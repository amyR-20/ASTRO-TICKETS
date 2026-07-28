/* ============================================================
   Astro Tickets — routes/authRoutes.js
   ============================================================ */

const express = require("express");
const router = express.Router();

const { registro, login, perfil } = require("../controllers/authController");
const { verificarToken } = require("../middleware/authMiddleware");

router.post("/registro", registro);
router.post("/login", login);
router.get("/perfil", verificarToken, perfil);

module.exports = router;
