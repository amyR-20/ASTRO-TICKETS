/* ============================================================
   Astro Tickets — routes/catalogoRoutes.js
   Recintos y artistas: consulta pública + creación (solo admin).
   ============================================================ */

const express = require("express");
const router = express.Router();

const {
  recintos,
  artistas,
  crearRecinto,
  crearArtista,
} = require("../controllers/catalogoController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

router.get("/recintos", recintos);
router.get("/artistas", artistas);
router.post("/admin/recintos", verificarToken, soloAdmin, crearRecinto);
router.post("/admin/artistas", verificarToken, soloAdmin, crearArtista);

module.exports = router;
