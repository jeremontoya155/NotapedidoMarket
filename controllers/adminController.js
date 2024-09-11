const pool = require('../db');
const path = require('path');
const PDFDocument = require('pdfkit');
const multer = require('multer');

// Configuración de Multer para manejar la subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Obtener todas las notas de pedido para la vista del admin
// Obtener todas las notas de pedido para la vista del admin
exports.getAdminDashboard = async (req, res) => {
  try {
    const proveedorSeleccionado = req.query.proveedor || '';

    // Consultar todos los proveedores
    const proveedoresResult = await pool.query('SELECT DISTINCT proveedor FROM nota_de_pedido');
    const proveedores = proveedoresResult.rows.map(row => row.proveedor);

    // Si hay un proveedor seleccionado, filtrar las notas de pedido por ese proveedor
    let query = `
      SELECT n.*, COUNT(i.id) as total_imagenes
      FROM nota_de_pedido n
      LEFT JOIN imagenes i ON n.id = i.nota_id
    `;
    const queryParams = [];

    if (proveedorSeleccionado) {
      query += ' WHERE proveedor = $1';
      queryParams.push(proveedorSeleccionado);
    }

    // Ordenar las notas de pedido por fecha, de más nuevo a más viejo
    query += ' GROUP BY n.id ORDER BY n.fecha_pedido DESC';

    // Consultar las notas de pedido con el filtro aplicado
    const result = await pool.query(query, queryParams);
    const notas = result.rows;

    // Renderizar la vista y pasar los datos
    res.render('admin', {
      notas,
      proveedores,
      proveedorSeleccionado // Enviar el proveedor seleccionado a la vista para mantener el filtro
    });
  } catch (error) {
    console.error('Error al obtener las notas de pedido:', error);
    res.status(500).send('Error al obtener las notas de pedido');
  }
};


// Obtener los detalles de la nota de pedido
exports.getNotaDetalles = async (req, res) => {
  const notaId = req.params.id;
  const presupuesto = req.query.presupuesto ? parseFloat(req.query.presupuesto) : 0;

  try {
    // Obtener la nota de pedido por ID
    const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

    // Obtener los detalles filtrados por presupuesto (si se ha proporcionado)
    const detalles = await pool.query(`
      SELECT * FROM detalle_nota WHERE nota_id = $1 AND imp_total >= $2 ORDER BY id ASC
    `, [notaId, presupuesto]);

    // Calcular el resumen (total de importe y unidades)
    const totalImporte = detalles.rows.reduce((sum, row) => sum + parseFloat(row.imp_total), 0);
    const totalUnidades = detalles.rows.reduce((sum, row) => sum + parseFloat(row.unidades), 0);

    // Ver si la nota está marcada como "actualizada" para permitir subir imagen
    const isActualizada = nota.rows[0].estado === 'actualizada';

    res.render('notaDetalles', {
      nota: nota.rows[0],
      detalles: detalles.rows,
      totalImporte,
      totalUnidades,
      presupuesto,
      isActualizada // Pasar el estado para mostrar el formulario de subir imagen si es necesario
    });
  } catch (error) {
    console.error('Error al obtener los detalles de la nota de pedido:', error);
    res.status(500).send('Error al obtener los detalles de la nota de pedido');
  }
};
// Función para generar PDF con todos los valores del encabezado
exports.generatePDF = async (req, res) => {
  const notaId = req.params.id;

  try {
    // Obtener la nota de pedido por ID
    const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

    // Obtener los detalles de la nota de pedido por ID de la nota
    const detalles = await pool.query('SELECT * FROM detalle_nota WHERE nota_id = $1', [notaId]);

    // Crear un documento PDF
    const doc = new PDFDocument();
    const filePath = path.join(__dirname, '../pdfs', `nota_${notaId}.pdf`);
    doc.pipe(res);

    // Título y cabecera
    doc.fontSize(20).text('Detalles de Nota de Pedido', { align: 'center' });
    doc.moveDown(2);

    // Información del encabezado
    doc.fontSize(12).text(`Laboratorio/Droguería: ${nota.rows[0].laboratorio}`);
    doc.text(`Fecha del Pedido: ${nota.rows[0].fecha_pedido}`);
    doc.text(`Proveedor: ${nota.rows[0].proveedor}`);
    doc.text(`Dirección: ${nota.rows[0].direccion}`);
    doc.text(`Fecha de Pago: ${nota.rows[0].fecha_pago}`);
    doc.text(`Condición: ${nota.rows[0].condicion}`);
    doc.text(`CUIT: ${nota.rows[0].cuit}`);
    doc.text(`CUIT Adicional: ${nota.rows[0].cuit_adicional}`);
    doc.text(`Compra: ${nota.rows[0].compra}`);
    doc.text(`Operador: ${nota.rows[0].operador}`);
    doc.text(`Importe: ${nota.rows[0].importe}`);
    doc.text(`Facturado Total: ${nota.rows[0].facturado_total}`);
    doc.text(`Unidades: ${nota.rows[0].unidades}`);
    doc.moveDown(2);

    // Añadir los detalles de la tabla
    doc.fontSize(12).text('Detalles de productos:');
    doc.moveDown(1);
    detalles.rows.forEach((detalle, index) => {
      doc.text(`${index + 1}. Producto: ${detalle.producto}, Cantidad: ${detalle.cantidad}, Importe Total: ${detalle.imp_total}`);
    });

    // Finalizar el PDF
    doc.end();
  } catch (error) {
    console.error('Error al generar el PDF:', error);
    res.status(500).send('Error al generar el PDF');
  }
};

exports.updateNotaEstado = async (req, res) => {
  const notaId = req.params.id;
  const nuevoEstado = req.body.estado;

  try {
    // Verificar si la nota tiene al menos una imagen cargada
    const imagenesResult = await pool.query('SELECT COUNT(*) as total FROM imagenes WHERE nota_id = $1', [notaId]);
    const tieneImagenes = parseInt(imagenesResult.rows[0].total) > 0;

    // Si no tiene imágenes y se intenta marcar como 'recibido', no permitir
    if (!tieneImagenes && nuevoEstado === 'recibido') {
      return res.redirect(`/admin?error=No se puede marcar como recibido sin imágenes&notaId=${notaId}`);
    }

    // Actualizar el estado de la nota solo si aún no está marcada como "recibido"
    const notaResult = await pool.query('SELECT estado FROM nota_de_pedido WHERE id = $1', [notaId]);
    const estadoActual = notaResult.rows[0].estado;

    if (estadoActual !== 'recibido') {
      await pool.query('UPDATE nota_de_pedido SET estado = $1 WHERE id = $2', [nuevoEstado, notaId]);
    }

    res.redirect('/admin');
  } catch (error) {
    console.error('Error al actualizar el estado de la nota:', error);
    res.status(500).send('Error al actualizar el estado de la nota');
  }
};


// Actualizar el estado de la nota de pedido
exports.updateNota = async (req, res) => {
  const notaId = req.params.id;
  const { estado } = req.body; // Recibimos el estado desde el formulario

  try {
    await pool.query('UPDATE nota_de_pedido SET estado = $1 WHERE id = $2', [estado, notaId]);
    res.redirect(`/admin/nota/${notaId}`);
  } catch (error) {
    console.error('Error al actualizar el estado de la nota de pedido:', error);
    res.status(500).send('Error al actualizar el estado de la nota de pedido');
  }
};

// Subir una imagen para la nota de pedido
exports.uploadImage = async (req, res) => {
  const notaId = req.params.id;
  const imagenPath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    // Verificar si la nota está en estado "actualizada"
    const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

    if (nota.rows[0].estado === 'actualizada' && imagenPath) {
      await pool.query('UPDATE nota_de_pedido SET imagen = $1 WHERE id = $2', [imagenPath, notaId]);
    }
    res.redirect(`/admin/nota/${notaId}`);
  } catch (error) {
    console.error('Error al subir la imagen:', error);
    res.status(500).send('Error al subir la imagen');
  }
};



// Ver la imagen de la nota de pedido
exports.viewImage = async (req, res) => {
  const notaId = req.params.id;

  try {
    const nota = await pool.query('SELECT imagen FROM nota_de_pedido WHERE id = $1', [notaId]);

    if (nota.rows[0].imagen) {
      res.render('notaImagen', { imagen: nota.rows[0].imagen });
    } else {
      res.status(404).send('No se encontró la imagen.');
    }
  } catch (error) {
    console.error('Error al obtener la imagen:', error);
    res.status(500).send('Error al obtener la imagen');
  }
};



// Función para mostrar imágenes de una nota de pedido
exports.getNotaImagenes = async (req, res) => {
  const notaId = req.params.id;

  try {
    // Obtener la nota de pedido
    const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

    // Obtener las imágenes de la nota
    const imagenes = await pool.query('SELECT * FROM imagenes WHERE nota_id = $1', [notaId]);

    res.render('imagenes', {
      nota: nota.rows[0],
      imagenes: imagenes.rows
    });
  } catch (error) {
    console.error('Error al obtener las imágenes de la nota:', error);
    res.status(500).send('Error al obtener las imágenes');
  }
};

// Función para subir una nueva imagen
exports.postNotaImagen = async (req, res) => {
  const notaId = req.params.id;
  const aclaracion = req.body.aclaracion || '';

  try {
    // Guardar la imagen en el sistema de archivos
    const file = req.file;
    const ruta = `/uploads/${file.filename}`;

    // Insertar la imagen en la base de datos
    await pool.query(`
      INSERT INTO imagenes (nota_id, ruta, aclaracion)
      VALUES ($1, $2, $3)
    `, [notaId, ruta, aclaracion]);

    res.redirect(`/admin/nota/${notaId}/imagenes`);
  } catch (error) {
    console.error('Error al subir la imagen:', error);
    res.status(500).send('Error al subir la imagen');
  }
};