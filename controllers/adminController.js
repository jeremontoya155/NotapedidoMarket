const pool = require('../db');
const path = require('path');
const PDFDocument = require('pdfkit');
// Obtener las notas de pedido
// Obtener todas las notas de pedido para la vista del admin
// Obtener todas las notas de pedido para la vista del admin, con filtro por proveedor
exports.getAdminDashboard = async (req, res) => {
  try {
    const proveedorSeleccionado = req.query.proveedor || ''; // Obtener proveedor desde la query
    let query = 'SELECT * FROM nota_de_pedido';
    const params = [];

    // Si se selecciona un proveedor, agregar la condición al query
    if (proveedorSeleccionado) {
      query += ' WHERE proveedor = $1';
      params.push(proveedorSeleccionado);
    }

    // Consultar las notas de pedido con el filtro de proveedor
    const result = await pool.query(query, params);
    const notas = result.rows;

    // Consultar todos los proveedores para el filtro
    const proveedoresResult = await pool.query('SELECT DISTINCT proveedor FROM nota_de_pedido');
    const proveedores = proveedoresResult.rows.map(row => row.proveedor);

    // Renderizar la vista y pasar las notas y los proveedores
    res.render('admin', {
      notas,
      proveedores,
      proveedorSeleccionado
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
  
      res.render('notaDetalles', {
        nota: nota.rows[0],
        detalles: detalles.rows,
        totalImporte,
        totalUnidades,
        presupuesto
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