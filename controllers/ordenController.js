    /* ============================================================
   Astro Tickets — controllers/ordenController.js (Fases 4 + 5)
   La compra se hace contra una FUNCIÓN concreta. El backend
   recalcula precios y totales desde la BD.
   ============================================================ */

const ordenModel = require("../models/ordenModel");

/** POST /api/ordenes — crea una compra (requiere sesión). */
async function crear(req, res) {
  try {
    const { funcionId, payment } = req.body || {};

    if (!funcionId) {
      return res.status(400).json({ error: "Debes indicar la función del evento." });
    }
    if (!payment || !payment.transactionId || !payment.reservationCode) {
      return res.status(400).json({ error: "El pago no fue confirmado." });
    }

    const orden = await ordenModel.crear({
      usuarioId: req.usuario.id,
      funcionId,
      payment,
    });

    if (orden.status) {
      // El modelo devolvió un error HTTP (404/409/400)
      return res.status(orden.status).json({ error: orden.mensaje });
    }

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
