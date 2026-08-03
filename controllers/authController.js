/* ============================================================
   Astro Tickets — controllers/authController.js
   Lógica de negocio de registro / login
   ============================================================ */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const usuarioModel = require("../models/usuarioModel");

const SALT_ROUNDS = 10;

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * POST /api/auth/registro
 * Body esperado: { nombre, email, password, password2 }
 * (los mismos campos que ya valida registro.html / auth.js en el frontend)
 */
async function registro(req, res) {
  try {
    // --- Validaciones con express-validator (mismos campos que el frontend) ---
    const validaciones = [
      body("nombre").trim().notEmpty().withMessage("Todos los campos son obligatorios."),
      body("username").trim().toLowerCase().matches(/^[a-z0-9_]{3,24}$/)
        .withMessage("El usuario debe tener 3 a 24 caracteres: letras, números o guion bajo."),
      body("email")
        .trim()
        .toLowerCase()
        .notEmpty().withMessage("Todos los campos son obligatorios.")
        .bail()
        .isEmail().withMessage("Ingresa un correo electrónico válido.")
        .bail()
        .matches(EMAIL_REGEX).withMessage("Ingresa un correo electrónico válido."),
      body("password")
        .notEmpty().withMessage("Todos los campos son obligatorios.")
        .bail()
        .isLength({ min: 10 }).withMessage("La contraseña debe tener al menos 10 caracteres.")
        .bail().matches(/[a-z]/).withMessage("La contraseña debe incluir una minúscula.")
        .bail().matches(/[A-Z]/).withMessage("La contraseña debe incluir una mayúscula.")
        .bail().matches(/\d/).withMessage("La contraseña debe incluir un número.")
        .bail().matches(/[^A-Za-z0-9]/).withMessage("La contraseña debe incluir un símbolo."),
      body("password2")
        .custom((value, { req: r }) => value === r.body.password)
        .withMessage("Las contraseñas no coinciden."),
    ];
    await Promise.all(validaciones.map((v) => v.run(req)));
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ error: errores.array()[0].msg });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const nombre = String(req.body.nombre || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = req.body.password;

    const existente = await usuarioModel.buscarPorEmail(email);
    if (existente) {
      return res.status(409).json({ error: "Este correo ya está registrado. Inicia sesión." });
    }
    if (await usuarioModel.buscarPorUsername(username)) {
      return res.status(409).json({ error: "Ese nombre de usuario ya está ocupado." });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const nuevoUsuario = await usuarioModel.crear({
      nombre,
      username,
      email,
      passwordHash,
    });

    return res.status(201).json({
      mensaje: "Cuenta creada correctamente. Ahora inicia sesión.",
      usuario: nuevoUsuario,
    });
  } catch (err) {
    console.error("Error en registro:", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "El correo o nombre de usuario ya está registrado." });
    }
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
    // --- Validaciones con express-validator ---
    const validaciones = [
      body("email")
        .trim()
        .toLowerCase()
        .notEmpty().withMessage("Correo y contraseña son obligatorios.")
        .bail()
        .isEmail().withMessage("Ingresa un correo electrónico válido."),
      body("password")
        .notEmpty().withMessage("Correo y contraseña son obligatorios."),
    ];
    await Promise.all(validaciones.map((v) => v.run(req)));
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ error: errores.array()[0].msg });
    }

    const { email, password } = req.body;

    const usuario = await usuarioModel.buscarPorEmail(email.trim().toLowerCase());

    const ip = req.ip;
    const userAgent = req.get("user-agent");

    // Auditoría de accesos (best-effort: si falla, no rompe el login)
    const registrar = async (datos) => {
      try {
        await usuarioModel.registrarAcceso(datos);
      } catch (err) {
        console.error("Error auditando acceso:", err.message);
      }
    };

    // Mensaje genérico a propósito: no revelar si el email existe o no,
    // por seguridad (evita que alguien "adivine" cuentas registradas).
    if (!usuario) {
      await registrar({
        email: email.trim().toLowerCase(),
        exitoso: false,
        metodo: "password",
        motivoFallo: "usuario_no_encontrado",
        ip,
        userAgent,
      });
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValido) {
      await registrar({
        usuarioId: usuario.id,
        email: usuario.email,
        exitoso: false,
        metodo: "password",
        motivoFallo: "password_incorrecta",
        ip,
        userAgent,
      });
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    await registrar({
      usuarioId: usuario.id,
      email: usuario.email,
      exitoso: true,
      metodo: "password",
      ip,
      userAgent,
    });
    await usuarioModel.actualizarLogin(usuario.id);

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
        username: usuario.username,
        nombre: usuario.nombre,
        email: usuario.email,
        role: usuario.role,
        avatar: usuario.avatar,
        avatar_url: usuario.avatar_url,
        bio: usuario.bio,
        idioma_pref: usuario.idioma_pref || "es",
        tema_pref: usuario.tema_pref || "auto",
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

async function actualizarPerfil(req, res) {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const bio = String(req.body?.bio || "").trim().slice(0, 240);
    const avatarUrl = String(req.body?.avatarUrl || "").trim();
    if (nombre.length < 2 || nombre.length > 100) return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres." });
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "El usuario debe tener 3 a 24 caracteres: letras, números o guion bajo." });
    if (avatarUrl && !/^data:image\/(png|jpe?g|webp);base64,/i.test(avatarUrl) && !/^https:\/\//i.test(avatarUrl)) {
      return res.status(400).json({ error: "La foto debe ser una imagen válida." });
    }
    if (avatarUrl.length > 950000) return res.status(413).json({ error: "La foto es demasiado grande. Usa una menor de 700 KB." });
    const ocupado = await usuarioModel.buscarPorUsername(username);
    if (ocupado && ocupado.id !== req.usuario.id) return res.status(409).json({ error: "Ese nombre de usuario ya está ocupado." });
    const usuario = await usuarioModel.actualizarPerfil(req.usuario.id, { nombre, username, avatarUrl, bio });
    return res.json({ mensaje: "Perfil actualizado.", usuario });
  } catch (err) {
    console.error("Error actualizando perfil:", err);
    if (err.code === "23505") return res.status(409).json({ error: "Ese nombre de usuario ya está ocupado." });
    return res.status(500).json({ error: "No se pudo actualizar el perfil." });
  }
}

/** PUT /api/auth/perfil/preferencias — guarda idioma/tema del usuario. */
async function actualizarPreferencias(req, res) {
  try {
    const { idioma, tema } = req.body || {};
    const idiomaValido = !idioma || ["es", "en"].includes(String(idioma));
    const temaValido = !tema || ["light", "dark", "auto"].includes(String(tema));
    if (!idiomaValido || !temaValido) {
      return res.status(400).json({ error: "Preferencias inválidas." });
    }
    const usuario = await usuarioModel.actualizarPreferencias(req.usuario.id, {
      idioma: idioma ? String(idioma) : undefined,
      tema: tema ? String(tema) : undefined,
    });
    return res.json({ mensaje: "Preferencias guardadas.", usuario });
  } catch (err) {
    console.error("Error guardando preferencias:", err);
    return res.status(500).json({ error: "No se pudieron guardar las preferencias." });
  }
}

module.exports = { registro, login, perfil, actualizarPerfil, actualizarPreferencias };
