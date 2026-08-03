/* ============================================================
   Astro Tickets — models/entradaModel.js
   Acceso a datos de la tabla entradas: detalle para PDF, validación
   de QR y estado de uso.
   ============================================================ */

const { pool } = require("../config/database");

/**
 * Detalle completo de una entrada para generar el PDF:
 * entrada + evento + función + orden + comprador.
 * Se busca por el código único de la entrada (el que conoce el frontend).
 */
async function obtenerEntrada(codigo) {
  const sql = `
    SELECT
      en.id               AS entrada_id,
      en.codigo,
      en.qr_token,
      en.zona,
      en.precio,
      en.estado,
      en.usado_en,
      o.creada_en        AS comprada_en,
      o.id                AS orden_id,
      o.transaccion,
      o.codigo_reserva,
      o.subtotal,
      o.tarifa,
      o.total,
      u.id                AS usuario_id,
      u.nombre            AS comprador,
      u.email,
      e.id                AS evento_id,
      e.nombre            AS evento_nombre,
      e.categoria         AS evento_categoria,
      e.fecha             AS evento_fecha,
      e.hora              AS evento_hora,
      e.lugar             AS evento_lugar,
      f.id                AS funcion_id,
      f.estado            AS funcion_estado,
      f.sala              AS funcion_sala,
      a.asiento_id        AS asiento,
      a.fila              AS asiento_fila
    FROM entradas en
    JOIN ordenes o        ON o.id = en.orden_id
    LEFT JOIN usuarios u  ON u.id = o.usuario_id
    JOIN eventos e        ON e.id = en.evento_id
    JOIN funciones_evento f ON f.id = en.funcion_id
    LEFT JOIN asientos a  ON a.funcion_id = en.funcion_id AND a.asiento_id = en.asiento_id
    WHERE en.codigo = $1
  `;
  const { rows } = await pool.query(sql, [codigo]);
  return rows[0] || null;
}

/** Busca una entrada por su código QR. */
async function obtenerEntradaPorQr(qrToken) {
  const sql = `
    SELECT
      en.id,
      en.codigo,
      en.qr_token,
      en.zona,
      en.precio,
      en.estado,
      en.usado_en,
      en.orden_id,
      e.nombre AS evento_nombre,
      e.fecha  AS evento_fecha,
      e.hora   AS evento_hora,
      e.lugar  AS evento_lugar,
      f.id     AS funcion_id
    FROM entradas en
    JOIN eventos e ON e.id = en.evento_id
    JOIN funciones_evento f ON f.id = en.funcion_id
    WHERE en.qr_token = $1
  `;
  const { rows } = await pool.query(sql, [qrToken]);
  return rows[0] || null;
}

/** Marca una entrada como usada (validación de acceso). */
async function marcarUsada(entradaId) {
  const { rows } = await pool.query(
    `UPDATE entradas
     SET estado = 'usada', usado_en = now()
     WHERE id = $1 AND estado <> 'usada'
     RETURNING id, estado, usado_en`,
    [entradaId]
  );
  return rows[0] || null;
}

module.exports = { obtenerEntrada, obtenerEntradaPorQr, marcarUsada };
