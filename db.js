require('dotenv').config();  // Cargar las variables de entorno desde .env
const { Pool } = require('pg');

// Configurar la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Desactiva la verificación SSL para conexiones remotas
  }
});

// Exportar el pool para usarlo en otros módulos
module.exports = pool;
