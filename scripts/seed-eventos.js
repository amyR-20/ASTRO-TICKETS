/* ============================================================
   Astro Tickets — scripts/seed-eventos.js
   Inserta los 6 eventos demo en la base (Neon) si no existen.
   Uso: node scripts/seed-eventos.js
   ============================================================ */

require("dotenv").config();
const eventoModel = require("../models/eventoModel");

const DEMOS = [
  { id: "evt-demo-jazz", name: "Noche de Jazz en Vivo", date: "2026-08-20", time: "20:00", venue: "Teatro Nacional, Santo Domingo", city: "Santo Domingo", category: "Concierto", description: "Una velada íntima con los mejores exponentes del jazz contemporáneo.", image: "multimedia/jazz.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 4500, qty: 20, desc: "" }, { name: "VIP", color: "#d63384", price: 3200, qty: 30, desc: "" }, { name: "General", color: "#10b981", price: 1800, qty: 30, desc: "" }], seats: [], rows: 8, cols: 10, capacity: 80, status: "published" },
  { id: "evt-demo-urbano", name: "Festival Ritmo Urbano", date: "2026-09-05", time: "21:00", venue: "Estadio Olímpico, Santo Domingo", city: "Santo Domingo", category: "Concierto", description: "La música urbana más vibrante en un solo escenario.", image: "multimedia/urbano.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 5500, qty: 36, desc: "" }, { name: "VIP", color: "#d63384", price: 3800, qty: 48, desc: "" }, { name: "General", color: "#10b981", price: 2200, qty: 60, desc: "" }], seats: [], rows: 12, cols: 12, capacity: 144, status: "published" },
  { id: "evt-demo-hamlet", name: "Hamlet, Obra de Teatro", date: "2026-09-12", time: "19:30", venue: "Casa de Teatro, Santo Domingo", city: "Santo Domingo", category: "Teatro", description: "La obra clásica de Shakespeare reinventada.", image: "multimedia/hamlet.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 3500, qty: 16, desc: "" }, { name: "VIP", color: "#d63384", price: 2500, qty: 16, desc: "" }, { name: "General", color: "#10b981", price: 1400, qty: 24, desc: "" }], seats: [], rows: 7, cols: 8, capacity: 56, status: "published" },
  { id: "evt-demo-baloncesto", name: "Clásico de Baloncesto", date: "2026-09-18", time: "20:00", venue: "Palacio de los Deportes, Santo Domingo", city: "Santo Domingo", category: "Deportes", description: "La emoción del baloncesto profesional en vivo.", image: "multimedia/baloncesto.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 3800, qty: 30, desc: "" }, { name: "VIP", color: "#d63384", price: 2800, qty: 30, desc: "" }, { name: "General", color: "#10b981", price: 1600, qty: 40, desc: "" }], seats: [], rows: 10, cols: 10, capacity: 100, status: "published" },
  { id: "evt-demo-conferencia", name: "Conferencia de Innovación Digital", date: "2026-09-30", time: "09:00", venue: "Centro de Convenciones, Santo Domingo", city: "Santo Domingo", category: "Conferencia", description: "Tendencias digitales que transforman el futuro.", image: "multimedia/conferencia.jpg", zones: [{ name: "VIP", color: "#d63384", price: 3200, qty: 40, desc: "" }, { name: "General", color: "#10b981", price: 2000, qty: 60, desc: "" }], seats: [], rows: 10, cols: 10, capacity: 100, status: "published" },
  { id: "evt-demo-sinfonica", name: "Sinfónica de Otoño", date: "2026-10-10", time: "20:00", venue: "Teatro Nacional, Santo Domingo", city: "Santo Domingo", category: "Concierto", description: "La orquesta sinfónica en una velada inolvidable.", image: "multimedia/sinfonica.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 4800, qty: 20, desc: "" }, { name: "VIP", color: "#d63384", price: 3500, qty: 30, desc: "" }, { name: "General", color: "#10b981", price: 2200, qty: 30, desc: "" }], seats: [], rows: 8, cols: 10, capacity: 80, status: "published" }
];

// Genera los asientos igual que el frontend (A1, A2, ...)
function generarAsientos(rows, cols) {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const rowLetter = String.fromCharCode(65 + r);
    for (let c = 1; c <= cols; c++) {
      seats.push({ id: rowLetter + c, row: rowLetter, col: c, type: null, status: "available" });
    }
  }
  return seats;
}

(async () => {
  let creados = 0;
  for (const demo of DEMOS) {
    const existe = await eventoModel.buscarPorId(demo.id);
    if (existe) {
      console.log(`Ya existe: ${demo.id}`);
      continue;
    }
    const datos = {
      ...demo,
      seats: generarAsientos(demo.rows, demo.cols),
      createdAt: new Date().toISOString(),
    };
    await eventoModel.crear(datos);
    creados++;
    console.log(`Creado: ${demo.name}`);
  }
  console.log(`\nListo. ${creados} evento(s) creado(s).`);
  process.exit(0);
})().catch((err) => {
  console.error("Error al sembrar eventos:", err);
  process.exit(1);
});
