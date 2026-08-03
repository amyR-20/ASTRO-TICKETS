/* ============================================================
   Reparación: garantiza que cada función tenga sus asientos.
   - Si la plantilla del evento está vacía, la genera de filas/cols.
   - Clona la plantilla a cada función sin asientos.
   Uso: node scripts/repair-funcion-asientos.js
   ============================================================ */

const { pool } = require("../config/database");

function generarSeats(rows, cols) {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const rowLetter = String.fromCharCode(65 + r);
    for (let c = 1; c <= cols; c++) {
      seats.push({ asiento_id: rowLetter + c, fila: rowLetter, columna: c, zona: null });
    }
  }
  return seats;
}

(async () => {
  try {
    const funcs = (await pool.query(
      `SELECT f.id AS funcion_id, f.evento_id, e.filas, e.columnas
       FROM funciones_evento f JOIN eventos e ON e.id = f.evento_id
       ORDER BY f.id`
    )).rows;

    let reparadas = 0;
    for (const f of funcs) {
      const n = (await pool.query(
        `SELECT count(*)::int AS n FROM asientos WHERE funcion_id = $1`,
        [f.funcion_id]
      )).rows[0].n;
      if (n > 0) continue;

      // Asegurar plantilla del evento
      const plantilla = (await pool.query(
        `SELECT asiento_id, fila, columna, zona FROM asientos
         WHERE evento_id = $1 AND funcion_id IS NULL ORDER BY fila, columna`,
        [f.evento_id]
      )).rows;
      let plantilla2 = plantilla;
      if (!plantilla2.length) {
        plantilla2 = generarSeats(Number(f.filas) || 0, Number(f.columnas) || 0);
        for (const s of plantilla2) {
          await pool.query(
            `INSERT INTO asientos (evento_id, asiento_id, fila, columna, zona, estado)
             VALUES ($1,$2,$3,$4,$5,'available')`,
            [f.evento_id, s.asiento_id, s.fila, s.columna, s.zona]
          );
        }
      }
      for (const s of plantilla2) {
        await pool.query(
          `INSERT INTO asientos (evento_id, funcion_id, asiento_id, fila, columna, zona, estado)
           VALUES ($1,$2,$3,$4,$5,$6,'available')`,
          [f.evento_id, f.funcion_id, s.asiento_id, s.fila, s.columna, s.zona]
        );
      }
      reparadas++;
      console.log(`Función #${f.funcion_id} (${f.evento_id}): ${plantilla2.length} asientos clonados.`);
    }
    console.log(`Listo. Funciones reparadas: ${reparadas}.`);
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
