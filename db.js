require('dotenv').config();  // Cargar las variables de entorno desde .env
const { Pool } = require('pg');
const mysql = require('mysql2/promise');  // Asegúrate de tener mysql2 para la conexión MySQL

// Configurar la conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Desactiva la verificación SSL para conexiones remotas
  }
});

// Configurar la conexión a MySQL para plexPool
const plexPool = mysql.createPool({
  host: process.env.PLEX_REPLICA_HOST,
  port: process.env.PLEX_REPLICA_PORT,
  user: process.env.PLEX_REPLICA_USER,
  password: process.env.PLEX_REPLICA_PASSWORD,
  database: process.env.PLEX_REPLICA_DATABASE,
});

module.exports = { pool, plexPool }; // Exporta ambos objetos para usarlos en otros módulos
