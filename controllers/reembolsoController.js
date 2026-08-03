/* ============================================================
   Astro Tickets — controllers/reembolsoController.js
   Reembolsos: flujo del usuario (solicitar / ver mis reembolsos)
   y del admin (listar, aprobar, rechazar o reembolsar directo).
   ============================================================ */

const reembolsoModel = require("../models/reembolsoModel");
const notificacionModel = require("../models/notificacionModel");

/** Mensaje de notificación según el idioma del usuario. */
function notificacionReembolso(estado, { idioma, eventoNombre, monto, transaccion }) {
  const es = idioma !== "en";
  const montoTxt = "RD$ " + Number(monto || 0).toLocaleString("es-DO");
  if (estado === "aprobado") {
    return {
      titulo: es ? "Reembolso aprobado" : "Refund approved",
      mensaje: es
        ? `Tu reembolso de ${montoTxt} por "${eventoNombre || "tu compra"}" fue aprobado. El dinero será devuelto a tu método de pago.`
        : `Your refund of ${montoTxt} for "${eventoNombre || "your purchase"}" was approved. The money will be returned to your payment method.`,
      tipo: "reembolso",
    };
  }
  return {
    titulo: es ? "Reembolso rechazado" : "Refund rejected",
    mensaje: es
      ? `Lamentablemente, la solicitud de reembolso de ${montoTxt} por "${eventoNombre || "tu compra"}" (${transaccion || ""}) fue rechazada.`
      : `Unfortunately, your refund request of ${montoTxt} for "${eventoNombre || "your purchase"}" (${transaccion || ""}) was rejected.`,
    tipo: "reembolso",
  };
}

async function _notificar(usuarioId, estado, datos) {
  if (!usuarioId) return;
  try {
    await notificacionModel.crear({ usuarioId, ...notificacionReembolso(estado, datos) });
  } catch (err) {
    console.error("Error creando notificación de reembolso:", err);
  }
}

/** GET /api/admin/reembolsos — historial + órdenes reembolsables. */
async function listar(req, res) {
  try {
    const [reembolsos, ordenesReembolsables] = await Promise.all([
      reembolsoModel.listarReembolsos(),
      reembolsoModel.listarOrdenesReembolsables(),
    ]);
    return res.json({ reembolsos, ordenesReembolsables });
  } catch (err) {
    console.error("Error listando reembolsos:", err);
    return res.status(500).json({ error: "Error interno al listar los reembolsos." });
  }
}

/** GET /api/reembolsos/mis-reembolsos — reembolsos y órdenes del usuario. */
async function misReembolsos(req, res) {
  try {
    const [reembolsos, reembolsables] = await Promise.all([
      reembolsoModel.listarPorUsuario(req.usuario.id),
      reembolsoModel.listarReembolsablesPorUsuario(req.usuario.id),
    ]);
    return res.json({ reembolsos, reembolsables });
  } catch (err) {
    console.error("Error listando mis reembolsos:", err);
    return res.status(500).json({ error: "Error interno al listar tus reembolsos." });
  }
}

/** POST /api/reembolsos — el usuario solicita un reembolso. */
async function solicitar(req, res) {
  try {
    const { ordenId, motivo } = req.body || {};
    if (!ordenId) {
      return res.status(400).json({ error: "Debes indicar la orden a reembolsar." });
    }
    const reembolso = await reembolsoModel.solicitar({
      ordenId,
      motivo: motivo != null ? String(motivo).trim() : null,
      usuarioId: req.usuario.id,
    });
    if (reembolso.status) {
      return res.status(reembolso.status).json({ error: reembolso.mensaje });
    }
    return res.status(201).json({ mensaje: "Solicitud de reembolso enviada.", reembolso });
  } catch (err) {
    console.error("Error solicitando reembolso:", err);
    return res.status(500).json({ error: "Error interno al solicitar el reembolso." });
  }
}

/** POST /api/admin/reembolsos/:id/aprobar — aprueba una solicitud. */
async function aprobar(req, res) {
  try {
    const resultado = await reembolsoModel.aprobar(Number(req.params.id), req.usuario.id);
    if (resultado.status) {
      return res.status(resultado.status).json({ error: resultado.mensaje });
    }
    await _notificar(resultado.usuarioId, "aprobado", {
      idioma: resultado.idioma,
      eventoNombre: resultado.eventoNombre,
      monto: resultado.monto,
      transaccion: resultado.transaccion,
    });
    return res.json({ mensaje: "Reembolso aprobado correctamente." });
  } catch (err) {
    console.error("Error aprobando reembolso:", err);
    return res.status(500).json({ error: "Error interno al aprobar el reembolso." });
  }
}

/** POST /api/admin/reembolsos/:id/rechazar — rechaza una solicitud. */
async function rechazar(req, res) {
  try {
    const resultado = await reembolsoModel.rechazar(Number(req.params.id), req.usuario.id);
    if (resultado.status) {
      return res.status(resultado.status).json({ error: resultado.mensaje });
    }
    await _notificar(resultado.usuarioId, "rechazado", {
      idioma: resultado.idioma,
      eventoNombre: resultado.eventoNombre,
      monto: resultado.monto,
      transaccion: "",
    });
    return res.json({ mensaje: "Reembolso rechazado." });
  } catch (err) {
    console.error("Error rechazando reembolso:", err);
    return res.status(500).json({ error: "Error interno al rechazar el reembolso." });
  }
}

/** POST /api/admin/reembolsos — procesa un reembolso directo. */
async function crear(req, res) {
  try {
    const { ordenId, monto, motivo } = req.body || {};
    if (!ordenId) {
      return res.status(400).json({ error: "Debes indicar la orden a reembolsar." });
    }
    const resultado = await reembolsoModel.crear({
      ordenId,
      monto,
      motivo,
      autorizadoPor: req.usuario.id,
    });
    if (resultado.status) {
      return res.status(resultado.status).json({ error: resultado.mensaje });
    }
    await _notificar(resultado.usuarioId, "aprobado", {
      idioma: resultado.idioma,
      eventoNombre: resultado.eventoNombre,
      monto: resultado.monto,
      transaccion: resultado.transaccion,
    });
    return res.status(201).json({ mensaje: "Reembolso procesado correctamente.", reembolso: resultado.reembolso });
  } catch (err) {
    console.error("Error creando reembolso:", err);
    return res.status(500).json({ error: "Error interno al procesar el reembolso." });
  }
}

module.exports = { listar, misReembolsos, solicitar, aprobar, rechazar, crear };
