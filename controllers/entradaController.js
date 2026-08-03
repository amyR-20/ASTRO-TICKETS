/* ============================================================
   Astro Tickets — controllers/entradaController.js
   PDF de la entrada (descarga), reenvío por correo y validación
   de acceso por código QR.
   ============================================================ */

const entradaModel = require("../models/entradaModel");
const entradaService = require("../services/entradaService");

/**
 * GET /api/entradas/:id/pdf — devuelve el PDF de una entrada.
 * Solo el comprador o un admin pueden descargarla.
 */
async function descargarPdf(req, res) {
  try {
    const entrada = await entradaModel.obtenerEntrada(req.params.id);

    if (!entrada) {
      return res.status(404).json({ error: "Entrada no encontrada." });
    }

    const esAdmin = req.usuario && req.usuario.role === "admin";
    if (!esAdmin && entrada.usuario_id !== req.usuario.id) {
      return res.status(403).json({ error: "No tienes acceso a esta entrada." });
    }

    let buffer;
    try {
      buffer = await entradaService.generarPdfEntrada(entrada);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${entradaService.nombreArchivo(entrada)}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Error generando PDF de la entrada:", err);
    return res.status(500).json({ error: "Error interno al generar el PDF." });
  }
}

/**
 * POST /api/entradas/:id/reenviar — reenvía el PDF de la entrada por
 * correo al comprador. Solo el comprador o un admin.
 */
async function reenviarPdf(req, res) {
  try {
    const entrada = await entradaModel.obtenerEntrada(req.params.id);

    if (!entrada) {
      return res.status(404).json({ error: "Entrada no encontrada." });
    }

    const esAdmin = req.usuario && req.usuario.role === "admin";
    if (!esAdmin && entrada.usuario_id !== req.usuario.id) {
      return res.status(403).json({ error: "No tienes acceso a esta entrada." });
    }

    const resultado = await entradaService.enviarPdfPorEmail(entrada);

    if (!resultado.enviado) {
      return res.status(503).json({
        error: "No se pudo enviar el correo.",
        motivo: resultado.motivo,
        sugerencia: "Usa la opción de descargar el PDF desde tu historial de compras.",
      });
    }

    return res.json({ mensaje: "Entrada reenviada a tu correo." });
  } catch (err) {
    console.error("Error reenviando el PDF de la entrada:", err);
    return res.status(500).json({ error: "Error interno al reenviar el PDF." });
  }
}

/**
 * GET /api/entradas/:id/qr — devuelve la imagen QR (PNG) de la entrada.
 * Solo el comprador o un admin pueden verla.
 */
async function qrPng(req, res) {
  try {
    const entrada = await entradaModel.obtenerEntrada(req.params.id);

    if (!entrada) {
      return res.status(404).json({ error: "Entrada no encontrada." });
    }

    const esAdmin = req.usuario && req.usuario.role === "admin";
    if (!esAdmin && entrada.usuario_id !== req.usuario.id) {
      return res.status(403).json({ error: "No tienes acceso a esta entrada." });
    }

    if (!entrada.qr_token) {
      return res.status(400).json({ error: "La entrada no tiene código QR asociado." });
    }

    const buffer = await entradaService.generarQrPng(entrada.qr_token);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="qr-${entrada.asiento || entrada.asiento_id || entrada.id}.png"`);
    return res.send(buffer);
  } catch (err) {
    console.error("Error generando el QR de la entrada:", err);
    return res.status(500).json({ error: "Error interno al generar el QR." });
  }
}

/**
 * POST /api/entradas/validar — valida una entrada en el acceso.
 * Recibe el código QR (qrToken). Solo admin. Marca la entrada como
 * usada la primera vez y rechaza reutilizaciones.
 */
async function validar(req, res) {
  try {
    const { qrToken } = req.body || {};
    if (!qrToken || typeof qrToken !== "string") {
      return res.status(400).json({ error: "Falta el código QR de la entrada." });
    }

    const entrada = await entradaModel.obtenerEntradaPorQr(qrToken.trim());
    if (!entrada) {
      return res.status(404).json({ error: "Código QR no válido." });
    }

    if (entrada.estado === "usada") {
      return res.status(409).json({
        error: "Esta entrada ya fue utilizada.",
        entrada: {
          evento: entrada.evento_nombre,
          zona: entrada.zona,
          asiento: entrada.asiento_id,
          usado_en: entrada.usado_en,
        },
      });
    }

    if (entrada.estado !== "activa") {
      return res.status(409).json({ error: `La entrada está en estado "${entrada.estado}".` });
    }

    const marcada = await entradaModel.marcarUsada(entrada.id);

    return res.json({
      mensaje: "Acceso concedido.",
      entrada: {
        id: marcada.id,
        evento: entrada.evento_nombre,
        fecha: entrada.evento_fecha,
        hora: entrada.evento_hora,
        lugar: entrada.evento_lugar,
        zona: entrada.zona,
        asiento: entrada.asiento_id,
        usado_en: marcada.usado_en,
      },
    });
  } catch (err) {
    console.error("Error validando entrada:", err);
    return res.status(500).json({ error: "Error interno al validar la entrada." });
  }
}

/**
 * POST /api/entradas/:id/transferir — transfiere una entrada a otra
 * persona por correo (requiere sesión; solo el comprador).
 */
async function transferir(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email)) {
      return res.status(400).json({ error: "Ingresa un correo electrónico válido." });
    }
    const resultado = await entradaModel.transferir(req.params.id, {
      emailDestino: email,
      usuarioOrigenId: req.usuario.id,
    });
    if (resultado.status) {
      return res.status(resultado.status).json({ error: resultado.mensaje });
    }
    const mensaje = resultado.estado === "completada"
      ? "Entrada transferida correctamente al correo indicado."
      : "Transferencia registrada. Se completará cuando el destinatario registre una cuenta con ese correo.";
    return res.json({ mensaje, transferencia: resultado });
  } catch (err) {
    console.error("Error transfiriendo entrada:", err);
    return res.status(500).json({ error: "Error interno al transferir la entrada." });
  }
}

module.exports = { descargarPdf, qrPng, reenviarPdf, validar, transferir };
