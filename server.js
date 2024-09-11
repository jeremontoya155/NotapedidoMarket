require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pg = require('pg');
const app = express();
const port = process.env.PORT || 3000;

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
const authRoutes = require('./routes/authRoutes');
app.use('/', authRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
