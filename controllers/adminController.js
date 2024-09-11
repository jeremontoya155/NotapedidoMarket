const pool = require('../db');
const path = require('path');
const PDFDocument = require('pdfkit');
// Obtener las notas de pedido
// Obtener todas las notas de pedido para la vista del admin
// Obtener todas las notas de pedido para la vista del admin, con filtro por proveedor
exports.getAdminDashboard = async (req, res) => {
  try {
    const proveedorSeleccionado = req.query.proveedor || '';

    // Consultar todos los proveedores
    const proveedoresResult = await pool.query('SELECT DISTINCT proveedor FROM nota_de_pedido order_by ');
    const proveedores = proveedoresResult.rows.map(row => row.proveedor);

    // Si hay un proveedor seleccionado, filtrar las notas de pedido por ese proveedor
    let query = 'SELECT * FROM nota_de_pedido';
    const queryParams = [];

    if (proveedorSeleccionado) {
      query += ' WHERE proveedor = $1';
      queryParams.push(proveedorSeleccionado);
    }
    // Ordenar las notas de pedido por fecha, de más nuevo a más viejo
    query += ' ORDER BY fecha_pedido DESC';

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