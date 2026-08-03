/* ============================================================
   Astro Tickets — models/eventoModel.js (Fases 4 + 5)
   Acceso a datos de las tablas eventos, zonas y asientos.
   Ahora cada evento tiene funciones (funciones_evento) y la
   creación/edición/estado quedan registrados en auditoría.
   ============================================================ */

const { query } = require("../config/database");
const funcionModel = require("./funcionModel");

/**
 * Convierte una fila de "eventos" al formato que espera el frontend
 * (el mismo que usaba localStorage: astro_events).
 */
function aEventoFrontend(fila, zonas = [], asientos = [], funciones = []) {
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
    funciones: funciones.map((f) => ({
      id: f.id,
      date: f.fecha instanceof Date ? f.fecha.toISOString().slice(0, 10) : f.fecha,
      time: String(f.hora || "").slice(0, 5),
      sala: f.sala,
      estado: f.estado,
      stats: f.stats || null,
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

/** Busca un evento por su id, incluyendo zonas, asientos y funciones. */
async function buscarPorId(id) {
  const { rows } = await query("SELECT * FROM eventos WHERE id = $1", [id]);
  if (!rows.length) return null;

  const zonas = (await query(
    "SELECT * FROM zonas WHERE evento_id = $1 ORDER BY id",
    [id]
  )).rows;
  const asientos = (await query(
    "SELECT * FROM asientos WHERE evento_id = $1 AND funcion_id IS NULL ORDER BY fila, columna",
    [id]
  )).rows;
  const funciones = await funcionModel.listarPorEvento(id);

  return aEventoFrontend(rows[0], zonas, asientos, funciones);
}

/**
 * Crea un evento con sus zonas, asientos (plantilla) y su primera
 * función por defecto, en una transacción. Audita la creación.
 */
async function crear(datos, usuarioId = null, razon = null) {
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

    // Primera función por defecto (la fecha/hora del formulario)
    const estadoFuncion = ev.estado === "published" ? "activa" : "programada";
    await funcionModel.crearEnCliente(client, {
      eventoId: ev.id,
      fecha: datos.date || new Date(),
      hora: datos.time || "20:00",
      sala: ev.lugar,
      estado: estadoFuncion,
      usuarioId,
      razon,
    });

    await funcionModel.registrarAuditoria(client, {
      usuarioId, accion: "evento.crear", entidad: "eventos",
      entidadId: ev.id, razon,
      detalle: { nombre: ev.nombre, estado: ev.estado },
    });

    await client.query("COMMIT");
    return aEventoFrontend(ev);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Actualiza un evento (borra zonas/asientos y los reinserta). Audita. */
async function actualizar(id, datos, usuarioId = null, razon = null) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");

    const anterior = (await client.query(
      `SELECT * FROM eventos WHERE id = $1 FOR UPDATE`,
      [id]
    )).rows[0];
    if (!anterior) return null;

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
    await client.query("DELETE FROM asientos WHERE evento_id=$1 AND funcion_id IS NULL", [id]);

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

    // Sincronizar la primera función con la nueva fecha/hora si el
    // evento cambió y esa función aún no tiene ventas.
    const funcs = (await client.query(
      `SELECT * FROM funciones_evento WHERE evento_id = $1 ORDER BY id ASC`,
      [id]
    )).rows;
    const fechaAnterior = anterior.fecha instanceof Date
      ? anterior.fecha.toISOString().slice(0, 10)
      : String(anterior.fecha || "").slice(0, 10);
    const horaAnterior = String(anterior.hora || "").slice(0, 5);
    const fechaNueva = String(datos.date || "").slice(0, 10);
    const horaNueva = String(datos.time || "20:00").slice(0, 5);

    if (funcs.length && (fechaAnterior !== fechaNueva || horaAnterior !== horaNueva)) {
      const primera = funcs[0];
      const conEntradas = (await client.query(
        `SELECT 1 FROM entradas WHERE funcion_id = $1 LIMIT 1`,
        [primera.id]
      )).rows.length > 0;
      if (!conEntradas) {
        await client.query(
          `UPDATE funciones_evento SET fecha=$1, hora=$2, actualizado_en=now()
           WHERE id=$3`,
          [fechaNueva || fechaAnterior || null, horaNueva, primera.id]
        );
      }
    }

    // Si el evento pasa a publicado, la primera función pasa a en_venta
    if (datos.status === "published" && funcs.length && funcs[0].estado === "programada") {
      await client.query(
        `UPDATE funciones_evento SET estado='activa', actualizado_en=now() WHERE id=$1`,
        [funcs[0].id]
      );
    }

    await funcionModel.registrarAuditoria(client, {
      usuarioId, accion: "evento.editar", entidad: "eventos",
      entidadId: id, razon,
      detalle: { desde: anterior.estado, hasta: datos.status || anterior.estado },
    });

    await client.query("COMMIT");
    return buscarPorId(id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Publica un evento (estado → published) y sus funciones a activa. */
async function publicar(id, usuarioId = null, razon = null) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE eventos SET estado='published' WHERE id=$1`,
      [id]
    );
    await client.query(
      `UPDATE funciones_evento SET estado='activa', actualizado_en=now()
       WHERE evento_id=$1 AND estado <> 'cancelada'`,
      [id]
    );
    await funcionModel.registrarAuditoria(client, {
      usuarioId, accion: "evento.publicar", entidad: "eventos",
      entidadId: id, razon,
    });
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Cancela un evento y todas sus funciones. Audita con razón. */
async function cancelar(id, usuarioId = null, razon = null) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE eventos SET estado='cancelado' WHERE id=$1`,
      [id]
    );
    await client.query(
      `UPDATE funciones_evento SET estado='cancelada', actualizado_en=now()
       WHERE evento_id=$1 AND estado <> 'cancelada'`,
      [id]
    );
    await funcionModel.registrarAuditoria(client, {
      usuarioId, accion: "evento.cancelar", entidad: "eventos",
      entidadId: id, razon,
    });
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Elimina un evento y todo lo relacionado (zonas, asientos, entradas). */
async function eliminar(id, usuarioId = null, razon = null) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");
    await funcionModel.registrarAuditoria(client, {
      usuarioId, accion: "evento.eliminar", entidad: "eventos",
      entidadId: id, razon,
    });
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

module.exports = { listar, buscarPorId, crear, actualizar, publicar, cancelar, eliminar, aEventoFrontend };
