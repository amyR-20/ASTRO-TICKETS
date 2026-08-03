const fs = require("fs");
const { pool } = require("../config/database");

(async () => {
  const file = process.argv[2];
  const sql = fs.readFileSync(file, "utf8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("MIGRACION COMPLETA: " + file);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
