/* ============================================================
   Astro Tickets — server.js
   Punto de entrada del backend
   ============================================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path"); // AGREGADO

const authRoutes = require("./routes/authRoutes");
const eventoRoutes = require("./routes/eventoRoutes");
const ordenRoutes = require("./routes/ordenRoutes");
const funcionRoutes = require("./routes/funcionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const entradaRoutes = require("./routes/entradaRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// --- Middlewares globales ---
// CORS restringido a una lista explícita de orígenes (nunca "*"):
//   - el propio servidor (Express sirve el frontend en :3000)
//   - Live Server (.vscode/settings.json usa el puerto 5501)
//   - "null": apertura directa de archivos HTML desde el disco (file://)
//   - GitHub Pages (frontend publicado en producción)
//   - CORS_ORIGINS (env, opcional): orígenes extra separados por coma.
const ORIGENES_PERMITIDOS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5501",
  "http://127.0.0.1:5501",
  "https://amyr-20.github.io",
  "null"
];
if (process.env.CORS_ORIGINS) {
  for (const origen of process.env.CORS_ORIGINS.split(",")) {
    const limpio = origen.trim();
    if (limpio) ORIGENES_PERMITIDOS.push(limpio);
  }
}
app.use(cors({ origin: ORIGENES_PERMITIDOS }));
// Las portadas de eventos se envian optimizadas desde el panel.
// 4 MB deja margen para el JSON de asientos sin aceptar cargas desmedidas.
app.use(express.json({ limit: "4mb" }));

// En local Express sirve la misma raiz que Vercel publica mediante su CDN.
app.use(express.static(path.join(__dirname, "public")));

// --- Rutas ---
app.use("/api/auth", authRoutes);
app.use("/api", funcionRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/ordenes", ordenRoutes);
app.use("/api/entradas", entradaRoutes);
app.use("/api/pagos", paymentRoutes);
app.use("/api", adminRoutes);

// AGREGADO: muestra index.html al entrar a localhost:3000
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Ruta de salud, útil para confirmar que el servidor está corriendo
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mensaje: "Astro Tickets backend funcionando" });
});

// --- 404 para rutas no encontradas ---
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

// --- Manejador de errores global (red de seguridad) ---
app.use((err, req, res, next) => {
  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;

const { pool } = require("./config/database");

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Conectado a PostgreSQL");
    console.log(result.rows);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
