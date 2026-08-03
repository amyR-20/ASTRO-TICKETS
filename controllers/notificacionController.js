/* ============================================================
   Astro Tickets — controllers/notificacionController.js
   Notificaciones del usuario autenticado.
   ============================================================ */

const notificacionModel = require("../models/notificacionModel");

/** GET /api/notificaciones — lista + contador de no leídas. */
async function misNotificaciones(req, res) {
  try {
    const [notificaciones, noLeidas] = await Promise.all([
      notificacionModel.listarPorUsuario(req.usuario.id),
      notificacionModel.contarNoLeidas(req.usuario.id),
    ]);
    return res.json({ notificaciones, noLeidas });
  } catch (err) {
    console.error("Error listando notificaciones:", err);
    return res.status(500).json({ error: "Error interno al listar notificaciones." });
  }
}

/** POST /api/notificaciones/leer — marca todas como leídas. */
async function leer(req, res) {
  try {
    await notificacionModel.marcarLeidas(req.usuario.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error marcando notificaciones como leídas:", err);
    return res.status(500).json({ error: "Error interno al actualizar notificaciones." });
  }
}

module.exports = { misNotificaciones, leer };
