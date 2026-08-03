/* ============================================================
   Astro Tickets — routes/eventoRoutes.js
   ============================================================ */

const express = require("express");
const router = express.Router();

const { listar, ver, crear, actualizar, eliminar } = require("../controllers/eventoController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

// Público: ver catálogo y detalle de eventos
router.get("/", listar);
router.get("/:id", ver);

// Solo admin: crear, editar y borrar eventos
router.post("/", verificarToken, soloAdmin, crear);
router.put("/:id", verificarToken, soloAdmin, actualizar);
router.delete("/:id", verificarToken, soloAdmin, eliminar);

module.exports = router;
