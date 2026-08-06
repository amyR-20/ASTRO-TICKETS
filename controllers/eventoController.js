/* ============================================================
   Astro Tickets — controllers/eventoController.js (Fases 4 + 5)
   Validaciones de entrada + códigos HTTP correctos + auditoría.
   ============================================================ */

const eventoModel = require("../models/eventoModel");

const ESTADOS_VALIDOS = ["draft", "published", "cancelado"];

function validarDatos(datos) {
  const errores = [];
  if (!datos.name || !String(datos.name).trim()) errores.push("El nombre del evento es obligatorio.");
  if (datos.status && !ESTADOS_VALIDOS.includes(datos.status)) {
    errores.push(`Estado inválido: ${datos.status}.`);
  }
  if (datos.capacity !== undefined && Number(datos.capacity) < 0) {
    errores.push("La capacidad no puede ser negativa.");
  }
  if (datos.rows !== undefined && Number(datos.rows) < 0) {
    errores.push("El número de filas no puede ser negativo.");
  }
  if (datos.cols !== undefined && Number(datos.cols) < 0) {
    errores.push("El número de columnas no puede ser negativo.");
  }
  if (datos.zones) {
    for (const z of datos.zones) {
      if (z.price !== undefined && (Number(z.price) < 0 || Number.isNaN(Number(z.price)))) {
        errores.push(`Precio inválido en la zona "${z.name}".`);
      }
      if (z.qty !== undefined && (Number(z.qty) < 0 || Number.isNaN(Number(z.qty)))) {
        errores.push(`Cantidad inválida en la zona "${z.name}".`);
      }
    }
  }
  return errores;
}

/** GET /api/eventos?estado=published|draft — lista eventos. */
async function listar(req, res) {
  try {
    const estado = req.query.estado || null;
    const eventos = await eventoModel.listarConDetalle(estado);
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
    const datos = req.body || {};
    const errores = validarDatos(datos);
    if (errores.length) {
      return res.status(400).json({ error: errores.join(" ") });
    }
    if (!datos.date) {
      return res.status(400).json({ error: "Nombre y fecha son obligatorios." });
    }
    if (!datos.id) {
      datos.id =
        "evt-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    }
    const evento = await eventoModel.crear(datos, req.usuario.id, datos.razon || null);
    return res.status(201).json({ evento });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "El evento ya existe." });
    }
    if (/sin asientos y zonas|zona sin precio/i.test(err.message || "")) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Error creando evento:", err);
    return res.status(500).json({ error: "Error interno al crear el evento." });
  }
}

/** PUT /api/eventos/:id — actualiza un evento (solo admin). */
async function actualizar(req, res) {
  try {
    const datos = req.body || {};
    const errores = validarDatos(datos);
    if (errores.length) {
      return res.status(400).json({ error: errores.join(" ") });
    }
    const existe = await eventoModel.existe(req.params.id);
    if (!existe) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    const evento = await eventoModel.actualizar(req.params.id, datos, req.usuario.id, datos.razon || null);
    return res.json({ evento });
  } catch (err) {
    console.error("Error actualizando evento:", err);
    return res.status(500).json({ error: "Error interno al actualizar el evento." });
  }
}

/** POST /api/eventos/:id/publicar — publica un evento y sus funciones. */
async function publicar(req, res) {
  try {
    const estado = await eventoModel.buscarEstado(req.params.id);
    if (!estado) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    if (estado.estado === "cancelado") {
      return res.status(409).json({ error: "No se puede publicar un evento cancelado." });
    }
    await eventoModel.publicar(req.params.id, req.usuario.id, req.body?.razon || null);
    return res.json({ mensaje: "Evento publicado." });
  } catch (err) {
    console.error("Error publicando evento:", err);
    return res.status(500).json({ error: "Error interno al publicar el evento." });
  }
}

/** POST /api/eventos/:id/cancelar — cancela evento y funciones (requiere razón). */
async function cancelar(req, res) {
  try {
    const razon = (req.body?.razon || "").trim();
    if (!razon) {
      return res.status(400).json({ error: "La razón es obligatoria para cancelar." });
    }
    const existe = await eventoModel.existe(req.params.id);
    if (!existe) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    await eventoModel.cancelar(req.params.id, req.usuario.id, razon);
    return res.json({ mensaje: "Evento cancelado." });
  } catch (err) {
    console.error("Error cancelando evento:", err);
    return res.status(500).json({ error: "Error interno al cancelar el evento." });
  }
}

/** DELETE /api/eventos/:id — elimina un evento (solo admin). */
async function eliminar(req, res) {
  try {
    const borrado = await eventoModel.eliminar(req.params.id, req.usuario.id, req.body?.razon || null);
    if (!borrado) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }
    return res.json({ mensaje: "Evento eliminado." });
  } catch (err) {
    console.error("Error eliminando evento:", err);
    return res.status(500).json({ error: "Error interno al eliminar el evento." });
  }
}

module.exports = { listar, ver, crear, actualizar, publicar, cancelar, eliminar };
