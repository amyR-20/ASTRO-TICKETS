/* Genera un PDF de muestra de la última entrada vendida. */
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");
const entradaModel = require("../models/entradaModel");
const entradaService = require("../services/entradaService");

(async () => {
  const { rows } = await pool.query("SELECT codigo FROM entradas ORDER BY id DESC LIMIT 1");
  if (!rows.length) { console.log("No hay entradas."); await pool.end(); return; }
  const entrada = await entradaModel.obtenerEntrada(rows[0].codigo);
  const buffer = await entradaService.generarPdfEntrada(entrada);
  const dest = path.join("C:\\Users\\amyra\\AppData\\Local\\Temp\\opencode", entradaService.nombreArchivo(entrada));
  fs.writeFileSync(dest, buffer);
  console.log("PDF generado:", dest, "| bytes:", buffer.length);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
