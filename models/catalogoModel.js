/* ============================================================
   Astro Tickets — models/catalogoModel.js
   Catálogo: recintos (sedes) y artistas para el creador de eventos.
   ============================================================ */

const { query } = require("../config/database");

async function listarRecintos() {
  const { rows } = await query(`SELECT * FROM recintos ORDER BY nombre ASC`);
  return rows;
}

async function crearRecinto({ nombre, ciudad, capacidad, descripcion }) {
  const { rows } = await query(
    `INSERT INTO recintos (nombre, ciudad, capacidad, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [nombre, ciudad || null, Number(capacidad) || 0, descripcion || null]
  );
  return rows[0];
}

async function listarArtistas() {
  const { rows } = await query(`SELECT * FROM artistas ORDER BY nombre ASC`);
  return rows;
}

async function crearArtista({ nombre, genero }) {
  const { rows } = await query(
    `INSERT INTO artistas (nombre, genero)
     VALUES ($1, $2)
     RETURNING *`,
    [nombre, genero || null]
  );
  return rows[0];
}

module.exports = { listarRecintos, crearRecinto, listarArtistas, crearArtista };
