const pool = require('../db');
const path = require('path');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const fs = require('fs');
const xlsx = require('xlsx');

const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

// Función de logout para el administrador
exports.adminLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar la sesión del administrador:', err);
      return res.redirect('/admin'); // Si hay un error, redirigir al panel de admin
    }
    res.clearCookie('connect.sid'); // Limpiar la cookie de la sesión
    res.redirect('/login'); // Redirigir a la página de login
  });
};






exports.getAdminDashboard = async (req, res) => {
  try {
    // Si los filtros no están definidos en la sesión, inicializarlos
    if (!req.session.filtros) {
      req.session.filtros = {
        laboratorioSeleccionado: '', // Cambiado de proveedorSeleccionado a laboratorioSeleccionado
        estadoSeleccionado: '',
        operadorSeleccionado: '',
        fechaInicio: '',
        fechaFin: '',
        ordenFecha: 'desc'
      };
    }

    // Actualizar los filtros en la sesión si se han enviado nuevos parámetros
    req.session.filtros.laboratorioSeleccionado = (req.query.laboratorio === '') ? '' : req.query.laboratorio || req.session.filtros.laboratorioSeleccionado;
    req.session.filtros.estadoSeleccionado = req.query.estado || req.session.filtros.estadoSeleccionado;
    req.session.filtros.operadorSeleccionado = (req.query.operador === '') ? '' : req.query.operador || req.session.filtros.operadorSeleccionado;
    req.session.filtros.fechaInicio = req.query.fechaInicio || req.session.filtros.fechaInicio;
    req.session.filtros.fechaFin = req.query.fechaFin || req.session.filtros.fechaFin;
    req.session.filtros.ordenFecha = req.query.ordenFecha || req.session.filtros.ordenFecha;

    // Consultar todos los laboratorios y operadores
    const laboratoriosResult = await pool.query('SELECT DISTINCT laboratorio FROM nota_de_pedido ORDER BY laboratorio ASC');
    const laboratorios = laboratoriosResult.rows.map(row => row.laboratorio);
    
    // Obtener operadores ordenados alfabéticamente
    const operadoresResult = await pool.query('SELECT DISTINCT operador FROM nota_de_pedido ORDER BY operador ASC');
    const operadores = operadoresResult.rows.map(row => row.operador);

    // Construir la consulta SQL con los filtros aplicados
    let query = `
      SELECT n.*, COUNT(i.id) as total_imagenes
      FROM nota_de_pedido n
      LEFT JOIN imagenes i ON n.id = i.nota_id
    `;
    const queryParams = [];
    let conditionIndex = 1; // Contador para los parámetros

    if (req.session.filtros.laboratorioSeleccionado) {
      query += ` WHERE laboratorio = $${conditionIndex}`;
      queryParams.push(req.session.filtros.laboratorioSeleccionado);
      conditionIndex++;
    }

    if (req.session.filtros.estadoSeleccionado) {
      query += (queryParams.length > 0 ? ' AND' : ' WHERE') + ` n.estado = $${conditionIndex}`;
      queryParams.push(req.session.filtros.estadoSeleccionado);
      conditionIndex++;
    }

    if (req.session.filtros.operadorSeleccionado) {
      query += (queryParams.length > 0 ? ' AND' : ' WHERE') + ` operador = $${conditionIndex}`;
      queryParams.push(req.session.filtros.operadorSeleccionado);
      conditionIndex++;
    }

    if (req.session.filtros.fechaInicio) {
      query += (queryParams.length > 0 ? ' AND' : ' WHERE') + ` n.fecha_pedido >= $${conditionIndex}`;
      queryParams.push(new Date(req.session.filtros.fechaInicio).toISOString());
      conditionIndex++;
    }

    if (req.session.filtros.fechaFin) {
      query += (queryParams.length > 0 ? ' AND' : ' WHERE') + ` n.fecha_pedido <= $${conditionIndex}`;
      queryParams.push(new Date(req.session.filtros.fechaFin).toISOString());
      conditionIndex++;
    }

    query += ` GROUP BY n.id ORDER BY n.fecha_pedido ${req.session.filtros.ordenFecha}`;

    const result = await pool.query(query, queryParams);
    const notas = result.rows;

    // Renderizar la vista y pasar los datos
    res.render('admin', {
      notas,
      laboratorios, // Cambiado de 'proveedores' a 'laboratorios'
      operadores,
      laboratorioSeleccionado: req.session.filtros.laboratorioSeleccionado, // Cambio aquí
      estadoSeleccionado: req.session.filtros.estadoSeleccionado,
      operadorSeleccionado: req.session.filtros.operadorSeleccionado,
      fechaInicio: req.session.filtros.fechaInicio,
      fechaFin: req.session.filtros.fechaFin,
      ordenFecha: req.session.filtros.ordenFecha
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



// Función para generar PDF con todos los valores del encabezado
exports.generatePDF = async (req, res) => {
  const notaId = req.params.id;

  try {
    // Definir la ruta absoluta a la carpeta 'public'
    const publicDir = path.join(__dirname, '..', 'public'); // Corrección de ruta absoluta

    // Obtener la nota de pedido por ID
    const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

    // Obtener los detalles de la nota de pedido por ID de la nota
    const detalles = await pool.query('SELECT * FROM detalle_nota WHERE nota_id = $1 AND cantidad > 0 AND imp_total > 0', [notaId]);

    // Verificar que hay detalles para mostrar
    if (detalles.rows.length === 0) {
      return res.status(404).send('No se encontraron productos válidos en esta nota.');
    }

    // Crear un documento PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // Determinar el logo a utilizar en base al tipo de nota
    const tipoNota = req.query.tipo || 'super';
    const logoPath = tipoNota === 'farmacia'
      ? path.join(publicDir, 'img/Logo_Farmacia.png') // Ruta absoluta correcta
      : path.join(publicDir, 'img/Logo_Super.png');

    // Añadir el logo al PDF
    try {
      doc.image(logoPath, 50, 20, { width: 100 });
    } catch (error) {
      console.error('Error al cargar la imagen del logo:', error);
    }

    doc.moveDown(1);

    // Título y cabecera
    doc.fontSize(20).text('Detalles de Nota de Pedido', { align: 'center', underline: true });
    doc.moveDown(1);

    // Información del encabezado con columnas
    doc.fontSize(12).text(`Laboratorio/Droguería: ${nota.rows[0].laboratorio}`, { continued: true });
    doc.text(`Fecha del Pedido: ${new Date(nota.rows[0].fecha_pedido).toLocaleDateString()}`, { align: 'right' });

    doc.fontSize(12).text(`Proveedor: ${nota.rows[0].proveedor}`, { continued: true });
    doc.text(`Condición: ${nota.rows[0].condicion}`, { align: 'right' });

    doc.fontSize(12).text(`CUIT: ${nota.rows[0].cuit}`, { continued: true });
    doc.text(`CUIT Adicional: ${nota.rows[0].cuit_adicional}`, { align: 'right' });

    doc.fontSize(12).text(`Comprador: ${nota.rows[0].operador}`, { continued: true });
    doc.text(`Compra: ${nota.rows[0].compra}`, { align: 'right' });

    doc.moveDown(2);

    // Añadir detalles de productos con formato de tabla
    doc.fontSize(14).text('Detalles de productos', { underline: true });
    doc.moveDown(1);

    const tableTop = doc.y;
    const itemWidth = 200;
    const cantidadWidth = 100;
    const totalWidth = 150;

    doc.fontSize(12)
      .text('Producto', 50, tableTop)
      .text('Cantidad', 50 + itemWidth, tableTop)
      .text('Importe Total', 50 + itemWidth + cantidadWidth, tableTop);

    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

    const maxRowsPerPage = 20;
    let position = tableTop + 30;
    let rowIndex = 0;

    detalles.rows.forEach((detalle) => {
      if (rowIndex >= maxRowsPerPage) {
        doc.addPage();
        position = 50;
        rowIndex = 0;
      }

      const y = position + (rowIndex * 20);
      const impTotal = parseFloat(detalle.imp_total).toFixed(2);
      const cantidad = parseFloat(detalle.cantidad).toFixed(2);

      const textOptions = { width: 200, height: 40, align: 'left' };
      const productText = detalle.producto || 'N/A';

      const fontSize = productText.length > 30 ? 8 : 10;
      doc.fontSize(fontSize)
        .text(productText, 50, y, textOptions)
        .text(cantidad, 50 + itemWidth, y)
        .text(impTotal, 50 + itemWidth + cantidadWidth, y);

      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();

      rowIndex++;
    });

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
// Subir una imagen para la nota de pedido usando Cloudinary
// Subir una imagen para la nota de pedido usando Cloudinary
exports.uploadImage = async (req, res) => {
  const notaId = req.params.id;
  try {
    if (req.file) {
      // Subir la imagen a Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'notas_pedido', // Carpeta en Cloudinary
      });

      const imagenPath = result.secure_url; // URL segura de la imagen

      // Verificar si la nota está en estado "actualizada"
      const nota = await pool.query('SELECT * FROM nota_de_pedido WHERE id = $1', [notaId]);

      if (nota.rows[0].estado === 'actualizada') {
        await pool.query('UPDATE nota_de_pedido SET imagen = $1 WHERE id = $2', [imagenPath, notaId]);
      }

      // Eliminar el archivo local después de subir a Cloudinary
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Error al eliminar el archivo local:', err);
        }
      });
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
// Función para subir una nueva imagen a Cloudinary
// Función para subir una nueva imagen a Cloudinary
exports.postNotaImagen = async (req, res) => {
  const notaId = req.params.id;
  const aclaracion = req.body.aclaracion || '';

  try {
    if (req.file) {
      // Subir la imagen a Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'notas_pedido',
      });

      const ruta = result.secure_url; // URL de la imagen en Cloudinary

      // Insertar la imagen en la base de datos
      await pool.query(`
        INSERT INTO imagenes (nota_id, ruta, aclaracion)
        VALUES ($1, $2, $3)
      `, [notaId, ruta, aclaracion]);

      // Eliminar el archivo local después de subir a Cloudinary
      fs.unlink(req.file.path, (err) => {
        if (err) {
          console.error('Error al eliminar el archivo local:', err);
        }
      });

      res.redirect(`/admin/nota/${notaId}/imagenes`);
    }
  } catch (error) {
    console.error('Error al subir la imagen:', error);
    res.status(500).send('Error al subir la imagen');
  }
};


// Eliminar una imagen de la nota de pedido
exports.deleteNotaImagen = async (req, res) => {
  const notaId = req.params.id;
  const imagenId = req.params.imagenId;

  try {
    // Obtener la imagen de la base de datos para obtener la ruta de Cloudinary
    const imagenResult = await pool.query('SELECT ruta FROM imagenes WHERE id = $1', [imagenId]);
    if (imagenResult.rows.length === 0) {
      return res.status(404).send('Imagen no encontrada');
    }

    const imagenRuta = imagenResult.rows[0].ruta;

    // Extraer el public_id de Cloudinary a partir de la URL de la imagen
    const publicId = imagenRuta.split('/').pop().split('.')[0];

    // Eliminar la imagen de Cloudinary
    await cloudinary.uploader.destroy(`notas_pedido/${publicId}`, (error, result) => {
      if (error) {
        console.error('Error al eliminar la imagen de Cloudinary:', error);
      }
    });

    // Eliminar la imagen de la base de datos
    await pool.query('DELETE FROM imagenes WHERE id = $1', [imagenId]);

    // Redirigir a la página de imágenes
    res.redirect(`/admin/nota/${notaId}/imagenes`);
  } catch (error) {
    console.error('Error al eliminar la imagen:', error);
    res.status(500).send('Error al eliminar la imagen');
  }
};


exports.showCargarPage = (req, res) => {
  res.render('cargar'); // Asegúrate que 'cargar.ejs' esté en la carpeta 'views'

};

exports.showNuevaVista = (req, res) => {
  res.render('nueva'); // Asegúrate de que 'nuevaVista.ejs' esté en la carpeta 'views'
};


// Función para eliminar solo archivos antiguos con extensión .xlsx o .xls
function eliminarArchivosAntiguos() {
  const uploadsDir = path.join(__dirname, '../uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('Error leyendo la carpeta uploads:', err);
      return;
    }
    files.forEach((file) => {
      if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
        const filePath = path.join(uploadsDir, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Error al eliminar archivo:', err);
          } else {
            console.log(`Archivo eliminado: ${filePath}`);
          }
        });
      }
    });
  });
}

// Procesar el archivo Excel subido (similar a la función en buyer)
exports.processExcel = async (req, res) => {
  try {
    // Eliminar archivos antiguos antes de subir el nuevo
    eliminarArchivosAntiguos();

    // Continuar con el procesamiento del nuevo archivo
    const filePath = path.join(__dirname, '../uploads', req.file.filename);
    const workbook = xlsx.readFile(filePath);
    const sheetName = 'NOTA DE PEDIDO';
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Separar encabezado (filas 0-9) y productos (desde la fila 10)
    const encabezado = data.slice(0, 10); 
    const productos = data.slice(10); 

    if (!encabezado[1] || encabezado[1].length < 7) {
      return res.status(400).send('El formato del archivo es incorrecto. No se encontró la columna esperada en el encabezado.');
    }

    let totalImporte = 0;
    let totalUnidades = 0;
    productos.forEach((producto) => {
      const cantidad = isValidNumber(producto[0]) ? parseFloat(producto[0]) : 0;
      const importe = isValidNumber(producto[10]) ? parseFloat(producto[10]) : 0;
      totalUnidades += cantidad;
      totalImporte += importe;
    });

    const fechaActual = new Date();

    let notaDePedidoValues = {
      laboratorio: encabezado[1][6] || null,
      fecha_pedido: fechaActual,
      proveedor: encabezado[2][6] || null,
      direccion: encabezado[3][6] || null,
      fecha_pago: isValidDate(req.body.fecha_pago) ? new Date(req.body.fecha_pago) : null,
      condicion: encabezado[4][10] || null,
      cuit: encabezado[5][1] || null,
      cuit_adicional: encabezado[5][4] || null,
      compra: encabezado[5][10] || null,
      operador: encabezado[6][1] || null,
      importe: isValidNumber(encabezado[6][6]) ? parseFloat(encabezado[6][6]) : totalImporte,
      facturado_total: isValidNumber(encabezado[6][9]) ? parseFloat(encabezado[6][9]) : totalImporte,
      unidades: isValidNumber(encabezado[7][6]) ? parseInt(encabezado[7][6]) : totalUnidades
    };

    const result = await pool.query(`
      INSERT INTO nota_de_pedido (laboratorio, fecha_pedido, proveedor, direccion, fecha_pago, condicion, cuit, cuit_adicional, compra, operador, importe, facturado_total, unidades)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, Object.values(notaDePedidoValues));

    const notaId = result.rows[0].id; 

    for (let i = 0; i < productos.length; i++) {
      if (isValidNumber(productos[i][0]) && productos[i][0] !== 'Id Quantio' && productos[i][0] > 0) {
        await pool.query(`
          INSERT INTO detalle_nota (nota_id, cantidad, medida_kg, id_quantio, codebar, producto, unidades, costo, drog, costo_final, imp_total)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          notaId,
          isValidNumber(productos[i][0]) ? parseFloat(productos[i][0]) : null,
          isValidNumber(productos[i][1]) ? parseFloat(productos[i][1]) : null,
          productos[i][2] || null,
          productos[i][3] || null,
          productos[i][4] || null,
          isValidNumber(productos[i][5]) ? parseInt(productos[i][5]) : null,
          isValidNumber(productos[i][6]) ? parseFloat(productos[i][6]) : null,
          isValidNumber(productos[i][7]) ? parseFloat(productos[i][7]) : null,
          isValidNumber(productos[i][9]) ? parseFloat(productos[i][9]) : null,
          isValidNumber(productos[i][10]) ? parseFloat(productos[i][10]) : null
        ]);
      }
    }



    res.redirect('/admin?success=true');
  } catch (error) {
    console.error('Error al procesar el archivo:', error);
    res.status(500).send('Error al procesar el archivo');
  }
};



// Funciones auxiliares
function isValidNumber(value) {
  return !isNaN(value) && value !== null && value !== '';
}

/*Cambios*/ 

function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}


