/* ============================================================
   Astro Tickets — controllers/authController.js
   Lógica de negocio de registro / login
   ============================================================ */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const usuarioModel = require("../models/usuarioModel");

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/registro
 * Body esperado: { nombre, email, password, password2 }
 * (los mismos campos que ya valida registro.html / auth.js en el frontend)
 */
async function registro(req, res) {
  try {
    const { nombre, email, password, password2 } = req.body;

    // --- Validaciones (equivalentes a las que ya hacía auth.js) ---
    if (!nombre || !email || !password || !password2) {
      return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }
    if (password !== password2) {
      return res.status(400).json({ error: "Las contraseñas no coinciden." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    }

    const existente = await usuarioModel.buscarPorEmail(email.trim().toLowerCase());
    if (existente) {
      return res.status(409).json({ error: "Este correo ya está registrado. Inicia sesión." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevoUsuario = await usuarioModel.crear({
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });

    return res.status(201).json({
      mensaje: "Cuenta creada correctamente. Ahora inicia sesión.",
      usuario: nuevoUsuario,
    });
  } catch (err) {
    console.error("Error en registro:", err);
    return res.status(500).json({ error: "Error interno al registrar el usuario." });
  }
}

/**
 * POST /api/auth/login
 * Body esperado: { email, password }
 * Responde con un JWT que el frontend debe guardar (reemplaza el
 * localStorage "astro_session" que usaba auth.js).
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
    }

    const usuario = await usuarioModel.buscarPorEmail(email.trim().toLowerCase());

    // Mensaje genérico a propósito: no revelar si el email existe o no,
    // por seguridad (evita que alguien "adivine" cuentas registradas).
    if (!usuario) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const payload = {
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "2h",
    });

    // Igual forma que la sesión que armaba auth.js en localStorage,
    // pero ahora viene firmada y verificada por el servidor.
    return res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        role: usuario.role,
        avatar: usuario.avatar,
      },
    });
  } catch (err) {
    console.error("Error en login:", err);
    return res.status(500).json({ error: "Error interno al iniciar sesión." });
  }
}

/**
 * GET /api/auth/perfil
 * Ruta protegida de ejemplo: devuelve los datos del usuario autenticado
 * a partir del token (útil para "recordar sesión" al recargar la página).
 */
async function perfil(req, res) {
  try {
    const usuario = await usuarioModel.buscarPorId(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    return res.status(200).json({ usuario });
  } catch (err) {
    console.error("Error en perfil:", err);
    return res.status(500).json({ error: "Error interno al obtener el perfil." });
  }
}

module.exports = { registro, login, perfil };
