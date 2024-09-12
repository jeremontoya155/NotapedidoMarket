const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
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

// Middleware para verificar autenticación y rol de admin
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

// Ruta para el logout del admin
router.get('/admin/logout', adminController.adminLogout);

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.redirect('/login');
}

// Ruta para la vista del admin que muestra todas las notas de pedido
router.get('/admin', isAuthenticated, isAdmin, adminController.getAdminDashboard);

// Ruta para ver los detalles de una nota de pedido
router.get('/admin/nota/:id', isAuthenticated, isAdmin, adminController.getNotaDetalles);

// Ruta para descargar el PDF de la nota
router.get('/admin/nota/:id/pdf', isAuthenticated, isAdmin, adminController.generatePDF);

// Ruta para subir una imagen (solo si la nota está actualizada)
router.post('/admin/nota/:id/upload-image', isAuthenticated, isAdmin, upload.single('imagen'), adminController.uploadImage);

// Ruta para ver la imagen de una nota de pedido
router.get('/admin/nota/:id/view-image', isAuthenticated, isAdmin, adminController.viewImage);

// Ruta para actualizar el estado de la nota
router.post('/admin/nota/:id/estado', isAuthenticated, isAdmin, adminController.updateNotaEstado);

// Ruta para ver las imágenes de una nota de pedido
router.get('/admin/nota/:id/imagenes', isAuthenticated, isAdmin, adminController.getNotaImagenes);

// Ruta para subir una nueva imagen
router.post('/admin/nota/:id/imagenes', isAuthenticated, isAdmin, upload.single('imagen'), adminController.postNotaImagen);

module.exports = router;
