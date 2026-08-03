/* ============================================================
   Astro Tickets — routes/adminRoutes.js (Fases 4 + 5)
   Panel de administración: resumen, auditoría, reservas.
   ============================================================ */

const express = require("express");
const router = express.Router();

const { dashboard, resumen, auditoria, reservasPorVencer, reporteCsv, reportePdf, reporteEvento } = require("../controllers/adminController");
const { listar: listarReembolsos, crear: crearReembolso, aprobar: aprobarReembolso, rechazar: rechazarReembolso } = require("../controllers/reembolsoController");
const { verificarToken, soloAdmin } = require("../middleware/authMiddleware");

router.get("/admin/dashboard", verificarToken, soloAdmin, dashboard);
router.get("/admin/resumen", verificarToken, soloAdmin, resumen);
router.get("/admin/auditoria", verificarToken, soloAdmin, auditoria);
router.get("/admin/reservas-por-vencer", verificarToken, soloAdmin, reservasPorVencer);
router.get("/admin/reportes/general.pdf", verificarToken, soloAdmin, reportePdf);
router.get("/admin/reportes/evento/:id", verificarToken, soloAdmin, reporteEvento);
router.get("/admin/reportes/:tipo.csv", verificarToken, soloAdmin, reporteCsv);

// Reembolsos (panel admin)
router.get("/admin/reembolsos", verificarToken, soloAdmin, listarReembolsos);
router.post("/admin/reembolsos", verificarToken, soloAdmin, crearReembolso);
router.post("/admin/reembolsos/:id/aprobar", verificarToken, soloAdmin, aprobarReembolso);
router.post("/admin/reembolsos/:id/rechazar", verificarToken, soloAdmin, rechazarReembolso);

module.exports = router;
