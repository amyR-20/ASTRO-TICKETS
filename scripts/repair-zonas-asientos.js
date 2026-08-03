/* ============================================================
   Reparación: asigna zonas a los asientos de cada evento según
   las cantidades de sus zonas (de la primera fila hacia atrás).
   Aplica a plantilla y a todas las funciones.
   Uso: node scripts/repair-zonas-asientos.js
   ============================================================ */

const { pool } = require("../config/database");

(async () => {
  try {
    const eventos = (await pool.query(`SELECT id FROM eventos ORDER BY id`)).rows;

    for (const ev of eventos) {
      const zonas = (await pool.query(
        `SELECT nombre FROM zonas WHERE evento_id = $1 ORDER BY precio DESC`,
        [ev.id]
      )).rows.map((z) => z.nombre);

      const asientos = (await pool.query(
        `SELECT id, fila, columna FROM asientos
         WHERE evento_id = $1 ORDER BY fila, columna`,
        [ev.id]
      )).rows;

      if (!zonas.length) {
        console.log(`  ${ev.id}: sin zonas, se omite.`);
        continue;
      }

      // Conteo por zona a asignar
      const conteo = {};
      for (const z of zonas) conteo[z] = 0;
      const zz = (await pool.query(
        `SELECT nombre, cantidad FROM zonas WHERE evento_id = $1 ORDER BY precio DESC`,
        [ev.id]
      )).rows;
      const tope = {};
      for (const z of zz) tope[z.nombre] = Number(z.cantidad) || 0;

      let zi = 0;
      for (const a of asientos) {
        while (zi < zonas.length && tope[zonas[zi]] > 0 && conteo[zonas[zi]] >= tope[zonas[zi]]) zi++;
        if (zi >= zonas.length) zi = zonas.length - 1;
        const nombre = zonas[zi];
        conteo[nombre]++;
        await pool.query(`UPDATE asientos SET zona = $1 WHERE id = $2`, [nombre, a.id]);
      }
      console.log(`  ${ev.id}: ${asientos.length} asientos con zonas ${zonas.join(", ")}`);
    }
    console.log("Listo.");
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
