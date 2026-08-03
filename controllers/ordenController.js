/* ============================================================
   Astro Tickets — controllers/ordenController.js
   ============================================================ */

const ordenModel = require("../models/ordenModel");
const eventoModel = require("../models/eventoModel");

/** POST /api/ordenes — crea una compra (requiere sesión). */
async function crear(req, res) {
  try {
    const { eventoId, seats, pricing, payment } = req.body || {};

    if (!eventoId || !Array.isArray(seats) || !seats.length || !payment) {
      return res.status(400).json({ error: "Datos de compra incompletos." });
    }
    if (!payment.transactionId || !payment.reservationCode) {
      return res.status(400).json({ error: "El pago no fue confirmado." });
    }

    const evento = await eventoModel.buscarPorId(eventoId);
    if (!evento) {
      return res.status(404).json({ error: "Evento no encontrado." });
    }

    const orden = await ordenModel.crear({
      usuarioId: req.usuario.id,
      eventoId,
      seats,
      pricing: pricing || { subtotal: 0, fee: 0, total: 0 },
      payment,
    });

    return res.status(201).json({ orden });
  } catch (err) {
    console.error("Error creando orden:", err);
    return res.status(500).json({ error: "Error interno al guardar la compra." });
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

module.exports = { crear, misCompras, listar };
