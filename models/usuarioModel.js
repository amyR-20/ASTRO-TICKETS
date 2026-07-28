/* ============================================================
   Astro Tickets — models/usuarioModel.js
   Acceso a datos de la tabla "usuarios"
   ============================================================ */

const { query } = require("../config/database");

/**
 * Busca un usuario por su email. Incluye el password_hash porque esta
 * función se usa internamente para el login (comparar contraseñas).
 * NO exponer el resultado de esta función directamente al cliente.
 */
async function buscarPorEmail(email) {
  const sql = `
    SELECT id, nombre, email, password_hash, role, avatar, creado_en
    FROM usuarios
    WHERE email = $1
  `;
  const { rows } = await query(sql, [email]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const sql = `
    SELECT id, nombre, email, role, avatar, creado_en
    FROM usuarios
    WHERE id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
}

/**
 * Calcula las iniciales del nombre para usar como "avatar" de 2 letras,
 * igual que hacía el frontend en localStorage (auth.js -> createUser).
 */
function calcularIniciales(nombre) {
  return nombre
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Crea un usuario nuevo. Recibe el password ya hasheado (bcrypt),
 * nunca el texto plano, para mantener esa responsabilidad en el
 * controller/servicio de auth, no en el modelo.
 */
async function crear({ nombre, email, passwordHash, role = "user" }) {
  const avatar = calcularIniciales(nombre);
  const sql = `
    INSERT INTO usuarios (nombre, email, password_hash, role, avatar)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, nombre, email, role, avatar, creado_en
  `;
  const { rows } = await query(sql, [nombre, email, passwordHash, role, avatar]);
  return rows[0];
}

module.exports = {
  buscarPorEmail,
  buscarPorId,
  crear,
};
