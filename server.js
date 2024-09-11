require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pg = require('pg');
const app = express();
const port = process.env.PORT || 3000;
const path = require('path');

// Sirve la carpeta 'uploads' de forma pública
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de la base de datos
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuración de sesiones
app.use(session({
  secret: 'mi_secreto', // Cambia esto a un secreto seguro
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }, // Cambiar a true en producción con HTTPS
}));

// Configuración de EJS y la carpeta de vistas
app.set('view engine', 'ejs');
app.set('views', './views');

// Archivos estáticos
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

// Rutas
const authRoutes = require('./routes/authRoutes'); // Rutas de autenticación
const compradorRoutes = require('./routes/compradorRoutes'); // Rutas del comprador
const adminRoutes = require('./routes/adminRoutes');
app.use('/', adminRoutes); // O cualquier prefijo como '/admin'
app.use('/', authRoutes);  // Rutas para autenticación
app.use('/', compradorRoutes);  // Rutas para compradores



// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});


