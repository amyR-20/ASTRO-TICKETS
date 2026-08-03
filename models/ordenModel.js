/* ============================================================
   Astro Tickets — models/ordenModel.js (Fases 4 + 5)
   Acceso a datos de las tablas ordenes, entradas y asientos.
   La compra valida en la BD (con SELECT ... FOR UPDATE) que las
   reservas del usuario siguen activas y que la función no se
   agotó, y cobra el PRECIO REAL de la zona, nunca el del cliente.
   ============================================================ */

const { pool } = require("../config/database");
const crypto = require("crypto");
const { liberarReservasVencidas } = require("./funcionModel");

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
 * Recalcula subtotal/tarifa/total desde la BD (nunca del cliente),
 * valida que cada asiento reservado por el usuario siga activo y
 * que la función no esté cancelada, y marca los asientos "sold".
 *
 * datos: { usuarioId, funcionId, payment: { transactionId, reservationCode } }
 */
async function crear(datos) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Liberar reservas vencidas antes de validar
    await liberarReservasVencidas();

    const funcion = (await client.query(
      `SELECT f.*, e.id AS evento_id FROM funciones_evento f
       JOIN eventos e ON e.id = f.evento_id
       WHERE f.id = $1 FOR UPDATE`,
      [datos.funcionId]
    )).rows[0];

    if (!funcion) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Función no encontrada." };
    }
    if (funcion.estado === "cancelada") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "La función fue cancelada." };
    }

    // Reservas activas del usuario para esta función (con FOR UPDATE)
    const { rows: reservas } = await client.query(
      `SELECT r.* FROM reservas r
       JOIN asientos a ON a.funcion_id = r.funcion_id AND a.asiento_id = r.asiento_id
       WHERE r.usuario_id = $1 AND r.funcion_id = $2 AND r.estado = 'activa'
         AND r.expira_en > now()
       ORDER BY r.asiento_id
       FOR UPDATE OF r, a`,
      [datos.usuarioId, datos.funcionId]
    );

    if (!reservas.length) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Ya no tienes asientos reservados para esta función. Reserva de nuevo." };
    }

    // Recalcular totales desde la BD
    let subtotal = 0;
    const detalleAsientos = [];
    for (const r of reservas) {
      const precio = Number(r.precio);
      if (Number.isNaN(precio) || precio < 0) {
        await client.query("ROLLBACK");
        return { status: 400, mensaje: `Precio inválido para el asiento ${r.asiento_id}.` };
      }
      subtotal += precio;
      detalleAsientos.push(r);
    }

    const tarifa = Math.round(subtotal * 0.08 * 100) / 100;
    const total = Math.round((subtotal + tarifa) * 100) / 100;

    const orden = await client.query(
      `INSERT INTO ordenes
         (usuario_id, evento_id, funcion_id, transaccion, codigo_reserva, metodo_pago,
          tarjeta_marca, tarjeta_ultimos4, subtotal, tarifa, total, estado, creada_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        datos.usuarioId || null,
        funcion.evento_id,
        datos.funcionId,
        datos.payment.transactionId,
        datos.payment.reservationCode,
        datos.payment.method || "tarjeta",
        datos.payment.cardBrand || null,
        datos.payment.cardLast4 || null,
        subtotal,
        tarifa,
        total,
        datos.estado || "paid",
        datos.purchasedAt ? new Date(datos.purchasedAt) : new Date(),
      ]
    );

    const ordenId = orden.rows[0].id;

    await client.query(
      `INSERT INTO pagos (orden_id, transaccion, metodo_pago, marca_tarjeta, ultimos4, monto, estado, pagado_en)
       VALUES ($1,$2,$3,$4,$5,$6,'procesado',now())
       ON CONFLICT (transaccion) DO NOTHING`,
      [ordenId, datos.payment.transactionId, datos.payment.method || "stripe", datos.payment.cardBrand, datos.payment.cardLast4, total]
    );

    const entradasCreadas = [];
    for (const r of detalleAsientos) {
      const codigoEntrada = generarCodigoEntrada();
      const qrToken = crypto.randomUUID().replace(/-/g, "").toUpperCase();
      await client.query(
        `INSERT INTO entradas (orden_id, evento_id, funcion_id, asiento_id, zona, precio, codigo, qr_token)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ordenId, funcion.evento_id, datos.funcionId, r.asiento_id, r.zona, r.precio, codigoEntrada, qrToken]
      );
      entradasCreadas.push({
        id: r.asiento_id,
        zone: r.zona,
        price: Number(r.precio),
        codigo: codigoEntrada,
        qrToken,
      });
      // Marcar asiento como vendido (solo si aún no lo está)
      await client.query(
        `UPDATE asientos SET estado='sold'
         WHERE funcion_id=$1 AND asiento_id=$2 AND estado <> 'sold'`,
        [datos.funcionId, r.asiento_id]
      );
      // Cerrar la reserva
      await client.query(
        `UPDATE reservas SET estado='completada'
         WHERE id=$1 AND estado='activa'`,
        [r.id]
      );
    }

    // Auditar la compra
    await client.query(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, funcion_id, detalle, creado_en)
       VALUES ($1,'orden.crear','ordenes',$2,$3,$4,now())`,
      [
        datos.usuarioId || null,
        String(ordenId),
        datos.funcionId,
        JSON.stringify({ asientos: detalleAsientos.length, total }),
      ]
    );

    // Si se agotaron todos los asientos de la función, marcarla agotada
    await client.query(
      `UPDATE funciones_evento f SET estado='agotada'
       WHERE f.id=$1 AND f.estado='activa'
         AND NOT EXISTS (
           SELECT 1 FROM asientos a
           WHERE a.funcion_id=f.id AND a.estado='available'
         )`,
      [datos.funcionId]
    );

    await client.query("COMMIT");

    return {
      orderId: orden.rows[0].id,
      ...orden.rows[0],
      subtotal,
      tarifa,
      total,
      asientos: entradasCreadas,
    };
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
      o.funcion_id,
      e.id AS evento_id,
      e.nombre AS evento_nombre,
      e.imagen AS evento_imagen,
      e.categoria AS evento_categoria,
      e.fecha AS evento_fecha,
      e.hora AS evento_hora,
      f.fecha AS funcion_fecha,
      f.hora AS funcion_hora,
      f.sala AS funcion_sala,
      u.nombre AS comprador_nombre,
      u.email AS comprador_email,
      e.lugar AS evento_lugar,
      COALESCE(
        json_agg(
          json_build_object(
            'id', en.asiento_id,
            'zone', en.zona,
            'price', en.precio,
            'codigo', en.codigo,
            'qrToken', en.qr_token
          )
        ) FILTER (WHERE en.id IS NOT NULL),
        '[]'
      ) AS entradas
    FROM ordenes o
    JOIN eventos e ON e.id = o.evento_id
    JOIN funciones_evento f ON f.id = o.funcion_id
    LEFT JOIN usuarios u ON u.id = o.usuario_id
    LEFT JOIN entradas en ON en.orden_id = o.id
    WHERE o.usuario_id = $1
    GROUP BY o.id, e.id, f.id, u.id
    ORDER BY o.creada_en DESC
  `;
  const { rows } = await pool.query(sql, [usuarioId]);

  return rows.map((r) => {
    const fecha = r.evento_fecha
      ? new Date(r.evento_fecha.getTime() + 3600 * 1000).toISOString().slice(0, 10)
      : null;
    return {
      orderId: r.orden_id,
      event: {
        id: r.evento_id,
        name: r.evento_nombre,
        img: r.evento_imagen,
        date: fecha,
        venue: r.evento_lugar,
        category: r.evento_categoria,
      },
      funcion: {
        id: r.funcion_id,
        fecha: r.funcion_fecha ? r.funcion_fecha.toISOString().slice(0, 10) : null,
        hora: r.funcion_hora ? String(r.funcion_hora).slice(0, 5) : null,
        sala: r.funcion_sala,
      },
      comprador: { nombre: r.comprador_nombre, email: r.comprador_email },
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
