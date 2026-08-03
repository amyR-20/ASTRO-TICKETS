/* ============================================================
   Astro Tickets — controllers/eventoController.js
   ============================================================ */

const eventoModel = require("../models/eventoModel");

/** GET /api/eventos?estado=published|draft — lista eventos. */
async function listar(req, res) {
  try {
    const estado = req.query.estado || null;
    const filas = await eventoModel.listar(estado);
    const eventos = await Promise.all(
      filas.map((f) => eventoModel.buscarPorId(f.id))
    );
    return res.json({ eventos });
  } catch (err) {
    console.error("Error listando eventos:", err);
    return res.status(500).json({ error: "Error interno al listar los eventos." });
  }
}

/** GET /api/eventos/:id — detalle de un evento. */
async function ver(req, res) {
  try {
    const evento = await eventoModel.buscarPorId(req.params.id);
    if (!evento) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    return res.json({ evento });
  } catch (err) {
    console.error("Error obteniendo evento:", err);
    return res.status(500).json({ error: "Error interno al obtener el evento." });
  }
}

/** POST /api/eventos — crea un evento (solo admin). */
async function crear(req, res) {
  try {
    const datos = req.body;
    if (!datos || !datos.name || !datos.date) {
      return res.status(400).json({ error: "Nombre y fecha son obligatorios." });
    }
    if (!datos.id) {
      datos.id =
        "evt-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    }
    const evento = await eventoModel.crear(datos);
    return res.status(201).json({ evento });
  } catch (err) {
    console.error("Error creando evento:", err);
    return res.status(500).json({ error: "Error interno al crear el evento." });
  }
}

/** PUT /api/eventos/:id — actualiza un evento (solo admin). */
async function actualizar(req, res) {
  try {
    const existe = await eventoModel.buscarPorId(req.params.id);
    if (!existe) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    const evento = await eventoModel.actualizar(req.params.id, req.body);
    return res.json({ evento });
  } catch (err) {
    console.error("Error actualizando evento:", err);
    return res.status(500).json({ error: "Error interno al actualizar el evento." });
  }
}

/** DELETE /api/eventos/:id — elimina un evento (solo admin). */
async function eliminar(req, res) {
  try {
    const borrado = await eventoModel.eliminar(req.params.id);
    if (!borrado) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    return res.json({ mensaje: "Evento eliminado." });
  } catch (err) {
    console.error("Error eliminando evento:", err);
    return res.status(500).json({ error: "Error interno al eliminar el evento." });
  }
}

module.exports = { listar, ver, crear, actualizar, eliminar };
