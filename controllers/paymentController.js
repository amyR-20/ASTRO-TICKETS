const stripeService = require("../services/stripeService");
const usuarioModel = require("../models/usuarioModel");

async function configuracion(req, res) {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return res.status(503).json({ error: "Falta la clave pública de Stripe." });
  return res.json({ publishableKey, currency: String(process.env.STRIPE_CURRENCY || "dop").toLowerCase() });
}

async function crearIntento(req, res) {
  try {
    const funcionId = String(req.body?.funcionId || "").trim();
    if (!funcionId) return res.status(400).json({ error: "Falta la función del evento." });
    const usuario = await usuarioModel.buscarPorId(req.usuario.id);
    const pago = await stripeService.crearIntento({ usuarioId: req.usuario.id, funcionId, email: usuario?.email });
    return res.status(201).json(pago);
  } catch (error) {
    console.error("Error creando PaymentIntent:", error.type || error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Stripe no pudo preparar el pago." });
  }
}

module.exports = { configuracion, crearIntento };
