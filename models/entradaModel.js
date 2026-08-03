/* ============================================================
   Astro Tickets — models/entradaModel.js
   Acceso a datos de la tabla entradas: detalle para PDF, validación
   de QR y estado de uso.
   ============================================================ */

const { pool } = require("../config/database");
const crypto = require("crypto");

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

/**
 * Transfiere una entrada a otra persona por su correo.
 * Si el destinatario es usuario registrado, la transferencia se
 * completa de inmediato y la entrada queda asociada a su cuenta
 * (entradas.transferida_a_id). En caso contrario queda 'pendiente'.
 */
async function transferir(codigo, { emailDestino, usuarioOrigenId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const entrada = (await client.query(
      `SELECT en.id, en.codigo, en.orden_id, en.funcion_id, en.estado,
              o.usuario_id
       FROM entradas en
       JOIN ordenes o ON o.id = en.orden_id
       WHERE en.codigo = $1
       FOR UPDATE OF en`,
      [codigo]
    )).rows[0];

    if (!entrada) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Entrada no encontrada." };
    }
    if (entrada.estado !== "activa") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Esta entrada ya no está activa (usada, reembolsada o cancelada)." };
    }
    if (String(entrada.usuario_id) !== String(usuarioOrigenId)) {
      await client.query("ROLLBACK");
      return { status: 403, mensaje: "Solo el comprador puede transferir esta entrada." };
    }

    const pendiente = (await client.query(
      `SELECT 1 FROM transferencias_entradas
       WHERE entrada_id = $1 AND estado = 'pendiente'`,
      [entrada.id]
    )).rows.length > 0;
    if (pendiente) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Esta entrada ya tiene una transferencia pendiente de confirmar." };
    }

    const destino = (await client.query(
      `SELECT id, nombre, email FROM usuarios WHERE lower(email) = lower($1)`,
      [emailDestino]
    )).rows[0] || null;

    const token = crypto.randomUUID().replace(/-/g, "").toUpperCase();
    const completada = !!destino;

    const transferencia = await client.query(
      `INSERT INTO transferencias_entradas
         (entrada_id, orden_id, usuario_origen_id, email_destino, token, estado, creado_en, completado_en)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
       RETURNING *`,
      [entrada.id, entrada.orden_id, usuarioOrigenId, emailDestino, token, completada ? "completada" : "pendiente", completada ? new Date() : null]
    );

    if (completada) {
      await client.query(
        `UPDATE entradas SET transferida_a_id = $1 WHERE id = $2`,
        [destino.id, entrada.id]
      );
    }

    await client.query(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, funcion_id, detalle, creado_en)
       VALUES ($1,'entrada.transferir','transferencias_entradas',$2,$3,$4,now())`,
      [
        usuarioOrigenId,
        token,
        entrada.funcion_id || null,
        JSON.stringify({ codigo, emailDestino, estado: completada ? "completada" : "pendiente" }),
      ]
    );

    await client.query("COMMIT");
    return {
      estado: completada ? "completada" : "pendiente",
      emailDestino,
      entradaId: entrada.id,
      token,
      destinatario: destino ? { id: destino.id, nombre: destino.nombre } : null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { obtenerEntrada, obtenerEntradaPorQr, marcarUsada, transferir };
