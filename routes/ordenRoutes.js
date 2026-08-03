/* ============================================================
   Astro Tickets — routes/ordenRoutes.js
   ============================================================ */

const express = require("express");
const router = express.Router();

const { crear, misCompras, listar } = require("../controllers/ordenController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

// Comprar entradas / ver mi historial (requiere iniciar sesión)
router.post("/", verificarToken, crear);
router.get("/mis-compras", verificarToken, misCompras);

// Todas las compras (solo admin)
router.get("/", verificarToken, soloAdmin, listar);

module.exports = router;
