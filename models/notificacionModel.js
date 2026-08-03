/* ============================================================
   Astro Tickets — models/notificacionModel.js
   Notificaciones por usuario (compra, evento, reembolso, alerta).
   ============================================================ */

const { pool } = require("../config/database");

async function crear({ usuarioId, titulo, mensaje, tipo }) {
  if (!usuarioId) return null;
  const { rows } = await pool.query(
    `INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [usuarioId, titulo, mensaje || null, tipo || "info"]
  );
  return rows[0];
}

async function listarPorUsuario(usuarioId, limite = 30) {
  const { rows } = await pool.query(
    `SELECT id, titulo, mensaje, tipo, leida, creado_en
     FROM notificaciones
     WHERE usuario_id = $1
     ORDER BY creado_en DESC
     LIMIT $2`,
    [usuarioId, limite]
  );
  return rows;
}

async function contarNoLeidas(usuarioId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM notificaciones
     WHERE usuario_id = $1 AND leida = false`,
    [usuarioId]
  );
  return rows[0].total;
}

async function marcarLeidas(usuarioId) {
  await pool.query(
    `UPDATE notificaciones SET leida = true
     WHERE usuario_id = $1 AND leida = false`,
    [usuarioId]
  );
}

module.exports = { crear, listarPorUsuario, contarNoLeidas, marcarLeidas };
