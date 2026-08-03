/* ============================================================
   Astro Tickets — routes/eventoRoutes.js (Fases 4 + 5)
   ============================================================ */

const express = require("express");
const router = express.Router();

const { listar, ver, crear, actualizar, publicar, cancelar, eliminar } = require("../controllers/eventoController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

// Público: ver catálogo y detalle de eventos
router.get("/", listar);
router.get("/:id", ver);

// Solo admin: crear, editar, publicar, cancelar y borrar eventos
router.post("/", verificarToken, soloAdmin, crear);
router.put("/:id", verificarToken, soloAdmin, actualizar);
router.post("/:id/publicar", verificarToken, soloAdmin, publicar);
router.post("/:id/cancelar", verificarToken, soloAdmin, cancelar);
router.delete("/:id", verificarToken, soloAdmin, eliminar);

module.exports = router;
