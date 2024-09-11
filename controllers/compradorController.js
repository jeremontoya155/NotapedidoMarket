const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const pool = require('../db');

// Mostrar el formulario de subida en la vista del comprador
exports.showBuyerDashboard = (req, res) => {
  res.render('buyer');
};

// Función para eliminar archivos antiguos
function eliminarArchivosAntiguos() {
  const uploadsDir = path.join(__dirname, '../uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('Error leyendo la carpeta uploads:', err);
      return;
    }
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Error al eliminar archivo:', err);
        } else {
          console.log(`Archivo eliminado: ${filePath}`);
        }
      });
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
    const encabezado = data.slice(0, 10); // Las primeras 10 filas para el encabezado
    const productos = data.slice(10); // Desde la fila 10 en adelante para los productos

    // Calcular importe y unidades si no están presentes
    let totalImporte = 0;
    let totalUnidades = 0;
    productos.forEach((producto) => {
      const cantidad = isValidNumber(producto[0]) ? parseFloat(producto[0]) : 0;
      const importe = isValidNumber(producto[10]) ? parseFloat(producto[10]) : 0;
      totalUnidades += cantidad;
      totalImporte += importe;
    });

    // Extraer los valores del encabezado
    let notaDePedidoValues = {
      laboratorio: encabezado[1][6] || null,
      fecha_pedido: isValidDate(encabezado[1][10]) ? new Date(encabezado[1][10]) : null,
      proveedor: encabezado[2][6] || null,
      direccion: encabezado[3][6] || null,
      fecha_pago: isValidDate(encabezado[3][10]) ? new Date(encabezado[3][10]) : null,
      condicion: encabezado[4][10] || null,
      cuit: encabezado[5][1] || null,
      cuit_adicional: encabezado[5][4] || null,
      compra: encabezado[5][10] || null,
      operador: encabezado[6][1] || null,
      importe: isValidNumber(encabezado[6][6]) ? parseFloat(encabezado[6][6]) : totalImporte,  // Usar el valor calculado si no está presente
      facturado_total: isValidNumber(encabezado[6][9]) ? parseFloat(encabezado[6][9]) : totalImporte,  // Usar el valor calculado
      unidades: isValidNumber(encabezado[7][6]) ? parseInt(encabezado[7][6]) : totalUnidades  // Usar el valor calculado si no está presente
    };

    // Insertar los datos del encabezado en la tabla nota_de_pedido
    const result = await pool.query(`
      INSERT INTO nota_de_pedido (laboratorio, fecha_pedido, proveedor, direccion, fecha_pago, condicion, cuit, cuit_adicional, compra, operador, importe, facturado_total, unidades)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, Object.values(notaDePedidoValues));

    const notaId = result.rows[0].id;  // ID de la nota insertada

    // Procesar los detalles de la nota (productos) a partir de la fila 10 en adelante
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

    res.send('Nota de pedido y detalles subidos con éxito');
  } catch (error) {
    console.error('Error al procesar el archivo:', error);
    res.status(500).send('Error al procesar el archivo');
  }
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
