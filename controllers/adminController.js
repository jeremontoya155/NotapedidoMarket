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

exports.getAdminDashboard = async (req, res) => {
  try {
    const proveedorSeleccionado = req.query.proveedor || '';
    const estadoSeleccionado = req.query.estado || '';
    const operadorSeleccionado = req.query.operador || '';
    const ordenFecha = req.query.ordenFecha || 'desc'; // Valor predeterminado: de más nuevo a más viejo

    // Consultar todos los proveedores y operadores
    const proveedoresResult = await pool.query('SELECT DISTINCT proveedor FROM nota_de_pedido');
    const proveedores = proveedoresResult.rows.map(row => row.proveedor);

    const operadoresResult = await pool.query('SELECT DISTINCT operador FROM nota_de_pedido');
    const operadores = operadoresResult.rows.map(row => row.operador);

    // Construir la consulta SQL con los filtros aplicados
    let query = `
      SELECT n.*, COUNT(i.id) as total_imagenes
      FROM nota_de_pedido n
      LEFT JOIN imagenes i ON n.id = i.nota_id
    `;
    const queryParams = [];

    // Filtrar por proveedor si está seleccionado
    if (proveedorSeleccionado) {
      query += ' WHERE proveedor = $1';
      queryParams.push(proveedorSeleccionado);
    }

    // Filtrar por estado si está seleccionado
    if (estadoSeleccionado) {
      if (queryParams.length > 0) {
        query += ' AND n.estado = $2';
      } else {
        query += ' WHERE n.estado = $1';
      }
      queryParams.push(estadoSeleccionado);
    }

    // Filtrar por operador si está seleccionado
    if (operadorSeleccionado) {
      if (queryParams.length > 0) {
        query += ` AND operador = $${queryParams.length + 1}`;
      } else {
        query += ' WHERE operador = $1';
      }
      queryParams.push(operadorSeleccionado);
    }

    // Aplicar el orden por fecha según el valor recibido en el filtro
    query += ` GROUP BY n.id ORDER BY n.fecha_pedido ${ordenFecha}`;

    const result = await pool.query(query, queryParams);
    const notas = result.rows;

    // Renderizar la vista y pasar los datos
    res.render('admin', {
      notas,
      proveedores,
      operadores, // Agregamos los operadores para pasarlos a la vista
      proveedorSeleccionado,
      estadoSeleccionado,
      operadorSeleccionado, // Enviamos el operador seleccionado a la vista
      ordenFecha // Enviar el valor de ordenFecha a la vista
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

    // Calcular el resumen (total de importe y cantidad)
    const totalImporte = detalles.rows.reduce((sum, row) => sum + parseFloat(row.imp_total), 0);
    const totalUnidades = detalles.rows.reduce((sum, row) => sum + parseFloat(row.cantidad), 0); // Asegúrate que la columna sea "cantidad"

    // Ver si la nota está marcada como "actualizada" para permitir subir imagen
    const isActualizada = nota.rows[0].estado === 'actualizada';

    // Renderizar la vista con los datos calculados
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
// Función para generar PDF con espacio para firmas
exports.generatePDF = async (req, res) => {
  const notaId = req.params.id;

  try {
    // Obtener la nota de pedido por ID
    const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

    // Obtener los detalles de la nota de pedido por ID de la nota
    const detalles = await pool.query('SELECT * FROM detalle_nota WHERE nota_id = $1', [notaId]);

    // Crear un documento PDF
    const doc = new PDFDocument({ margin: 50 });
    const filePath = path.join(__dirname, '../pdfs', `nota_${notaId}.pdf`);
    doc.pipe(res);

    // Título y cabecera
    doc.fontSize(20).text('Detalles de Nota de Pedido', { align: 'center', underline: true });
    doc.moveDown(1);

    // Información del encabezado con columnas
    doc.fontSize(12).text(`Laboratorio/Droguería: ${nota.rows[0].laboratorio}`, { continued: true });
    doc.text(`Fecha del Pedido: ${new Date(nota.rows[0].fecha_pedido).toLocaleDateString()}`, { align: 'right' });

    doc.fontSize(12).text(`Proveedor: ${nota.rows[0].proveedor}`, { continued: true });
    doc.text(`Condición: ${nota.rows[0].condicion}`, { align: 'right' });

    doc.fontSize(12).text(`Dirección: ${nota.rows[0].direccion}`, { continued: true });
    doc.text(`Fecha de Pago: ${new Date(nota.rows[0].fecha_pago).toLocaleDateString()}`, { align: 'right' });

    doc.fontSize(12).text(`CUIT: ${nota.rows[0].cuit}`, { continued: true });
    doc.text(`CUIT Adicional: ${nota.rows[0].cuit_adicional}`, { align: 'right' });

    doc.fontSize(12).text(`Operador: ${nota.rows[0].operador}`, { continued: true });
    doc.text(`Compra: ${nota.rows[0].compra}`, { align: 'right' });

    doc.moveDown(2);

    // Añadir detalles de productos con formato de tabla
    doc.fontSize(14).text('Detalles de productos', { underline: true });
    doc.moveDown(1);

    // Encabezado de la tabla
    const tableTop = doc.y;
    const itemWidth = 200;
    const cantidadWidth = 100;
    const totalWidth = 150;

    doc.fontSize(12)
      .text('Producto', 50, tableTop)
      .text('Cantidad', 50 + itemWidth, tableTop)
      .text('Importe Total', 50 + itemWidth + cantidadWidth, tableTop);

    // Línea separadora
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

    // Renderizado de cada detalle de la nota
    let position = tableTop + 30;
    detalles.rows.forEach((detalle, index) => {
      const y = position + (index * 20);
      doc.fontSize(10)
        .text(detalle.producto, 50, y)
        .text(detalle.cantidad, 50 + itemWidth, y)
        .text(detalle.imp_total, 50 + itemWidth + cantidadWidth, y);
    });

    // Resumen final de la nota
    doc.moveDown(2);
    const totalImporte = detalles.rows.reduce((sum, row) => sum + parseFloat(row.imp_total), 0);
    const totalUnidades = detalles.rows.reduce((sum, row) => sum + parseFloat(row.cantidad), 0);

    doc.fontSize(12).text(`Total de Importe: $${totalImporte.toFixed(2)}`, { align: 'right' });
    doc.fontSize(12).text(`Total de Unidades: ${totalUnidades}`, { align: 'right' });

    doc.moveDown(3);

    // Espacio para la firma
    doc.moveDown(5);
    doc.fontSize(12).text('_____________________________', 50, doc.y, { align: 'center' });
    doc.fontSize(12).text('Firma', 50, doc.y + 5, { align: 'center' });

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