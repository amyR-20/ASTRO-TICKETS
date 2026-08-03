/* ============================================================
   Astro Tickets — config/database.js
   Pool de conexiones a PostgreSQL (librería "pg")
   ============================================================ */

require("dotenv").config();
const { Pool } = require("pg");

// Si existe DATABASE_URL, se usa esa (recomendado para producción /
// servicios como Render, Railway, Supabase). Si no, arma la conexión
// con variables sueltas (útil para desarrollo local).
// Se configura max, timeouts y maxUses para no colgar las peticiones
// cuando el pool se agota o una conexión se vuelve inservible.
const poolOptions = {
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
};

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ...poolOptions,
      // Descomenta esto si tu proveedor exige SSL (Render, Supabase, etc.)
      // ssl: { rejectUnauthorized: false },
      ...(process.env.PG_SSL === "true" ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ...poolOptions,
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
