/* ============================================================
   Astro Tickets — controllers/funcionController.js (Fases 4 + 5)
   Funciones por evento + reservas con concurrencia + inventario.
   ============================================================ */

const eventoModel = require("../models/eventoModel");
const funcionModel = require("../models/funcionModel");
const reservaModel = require("../models/reservaModel");

const ESTADOS_VALIDOS = ["programada", "activa", "agotada", "cancelada", "finalizada"];

function validarFechaHora(fecha, hora) {
  const errores = [];
  const hoy = new Date();
  if (fecha) {
    const f = new Date(fecha);
    if (Number.isNaN(f.getTime())) {
      errores.push("La fecha de la función no es válida.");
    } else if (f.toISOString().slice(0, 10) < hoy.toISOString().slice(0, 10)) {
      errores.push("La fecha de la función no puede ser anterior a hoy.");
    }
  }
  if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    errores.push("La hora debe tener formato HH:MM.");
  }
  return errores;
}

/** GET /api/eventos/:eventoId/funciones — funciones de un evento. */
async function listar(req, res) {
  try {
    const evento = await eventoModel.buscarPorId(req.params.eventoId);
    if (!evento) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    return res.json({ funciones: evento.funciones || [] });
  } catch (err) {
    console.error("Error listando funciones:", err);
    return res.status(500).json({ error: "Error interno al listar las funciones." });
  }
}

/** GET /api/funciones/:id — detalle de una función (asientos + estadísticas). */
async function ver(req, res) {
  try {
    const detalle = await funcionModel.buscarPorId(req.params.id);
    if (!detalle) {
      return res.status(404).json({ error: "Función no encontrada." });
    }
    return res.json(detalle);
  } catch (err) {
    console.error("Error obteniendo función:", err);
    return res.status(500).json({ error: "Error interno al obtener la función." });
  }
}

/** POST /api/eventos/:id/funciones — crea una función (solo admin). */
async function crear(req, res) {
  try {
    const { fecha, hora, sala, estado, razon } = req.body || {};
    const errores = validarFechaHora(fecha, hora);
    if (!fecha) errores.push("La fecha de la función es obligatoria.");
    if (!hora) errores.push("La hora de la función es obligatoria.");
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      errores.push(`Estado inválido: ${estado}.`);
    }
    if (errores.length) {
      return res.status(400).json({ error: errores.join(" ") });
    }

    const evento = await eventoModel.buscarPorId(req.params.eventoId);
    if (!evento) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }

    const funcion = await funcionModel.crear({
      eventoId: req.params.eventoId,
      fecha,
      hora,
      sala,
      estado: estado || (evento.status === "published" ? "activa" : "programada"),
      usuarioId: req.usuario.id,
      razon: razon || null,
    });
    return res.status(201).json({ funcion });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una función con esa fecha y hora para este evento." });
    }
    console.error("Error creando función:", err);
    return res.status(500).json({ error: "Error interno al crear la función." });
  }
}

/** PUT /api/funciones/:id — actualiza una función (solo admin). */
async function actualizar(req, res) {
  try {
    const { fecha, hora, sala, estado, razon } = req.body || {};
    const errores = validarFechaHora(fecha, hora);
    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      errores.push(`Estado inválido: ${estado}.`);
    }
    if (errores.length) {
      return res.status(400).json({ error: errores.join(" ") });
    }
    if (estado === "cancelada" && !(razon || "").trim()) {
      return res.status(400).json({ error: "La razón es obligatoria para cancelar la función." });
    }

    const funcion = await funcionModel.actualizar(
      req.params.id,
      { fecha, hora, sala, estado },
      req.usuario.id,
      razon || null
    );
    if (!funcion) {
      return res.status(404).json({ error: "Función no encontrada." });
    }
    return res.json({ funcion });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una función con esa fecha y hora para este evento." });
    }
    console.error("Error actualizando función:", err);
    return res.status(500).json({ error: "Error interno al actualizar la función." });
  }
}

/** DELETE /api/funciones/:id — elimina una función (solo admin). */
async function eliminar(req, res) {
  try {
    const resultado = await funcionModel.eliminar(
      req.params.id,
      req.usuario.id,
      req.body?.razon || null
    );
    if (!resultado) {
      return res.status(404).json({ error: "Función no encontrada." });
    }
    if (resultado.tieneEntradas) {
      return res.status(409).json({ error: "No se puede eliminar: la función tiene entradas vendidas." });
    }
    return res.json({ mensaje: "Función eliminada." });
  } catch (err) {
    console.error("Error eliminando función:", err);
    return res.status(500).json({ error: "Error interno al eliminar la función." });
  }
}

/** POST /api/funciones/:id/reservar — reserva asientos (requiere sesión). */
async function reservar(req, res) {
  try {
    const { asientos } = req.body || {};
    if (!Array.isArray(asientos) || !asientos.length) {
      return res.status(400).json({ error: "Debes seleccionar al menos un asiento." });
    }
    const idsUnicos = [...new Set(asientos.map((s) => String(s).trim()).filter(Boolean))];
    if (!idsUnicos.length || idsUnicos.some((s) => !/^[A-Z]+\d+$/.test(s))) {
      return res.status(400).json({ error: "Asientos seleccionados no válidos." });
    }

    const funcionId = Number(req.params.id);
    if (!Number.isInteger(funcionId) || funcionId <= 0) {
      return res.status(400).json({ error: "La función seleccionada no es válida." });
    }

    const resultado = await reservaModel.reservar({
      usuarioId: req.usuario.id,
      funcionId,
      asientoIds: idsUnicos,
    });

    if (resultado.status) {
      return res.status(resultado.status).json({
        error: resultado.mensaje,
        asientos: resultado.asientos || undefined,
      });
    }
    return res.status(201).json(resultado);
  } catch (err) {
    console.error("Error reservando asientos:", err);
    return res.status(500).json({ error: "Error interno al reservar los asientos." });
  }
}

/** DELETE /api/funciones/:id/reservas — libera las reservas del usuario. */
async function cancelarReservas(req, res) {
  try {
    const { asientos } = req.body || {};
    if (!Array.isArray(asientos) || !asientos.length) {
      return res.status(400).json({ error: "Debes indicar qué asientos liberar." });
    }
    await reservaModel.cancelar({
      usuarioId: req.usuario.id,
      funcionId: req.params.id,
      asientoIds: asientos.map((s) => String(s)),
    });
    return res.json({ mensaje: "Reservas liberadas." });
  } catch (err) {
    console.error("Error cancelando reservas:", err);
    return res.status(500).json({ error: "Error interno al cancelar las reservas." });
  }
}

/** GET /api/funciones/:id/mis-reservas — resumen autoritativo del checkout. */
async function misReservas(req, res) {
  try {
    const resumen = await reservaModel.resumenActivasDeUsuario(req.usuario.id, req.params.id);
    if (!resumen.reservas.length) {
      return res.status(404).json({ error: "No tienes reservas activas para esta función." });
    }
    return res.json(resumen);
  } catch (err) {
    console.error("Error consultando reservas:", err);
    return res.status(500).json({ error: "Error interno al consultar tus reservas." });
  }
}

/** POST /api/funciones/:id/asientos/:asiento/bloquear — bloquea (solo admin). */
async function bloquearAsiento(req, res) {
  try {
    const razon = (req.body?.razon || "").trim();
    if (!razon) {
      return res.status(400).json({ error: "La razón es obligatoria para bloquear un asiento." });
    }
    const resultado = await funcionModel.cambiarEstadoAsiento({
      funcionId: req.params.id,
      asiento: req.params.asiento,
      estado: "blocked",
      usuarioId: req.usuario.id,
      razon,
    });
    if (resultado.status) {
      return res.status(resultado.status).json({ error: resultado.mensaje });
    }
    return res.json({ mensaje: `Asiento ${req.params.asiento} bloqueado.` });
  } catch (err) {
    console.error("Error bloqueando asiento:", err);
    return res.status(500).json({ error: "Error interno al bloquear el asiento." });
  }
}

/** POST /api/funciones/:id/asientos/:asiento/restaurar — restaura (solo admin). */
async function restaurarAsiento(req, res) {
  try {
    const resultado = await funcionModel.cambiarEstadoAsiento({
      funcionId: req.params.id,
      asiento: req.params.asiento,
      estado: "available",
      usuarioId: req.usuario.id,
      razon: req.body?.razon || "Restauración manual",
    });
    if (resultado.status) {
      return res.status(resultado.status).json({ error: resultado.mensaje });
    }
    return res.json({ mensaje: `Asiento ${req.params.asiento} restaurado.` });
  } catch (err) {
    console.error("Error restaurando asiento:", err);
    return res.status(500).json({ error: "Error interno al restaurar el asiento." });
  }
}

module.exports = {
  listar,
  ver,
  crear,
  actualizar,
  eliminar,
  reservar,
  cancelarReservas,
  misReservas,
  bloquearAsiento,
  restaurarAsiento,
};
