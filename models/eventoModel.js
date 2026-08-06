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
function aEventoFrontend(fila, zonas = [], asientos = [], funciones = [], artistas = []) {
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
    categoryId: fila.categoria_id || null,
    recintoId: fila.recinto_id || null,
    artistas: artistas.map((a) => ({ id: a.id, name: a.nombre, genre: a.genero })),
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

/**
 * Garantiza que exista una fila en "categorias" para el texto de la
 * categoría y devuelve su id (la FK real de eventos.categoria_id).
 */
async function resolverCategoriaId(client, nombre) {
  if (!nombre) return null;
  await client.query(
    `INSERT INTO categorias (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`,
    [String(nombre)]
  );
  const { rows } = await client.query(
    `SELECT id FROM categorias WHERE nombre = $1`,
    [String(nombre)]
  );
  return rows[0] ? rows[0].id : null;
}

/** Lee los artistas asociados a un evento. */
async function listarArtistasDeEvento(id) {
  const { rows } = await query(
    `SELECT ar.id, ar.nombre, ar.genero
     FROM evento_artistas ea
     JOIN artistas ar ON ar.id = ea.artista_id
     WHERE ea.evento_id = $1
     ORDER BY ea.posicion ASC, ar.nombre ASC`,
    [id]
  );
  return rows;
}

/** Reemplaza los artistas asociados a un evento (dentro de una transacción). */
async function reemplazarArtistas(client, eventoId, artistaIds) {
  await client.query(`DELETE FROM evento_artistas WHERE evento_id = $1`, [eventoId]);
  if (Array.isArray(artistaIds) && artistaIds.length) {
    const ids = [...new Set(artistaIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))];
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `INSERT INTO evento_artistas (evento_id, artista_id, posicion) VALUES ($1, $2, $3)
         ON CONFLICT (evento_id, artista_id) DO NOTHING`,
        [eventoId, ids[i], i]
      );
    }
  }
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

/**
 * Lista eventos en 2 consultas (eventos + zonas), sin asientos ni funciones.
 * Para listados en los que el frontend sólo usa zonas (evita el N+1 de
 * buscarPorId). Devuelve el formato aEventoFrontend con funciones vacías.
 */
async function listarConDetalle(estado) {
  const sql = `
    SELECT * FROM eventos
    WHERE ($1::text IS NULL OR estado = $1)
    ORDER BY fecha ASC, hora ASC
  `;
  const { rows } = await query(sql, [estado || null]);
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const { rows: zonas } = await query(
    `SELECT * FROM zonas
     WHERE evento_id = ANY($1::text[]) AND funcion_id IS NULL
     ORDER BY id`,
    [ids]
  );
  const zonasPorEvento = new Map();
  for (const z of zonas) {
    if (!zonasPorEvento.has(z.evento_id)) zonasPorEvento.set(z.evento_id, []);
    zonasPorEvento.get(z.evento_id).push(z);
  }

  // Funciones + estadísticas de inventario para poder pintar el estado
  // "Disponible / Vendiéndose rápido / Agotado" según las boletas que quedan.
  const { rows: funciones } = await query(
    `SELECT * FROM funciones_evento
     WHERE evento_id = ANY($1::text[])
     ORDER BY evento_id, fecha ASC, hora ASC`,
    [ids]
  );
  const stats = funciones.length
    ? await funcionModel.estadisticasMasivas(funciones.map((f) => f.id))
    : new Map();
  const funcionesPorEvento = new Map();
  for (const f of funciones) {
    if (!funcionesPorEvento.has(f.evento_id)) funcionesPorEvento.set(f.evento_id, []);
    funcionesPorEvento.get(f.evento_id).push({ ...f, stats: stats.get(f.id) || null });
  }

  return rows.map((fila) => aEventoFrontend(fila, zonasPorEvento.get(fila.id) || [], [], funcionesPorEvento.get(fila.id) || []));
}

/** Comprueba (sin leer todo el evento) si existe un evento con ese id. */
async function existe(id) {
  const { rows } = await query("SELECT 1 FROM eventos WHERE id = $1", [id]);
  return rows.length > 0;
}

/** Devuelve { estado } de un evento o null (consulta barata para validar). */
async function buscarEstado(id) {
  const { rows } = await query("SELECT estado FROM eventos WHERE id = $1", [id]);
  return rows[0] || null;
}

/** Busca un evento por su id, incluyendo zonas, asientos y funciones. */
async function buscarPorId(id) {
  const { rows } = await query("SELECT * FROM eventos WHERE id = $1", [id]);
  if (!rows.length) return null;

  const zonas = (await query(
    "SELECT * FROM zonas WHERE evento_id = $1 AND funcion_id IS NULL ORDER BY id",
    [id]
  )).rows;
  const asientos = (await query(
    "SELECT * FROM asientos WHERE evento_id = $1 AND funcion_id IS NULL ORDER BY fila, columna",
    [id]
  )).rows;
  const funciones = await funcionModel.listarPorEvento(id);
  const artistas = await listarArtistasDeEvento(id);

  return aEventoFrontend(rows[0], zonas, asientos, funciones, artistas);
}

/**
 * Crea un evento con sus zonas, asientos (plantilla) y su primera
 * función por defecto, en una transacción. Audita la creación.
 */
async function crear(datos, usuarioId = null, razon = null) {
  const client = await require("../config/database").pool.connect();
  try {
    await client.query("BEGIN");

    const categoriaId = await resolverCategoriaId(client, datos.category || null);
    const recintoId = datos.recintoId ? Number(datos.recintoId) : null;

    const evento = await client.query(
      `INSERT INTO eventos
         (id, nombre, descripcion, categoria, fecha, hora, lugar, ciudad,
          direccion, imagen, estado, filas, columnas, capacidad, creado_en,
          categoria_id, recinto_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now(), $15, $16)
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
        categoriaId,
        recintoId,
      ]
    );

    const ev = evento.rows[0];

    if (Array.isArray(datos.artistas)) {
      await reemplazarArtistas(client, ev.id, datos.artistas);
    }

    if (datos.zones && datos.zones.length) {
      const valores = [];
      const params = [];
      datos.zones.forEach((z, i) => {
        const base = i * 6;
        params.push(ev.id, z.name, z.color, z.price, z.qty, z.desc);
        valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
      });
      await client.query(
        `INSERT INTO zonas (evento_id, nombre, color, precio, cantidad, descripcion)
         VALUES ${valores.join(", ")}`,
        params
      );
    }

    if (datos.seats && datos.seats.length) {
      for (let inicio = 0; inicio < datos.seats.length; inicio += 1000) {
        const lote = datos.seats.slice(inicio, inicio + 1000);
        const valores = [];
        const params = [];
        lote.forEach((s, i) => {
          const base = i * 6;
          params.push(ev.id, s.id, s.row, s.col, s.type || null, s.status || "available");
          valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
        });
        await client.query(
          `INSERT INTO asientos (evento_id, asiento_id, fila, columna, zona, estado)
           VALUES ${valores.join(", ")}`,
          params
        );
      }
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
    // Devolver el evento completo. La respuesta anterior solo incluia la fila
    // principal y dejaba `zones` y `funciones` vacios aunque ya existieran en
    // Neon, haciendo que el panel pareciera no haber creado bien el evento.
    return buscarPorId(ev.id);
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

    const categoriaId = await resolverCategoriaId(client, datos.category || anterior.categoria || null);
    const recintoId = datos.recintoId !== undefined ? Number(datos.recintoId) : anterior.recinto_id;

    await client.query(
      `UPDATE eventos SET
         nombre=$1, descripcion=$2, categoria=$3, fecha=$4, hora=$5,
         lugar=$6, ciudad=$7, direccion=$8, imagen=$9, estado=$10,
         filas=$11, columnas=$12, capacidad=$13, categoria_id=$14, recinto_id=$15
       WHERE id=$16`,
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
        categoriaId,
        recintoId,
        id,
      ]
    );

    if (Array.isArray(datos.artistas)) {
      await reemplazarArtistas(client, id, datos.artistas);
    }

    // Las zonas de funciones existentes conservan el precio e inventario
    // histórico. Sólo se actualiza la plantilla para funciones futuras.
    await client.query("DELETE FROM zonas WHERE evento_id=$1 AND funcion_id IS NULL", [id]);
    await client.query("DELETE FROM asientos WHERE evento_id=$1 AND funcion_id IS NULL", [id]);

    if (datos.zones && datos.zones.length) {
      const valores = [];
      const params = [];
      datos.zones.forEach((z, i) => {
        const base = i * 6;
        params.push(id, z.name, z.color, z.price, z.qty, z.desc);
        valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
      });
      await client.query(
        `INSERT INTO zonas (evento_id, nombre, color, precio, cantidad, descripcion)
         VALUES ${valores.join(", ")}`,
        params
      );
    }

    if (datos.seats && datos.seats.length) {
      const valores = [];
      const params = [];
      datos.seats.forEach((s, i) => {
        const base = i * 6;
        params.push(id, s.id, s.row, s.col, s.type || null, s.status || "available");
        valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
      });
      await client.query(
        `INSERT INTO asientos (evento_id, asiento_id, fila, columna, zona, estado)
         VALUES ${valores.join(", ")}`,
        params
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

module.exports = {
  listar,
  listarConDetalle,
  existe,
  buscarEstado,
  buscarPorId,
  crear,
  actualizar,
  publicar,
  cancelar,
  eliminar,
  aEventoFrontend,
};
