const { spawn } = require("child_process");
const http = require("http");

const PORT = 3220;
const BASE = `http://127.0.0.1:${PORT}`;

function get(origin) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: PORT,
        path: "/api/health",
        method: "GET",
        headers: origin ? { Origin: origin } : {},
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, acao: res.headers["access-control-allow-origin"] }));
      }
    );
    req.on("error", (e) => resolve({ error: e.message }));
    req.end();
  });
}

(async () => {
  const server = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });

  let listo = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await get(null);
      if (r.status === 200) { listo = true; break; }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!listo) { console.error("No arrancó"); server.kill(); process.exit(1); }

  const casos = [
    ["https://amyr-20.github.io", "PERMITIDO"],
    ["http://localhost:3000", "PERMITIDO (dev)"],
    ["http://localhost:5501", "PERMITIDO (Live Server)"],
    ["null", "PERMITIDO (file://)"],
    ["https://otro-dominio.com", "DEBE SER RECHAZADO (sin ACAO)"],
    [null, "SIN Origin (mismo origen)"],
  ];

  for (const [origin, esperado] of casos) {
    const r = await get(origin);
    const estado = origin === null ? "200 sin ACAO (ok)" : r.acao ? `200 ACAO=${r.acao}` : `${r.status} sin ACAO`;
    console.log(`Origin=${origin || "(ninguno)"}  ->  ${estado}  [${esperado}]`);
  }

  server.kill();
  process.exit(0);
})();
