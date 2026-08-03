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

const app = express();

// --- Middlewares globales ---
// CORS restringido a los orígenes usados en desarrollo local:
//   - el propio servidor (Express sirve el frontend en :3000)
//   - Live Server (.vscode/settings.json usa el puerto 5501)
//   - "null": apertura directa de archivos HTML desde el disco (file://)
// En producción se debe reemplazar por el dominio real del frontend.
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "null"
  ]
}));
app.use(express.json());

// AGREGADO: permite servir los archivos HTML, CSS y JavaScript
app.use(express.static(path.join(__dirname)));

// --- Rutas ---
app.use("/api/auth", authRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/ordenes", ordenRoutes);

// AGREGADO: muestra index.html al entrar a localhost:3000
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

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