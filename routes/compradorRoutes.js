const express = require('express');
const router = express.Router();
const compradorController = require('../controllers/compradorController');
const multer = require('multer');

// Configuración de Multer para manejar la subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Ruta para mostrar el formulario de subida
router.get('/buyer', compradorController.showBuyerDashboard);

// Verifica que la función compradorController.processExcel esté definida correctamente
router.post('/buyer/upload', upload.single('file'), compradorController.processExcel);

// Ruta para el logout del comprador
router.get('/buyer/logout', compradorController.buyerLogout);


module.exports = router;
