    /* ============================================================
   Astro Tickets — controllers/ordenController.js (Fases 4 + 5)
   La compra se hace contra una FUNCIÓN concreta. El backend
   recalcula precios y totales desde la BD.
   ============================================================ */

const ordenModel = require("../models/ordenModel");
const entradaModel = require("../models/entradaModel");
const entradaService = require("../services/entradaService");
const comprobanteService = require("../services/comprobanteService");
const stripeService = require("../services/stripeService");

/** POST /api/ordenes — crea una compra (requiere sesión). */
async function crear(req, res) {
  try {
    const { funcionId, payment } = req.body || {};

    if (!funcionId) {
      return res.status(400).json({ error: "Debes indicar la función del evento." });
    }
    if (!payment || !payment.paymentIntentId) {
      return res.status(400).json({ error: "El pago no fue confirmado." });
    }

    const pagoVerificado = await stripeService.verificarPago({
      paymentIntentId: payment.paymentIntentId,
      usuarioId: req.usuario.id,
      funcionId,
    });

    const orden = await ordenModel.crear({
      usuarioId: req.usuario.id,
      funcionId,
      payment: pagoVerificado,
      buyer: (req.body && req.body.buyer) || null,
    });

    if (orden.status) {
      // El modelo devolvió un error HTTP (404/409/400)
      return res.status(orden.status).json({ error: orden.mensaje });
    }

    return res.status(201).json({ orden });
  } catch (err) {
    console.error("Error creando orden:", err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : "Error interno al guardar la compra." });
  }
}

/** GET /api/ordenes/mis-compras — historial del usuario logueado. */
async function misCompras(req, res) {
  try {
    const compras = await ordenModel.listarPorUsuario(req.usuario.id);
    return res.json({ compras });
  } catch (err) {
    console.error("Error obteniendo compras:", err);
    return res.status(500).json({ error: "Error interno al obtener tus compras." });
  }
}

/** GET /api/ordenes/:id — una orden del propietario (o admin). */
async function obtener(req, res) {
  try {
    const compras = await ordenModel.listarPorUsuario(req.usuario.id);
    const orden = compras.find((compra) => String(compra.orderId) === String(req.params.id));
    if (orden) return res.json({ orden });
    const todas = await ordenModel.listarTodas();
    const existe = todas.find((compra) => String(compra.id) === String(req.params.id));
    if (existe) return res.status(403).json({ error: "No tienes acceso a esta orden." });
    return res.status(404).json({ error: "Orden no encontrada para este usuario." });
  } catch (err) {
    console.error("Error obteniendo orden:", err);
    return res.status(500).json({ error: "Error interno al obtener la orden." });
  }
}

/** GET /api/ordenes/:id/comprobante.pdf — descarga el comprobante de pago de la orden propia. */
async function comprobantePdf(req, res) {
  try {
    const compras = await ordenModel.listarPorUsuario(req.usuario.id);
    const orden = compras.find((compra) => String(compra.orderId) === String(req.params.id));
    if (!orden) {
      const todas = await ordenModel.listarTodas();
      if (todas.some((o) => String(o.id) === String(req.params.id))) {
        return res.status(403).json({ error: "No tienes acceso a esta orden." });
      }
      return res.status(404).json({ error: "Orden no encontrada para este usuario." });
    }

    let buffer;
    try {
      buffer = await comprobanteService.generarPdfComprobante(orden);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${comprobanteService.nombreArchivoComprobante(orden)}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Error generando PDF del comprobante:", err);
    return res.status(500).json({ error: "Error interno al generar el comprobante." });
  }
}

/** POST /api/ordenes/:id/reenviar — reenvía todas las entradas de la orden propia. */
async function reenviar(req, res) {
  try {
    const compras = await ordenModel.listarPorUsuario(req.usuario.id);
    const orden = compras.find((compra) => String(compra.orderId) === String(req.params.id));
    if (!orden) return res.status(403).json({ error: "No tienes acceso a esta orden." });
    if (!orden.seats.length) return res.status(404).json({ error: "La orden no tiene entradas." });

    const resultados = await Promise.all(orden.seats.map(async ({ codigo }) => {
      const entrada = await entradaModel.obtenerEntrada(codigo);
      if (!entrada || entrada.usuario_id !== req.usuario.id) throw new Error("Entrada no autorizada.");
      return entradaService.enviarPdfPorEmail(entrada);
    }));
    const fallo = resultados.find((resultado) => !resultado.enviado);
    if (fallo) return res.status(503).json({ error: "No se pudo enviar el correo.", motivo: fallo.motivo });

    console.info("AUDIT ticket_email", { usuarioId: req.usuario.id, ordenId: orden.orderId, fecha: new Date().toISOString(), resultado: "enviado" });
    return res.json({ mensaje: "Confirmación enviada al correo registrado.", entradas: resultados.length });
  } catch (err) {
    console.error("Error reenviando confirmación de orden:", err);
    return res.status(500).json({ error: "Error interno al reenviar la confirmación." });
  }
}

/** GET /api/ordenes — todas las compras (solo admin). */
async function listar(req, res) {
  try {
    const ordenes = await ordenModel.listarTodas();
    return res.json({ ordenes });
  } catch (err) {
    console.error("Error listando órdenes:", err);
    return res.status(500).json({ error: "Error interno al listar las compras." });
  }
}

module.exports = { crear, misCompras, obtener, comprobantePdf, reenviar, listar };
