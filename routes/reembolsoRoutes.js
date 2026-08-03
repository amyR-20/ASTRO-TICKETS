/* ============================================================
   Astro Tickets — routes/reembolsoRoutes.js
   Reembolsos del usuario autenticado (solicitar y consultar).
   ============================================================ */

const express = require("express");
const router = express.Router();

const { misReembolsos, solicitar } = require("../controllers/reembolsoController");
const { verificarToken, soloUsuario } = require("../middleware/authMiddleware");

router.get("/reembolsos/mis-reembolsos", verificarToken, misReembolsos);
router.post("/reembolsos", verificarToken, soloUsuario, solicitar);

module.exports = router;
