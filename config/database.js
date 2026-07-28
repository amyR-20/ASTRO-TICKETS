/* ============================================================
   Astro Tickets — config/database.js
   Pool de conexiones a PostgreSQL (librería "pg")
   ============================================================ */

require("dotenv").config();
const { Pool } = require("pg");

// Si existe DATABASE_URL, se usa esa (recomendado para producción /
// servicios como Render, Railway, Supabase). Si no, arma la conexión
// con variables sueltas (útil para desarrollo local).
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Descomenta esto si tu proveedor exige SSL (Render, Supabase, etc.)
      // ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

// Pequeña utilidad para loguear cada query en desarrollo (opcional pero
// ayuda mucho a depurar). Se puede quitar si molesta.
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    console.log("SQL ejecutado", { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = { pool, query };
