/* ============================================================
   Astro Tickets — controllers/waitlistController.js
   Endpoints de lista de espera (requieren sesión).
   ============================================================ */

const waitlistModel = require("../models/waitlistModel");

/** POST /api/funciones/:id/lista-espera */
async function unirse(req, res) {
  try {
    await waitlistModel.unirse(req.usuario.id, req.params.id);
    return res.status(201).json({ mensaje: "Te avisaremos cuando haya boletos disponibles." });
  } catch (err) {
    console.error("Error en lista de espera:", err);
    return res.status(500).json({ error: "Error interno al unirte a la lista de espera." });
  }
}

/** GET /api/funciones/:id/lista-espera/mi */
async function miEstado(req, res) {
  try {
    const enLista = await waitlistModel.estado(req.usuario.id, req.params.id);
    return res.json({ enLista });  } catch (err) {
    console.error("Error consultando lista de espera:", err);
    return res.status(500).json({ error: "Error interno al consultar la lista de espera." });
  }
}

/** DELETE /api/funciones/:id/lista-espera */
async function retirarse(req, res) {
  try {
    await waitlistModel.retirarse(req.usuario.id, req.params.id);
    return res.json({ mensaje: "Te retiraste de la lista de espera." });
  } catch (err) {
    console.error("Error retirando de lista de espera:", err);
    return res.status(500).json({ error: "Error interno al retirarte de la lista de espera." });
  }
}

module.exports = { unirse, miEstado, retirarse };
