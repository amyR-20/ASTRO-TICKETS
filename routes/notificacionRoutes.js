/* ============================================================
   Astro Tickets — routes/notificacionRoutes.js
   Notificaciones del usuario autenticado.
   ============================================================ */

const express = require("express");
const router = express.Router();

const { misNotificaciones, leer } = require("../controllers/notificacionController");
const { verificarToken } = require("../middleware/authMiddleware");

router.get("/notificaciones", verificarToken, misNotificaciones);
router.post("/notificaciones/leer", verificarToken, leer);

module.exports = router;
