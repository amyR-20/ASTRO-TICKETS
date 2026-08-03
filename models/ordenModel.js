/* ============================================================
   Astro Tickets — models/ordenModel.js
   Acceso a datos de las tablas ordenes, entradas y asientos
   ============================================================ */

const { pool } = require("../config/database");
const crypto = require("crypto");

/**
 * Genera un código único de entrada. UUIDv4 completo (32 caracteres
 * hex sin guiones): aleatorio, no secuencial, no adivinable.
 * Nunca se confía en un código enviado por el frontend.
 */
function generarCodigoEntrada() {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

/**
 * Crea una orden de compra y sus entradas en una transacción.
 * También marca los asientos vendidos como "sold".
 *
 * datos: {
 *   usuarioId, eventoId,
 *   payment: { method, cardBrand, cardLast4, cardHolder, transactionId, reservationCode },
 *   seats: [{ id, zone, price }],
 *   pricing: { subtotal, fee, total },
 *   purchasedAt (ISO) | opcional
 * }
 */
async function crear(datos) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orden = await client.query(
      `INSERT INTO ordenes
         (usuario_id, evento_id, transaccion, codigo_reserva, metodo_pago,
          tarjeta_marca, tarjeta_ultimos4, subtotal, tarifa, total, estado, creada_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        datos.usuarioId || null,
        datos.eventoId,
        datos.payment.transactionId,
        datos.payment.reservationCode,
        datos.payment.method,
        datos.payment.cardBrand || null,
        datos.payment.cardLast4 || null,
        datos.pricing.subtotal,
        datos.pricing.fee,
        datos.pricing.total,
        datos.estado || "paid",
        datos.purchasedAt ? new Date(datos.purchasedAt) : new Date(),
      ]
    );

    const ordenId = orden.rows[0].id;

    for (const s of datos.seats) {
      const codigoEntrada = generarCodigoEntrada();
      await client.query(
        `INSERT INTO entradas (orden_id, evento_id, asiento_id, zona, precio, codigo)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ordenId, datos.eventoId, s.id, s.zone || null, s.price, codigoEntrada]
      );
      // Marcar asiento como vendido
      await client.query(
        `UPDATE asientos SET estado='sold'
         WHERE evento_id=$1 AND asiento_id=$2`,
        [datos.eventoId, s.id]
      );
    }

    await client.query("COMMIT");
    return orden.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Devuelve las compras de un usuario en el formato que espera el
 * frontend (astro_history), con datos del evento incluidos.
 */
async function listarPorUsuario(usuarioId) {
  const sql = `
    SELECT
      o.id AS orden_id,
      o.transaccion,
      o.codigo_reserva,
      o.metodo_pago,
      o.tarjeta_marca,
      o.tarjeta_ultimos4,
      o.subtotal,
      o.tarifa,
      o.total,
      o.estado,
      o.creada_en,
      e.id AS evento_id,
      e.nombre AS evento_nombre,
      e.imagen AS evento_imagen,
      e.categoria AS evento_categoria,
      e.fecha AS evento_fecha,
      e.hora AS evento_hora,
      e.lugar AS evento_lugar,
      COALESCE(
        json_agg(
          json_build_object(
            'id', en.asiento_id,
            'zone', en.zona,
            'price', en.precio,
            'codigo', en.codigo
          )
        ) FILTER (WHERE en.id IS NOT NULL),
        '[]'
      ) AS entradas
    FROM ordenes o
    JOIN eventos e ON e.id = o.evento_id
    LEFT JOIN entradas en ON en.orden_id = o.id
    WHERE o.usuario_id = $1
    GROUP BY o.id, e.id
    ORDER BY o.creada_en DESC
  `;
  const { rows } = await pool.query(sql, [usuarioId]);

  return rows.map((r) => {
    const fecha = r.evento_fecha
      ? new Date(r.evento_fecha.getTime() + 3600 * 1000).toISOString().slice(0, 10)
      : null;
    return {
      event: {
        name: r.evento_nombre,
        img: r.evento_imagen,
        date: fecha,
        venue: r.evento_lugar,
        category: r.evento_categoria,
      },
      seats: r.entradas,
      pricing: {
        subtotal: Number(r.subtotal),
        fee: Number(r.tarifa),
        total: Number(r.total),
      },
      payment: {
        method: r.metodo_pago,
        cardBrand: r.tarjeta_marca,
        cardLast4: r.tarjeta_ultimos4,
        cardHolder: null,
        transactionId: r.transaccion,
        reservationCode: r.codigo_reserva,
      },
      purchasedAt: r.creada_en ? r.creada_en.toISOString() : null,
      status: r.estado,
    };
  });
}

/** Todas las órdenes (admin). */
async function listarTodas() {
  const sql = `
    SELECT
      o.*, e.nombre AS evento_nombre, u.nombre AS usuario_nombre, u.email AS usuario_email
    FROM ordenes o
    JOIN eventos e ON e.id = o.evento_id
    LEFT JOIN usuarios u ON u.id = o.usuario_id
    ORDER BY o.creada_en DESC
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

module.exports = { crear, listarPorUsuario, listarTodas };
