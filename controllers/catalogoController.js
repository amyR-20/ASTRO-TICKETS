/* ============================================================
   Astro Tickets — controllers/catalogoController.js
   Recintos y artistas: consulta pública + creación (admin).
   ============================================================ */

const catalogoModel = require("../models/catalogoModel");

async function recintos(req, res) {
  try {
    const listado = await catalogoModel.listarRecintos();
    return res.json({ recintos: listado });
  } catch (err) {
    console.error("Error listando recintos:", err);
    return res.status(500).json({ error: "Error interno al listar los recintos." });
  }
}

async function artistas(req, res) {
  try {
    const listado = await catalogoModel.listarArtistas();
    return res.json({ artistas: listado });
  } catch (err) {
    console.error("Error listando artistas:", err);
    return res.status(500).json({ error: "Error interno al listar los artistas." });
  }
}

async function crearRecinto(req, res) {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    if (!nombre) return res.status(400).json({ error: "Escribe el nombre del recinto." });
    const recinto = await catalogoModel.crearRecinto(req.body);
    return res.status(201).json({ recinto });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ese recinto ya existe." });
    console.error("Error creando recinto:", err);
    return res.status(500).json({ error: "Error interno al crear el recinto." });
  }
}

async function crearArtista(req, res) {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    if (!nombre) return res.status(400).json({ error: "Escribe el nombre del artista." });
    const artista = await catalogoModel.crearArtista(req.body);
    return res.status(201).json({ artista });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ese artista ya existe." });
    console.error("Error creando artista:", err);
    return res.status(500).json({ error: "Error interno al crear el artista." });
  }
}

module.exports = { recintos, artistas, crearRecinto, crearArtista };
