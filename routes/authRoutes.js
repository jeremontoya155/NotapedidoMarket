const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Ruta de login
router.get('/', authController.getLogin);
router.post('/login', authController.postLogin);

// Ruta de administrador
router.get('/admin', authController.getAdmin);

// Ruta de comprador
router.get('/buyer', authController.getBuyer);

// Cerrar sesión
router.get('/logout', authController.logout);

module.exports = router;
