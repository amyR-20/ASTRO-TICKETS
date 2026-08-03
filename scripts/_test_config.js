const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync("js/config.js", "utf8");

function evaluar({ hostname, protocol, astroApiBase }) {
  const sandbox = {
    window: {
      location: { hostname, protocol },
      ASTRO_API_BASE: astroApiBase,
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return vm.runInContext("AstroConfig.API_BASE", sandbox);
}

const casos = [
  ["localhost:3000 servido por Express", evaluar({ hostname: "localhost", protocol: "http:" }), "http://localhost:3000/api"],
  ["archivo file://", evaluar({ hostname: "", protocol: "file:" }), "http://localhost:3000/api"],
  ["GitHub Pages (sin ASTRO_API_BASE)", evaluar({ hostname: "amyr-20.github.io", protocol: "https:" }), "https://TU-BACKEND-URL-AQUI.onrender.com/api"],
  ["GitHub Pages (con ASTRO_API_BASE inyectado)", evaluar({ hostname: "amyr-20.github.io", protocol: "https:", astroApiBase: "https://real.onrender.com/api" }), "https://real.onrender.com/api"],
  ["ASTRO_API_BASE con barra final", evaluar({ hostname: "localhost", protocol: "http:", astroApiBase: "https://real.onrender.com/api/" }), "https://real.onrender.com/api"],
];

let fallos = 0;
for (const [nombre, obtenido, esperado] of casos) {
  const ok = obtenido === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nombre} -> ${obtenido}${ok ? "" : ` (esperado ${esperado})`}`);
}
process.exit(fallos ? 1 : 0);
