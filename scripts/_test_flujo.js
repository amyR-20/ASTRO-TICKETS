const { pool } = require("../config/database");
const funcionModel = require("../models/funcionModel");
const reservaModel = require("../models/reservaModel");
const ordenModel = require("../models/ordenModel");

const USUARIO_A = 2; // jesus
const USUARIO_B = 3; // amy
const FUNCION = 3;   // jazz

async function limpiar() {
  await pool.query(`DELETE FROM entradas WHERE funcion_id=$1`, [FUNCION]);
  await pool.query(`DELETE FROM ordenes WHERE funcion_id=$1`, [FUNCION]);
  await pool.query(`DELETE FROM reservas WHERE funcion_id=$1`, [FUNCION]);
  await pool.query(`UPDATE asientos SET estado='available' WHERE funcion_id=$1`, [FUNCION]);
  await pool.query(`UPDATE funciones_evento SET estado='activa' WHERE id=$1`, [FUNCION]);
}

let fallos = 0;
function ok(cond, msg) {
  console.log((cond ? "PASS" : "FAIL") + "  " + msg);
  if (!cond) fallos++;
}

(async () => {
  await limpiar();
  await funcionModel.liberarReservasVencidas();

  // 1. Detalle de función
  const detalle = await funcionModel.buscarPorId(FUNCION);
  ok(detalle && detalle.evento?.id === "evt-demo-jazz", "buscarPorId devuelve la función con evento");
  ok(detalle.asientos.length === 80, `asientos de función = 80 (${detalle.asientos.length})`);
  ok(detalle.zonas.length === 3, `zonas = 3 (${detalle.zonas.length})`);

  // 2. Estadísticas
  const stats = await funcionModel.estadisticas(FUNCION);
  ok(stats && stats.capacidad === 80, `stats.capacidad = 80 (${stats?.capacidad})`);
  ok(stats.disponibles === 80, `stats.disponibles = 80 (${stats?.disponibles})`);
  ok(stats.zonas.length === 3, `stats.zonas = 3 (${stats?.zonas?.length})`);

  // 3. Reserva de 2 asientos por A
  const res = await reservaModel.reservar({ usuarioId: USUARIO_A, funcionId: FUNCION, asientoIds: ["A1", "A2"] });
  ok(!res.status, "reserva A exitosa");
  ok(res.reservas.length === 2 && res.expiraEn, "reserva devuelve 2 reservas + expiraEn");

  // 4. Concurrencia: B intenta reservar los mismos asientos -> 409
  const resB = await reservaModel.reservar({ usuarioId: USUARIO_B, funcionId: FUNCION, asientoIds: ["A1", "A3"] });
  ok(resB.status === 409, `B recibe 409 por A1 ocupado (status=${resB.status})`);
  ok(resB.asientos?.includes("A1"), "el 409 indica que A1 no está disponible");

  // 5. B sí puede reservar otro asiento
  const resB2 = await reservaModel.reservar({ usuarioId: USUARIO_B, funcionId: FUNCION, asientoIds: ["A3"] });
  ok(!resB2.status && resB2.reservas.length === 1, "B reserva A3 exitosamente");

  // 6. Expiración: expirar reservas de B y liberar
  await pool.query(`UPDATE reservas SET expira_en = now() - interval '1 minute' WHERE usuario_id=$1 AND funcion_id=$2 AND estado='activa'`, [USUARIO_B, FUNCION]);
  const liberadas = await funcionModel.liberarReservasVencidas();
  ok(liberadas > 0, `liberarReservasVencidas liberó ${liberadas} reserva(s)`);
  const a3 = (await pool.query(`SELECT estado FROM asientos WHERE funcion_id=$1 AND asiento_id='A3'`, [FUNCION])).rows[0].estado;
  ok(a3 === "available", `A3 vuelve a available tras expirar (${a3})`);

  // 7. Compra con las reservas de A
  const orden = await ordenModel.crear({
    usuarioId: USUARIO_A,
    funcionId: FUNCION,
    payment: { transactionId: "TXN-TEST-001", reservationCode: "RSV-TEST-001", method: "card", cardBrand: "VISA", cardLast4: "4242" },
  });
  ok(!orden.status, "orden creada (sin error HTTP)");
  ok(Number(orden.total) > 0, `total recalculado desde BD (${orden.total})`);
  ok(orden.asientos.length === 2, `orden con 2 asientos (${orden.asientos.length})`);

  const a1 = (await pool.query(`SELECT estado FROM asientos WHERE funcion_id=$1 AND asiento_id='A1'`, [FUNCION])).rows[0].estado;
  ok(a1 === "sold", `A1 quedó sold (${a1})`);
  const entradas = (await pool.query(`SELECT count(*)::int AS n FROM entradas WHERE funcion_id=$1`, [FUNCION])).rows[0].n;
  ok(entradas === 2, `2 entradas creadas con funcion_id (${entradas})`);

  // 8. Recompra sin reserva activa -> 409
  const resA2 = await reservaModel.reservar({ usuarioId: USUARIO_A, funcionId: FUNCION, asientoIds: ["A2"] });
  await pool.query(`UPDATE reservas SET expira_en = now() + interval '1 minute' WHERE funcion_id=$1 AND estado='activa'`, [FUNCION]);
  const orden2 = await ordenModel.crear({
    usuarioId: USUARIO_A,
    funcionId: FUNCION,
    payment: { transactionId: "TXN-TEST-002", reservationCode: "RSV-TEST-002", method: "card" },
  });
  ok(orden2.status === 409, "compra sin reserva válida -> 409");

  // 9. Estadísticas tras venta
  const stats2 = await funcionModel.estadisticas(FUNCION);
  ok(stats2.vendidos === 2, `vendidos = 2 (${stats2.vendidos})`);
  ok(stats2.disponibles === 78, `disponibles = 78 (${stats2.disponibles})`);

  console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTODOS LOS TESTS PASAN");
  await limpiar();
  await pool.end();
  process.exit(fallos ? 1 : 0);
})().catch(async (e) => {
  console.error("ERROR INESPERADO:", e);
  try { await limpiar(); } catch (_) {}
  await pool.end();
  process.exit(1);
});
