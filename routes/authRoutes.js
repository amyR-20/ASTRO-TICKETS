/* ============================================================
   Astro Tickets — routes/authRoutes.js
   ============================================================ */

const express = require("express");
const router = express.Router();

const { registro, login, perfil, actualizarPerfil } = require("../controllers/authController");
const { verificarToken } = require("../middleware/authMiddleware");

router.post("/registro", registro);
router.post("/login", login);
router.get("/perfil", verificarToken, perfil);
router.put("/perfil", verificarToken, actualizarPerfil);

module.exports = router;
