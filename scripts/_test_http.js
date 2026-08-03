const { spawn } = require("child_process");
const { pool } = require("../config/database");

const PORT = 3210;
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = `http_test_${Date.now()}@astro.com`;

let fallos = 0;
function ok(cond, msg) {
  console.log((cond ? "PASS" : "FAIL") + "  " + msg);
  if (!cond) fallos++;
}

async function api(path, { method = "GET", token = null, body = null } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

(async () => {
  const server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe",
  });
  server.stderr.on("data", (d) => console.error("[srv]", String(d).trim()));

  // Esperar a que el servidor esté listo
  let listo = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE + "/api/health");
      if (r.ok) { listo = true; break; }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!listo) {
    console.error("El servidor no arrancó.");
    server.kill();
    process.exit(1);
  }
  console.log("Servidor listo en " + PORT);

  try {
    // 0. Preparar datos de la función demo (asientos de prueba libres)
    await pool.query(`DELETE FROM entradas WHERE funcion_id=3 AND asiento_id IN ('A1','A2','B1')`, []);
    await pool.query(`DELETE FROM ordenes o WHERE NOT EXISTS (SELECT 1 FROM entradas e WHERE e.orden_id = o.id)`, []);
    await pool.query(`DELETE FROM reservas WHERE funcion_id=3 AND asiento_id IN ('A1','A2','B1')`, []);
    await pool.query(`UPDATE asientos SET estado='available' WHERE funcion_id=3 AND asiento_id IN ('A1','A2','B1')`, []);

    // 1. Registro de usuario nuevo
    const reg = await api("/api/auth/registro", {
      method: "POST",
      body: { nombre: "Test HTTP", email: EMAIL, password: "Test1234!", password2: "Test1234!" },
    });
    ok(reg.status === 201, `registro -> 201 (${reg.status})`);

    // 2. Login
    const login = await api("/api/auth/login", {
      method: "POST",
      body: { email: EMAIL, password: "Test1234!" },
    });
    ok(login.status === 200 && login.data.token, `login -> 200 con token`);
    const tokenUser = login.data.token;
    const userId = login.data.usuario.id;

    // 3. Público: listar eventos con funciones
    const eventos = await api("/api/eventos?estado=published");
    ok(eventos.status === 200 && Array.isArray(eventos.data.eventos), "GET /api/eventos -> 200 con lista");
    const jazz = eventos.data.eventos.find((e) => e.id === "evt-demo-jazz");
    ok(jazz && Array.isArray(jazz.funciones) && jazz.funciones.length === 1, "evento jazz trae 1 función");

    // 4. Detalle de función
    const func = await api("/api/funciones/3");
    ok(func.status === 200 && func.data.asientos.length === 80, "GET /api/funciones/3 -> 200 con asientos");

    // 5. Reserva sin token -> 401
    const sinToken = await api("/api/funciones/3/reservar", { method: "POST", body: { asientos: ["A1"] } });
    ok(sinToken.status === 401, `reservar sin token -> 401 (${sinToken.status})`);

    // 6. Reserva con token -> 201
    const res = await api("/api/funciones/3/reservar", { method: "POST", token: tokenUser, body: { asientos: ["A1", "A2"] } });
    ok(res.status === 201 && res.data.reservas.length === 2, `reservar -> 201 con 2 reservas (${res.status})`);

    // 7. Concurrencia: mismo asiento -> 409
    const conflicto = await api("/api/funciones/3/reservar", { method: "POST", token: tokenUser, body: { asientos: ["A1", "B3"] } });
    ok(conflicto.status === 409, `reservar asiento ocupado -> 409 (${conflicto.status})`);

    // 8. Validación: sin asientos -> 400
    const vacio = await api("/api/funciones/3/reservar", { method: "POST", token: tokenUser, body: { asientos: [] } });
    ok(vacio.status === 400, `reservar sin asientos -> 400 (${vacio.status})`);

    // 9. Comprar con la reserva -> 201
    const orden = await api("/api/ordenes", {
      method: "POST",
      token: tokenUser,
      body: { funcionId: 3, payment: { transactionId: "TXN-HTTP-001", reservationCode: "RSV-HTTP-001", method: "card", cardBrand: "VISA", cardLast4: "4242" } },
    });
    ok(orden.status === 201 && orden.data.orden.total > 0, `POST /api/ordenes -> 201 (${orden.status})`);

    // 10. Recompra sin reserva -> 409
    const orden2 = await api("/api/ordenes", {
      method: "POST",
      token: tokenUser,
      body: { funcionId: 3, payment: { transactionId: "TXN-HTTP-002", reservationCode: "RSV-HTTP-002", method: "card" } },
    });
    ok(orden2.status === 409, `compra sin reserva -> 409 (${orden2.status})`);

    // 11. Admin: sin token -> 401, con token de usuario -> 403
    const adminNoToken = await api("/api/admin/resumen");
    ok(adminNoToken.status === 401, `admin sin token -> 401 (${adminNoToken.status})`);
    const adminUsuario = await api("/api/admin/resumen", { token: tokenUser });
    ok(adminUsuario.status === 403, `admin con rol user -> 403 (${adminUsuario.status})`);

    // 12. Crear función sin ser admin -> 403
    const crearFuncion = await api("/api/eventos/evt-demo-jazz/funciones", {
      method: "POST", token: tokenUser,
      body: { fecha: "2026-11-20", hora: "21:00", sala: "Sala 2" },
    });
    ok(crearFuncion.status === 403, `crear función como user -> 403 (${crearFuncion.status})`);

    // 13. Crear función con rol admin -> 201
    await pool.query(`UPDATE usuarios SET role='admin' WHERE id=$1`, [userId]);
    const loginAdmin = await api("/api/auth/login", { method: "POST", body: { email: EMAIL, password: "Test1234!" } });
    const tokenAdmin = loginAdmin.data.token;
    const crearFuncionAdmin = await api("/api/eventos/evt-demo-jazz/funciones", {
      method: "POST", token: tokenAdmin,
      body: { fecha: "2026-11-20", hora: "21:00", sala: "Sala 2", razon: "test" },
    });
    ok(crearFuncionAdmin.status === 201, `crear función admin -> 201 (${crearFuncionAdmin.status})`);
    const funcionNueva = crearFuncionAdmin.data.funcion;

    // 14. Duplicado (misma fecha+hora) -> 409
    const dup = await api("/api/eventos/evt-demo-jazz/funciones", {
      method: "POST", token: tokenAdmin,
      body: { fecha: "2026-11-20", hora: "21:00", sala: "Sala 2" },
    });
    ok(dup.status === 409, `función duplicada -> 409 (${dup.status})`);

    // 15. Función en fecha pasada -> 400
    const pasado = await api("/api/eventos/evt-demo-jazz/funciones", {
      method: "POST", token: tokenAdmin,
      body: { fecha: "2020-01-01", hora: "21:00" },
    });
    ok(pasado.status === 400, `función en fecha pasada -> 400 (${pasado.status})`);

    // 16. Cancelar evento sin razón -> 400
    const cancelarSinRazon = await api("/api/eventos/evt-demo-jazz/cancelar", { method: "POST", token: tokenAdmin, body: {} });
    ok(cancelarSinRazon.status === 400, `cancelar sin razón -> 400 (${cancelarSinRazon.status})`);

    // 17. Bloquear asiento con razón -> 200
    const bloquear = await api("/api/funciones/3/asientos/B1/bloquear", {
      method: "POST", token: tokenAdmin, body: { razon: "test bloqueo" },
    });
    ok(bloquear.status === 200, `bloquear asiento admin -> 200 (${bloquear.status})`);

    // 18. Resumen admin -> 200
    const resumen = await api("/api/admin/resumen", { token: tokenAdmin });
    ok(resumen.status === 200 && Array.isArray(resumen.data.eventos), `admin resumen -> 200 (${resumen.status})`);

    // 19. Auditoría admin -> 200
    const audit = await api("/api/admin/auditoria", { token: tokenAdmin });
    ok(audit.status === 200 && Array.isArray(audit.data.auditoria), `admin auditoría -> 200 (${audit.status})`);

    // 20. Eliminar la función creada
    const del = await api(`/api/funciones/${funcionNueva.id}`, { method: "DELETE", token: tokenAdmin, body: { razon: "limpieza test" } });
    ok(del.status === 200, `eliminar función -> 200 (${del.status})`);

    // 21. 404 de ruta inexistente
    const nf = await api("/api/eventos/no-existe");
    ok(nf.status === 404, `evento inexistente -> 404 (${nf.status})`);

    console.log(fallos ? `\n${fallos} FALLO(S)` : "\nTODOS LOS TESTS HTTP PASAN");
  } finally {
    // Limpieza
    try {
      await pool.query(`DELETE FROM entradas WHERE evento_id='evt-demo-jazz' AND funcion_id=3 AND orden_id IN (SELECT id FROM ordenes WHERE usuario_id=(SELECT id FROM usuarios WHERE email=$1))`, [EMAIL]);
      await pool.query(`DELETE FROM ordenes WHERE usuario_id=(SELECT id FROM usuarios WHERE email=$1)`, [EMAIL]);
      await pool.query(`DELETE FROM reservas WHERE usuario_id=(SELECT id FROM usuarios WHERE email=$1)`, [EMAIL]);
      await pool.query(`UPDATE asientos SET estado='available' WHERE funcion_id=3 AND asiento_id IN ('A1','A2','B1')`, []);
      await pool.query(`DELETE FROM auditoria WHERE usuario_id=(SELECT id FROM usuarios WHERE email=$1)`, [EMAIL]);
      await pool.query(`DELETE FROM usuarios WHERE email=$1`, [EMAIL]);
    } catch (e) {
      console.error("Limpieza:", e.message);
    }
    server.kill();
    await pool.end();
    process.exit(fallos ? 1 : 0);
  }
})().catch((e) => {
  console.error("ERROR INESPERADO:", e);
  server.kill();
  process.exit(1);
});
