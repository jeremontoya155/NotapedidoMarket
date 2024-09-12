const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const pool = require('../db');

// Mostrar el formulario de subida en la vista del comprador
exports.showBuyerDashboard = (req, res) => {
  res.render('buyer');
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
      // Eliminar solo los archivos .xlsx o .xls
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

// Procesar el archivo Excel subido
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

    // Calcular importe y unidades si no están presentes
    let totalImporte = 0;
    let totalUnidades = 0;
    productos.forEach((producto) => {
      const cantidad = isValidNumber(producto[0]) ? parseFloat(producto[0]) : 0;
      const importe = isValidNumber(producto[10]) ? parseFloat(producto[10]) : 0;
      totalUnidades += cantidad;
      totalImporte += importe;
    });

    // Generar la fecha actual como la fecha del pedido
    const fechaActual = new Date();

    // Extraer los valores del encabezado y manejar la fecha de pago como opcional
    let notaDePedidoValues = {
      laboratorio: encabezado[1][6] || null,
      fecha_pedido: fechaActual,  // Usar la fecha y hora actuales
      // fecha_entrega: encavezado[3][10] || null,
      proveedor: encabezado[2][6] || null,
      direccion: encabezado[3][6] || null,
      fecha_pago: isValidDate(req.body.fecha_pago) ? new Date(req.body.fecha_pago) : null,  // Manejo opcional de la fecha
      condicion: encabezado[4][10] || null,
      cuit: encabezado[5][1] || null,
      cuit_adicional: encabezado[5][4] || null,
      compra: encabezado[5][10] || null,
      operador: encabezado[6][1] || null,
      importe: isValidNumber(encabezado[6][6]) ? parseFloat(encabezado[6][6]) : totalImporte,  
      facturado_total: isValidNumber(encabezado[6][9]) ? parseFloat(encabezado[6][9]) : totalImporte,
      unidades: isValidNumber(encabezado[7][6]) ? parseInt(encabezado[7][6]) : totalUnidades
    };

    // Insertar los datos del encabezado en la tabla nota_de_pedido
    const result = await pool.query(`
      INSERT INTO nota_de_pedido (laboratorio, fecha_pedido, proveedor, direccion, fecha_pago, condicion, cuit, cuit_adicional, compra, operador, importe, facturado_total, unidades)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, Object.values(notaDePedidoValues));

    const notaId = result.rows[0].id; 

    // Procesar los detalles de la nota
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

    // Redirigir con éxito
    res.redirect('/buyer?success=true');
  } catch (error) {
    console.error('Error al procesar el archivo:', error);
    res.status(500).send('Error al procesar el archivo');
  }
};

// Función de logout para el comprador
exports.buyerLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error al cerrar la sesión del comprador:', err);
      return res.redirect('/buyer'); // Si hay un error, redirigir al panel de comprador
    }
    res.clearCookie('connect.sid'); // Limpiar la cookie de la sesión
    res.redirect('/login'); // Redirigir a la página de login
  });
};


// Función para validar si un valor es numérico
function isValidNumber(value) {
  return !isNaN(value) && value !== null && value !== '';
}

// Función para validar si el valor es una fecha válida
function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime()); // Si no es una fecha válida, devolver false
}
