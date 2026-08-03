/* ============================================================
   Astro Tickets — scripts/_test_entradas.js
   Test end-to-end de entradas (PDF + QR):
   1. login admin       5. mis-compras (códigos de entrada)
   2. primer evento     6. descargar PDF
   3. primera función   7. validar QR (ok, repetido, inválido)
   4. reservar + comprar
   Levanta el servidor en :3099 y lo cierra al terminar.
   ============================================================ */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;

const server = spawn("node", ["server.js"], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: "test" },
  stdio: ["ignore", "ignore", "inherit"],
});

function esperarServidor(veces = 40) {
  return new Promise((resolve) => {
    const tryOnce = async () => {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) return resolve();
      } catch (_) {}
      if (veces-- <= 0) return resolve();
      setTimeout(tryOnce, 500);
    };
    tryOnce();
  });
}

async function api(method, ruta, { token, body } = {}) {
  const res = await fetch(BASE + ruta, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let data = null;
  try { data = JSON.parse(texto); } catch (_) {}
  return { status: res.status, data, buffer: res.ok && texto.includes("%PDF") ? texto : null };
}

async function main() {
  await esperarServidor();
  let ok = 0, fail = 0;
  const check = (nombre, cond, extra) => {
    if (cond) { ok++; console.log("OK  ->", nombre); }
    else { fail++; console.log("FAIL->", nombre, extra || ""); }
  };

  // 1. login admin
  const login = await api("POST", "/api/auth/login", {
    body: { email: "admin@astro.com", password: "admin123" },
  });
  check("login admin", login.status === 200, JSON.stringify(login.data));
  const token = login.data && login.data.token;
  if (!token) return fin(fail, ok);

  // 2. eventos
  const eventos = await api("GET", "/api/eventos");
  const eventosArr = (eventos.data && (eventos.data.eventos || eventos.data)) || [];
  check("listar eventos", eventosArr.length > 0);

  // 3. funciones: usar el primer evento que tenga funciones (un evento sin
  // función no es vendible, así que no debe bloquear el resto del flujo).
  let evento = null;
  let funcionesArr = [];
  for (const ev of eventosArr) {
    const funcs = await api("GET", `/api/eventos/${ev.id}/funciones`);
    funcionesArr = (funcs.data && funcs.data.funciones) || [];
    if (funcionesArr.length) { evento = ev; break; }
  }
  check("listar funciones", funcionesArr.length > 0);
  const funcion = funcionesArr[0];

  // 4. detalle de la función → asientos disponibles
  const detalle = await api("GET", `/api/funciones/${funcion.id}`);
  const asientos = (detalle.data && (detalle.data.asientos || detalle.data.seats)) || [];
  const libres = asientos.filter((a) => a.estado === "available" || a.estado === "disponible");
  check("función con asientos libres", libres.length > 0, JSON.stringify(libres.slice(0, 2)));
  if (!libres.length) return fin(fail, ok);
  const elegidos = libres.slice(0, 2).map((a) => a.asiento_id || a.id);

  // 5. reservar
  const resv = await api("POST", `/api/funciones/${funcion.id}/reservar`, {
    token,
    body: { asientos: elegidos },
  });
  check("reservar asientos", resv.status === 201, JSON.stringify(resv.data));
  if (resv.status !== 201) return fin(fail, ok);

  // 6. comprar
  const compra = await api("POST", "/api/ordenes", {
    token,
    body: {
      funcionId: funcion.id,
      payment: {
        transactionId: "TEST-" + Date.now(),
        reservationCode: "RES-" + Date.now(),
        method: "tarjeta",
        cardBrand: "visa",
        cardLast4: "4242",
      },
    },
  });
  check("crear orden", compra.status === 201, JSON.stringify(compra.data));
  if (compra.status !== 201) return fin(fail, ok);

  // 7. mis-compras → códigos de entrada
  const hist = await api("GET", "/api/ordenes/mis-compras", { token });
  const compras = (hist.data && hist.data.compras) || [];
  const miCompra = compras.find((c) => c.payment && c.payment.transactionId === compra.data.orden.transaccion);
  check("historial tiene la compra", !!miCompra);
  const entradas = (miCompra && miCompra.seats) || [];
  check("historial trae códigos de entrada", entradas.length >= 2, JSON.stringify(entradas));
  const codigoEntrada = entradas[0] && entradas[0].codigo;

  // 8. descargar PDF (con token del comprador)
  const pdf = await api("GET", `/api/entradas/${codigoEntrada}/pdf`, { token });
  check("descargar PDF", pdf.status === 200 && pdf.buffer && pdf.buffer.includes("%PDF"), `status=${pdf.status}`);

  // 8b. PDF sin sesión → 401
  const pdfAnon = await api("GET", `/api/entradas/${codigoEntrada}/pdf`);
  check("PDF anónimo rechazado", pdfAnon.status === 401 || pdfAnon.status === 403);

  // 9. validar QR con token inválido
  const qrInvalido = await api("POST", "/api/entradas/validar", { token, body: { qrToken: "NOEXISTE" } });
  check("QR inválido rechazado", qrInvalido.status === 404);

  // 10. validar QR correcto (el token se saca de la BD, como lo lee un escáner)
  const { pool } = require("../config/database");
  const qrRow = await pool.query("SELECT qr_token FROM entradas WHERE codigo = $1", [codigoEntrada]);
  const qrToken = qrRow.rows[0] && qrRow.rows[0].qr_token;
  check("entrada tiene qr_token", !!qrToken);
  const qrOk = await api("POST", "/api/entradas/validar", { token, body: { qrToken } });
  check("validar QR correcto", qrOk.status === 200, JSON.stringify(qrOk.data));

  // 11. reutilizar el mismo QR → 409
  const qrRepetido = await api("POST", "/api/entradas/validar", { token, body: { qrToken } });
  check("QR reutilizado rechazado", qrRepetido.status === 409, JSON.stringify(qrRepetido.data));
  await pool.end();

  return fin(fail, ok);
}

async function fin(fail, ok) {
  console.log(`\nRESULTADO: ${ok} OK, ${fail} FAIL`);
  server.kill();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("Error de test:", e); server.kill(); process.exit(1); });
