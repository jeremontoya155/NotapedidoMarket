require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pg = require('pg');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

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

// Middleware para verificar si el usuario está autenticado
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) { // Asegúrate de que la sesión y el usuario existan
    return next(); // Si el usuario está autenticado, continuar
  }
  res.redirect('/login'); // Si no está autenticado, redirigir al login
}

// Middleware para verificar si es administrador
function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next(); // Si el usuario es administrador, continuar
  }
  res.redirect('/login'); // Si no es administrador, redirigir al login
}

// Rutas
const authRoutes = require('./routes/authRoutes'); // Rutas de autenticación
const compradorRoutes = require('./routes/compradorRoutes'); // Rutas del comprador
const adminRoutes = require('./routes/adminRoutes');

// Rutas de administración protegidas por autenticación y rol de admin
app.use('/admin', isAuthenticated, isAdmin, adminRoutes);

// Rutas para autenticación y compradores
app.use('/', authRoutes);
app.use('/', compradorRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
