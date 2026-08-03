/* ============================================================
   Astro Tickets — routes/entradaRoutes.js
   ============================================================ */

const express = require("express");
const router = express.Router();

const {
  descargarPdf,
  qrPng,
  reenviarPdf,
  validar,
} = require("../controllers/entradaController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

// Descargar / reenviar la boleta (comprador o admin)
router.get("/:id/pdf", verificarToken, descargarPdf);
router.get("/:id/qr", verificarToken, qrPng);
router.post("/:id/reenviar", verificarToken, reenviarPdf);

// Validar entrada en el acceso (solo admin / personal del evento)
router.post("/validar", verificarToken, soloAdmin, validar);

module.exports = router;
