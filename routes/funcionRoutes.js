/* ============================================================
   Astro Tickets — routes/funcionRoutes.js (Fases 4 + 5)
   Funciones por evento + reservas de asientos.
   ============================================================ */

const express = require("express");
const router = express.Router();

const {
  listar, ver, crear, actualizar, eliminar,
  reservar, cancelarReservas, misReservas, bloquearAsiento, restaurarAsiento,
} = require("../controllers/funcionController");
const { verificarToken, soloAdmin, soloUsuario } = require("../middleware/authMiddleware");
const {
  unirse, miEstado, retirarse,
} = require("../controllers/waitlistController");

// Público: funciones de un evento y detalle de una función
router.get("/eventos/:eventoId/funciones", listar);
router.get("/funciones/:id", ver);

// Solo admin: crear/editar/eliminar funciones y bloquear asientos
router.post("/eventos/:eventoId/funciones", verificarToken, soloAdmin, crear);
router.put("/funciones/:id", verificarToken, soloAdmin, actualizar);
router.delete("/funciones/:id", verificarToken, soloAdmin, eliminar);
router.post("/funciones/:id/asientos/:asiento/bloquear", verificarToken, soloAdmin, bloquearAsiento);
router.post("/funciones/:id/asientos/:asiento/restaurar", verificarToken, soloAdmin, restaurarAsiento);

// Usuario con sesión: reservar / liberar asientos
router.post("/funciones/:id/reservar", verificarToken, soloUsuario, reservar);
router.get("/funciones/:id/mis-reservas", verificarToken, misReservas);
router.delete("/funciones/:id/reservas", verificarToken, cancelarReservas);

// Lista de espera de una función (avísame cuando haya boletos)
router.post("/funciones/:id/lista-espera", verificarToken, soloUsuario, unirse);
router.get("/funciones/:id/lista-espera/mi", verificarToken, miEstado);
router.delete("/funciones/:id/lista-espera", verificarToken, retirarse);

module.exports = router;
