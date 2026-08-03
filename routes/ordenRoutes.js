/* ============================================================
   Astro Tickets — routes/ordenRoutes.js
   ============================================================ */

const express = require("express");
const router = express.Router();

const { crear, misCompras, obtener, reenviar, listar } = require("../controllers/ordenController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

// Comprar entradas / ver mi historial (requiere iniciar sesión)
router.post("/", verificarToken, crear);
router.get("/mis-compras", verificarToken, misCompras);
router.post("/:id/reenviar", verificarToken, reenviar);
router.get("/:id", verificarToken, obtener);

// Todas las compras (solo admin)
router.get("/", verificarToken, soloAdmin, listar);

module.exports = router;
