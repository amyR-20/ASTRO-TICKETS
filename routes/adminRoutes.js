/* ============================================================
   Astro Tickets — routes/adminRoutes.js (Fases 4 + 5)
   Panel de administración: resumen, auditoría, reservas.
   ============================================================ */

const express = require("express");
const router = express.Router();

const { dashboard, resumen, auditoria, reservasPorVencer } = require("../controllers/adminController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

router.get("/admin/dashboard", verificarToken, soloAdmin, dashboard);
router.get("/admin/resumen", verificarToken, soloAdmin, resumen);
router.get("/admin/auditoria", verificarToken, soloAdmin, auditoria);
router.get("/admin/reservas-por-vencer", verificarToken, soloAdmin, reservasPorVencer);

module.exports = router;
