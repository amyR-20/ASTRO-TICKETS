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
    SELECT id, username, nombre, email, password_hash, role, avatar, avatar_url, bio, estado, creado_en, idioma_pref, tema_pref
    FROM usuarios
    WHERE email = $1
  `;
  const { rows } = await query(sql, [email]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const sql = `
    SELECT id, username, nombre, email, role, avatar, avatar_url, bio, estado, ultimo_login, creado_en, updated_at, idioma_pref, tema_pref
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
async function buscarPorUsername(username) {
  const { rows } = await query(`SELECT id, username FROM usuarios WHERE lower(username)=lower($1)`, [username]);
  return rows[0] || null;
}

async function crear({ username, nombre, email, passwordHash, role = "user" }) {
  const avatar = calcularIniciales(nombre);
  const sql = `
    INSERT INTO usuarios (username, nombre, email, password_hash, role, avatar)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, username, nombre, email, role, avatar, estado, creado_en
  `;
  const { rows } = await query(sql, [username, nombre, email, passwordHash, role, avatar]);
  return rows[0];
}

/**
 * Registra un intento de acceso en accesos_usuarios (auditoría).
 * Nunca guarda contraseñas, hashes, tokens ni secretos.
 * Es "best-effort": si falla, no debe romper el flujo de login.
 */
async function registrarAcceso({ usuarioId, email, exitoso, metodo = "password", motivoFallo, ip, userAgent }) {
  const sql = `
    INSERT INTO accesos_usuarios (usuario_id, email_intentado, exitoso, metodo, motivo_fallo, ip, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;
  await query(sql, [
    usuarioId || null,
    email,
    exitoso,
    metodo,
    motivoFallo || null,
    ip || null,
    userAgent || null,
  ]);
}

/** Marca el último inicio de sesión del usuario. */
async function actualizarLogin(usuarioId) {
  const sql = `
    UPDATE usuarios SET ultimo_login = now(), updated_at = now() WHERE id = $1
  `;
  await query(sql, [usuarioId]);
}

/** Lista usuarios (panel admin). Sin datos sensibles. */
async function listar({ limite = 50 } = {}) {
  const sql = `
    SELECT id, username, nombre, email, role, avatar, estado, ultimo_login, creado_en
    FROM usuarios
    ORDER BY creado_en DESC
    LIMIT $1
  `;
  const { rows } = await query(sql, [Math.min(Number(limite) || 50, 500)]);
  return rows;
}

async function actualizarPerfil(id, { nombre, username, avatarUrl, bio }) {
  const avatar = calcularIniciales(nombre);
  const { rows } = await query(
    `UPDATE usuarios
        SET nombre=$2, username=$3, avatar=$4, avatar_url=$5, bio=$6, updated_at=now()
      WHERE id=$1
      RETURNING id, username, nombre, email, role, avatar, avatar_url, bio, estado, ultimo_login, creado_en, updated_at, idioma_pref, tema_pref`,
    [id, nombre, username, avatar, avatarUrl || null, bio || null]
  );
  return rows[0] || null;
}

/** Actualiza solo las preferencias (idioma/tema) del usuario. */
async function actualizarPreferencias(id, { idioma, tema }) {
  const { rows } = await query(
    `UPDATE usuarios
        SET idioma_pref = COALESCE($2, idioma_pref),
            tema_pref   = COALESCE($3, tema_pref),
            updated_at  = now()
      WHERE id = $1
      RETURNING id, username, nombre, email, role, avatar, avatar_url, bio, estado, ultimo_login, creado_en, updated_at, idioma_pref, tema_pref`,
    [id, idioma || null, tema || null]
  );
  return rows[0] || null;
}

module.exports = {
  buscarPorEmail,
  buscarPorUsername,
  buscarPorId,
  crear,
  registrarAcceso,
  actualizarLogin,
  listar,
  actualizarPerfil,
  actualizarPreferencias,
};
