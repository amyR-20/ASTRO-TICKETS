/* ============================================================
   Astro Tickets — models/eventoModel.js
   Acceso a datos de las tablas eventos, zonas y asientos
   ============================================================ */

const { query } = require("../config/database");

/**
 * Convierte una fila de "eventos" al formato que espera el frontend
 * (el mismo que usaba localStorage: astro_events).
 */
function aEventoFrontend(fila, zonas = [], asientos = []) {
  // fecha (DATE) y hora (TIME) pueden llegar como Date o como string
  const fechaStr = fila.fecha instanceof Date
    ? fila.fecha.toISOString().slice(0, 10)
    : fila.fecha || null;
  const horaStr = fila.hora instanceof Date
    ? fila.hora.toISOString().slice(11, 16)
    : String(fila.hora || "").slice(0, 5) || null;

  return {
    id: fila.id,
    name: fila.nombre,
    description: fila.descripcion,
    category: fila.categoria,
    date: fechaStr,
    time: horaStr,
    venue: fila.lugar,
    city: fila.ciudad,
    address: fila.direccion,
    image: fila.imagen,
    status: fila.estado,
    rows: fila.filas,
    cols: fila.columnas,
    capacity: fila.capacidad,
    zones: zonas.map((z) => ({
      name: z.nombre,
      color: z.color,
      price: Number(z.precio),
      qty: z.cantidad,
      desc: z.descripcion,
    })),
    seats: asientos.map((a) => ({
      id: a.asiento_id,
      row: a.fila,
      col: a.columna,
      type: a.zona,
      status: a.estado,
    })),
    createdAt: fila.creado_en ? fila.creado_en.toISOString() : null,
  };
}

/** Lista eventos (filtra por estado si se pasa). */
async function listar(estado) {
  const sql = `
    SELECT * FROM eventos
    WHERE ($1::text IS NULL OR estado = $1)
    ORDER BY fecha ASC, hora ASC
  `;
  const { rows } = await query(sql, [estado || null]);
  return rows;
}

/** Busca un evento por su id, incluyendo sus zonas y asientos. */
async function buscarPorId(id) {
  const { rows } = await query("SELECT * FROM eventos WHERE id = $1", [id]);
  if (!rows.length) return null;

  const zonas = (await query(
    "SELECT * FROM zonas WHERE evento_id = $1 ORDER BY id",
    [id]
  )).rows;
  const asientos = (await query(
    "SELECT * FROM asientos WHERE evento_id = $1 ORDER BY fila, columna",
    [id]
  )).rows;

  return aEventoFrontend(rows[0], zonas, asientos);
}

/**
 * Crea un evento con sus zonas y asientos en una transacción.
 * datos: objeto del frontend (igual que collectEventData).
 */
async function crear(datos) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");

    const evento = await client.query(
      `INSERT INTO eventos
         (id, nombre, descripcion, categoria, fecha, hora, lugar, ciudad,
          direccion, imagen, estado, filas, columnas, capacidad, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       RETURNING *`,
      [
        datos.id,
        datos.name,
        datos.description || "",
        datos.category || "Concierto",
        datos.date || null,
        datos.time || "20:00",
        datos.venue || "",
        datos.city || "",
        datos.address || "",
        datos.image || "multimedia/logo.svg",
        datos.status || "draft",
        datos.rows || 0,
        datos.cols || 0,
        datos.capacity || 0,
      ]
    );

    const ev = evento.rows[0];

    for (const z of datos.zones || []) {
      await client.query(
        `INSERT INTO zonas (evento_id, nombre, color, precio, cantidad, descripcion)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ev.id, z.name, z.color, z.price, z.qty, z.desc]
      );
    }

    for (const s of datos.seats || []) {
      await client.query(
        `INSERT INTO asientos (evento_id, asiento_id, fila, columna, zona, estado)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ev.id, s.id, s.row, s.col, s.type || null, s.status || "available"]
      );
    }

    await client.query("COMMIT");
    return aEventoFrontend(ev);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Actualiza un evento completo (borra zonas/asientos y los reinserta). */
async function actualizar(id, datos) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE eventos SET
         nombre=$1, descripcion=$2, categoria=$3, fecha=$4, hora=$5,
         lugar=$6, ciudad=$7, direccion=$8, imagen=$9, estado=$10,
         filas=$11, columnas=$12, capacidad=$13
       WHERE id=$14`,
      [
        datos.name,
        datos.description || "",
        datos.category || "Concierto",
        datos.date || null,
        datos.time || "20:00",
        datos.venue || "",
        datos.city || "",
        datos.address || "",
        datos.image || "multimedia/logo.svg",
        datos.status || "draft",
        datos.rows || 0,
        datos.cols || 0,
        datos.capacity || 0,
        id,
      ]
    );

    await client.query("DELETE FROM zonas WHERE evento_id=$1", [id]);
    await client.query("DELETE FROM asientos WHERE evento_id=$1", [id]);

    for (const z of datos.zones || []) {
      await client.query(
        `INSERT INTO zonas (evento_id, nombre, color, precio, cantidad, descripcion)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, z.name, z.color, z.price, z.qty, z.desc]
      );
    }

    for (const s of datos.seats || []) {
      await client.query(
        `INSERT INTO asientos (evento_id, asiento_id, fila, columna, zona, estado)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, s.id, s.row, s.col, s.type || null, s.status || "available"]
      );
    }

    await client.query("COMMIT");
    return buscarPorId(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Elimina un evento y todo lo relacionado (zonas, asientos, entradas). */
async function eliminar(id) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM entradas WHERE evento_id=$1", [id]);
    await client.query("DELETE FROM asientos WHERE evento_id=$1", [id]);
    await client.query("DELETE FROM zonas WHERE evento_id=$1", [id]);
    const r = await client.query("DELETE FROM eventos WHERE id=$1", [id]);
    await client.query("COMMIT");
    return r.rowCount > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, aEventoFrontend };
