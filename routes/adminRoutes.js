/* ============================================================
   Astro Tickets — routes/adminRoutes.js (Fases 4 + 5)
   Panel de administración: resumen, auditoría, reservas.
   ============================================================ */

const express = require("express");
const router = express.Router();

const { dashboard, resumen, auditoria, reservasPorVencer, reporteCsv, reportePdf } = require("../controllers/adminController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

router.get("/admin/dashboard", verificarToken, soloAdmin, dashboard);
router.get("/admin/resumen", verificarToken, soloAdmin, resumen);
router.get("/admin/auditoria", verificarToken, soloAdmin, auditoria);
router.get("/admin/reservas-por-vencer", verificarToken, soloAdmin, reservasPorVencer);
router.get("/admin/reportes/general.pdf", verificarToken, soloAdmin, reportePdf);
router.get("/admin/reportes/:tipo.csv", verificarToken, soloAdmin, reporteCsv);

module.exports = router;
