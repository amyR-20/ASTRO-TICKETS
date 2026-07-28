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
 */
function soloAdmin(req, res, next) {
  if (!req.usuario || req.usuario.role !== "admin") {
    return res.status(403).json({ error: "Acceso restringido a administradores." });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };
