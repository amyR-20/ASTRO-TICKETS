/* ============================================================
   Astro Tickets — seed.js
   Crea el usuario administrador inicial (contraseña: admin123)
   Uso: node seed.js
   ============================================================ */

require("dotenv").config();
const bcrypt = require("bcrypt");
const { pool } = require("./config/database");

async function seed() {
  const email = "admin@astro.com";
  const passwordPlano = "admin123";
  const passwordHash = await bcrypt.hash(passwordPlano, 10);

  const sql = `
    INSERT INTO usuarios (nombre, email, password_hash, role, avatar)
    VALUES ($1, $2, $3, 'admin', $4)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email
  `;

  const { rows } = await pool.query(sql, ["Administrador", email, passwordHash, "AD"]);

  if (rows.length) {
    console.log(`Usuario admin creado: ${email} / ${passwordPlano}`);
  } else {
    console.log("El usuario admin ya existía, no se hicieron cambios.");
  }

  await pool.end();
}

seed().catch((err) => {
  console.error("Error al crear el usuario admin:", err);
  process.exit(1);
});
