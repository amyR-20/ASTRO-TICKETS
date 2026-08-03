/* ============================================================
   Astro Tickets — models/reservaModel.js (Fases 4 + 5)
   Reserva de asientos con control de concurrencia.
   - SELECT ... FOR UPDATE para serializar la reserva del mismo asiento.
   - Nunca confía en la disponibilidad mostrada al cargar la página.
   - Expiración de reservas gestionada en models/funcionModel.
   ============================================================ */

const { pool } = require("../config/database");
const { MINUTOS_RESERVA, liberarReservasVencidas } = require("./funcionModel");

/**
 * Reserva uno o varios asientos de una función para el usuario.
 * Precondiciones (validadas en la transacción, con FOR UPDATE):
 *  - la función existe y no está cancelada;
 *  - cada asiento existe en la función;
 *  - cada asiento está 'available' (o ya reservado por el mismo usuario);
 *  - la zona del asiento tiene precio definido.
 * Devuelve { reservas, expiraEn } o lanza { status, mensaje, asientos }.
 */
async function reservar({ usuarioId, funcionId, asientoIds }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Antes de reservar, liberar reservas vencidas
    await liberarReservasVencidas();

    const funcion = (await client.query(
      `SELECT f.*, e.id AS evento_id FROM funciones_evento f
       JOIN eventos e ON e.id = f.evento_id
       WHERE f.id = $1 FOR UPDATE`,
      [funcionId]
    )).rows[0];

    if (!funcion) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Función no encontrada." };
    }
    if (funcion.estado === "cancelada") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Esta función fue cancelada." };
    }

    // Asientos con bloqueo por fila para evitar doble reserva
    const { rows: asientos } = await client.query(
      `SELECT a.id, a.asiento_id, a.zona, a.estado
       FROM asientos a
       WHERE a.funcion_id = $1 AND a.asiento_id = ANY($2::text[])
       ORDER BY a.asiento_id
       FOR UPDATE`,
      [funcionId, asientoIds]
    );

    // Precios de las zonas desde la BD
    const { rows: zonas } = await client.query(
      `SELECT nombre, precio FROM zonas WHERE evento_id = $1`,
      [funcion.evento_id]
    );
    const precioDe = (zona) => {
      const z = zonas.find((x) => x.nombre.toLowerCase() === (zona || "").toLowerCase());
      return z ? Number(z.precio) : null;
    };

    const encontrados = new Set(asientos.map((a) => a.asiento_id));
    const inexistentes = asientoIds.filter((id) => !encontrados.has(id));
    if (inexistentes.length) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: `Asiento(s) inexistente(s): ${inexistentes.join(", ")}` };
    }

    // Validar disponibilidad (no confiar en lo mostrado al cargar la página)
    const noDisponibles = [];
    for (const a of asientos) {
      if (a.estado === "sold" || a.estado === "blocked") {
        noDisponibles.push(a.asiento_id);
        continue;
      }
      if (a.estado === "reserved") {
        const miReserva = (await client.query(
          `SELECT precio FROM reservas
           WHERE funcion_id = $1 AND asiento_id = $2
             AND usuario_id = $3 AND estado = 'activa'`,
          [funcionId, a.asiento_id, usuarioId]
        )).rows[0];
        if (!miReserva) {
          noDisponibles.push(a.asiento_id);
          continue;
        }
        a.precio = Number(miReserva.precio);
        continue;
      }
      const precio = precioDe(a.zona);
      if (!a.zona || precio == null) {
        await client.query("ROLLBACK");
        return { status: 400, mensaje: `El asiento ${a.asiento_id} no tiene zona o precio definido.` };
      }
      a.precio = precio;
    }

    if (noDisponibles.length) {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "Algunos asientos ya no están disponibles.", asientos: noDisponibles };
    }

    const expiraEn = new Date(Date.now() + MINUTOS_RESERVA * 60000).toISOString();
    const reservasCreadas = [];

    for (const a of asientos) {
      // Reserva del usuario (se elimina la reserva propia previa si existe)
      await client.query(
        `DELETE FROM reservas
         WHERE funcion_id = $1 AND asiento_id = $2 AND estado = 'activa'`,
        [funcionId, a.asiento_id]
      );
      const r = await client.query(
        `INSERT INTO reservas (usuario_id, funcion_id, evento_id, asiento_id, zona, precio, expira_en, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'activa') RETURNING *`,
        [usuarioId, funcionId, funcion.evento_id, a.asiento_id, a.zona, a.precio, new Date(expiraEn)]
      );
      reservasCreadas.push(r.rows[0]);

      await client.query(
        `UPDATE asientos SET estado = 'reserved'
         WHERE id = $1 AND estado <> 'sold'`,
        [a.id]
      );
    }

    await client.query("COMMIT");
    return {
      reservas: reservasCreadas.map((r) => ({
        id: r.id,
        asiento: r.asiento_id,
        zona: r.zona,
        precio: Number(r.precio),
        expiraEn: r.expira_en.toISOString(),
      })),
      expiraEn,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Libera reservas activas del usuario en la función. */
async function cancelar({ usuarioId, funcionId, asientoIds }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE reservas SET estado = 'cancelada'
       WHERE funcion_id = $1 AND asiento_id = ANY($2::text[])
         AND usuario_id = $3 AND estado = 'activa'`,
      [funcionId, asientoIds, usuarioId]
    );

    await client.query(
      `UPDATE asientos a SET estado = 'available'
       WHERE a.funcion_id = $1 AND a.asiento_id = ANY($2::text[])
         AND a.estado = 'reserved'
         AND NOT EXISTS (
           SELECT 1 FROM reservas r
           WHERE r.funcion_id = a.funcion_id
             AND r.asiento_id = a.asiento_id
             AND r.estado = 'activa'
         )`,
      [funcionId, asientoIds]
    );

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Reservas activas del usuario (para revalidar al pagar). */
async function activasDeUsuario(usuarioId, funcionId) {
  const { rows } = await pool.query(
    `SELECT asiento_id, zona, precio, expira_en
     FROM reservas
     WHERE usuario_id = $1 AND funcion_id = $2 AND estado = 'activa'`,
    [usuarioId, funcionId]
  );
  return rows;
}

module.exports = { reservar, cancelar, activasDeUsuario };
