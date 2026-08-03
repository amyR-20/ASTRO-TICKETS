/* ============================================================
   Astro Tickets — models/reembolsoModel.js
   Reembolsos: listado, órdenes reembolsables, solicitudes de
   usuarios y procesamiento (aprobar/rechazar).
   Al aprobar se liberan los asientos (vuelven a venderse), se
   marca la orden/pago/entradas y se registra en auditoría.
   ============================================================ */

const { pool } = require("../config/database");

/** Historial de reembolsos con datos de la orden y de quien autorizó. */
async function listarReembolsos() {
  const { rows } = await pool.query(`
    SELECT
      r.id, r.monto, r.motivo, r.estado, r.creado_en, r.completado_en,
      r.orden_id, o.transaccion, o.total AS orden_total, o.estado AS orden_estado,
      e.nombre AS evento_nombre,
      u.nombre AS comprador_nombre, u.email AS comprador_email,
      a.nombre AS admin_nombre
    FROM reembolsos r
    JOIN ordenes o ON o.id = r.orden_id
    JOIN eventos e ON e.id = o.evento_id
    LEFT JOIN usuarios u ON u.id = o.usuario_id
    LEFT JOIN usuarios a ON a.id = r.autorizado_por
    ORDER BY r.creado_en DESC
  `);
  return rows;
}

/** Órdenes pagadas que aún no tienen un reembolso procesado. */
async function listarOrdenesReembolsables() {
  const { rows } = await pool.query(`
    SELECT
      o.id, o.transaccion, o.total, o.creada_en, o.metodo_pago, o.estado,
      e.nombre AS evento_nombre, e.fecha AS evento_fecha,
      u.nombre AS comprador_nombre, u.email AS comprador_email
    FROM ordenes o
    JOIN eventos e ON e.id = o.evento_id
    LEFT JOIN usuarios u ON u.id = o.usuario_id
    WHERE o.estado IN ('paid','completed','completada')
      AND NOT EXISTS (
        SELECT 1 FROM reembolsos r
        WHERE r.orden_id = o.id AND r.estado IN ('solicitado','aprobado')
      )
    ORDER BY o.creada_en DESC
    LIMIT 200
  `);
  return rows;
}

/** Reembolsos de un usuario (historial de sus solicitudes). */
async function listarPorUsuario(usuarioId) {
  const { rows } = await pool.query(`
    SELECT
      r.id, r.orden_id, r.monto, r.motivo, r.estado, r.creado_en, r.completado_en,
      o.transaccion, o.total AS orden_total, o.estado AS orden_estado,
      e.nombre AS evento_nombre, e.fecha AS evento_fecha
    FROM reembolsos r
    JOIN ordenes o ON o.id = r.orden_id
    JOIN eventos e ON e.id = o.evento_id
    WHERE o.usuario_id = $1
    ORDER BY r.creado_en DESC
    LIMIT 50
  `, [usuarioId]);
  return rows;
}

/** Órdenes pagadas del usuario que aún no tienen reembolso. */
async function listarReembolsablesPorUsuario(usuarioId) {
  const { rows } = await pool.query(`
    SELECT
      o.id, o.transaccion, o.total, o.creada_en, o.metodo_pago, o.estado,
      e.nombre AS evento_nombre, e.fecha AS evento_fecha
    FROM ordenes o
    JOIN eventos e ON e.id = o.evento_id
    WHERE o.usuario_id = $1
      AND o.estado IN ('paid','completed','completada')
      AND NOT EXISTS (
        SELECT 1 FROM reembolsos r
        WHERE r.orden_id = o.id AND r.estado IN ('solicitado','aprobado')
      )
    ORDER BY o.creada_en DESC
    LIMIT 50
  `, [usuarioId]);
  return rows;
}

/** El usuario solicita un reembolso (queda en estado 'solicitado'). */
async function solicitar({ ordenId, motivo, usuarioId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orden = (await client.query(
      `SELECT id, usuario_id, total, estado FROM ordenes WHERE id = $1 FOR UPDATE`,
      [ordenId]
    )).rows[0];

    if (!orden) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Orden no encontrada." };
    }
    if (orden.usuario_id !== usuarioId) {
      await client.query("ROLLBACK");
      return { status: 403, mensaje: "Esta orden no te pertenece." };
    }
    if (!["paid", "completed", "completada"].includes(orden.estado)) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Solo puedes solicitar reembolsos de órdenes pagadas o completadas." };
    }

    const yaExiste = (await client.query(
      `SELECT 1 FROM reembolsos
       WHERE orden_id = $1 AND estado IN ('solicitado','aprobado')`,
      [ordenId]
    )).rows.length > 0;
    if (yaExiste) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Esta orden ya tiene un reembolso en proceso o procesado." };
    }

    const montoFinal = Number(orden.total);
    const reembolso = await client.query(
      `INSERT INTO reembolsos (orden_id, pago_id, monto, motivo, estado, creado_en)
       SELECT $1,
              (SELECT id FROM pagos WHERE orden_id = $1 ORDER BY id DESC LIMIT 1),
              $2, $3, 'solicitado', now()
       RETURNING *`,
      [ordenId, montoFinal, motivo || null]
    );

    await client.query("COMMIT");
    return reembolso.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Aplica los efectos de un reembolso aprobado dentro de una transacción:
 * marca la orden 'refunded', el pago 'reembolsado', las entradas
 * 'reembolsada' y libera los asientos vendidos de la función.
 * Devuelve la orden (con usuario_id, idioma y evento para notificar).
 */
async function aplicarAprobacion(client, ordenId, monto, autorizadoPor, motivo, reembolsoId) {
  const orden = (await client.query(
    `SELECT o.*, f.id AS funcion_id, e.nombre AS evento_nombre,
            u.id AS usuario_id, u.idioma_pref
     FROM ordenes o
     LEFT JOIN funciones_evento f ON f.id = o.funcion_id
     LEFT JOIN eventos e ON e.id = o.evento_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     WHERE o.id = $1
     FOR UPDATE OF o`,
    [ordenId]
  )).rows[0];

  if (!orden) return { status: 404, mensaje: "Orden no encontrada." };
  if (!["paid", "completed", "completada"].includes(orden.estado)) {
    return { status: 409, mensaje: "Solo se pueden reembolsar órdenes pagadas o completadas." };
  }

  await client.query(`UPDATE ordenes SET estado='refunded' WHERE id=$1`, [ordenId]);
  await client.query(`UPDATE pagos SET estado='reembolsado' WHERE orden_id=$1`, [ordenId]);
  await client.query(
    `UPDATE entradas SET estado='reembolsada'
     WHERE orden_id=$1 AND estado IN ('activa','usada')`,
    [ordenId]
  );

  // Liberar los asientos de la función para que vuelvan a venderse.
  if (orden.funcion_id) {
    await client.query(
      `UPDATE asientos SET estado='available'
       WHERE funcion_id=$1 AND estado='sold'
         AND asiento_id IN (SELECT asiento_id FROM entradas WHERE orden_id=$2)`,
      [orden.funcion_id, ordenId]
    );
    await client.query(
      `UPDATE funciones_evento f SET estado='activa', actualizado_en=now()
       WHERE f.id=$1 AND f.estado='agotada' AND EXISTS (
         SELECT 1 FROM asientos a
         WHERE a.funcion_id = f.id AND a.estado = 'available'
       )`,
      [orden.funcion_id]
    );
  }

  await client.query(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, funcion_id, detalle, creado_en)
     VALUES ($1,'orden.reembolsar','reembolsos',$2,$3,$4,now())`,
    [
      autorizadoPor || null,
      String(reembolsoId),
      orden.funcion_id || null,
      JSON.stringify({ ordenId, monto, motivo: motivo || null, transaccion: orden.transaccion }),
    ]
  );

  return {
    orden,
    usuarioId: orden.usuario_id || null,
    idioma: orden.idioma_pref,
    eventoNombre: orden.evento_nombre,
    monto,
    transaccion: orden.transaccion,
  };
}

/** Aprueba una solicitud de reembolso pendiente. */
async function aprobar(reembolsoId, autorizadoPor) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ref = (await client.query(
      `SELECT * FROM reembolsos WHERE id = $1 FOR UPDATE`,
      [reembolsoId]
    )).rows[0];

    if (!ref) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Reembolso no encontrado." };
    }
    if (ref.estado !== "solicitado") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Este reembolso ya fue procesado." };
    }

    const aplicado = await aplicarAprobacion(client, ref.orden_id, Number(ref.monto), autorizadoPor, ref.motivo, ref.id);
    if (aplicado.status) {
      await client.query("ROLLBACK");
      return aplicado;
    }

    await client.query(
      `UPDATE reembolsos SET estado='aprobado', completado_en=now(), autorizado_por=$2 WHERE id=$1`,
      [ref.id, autorizadoPor]
    );

    await client.query("COMMIT");
    return {
      id: ref.id,
      estado: "aprobado",
      ...aplicado,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Rechaza una solicitud de reembolso pendiente. */
async function rechazar(reembolsoId, autorizadoPor) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ref = (await client.query(
      `SELECT r.*, o.usuario_id, u.idioma_pref, e.nombre AS evento_nombre
       FROM reembolsos r
       JOIN ordenes o ON o.id = r.orden_id
       LEFT JOIN eventos e ON e.id = o.evento_id
       LEFT JOIN usuarios u ON u.id = o.usuario_id
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [reembolsoId]
    )).rows[0];

    if (!ref) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Reembolso no encontrado." };
    }
    if (ref.estado !== "solicitado") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Este reembolso ya fue procesado." };
    }

    await client.query(
      `UPDATE reembolsos SET estado='rechazado', completado_en=now(), autorizado_por=$2 WHERE id=$1`,
      [ref.id, autorizadoPor]
    );

    await client.query(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, funcion_id, detalle, creado_en)
       VALUES ($1,'orden.reembolso.rechazado','reembolsos',$2,NULL,$3,now())`,
      [autorizadoPor || null, String(ref.id), JSON.stringify({ ordenId: ref.orden_id, motivo: ref.motivo || null })]
    );

    await client.query("COMMIT");
    return {
      id: ref.id,
      estado: "rechazado",
      usuarioId: ref.usuario_id || null,
      idioma: ref.idioma_pref,
      eventoNombre: ref.evento_nombre,
      monto: Number(ref.monto),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Procesa un reembolso directo (sin solicitud previa) sobre una orden pagada.
 * Marca la orden 'refunded', el pago 'reembolsado', las entradas
 * 'reembolsada' y libera los asientos vendidos de la función.
 */
async function crear({ ordenId, monto, motivo, autorizadoPor }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orden = (await client.query(
      `SELECT o.*, f.id AS funcion_id
       FROM ordenes o
       LEFT JOIN funciones_evento f ON f.id = o.funcion_id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [ordenId]
    )).rows[0];

    if (!orden) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Orden no encontrada." };
    }
    if (!["paid", "completed", "completada"].includes(orden.estado)) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Solo se pueden reembolsar órdenes pagadas o completadas." };
    }

    const yaExiste = (await client.query(
      `SELECT 1 FROM reembolsos
       WHERE orden_id = $1 AND estado IN ('solicitado','aprobado')`,
      [ordenId]
    )).rows.length > 0;
    if (yaExiste) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Esta orden ya tiene un reembolso procesado o en proceso." };
    }

    const montoFinal = monto != null ? Number(monto) : Number(orden.total);
    if (Number.isNaN(montoFinal) || montoFinal <= 0 || montoFinal > Number(orden.total)) {
      await client.query("ROLLBACK");
      return { status: 400, mensaje: "El monto debe ser mayor a 0 y no superar el total de la orden." };
    }

    const reembolso = await client.query(
      `INSERT INTO reembolsos (orden_id, pago_id, monto, motivo, autorizado_por, estado, creado_en, completado_en)
       SELECT $1,
              (SELECT id FROM pagos WHERE orden_id = $1 ORDER BY id DESC LIMIT 1),
              $2, $3, $4, 'aprobado', now(), now()
       RETURNING *`,
      [ordenId, montoFinal, motivo || null, autorizadoPor || null]
    );

    const aplicado = await aplicarAprobacion(client, ordenId, montoFinal, autorizadoPor, motivo || null, reembolso.rows[0].id);
    if (aplicado.status) {
      await client.query("ROLLBACK");
      return aplicado;
    }

    await client.query("COMMIT");
    return {
      reembolso: reembolso.rows[0],
      ...aplicado,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listarReembolsos,
  listarOrdenesReembolsables,
  listarPorUsuario,
  listarReembolsablesPorUsuario,
  solicitar,
  aprobar,
  rechazar,
  crear,
};
