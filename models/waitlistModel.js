/* ============================================================
   Astro Tickets — models/waitlistModel.js
   Lista de espera: el usuario se apunta para que le avisen
   cuando vuelva a haber boletos en una función agotada.
   ============================================================ */

const { query } = require("../config/database");

async function unirse(usuarioId, funcionId) {
  const { rows } = await query(
    `INSERT INTO lista_espera (usuario_id, funcion_id)
     VALUES ($1, $2)
     ON CONFLICT (usuario_id, funcion_id)
     DO UPDATE SET notificado = false
     RETURNING *`,
    [usuarioId, funcionId]
  );
  return rows[0];
}

async function estado(usuarioId, funcionId) {
  const { rows } = await query(
    `SELECT 1 FROM lista_espera WHERE usuario_id = $1 AND funcion_id = $2`,
    [usuarioId, funcionId]
  );
  return rows.length > 0;
}

async function retirarse(usuarioId, funcionId) {
  await query(
    `DELETE FROM lista_espera WHERE usuario_id = $1 AND funcion_id = $2`,
    [usuarioId, funcionId]
  );
}

module.exports = { unirse, estado, retirarse };
