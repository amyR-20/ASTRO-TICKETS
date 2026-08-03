/* ============================================================
   Astro Tickets — middleware/authMiddleware.js
   Verifica el JWT y protege rutas privadas / de admin
   ============================================================ */

const jwt = require("jsonwebtoken");

/**
 * Uso: router.get("/ruta-privada", verificarToken, controller)
 * Espera el header:  Authorization: Bearer <token>
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No se proporcionó un token de acceso." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

/**
 * Uso: router.post("/eventos", verificarToken, soloAdmin, controller)
 * Debe usarse SIEMPRE después de verificarToken.
 * Verifica el rol contra la base de datos, no solo contra el payload del
 * JWT, para que un rol desactualizado o alterado no conceda acceso.
 */
async function soloAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(403).json({ error: "Acceso restringido a administradores." });
  }
  try {
    const usuarioModel = require("../models/usuarioModel");
    const usuario = await usuarioModel.buscarPorId(req.usuario.id);
    if (!usuario || usuario.role !== "admin") {
      return res.status(403).json({ error: "Acceso restringido a administradores." });
    }
    next();
  } catch (err) {
    console.error("Error verificando rol de administrador:", err);
    return res.status(500).json({ error: "Error interno al verificar permisos." });
  }
}

/**
 * Uso: router.post("/funciones/:id/reservar", verificarToken, soloUsuario, controller)
 * Debe usarse SIEMPRE después de verificarToken.
 * Los administradores gestionan la plataforma y no compran boletos, así
 * que las acciones de compra se restringen a cuentas de cliente.
 */
async function soloUsuario(req, res, next) {
  if (!req.usuario) {
    return res.status(403).json({ error: "Acceso restringido a cuentas de cliente." });
  }
  try {
    const usuarioModel = require("../models/usuarioModel");
    const usuario = await usuarioModel.buscarPorId(req.usuario.id);
    if (!usuario || usuario.role === "admin") {
      return res.status(403).json({ error: "Los administradores no pueden comprar boletos." });
    }
    next();
  } catch (err) {
    console.error("Error verificando rol de cliente:", err);
    return res.status(500).json({ error: "Error interno al verificar permisos." });
  }
}

module.exports = { verificarToken, soloAdmin, soloUsuario };
