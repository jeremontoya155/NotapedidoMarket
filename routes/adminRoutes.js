const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Ruta para la vista del admin que muestra todas las notas de pedido
router.get('/admin', adminController.getAdminDashboard);

// Ruta para ver los detalles de una nota de pedido
router.get('/admin/nota/:id', adminController.getNotaDetalles);
// Ruta para descargar el PDF de la nota
router.get('/admin/nota/:id/pdf', adminController.generatePDF);

module.exports = router;
