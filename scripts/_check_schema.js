const { pool } = require("../config/database");
(async () => {
  try {
    for (const t of ["entradas", "ordenes", "funciones_evento", "zonas", "asientos", "reservas", "auditoria"]) {
      const c = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t]
      );
      console.log(`\n== ${t} ==`);
      console.log("  " + c.rows.map((x) => x.column_name).join(", "));
      const chk = await pool.query(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid = $1::regclass AND contype='c'`,
        [t]
      );
      for (const x of chk.rows) console.log("  CHECK: " + x.def);
      const idx = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1 AND indexdef ILIKE '%UNIQUE%'`,
        [t]
      );
      for (const x of idx.rows) console.log("  UNIQUE: " + x.indexname);
    }
    const n = await pool.query("SELECT count(*)::int AS n FROM entradas");
    console.log("\nentradas:", n.rows[0].n);
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    await pool.end();
  }
})();
