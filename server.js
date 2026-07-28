/* ============================================================
   Astro Tickets — server.js
   Punto de entrada del backend
   ============================================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");

const app = express();

// --- Middlewares globales ---
app.use(cors()); // en producción, restringe esto al dominio real del frontend
app.use(express.json());

// --- Rutas ---
app.use("/api/auth", authRoutes);

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
