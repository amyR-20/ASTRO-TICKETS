/* ============================================================
   Astro Tickets — models/funcionModel.js (Fases 4 + 5)
   Funciones de evento + inventario + reservas vencidas + auditoría
   ============================================================ */

const { pool } = require("../config/database");

/** Minutos de vida de una reserva antes de expirar. */
const MINUTOS_RESERVA = 15;

/**
 * Expira las reservas activas vencidas y devuelve los asientos
 * reservados correspondientes a "available".
 * Se ejecuta antes de consultar o reservar asientos (no depende
 * de que el usuario cierre la página). Devuelve nº de reservas
 * expiradas. Si en el futuro se necesita que esto ocurra de forma
 * automática sin peticiones, se deberá programar un cron job que
 * llame a esta función cada 1-2 minutos.
 *
 * Acepta un `client` opcional: si se pasa, ejecuta los UPDATE dentro
 * de la transacción de ese cliente (evita abrir una segunda conexión
 * del pool durante reservar/comprar).
 */
async function liberarReservasVencidas(client = null) {
  const ejecutar = async (con) => {
    // 1) Marcar reservas activas vencidas como expiradas
    const res = await con.query(
      `UPDATE reservas SET estado = 'expirada'
       WHERE estado = 'activa' AND expira_en <= now()`
    );

    // 2) Liberar asientos que quedaron 'reserved' sin reserva activa
    await con.query(
      `UPDATE asientos a SET estado = 'available'
       WHERE a.estado = 'reserved'
         AND a.funcion_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM reservas r
           WHERE r.funcion_id = a.funcion_id
             AND r.asiento_id = a.asiento_id
             AND r.estado = 'activa'
         )`
    );
    return res.rowCount || 0;
  };

  if (client) return ejecutar(client);

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const n = await ejecutar(c);
    await c.query("COMMIT");
    return n;
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    c.release();
  }
}

/**
 * Estadísticas de inventario de una función.
 * Una sola consulta con COUNT(*) FILTER (antes usaba 6 subconsultas
 * que escaneaban `asientos` una vez por cada contador).
 * Devuelve { capacidad, vendidos, reservados, bloqueados, disponibles,
 *            pctDisponible, agotada, zonas: [...] }
 */
async function estadisticas(funcionId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS capacidad,
       COUNT(*) FILTER (WHERE estado = 'sold') AS vendidos,
       COUNT(*) FILTER (WHERE estado = 'reserved') AS reservados,
       COUNT(*) FILTER (WHERE estado = 'blocked') AS bloqueados,
       COUNT(*) FILTER (WHERE estado = 'available') AS disponibles,
       COALESCE(
         (SELECT json_agg(z) FROM (
            SELECT zona,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE estado = 'sold') AS vendidos,
                   COUNT(*) FILTER (WHERE estado = 'reserved') AS reservados,
                   COUNT(*) FILTER (WHERE estado = 'blocked') AS bloqueados,
                   COUNT(*) FILTER (WHERE estado = 'available') AS disponibles
            FROM asientos
            WHERE funcion_id = $1
            GROUP BY zona
          ) z), '[]'
       ) AS zonas
     FROM asientos
     WHERE funcion_id = $1`,
    [funcionId]
  );

  const fila = rows[0];
  if (!fila) {
    return {
      capacidad: 0, vendidos: 0, reservados: 0, bloqueados: 0,
      disponibles: 0, pctDisponible: 0, agotada: false, zonas: [],
    };
  }

  const capacidad = Number(fila.capacidad);
  const disponibles = Number(fila.disponibles);
  return {
    capacidad,
    vendidos: Number(fila.vendidos),
    reservados: Number(fila.reservados),
    bloqueados: Number(fila.bloqueados),
    disponibles,
    pctDisponible: capacidad > 0 ? Math.round((disponibles / capacidad) * 100) : 0,
    agotada: capacidad > 0 && disponibles === 0,
    zonas: fila.zonas.map((z) => ({
      zona: z.zona,
      total: Number(z.total),
      vendidos: Number(z.vendidos),
      reservados: Number(z.reservados),
      bloqueados: Number(z.bloqueados),
      disponibles: Number(z.disponibles),
      agotada: z.total > 0 && Number(z.disponibles) === 0,
    })),
  };
}

/**
 * Estadísticas de todas las funciones cuyos ids se pasan, en 2 consultas
 * (totales + por zona) en lugar de 2 consultas POR función.
 * Devuelve un Map<funcionId, stats>.
 */
async function estadisticasMasivas(funcionIds) {
  const mapa = new Map();
  if (!funcionIds.length) return mapa;

  const { rows: totales } = await pool.query(
    `SELECT funcion_id,
            COUNT(*) AS capacidad,
            COUNT(*) FILTER (WHERE estado = 'sold') AS vendidos,
            COUNT(*) FILTER (WHERE estado = 'reserved') AS reservados,
            COUNT(*) FILTER (WHERE estado = 'blocked') AS bloqueados,
            COUNT(*) FILTER (WHERE estado = 'available') AS disponibles
     FROM asientos
     WHERE funcion_id = ANY($1::int[])
     GROUP BY funcion_id`,
    [funcionIds]
  );

  const { rows: porZona } = await pool.query(
    `SELECT funcion_id, zona,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE estado = 'sold') AS vendidos,
            COUNT(*) FILTER (WHERE estado = 'reserved') AS reservados,
            COUNT(*) FILTER (WHERE estado = 'blocked') AS bloqueados,
            COUNT(*) FILTER (WHERE estado = 'available') AS disponibles
     FROM asientos
     WHERE funcion_id = ANY($1::int[])
     GROUP BY funcion_id, zona
     ORDER BY funcion_id`,
    [funcionIds]
  );

  const zonasPorFuncion = new Map();
  for (const z of porZona) {
    if (!zonasPorFuncion.has(z.funcion_id)) zonasPorFuncion.set(z.funcion_id, []);
    zonasPorFuncion.get(z.funcion_id).push(z);
  }

  for (const t of totales) {
    const capacidad = Number(t.capacidad);
    const disponibles = Number(t.disponibles);
    const zonas = (zonasPorFuncion.get(t.funcion_id) || []).map((z) => ({
      zona: z.zona,
      total: Number(z.total),
      vendidos: Number(z.vendidos),
      reservados: Number(z.reservados),
      bloqueados: Number(z.bloqueados),
      disponibles: Number(z.disponibles),
      agotada: Number(z.total) > 0 && Number(z.disponibles) === 0,
    }));
    mapa.set(t.funcion_id, {
      capacidad,
      vendidos: Number(t.vendidos),
      reservados: Number(t.reservados),
      bloqueados: Number(t.bloqueados),
      disponibles,
      pctDisponible: capacidad > 0 ? Math.round((disponibles / capacidad) * 100) : 0,
      agotada: capacidad > 0 && disponibles === 0,
      zonas,
    });
  }
  return mapa;
}

/** Lista las funciones de un evento con sus estadísticas. */
async function listarPorEvento(eventoId) {
  const { rows } = await pool.query(
    `SELECT * FROM funciones_evento
     WHERE evento_id = $1
     ORDER BY fecha ASC, hora ASC`,
    [eventoId]
  );
  if (!rows.length) return rows;

  const stats = await estadisticasMasivas(rows.map((f) => f.id));
  return rows.map((f) => ({ ...f, stats: stats.get(f.id) || null }));
}

/** Busca una función por id con sus asientos y estadísticas. */
async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT f.*, e.nombre AS evento_nombre, e.descripcion AS evento_descripcion,
            e.imagen AS evento_imagen, e.categoria AS evento_categoria
     FROM funciones_evento f JOIN eventos e ON e.id = f.evento_id
     WHERE f.id = $1`,
    [id]
  );
  if (!rows.length) return null;

  const asientos = (await pool.query(
    `SELECT id, asiento_id, fila, columna, zona, estado
     FROM asientos WHERE funcion_id = $1 ORDER BY fila, columna`,
    [id]
  )).rows;

  // Las zonas pertenecen a la función. Como compatibilidad con eventos que
  // todavía sólo tienen plantilla, se usa la plantilla únicamente si no hay
  // zonas propias para esta función; nunca se mezclan ambas listas.
  let zonas = (await pool.query(
    `SELECT nombre, color, precio, cantidad, descripcion
     FROM zonas WHERE funcion_id = $1 ORDER BY id`,
    [id]
  )).rows;
  if (!zonas.length) {
    zonas = (await pool.query(
      `SELECT nombre, color, precio, cantidad, descripcion
       FROM zonas WHERE evento_id = $1 AND funcion_id IS NULL ORDER BY id`,
      [rows[0].evento_id]
    )).rows;
  }

  return {
    ...rows[0],
    evento: {
      id: rows[0].evento_id,
      nombre: rows[0].evento_nombre,
      descripcion: rows[0].evento_descripcion,
      imagen: rows[0].evento_imagen,
      categoria: rows[0].evento_categoria,
    },
    zonas: zonas.map((z) => ({
      name: z.nombre,
      color: z.color,
      price: Number(z.precio),
      qty: z.cantidad,
      desc: z.descripcion,
    })),
    asientos: asientos.map((a) => ({
      id: a.asiento_id,
      row: a.fila,
      col: a.columna,
      type: a.zona,
      status: a.estado,
    })),
    stats: await estadisticas(id),
  };
}

/**
 * Crea una función para un evento. Clona la plantilla de asientos del
 * evento (asientos sin función) a esta función, todos "available".
 * Si el evento no tiene plantilla, genera asientos con filas/columnas.
 */
async function crear(datos) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const funcion = await crearEnCliente(client, datos);
    await client.query("COMMIT");
    return funcion;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Crea una función dentro de una transacción ya abierta. */
async function crearEnCliente(client, { eventoId, fecha, hora, sala, estado = "programada", usuarioId = null, razon = null }) {
  const ins = await client.query(
    `INSERT INTO funciones_evento (evento_id, fecha, hora, sala, estado)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [eventoId, fecha, hora, sala || null, estado]
  );
  const funcion = ins.rows[0];

  // Plantilla de asientos del evento (sin función)
  let plantilla = (await client.query(
    `SELECT asiento_id, fila, columna, zona, estado
     FROM asientos WHERE evento_id = $1 AND funcion_id IS NULL
     ORDER BY fila, columna`,
    [eventoId]
  )).rows;

  // Si no hay plantilla, generar a partir de filas/columnas del evento
  if (!plantilla.length) {
    const ev = (await client.query(
      `SELECT filas, columnas FROM eventos WHERE id = $1`,
      [eventoId]
    )).rows[0];
    const filas = Number(ev?.filas) || 0;
    const columnas = Number(ev?.columnas) || 0;
    plantilla = [];
    for (let r = 0; r < filas; r++) {
      const fila = String.fromCharCode(65 + r);
      for (let c = 1; c <= columnas; c++) {
        plantilla.push({ asiento_id: fila + c, fila, columna: c, zona: null, estado: "available" });
      }
    }
  }
  if (plantilla.length) {
    // Lotes: evita superar el límite de parámetros de PostgreSQL en recintos grandes.
    for (let inicio = 0; inicio < plantilla.length; inicio += 1000) {
      const lote = plantilla.slice(inicio, inicio + 1000);
      const valores = [];
      const params = [];
      lote.forEach((a, i) => {
        const base = i * 7;
        params.push(eventoId, funcion.id, a.asiento_id, a.fila, a.columna, a.zona || null, "available");
        valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`);
      });
      await client.query(
        `INSERT INTO asientos (evento_id, funcion_id, asiento_id, fila, columna, zona, estado)
         VALUES ${valores.join(", ")}`,
        params
      );
    }
  }

  // Cada función recibe su propia copia de precios. Así editar la plantilla
  // nunca altera una función que ya está a la venta o tiene entradas.
  const zonasPlantilla = (await client.query(
    `SELECT nombre, color, precio, cantidad, descripcion
     FROM zonas WHERE evento_id = $1 AND funcion_id IS NULL ORDER BY id`,
    [eventoId]
  )).rows;
  if (!zonasPlantilla.length || plantilla.some((a) => !a.zona)) {
    throw new Error("No se puede crear una función sin asientos y zonas con precio válido.");
  }

  if (zonasPlantilla.length) {
    const valores = [];
    const params = [];
    zonasPlantilla.forEach((zona, i) => {
      if (!zona.nombre || Number(zona.precio) < 0) {
        throw new Error("No se puede crear una función con una zona sin precio válido.");
      }
      const base = i * 7;
      params.push(eventoId, funcion.id, zona.nombre, zona.color, zona.precio, zona.cantidad, zona.descripcion);
      valores.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`);
    });
    await client.query(
      `INSERT INTO zonas (evento_id, funcion_id, nombre, color, precio, cantidad, descripcion)
       VALUES ${valores.join(", ")}`,
      params
    );
  }

  await registrarAuditoria(client, {
    usuarioId, accion: "funcion.crear", entidad: "funciones_evento",
    entidadId: String(funcion.id), funcionId: funcion.id, razon,
  });

  return funcion;
}

/** Actualiza una función (fecha, hora, sala, estado). Audita. */
async function actualizar(id, datos, usuarioId = null, razon = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const anterior = (await client.query(
      `SELECT * FROM funciones_evento WHERE id = $1 FOR UPDATE`,
      [id]
    )).rows[0];
    if (!anterior) return null;

    const upd = await client.query(
      `UPDATE funciones_evento SET
         fecha = $1, hora = $2, sala = $3, estado = $4, actualizado_en = now()
       WHERE id = $5 RETURNING *`,
      [
        datos.fecha !== undefined ? datos.fecha : anterior.fecha,
        datos.hora !== undefined ? datos.hora : anterior.hora,
        datos.sala !== undefined ? datos.sala : anterior.sala,
        datos.estado !== undefined ? datos.estado : anterior.estado,
        id,
      ]
    );

    if (anterior.estado !== upd.rows[0].estado) {
      await registrarAuditoria(client, {
        usuarioId, accion: "funcion.cambio_estado", entidad: "funciones_evento",
        entidadId: String(id), funcionId: id,
        razon: razon || `Estado: ${anterior.estado} → ${upd.rows[0].estado}`,
        detalle: { desde: anterior.estado, hasta: upd.rows[0].estado },
      });
    } else {
      await registrarAuditoria(client, {
        usuarioId, accion: "funcion.editar", entidad: "funciones_evento",
        entidadId: String(id), funcionId: id, razon,
      });
    }

    await client.query("COMMIT");
    return upd.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Elimina una función (solo si no tiene entradas vendidas). Audita. */
async function eliminar(id, usuarioId = null, razon = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const funcion = (await client.query(
      `SELECT * FROM funciones_evento WHERE id = $1 FOR UPDATE`,
      [id]
    )).rows[0];
    if (!funcion) return null;

    const conEntradas = (await client.query(
      `SELECT 1 FROM entradas WHERE funcion_id = $1 LIMIT 1`,
      [id]
    )).rows.length > 0;
    if (conEntradas) return { tieneEntradas: true };

    await registrarAuditoria(client, {
      usuarioId, accion: "funcion.eliminar", entidad: "funciones_evento",
      entidadId: String(id), funcionId: id, razon,
    });

    // ON DELETE CASCADE borra los asientos de la función
    await client.query(`DELETE FROM funciones_evento WHERE id = $1`, [id]);

    await client.query("COMMIT");
    return { tieneEntradas: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Reservas activas que expiran pronto (para el panel admin). */
async function reservasPorVencer(minutos = 10) {
  const { rows } = await pool.query(
    `SELECT r.id, r.usuario_id, u.nombre AS usuario_nombre, u.email AS usuario_email,
            r.funcion_id, f.evento_id, e.nombre AS evento_nombre,
            f.fecha AS funcion_fecha, f.hora AS funcion_hora,
            r.asiento_id, r.zona, r.precio, r.expira_en
     FROM reservas r
     JOIN funciones_evento f ON f.id = r.funcion_id
     JOIN eventos e ON e.id = f.evento_id
     LEFT JOIN usuarios u ON u.id = r.usuario_id
     WHERE r.estado = 'activa' AND r.expira_en <= now() + ($1 * interval '1 minute')
     ORDER BY r.expira_en ASC`,
    [minutos]
  );
  return rows;
}

/** Resumen global por evento → función (panel admin). */
async function resumenGlobal() {
  await liberarReservasVencidas();
  // 4 consultas en total: eventos, funciones, totales y por zona.
  // Antes hacía 1 consulta por evento + 2 por función (N+1).
  const { rows: eventos } = await pool.query(
    `SELECT * FROM eventos ORDER BY creado_en DESC`
  );
  if (!eventos.length) return [];

  const idsEventos = eventos.map((e) => e.id);
  const { rows: funciones } = await pool.query(
    `SELECT * FROM funciones_evento
     WHERE evento_id = ANY($1::text[])
     ORDER BY fecha ASC, hora ASC`,
    [idsEventos]
  );

  const stats = await estadisticasMasivas(funciones.map((f) => f.id));

  const porEvento = new Map(eventos.map((e) => [e.id, []]));
  for (const f of funciones) {
    const lista = porEvento.get(f.evento_id);
    if (lista) lista.push({ ...f, stats: stats.get(f.id) || null });
  }

  return eventos.map((e) => ({ evento: e, funciones: porEvento.get(e.id) || [] }));
}

/** Cambia el estado de un asiento de la función (admin). Audita. */
async function cambiarEstadoAsiento({ funcionId, asiento, estado, usuarioId = null, razon = null }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actual = (await client.query(
      `SELECT id, estado FROM asientos
       WHERE funcion_id = $1 AND asiento_id = $2 FOR UPDATE`,
      [funcionId, asiento]
    )).rows[0];

    if (!actual) {
      await client.query("ROLLBACK");
      return { status: 404, mensaje: "Asiento no encontrado en esta función." };
    }

    if (estado === "blocked" && actual.estado === "sold") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "No se puede bloquear un asiento vendido." };
    }
    if (estado === "available" && actual.estado === "sold") {
      await client.query("ROLLBACK");
      return { status: 409, mensaje: "No se puede restaurar un asiento vendido." };
    }

    if (actual.estado === "reserved") {
      // Liberar la reserva activa asociada
      await client.query(
        `UPDATE reservas SET estado = 'cancelada'
         WHERE funcion_id = $1 AND asiento_id = $2 AND estado = 'activa'`,
        [funcionId, asiento]
      );
    }

    await client.query(
      `UPDATE asientos SET estado = $1 WHERE id = $2`,
      [estado, actual.id]
    );

    await registrarAuditoria(client, {
      usuarioId, accion: `asiento.${estado}`, entidad: "asientos",
      entidadId: String(actual.id), funcionId,
      razon: razon || `Estado: ${actual.estado} → ${estado}`,
      detalle: { asiento, desde: actual.estado, hasta: estado },
    });

    // Recalcular el estado de la función
    const libres = (await client.query(
      `SELECT count(*)::int AS n FROM asientos
       WHERE funcion_id = $1 AND estado = 'available'`,
      [funcionId]
    )).rows[0].n;

    await client.query(
      `UPDATE funciones_evento SET estado = CASE
         WHEN $1 > 0 THEN 'activa'
         ELSE 'agotada'
       END, actualizado_en = now()
       WHERE id = $2 AND estado <> 'cancelada'`,
      [libres, funcionId]
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Escribe en la tabla de auditoría (dentro de una transacción). */
async function registrarAuditoria(client, { usuarioId, accion, entidad, entidadId, funcionId = null, razon = null, detalle = null }) {
  await client.query(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, funcion_id, razon, detalle)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [usuarioId, accion, entidad, entidadId, funcionId, razon, detalle ? JSON.stringify(detalle) : null]
  );
}

module.exports = {
  MINUTOS_RESERVA,
  liberarReservasVencidas,
  estadisticas,
  estadisticasMasivas,
  listarPorEvento,
  buscarPorId,
  crear,
  crearEnCliente,
  actualizar,
  eliminar,
  reservasPorVencer,
  resumenGlobal,
  cambiarEstadoAsiento,
  registrarAuditoria,
};
