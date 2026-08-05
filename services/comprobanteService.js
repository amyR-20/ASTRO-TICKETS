/* ============================================================
   Astro Tickets — services/comprobanteService.js
   Generación del PDF del comprobante de pago de una orden.
   ============================================================ */

const PDFDocument = require("pdfkit");
const { formatRD } = require("./entradaService");

const INDIGO = "#1E1B4B";
const VIOLETA = "#7C3AED";
const GRIS = "#6B7280";

/** Normaliza la hora de un evento a "HH:MM". */
function formatHora(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

/** Formatea la fecha/hora de compra en "jueves 3 de agosto, 15:30". */
function formatFechaHora(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha.getTime ? fecha.getTime() : fecha);
  if (Number.isNaN(d.getTime())) return "";
  const dia = d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return `${dia}, ${hora}`;
}

/** Método de pago legible para el comprobante. */
function metodoPagoLegible(orden) {
  const metodo = String(orden.payment?.method || "tarjeta").toLowerCase();
  if (metodo === "card" || metodo === "tarjeta" || metodo === "stripe") {
    const marca = orden.payment?.cardBrand;
    const ultimos4 = orden.payment?.cardLast4;
    return `Tarjeta ${marca || "bancaria"}${ultimos4 ? ` **** ${ultimos4}` : ""}`;
  }
  return metodo;
}

/**
 * Genera el PDF del comprobante de pago de una orden como un Buffer.
 * orden: objeto del formato que devuelve ordenModel.listarPorUsuario()
 *        (orderId, event, funcion, comprador, seats, pricing, payment, status).
 */
async function generarPdfComprobante(orden) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: `Comprobante de pago — ${orden.event?.name || "Orden"}`,
      Author: "Astro Tickets",
    },
  });

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  const pageW = doc.page.width;

  // ---- Marca de fondo suave ----
  doc.save();
  doc.rect(0, 0, pageW, doc.page.height).fill("#F5F3FF");
  doc.restore();

  // ---- Encabezado ----
  doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(22).text("ASTRO TICKETS", 40, 44);
  doc.fontSize(9).fillColor(GRIS)
    .text("Comprobante de pago · conserva este documento como respaldo", 40, 72);

  // ---- Línea ----
  doc.moveTo(40, 104).lineTo(pageW - 40, 104)
    .lineWidth(1.5).strokeColor(VIOLETA).stroke();

  // ---- Encabezado del comprobante ----
  doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(13).text("COMPROBANTE DE PAGO", 40, 120);
  doc.font("Helvetica").fontSize(9).fillColor(GRIS)
    .text(`Emitido el ${formatFechaHora(orden.purchasedAt || new Date())}.`, 40, 140);

  // ---- Comprador y datos de la orden ----
  const yOrden = 168;
  const ordenRows = [
    ["Comprador", orden.comprador?.nombre || "—"],
    ["Correo", orden.comprador?.email || "—"],
    ["Nº de transacción", orden.payment?.transactionId || "—"],
    ["Código de reserva", orden.payment?.reservationCode || "—"],
    ["Método de pago", metodoPagoLegible(orden)],
    ["Estado", orden.status === "paid" ? "Pagado" : (orden.status || "—")],
  ];
  const hOrden = 36 + 15 * ordenRows.length + 6;
  doc.roundedRect(40, yOrden, pageW - 80, hOrden, 8).fill("#FFFFFF");
  doc.fillColor(VIOLETA).font("Helvetica-Bold").fontSize(10).text("COMPRADOR Y ORDEN", 58, yOrden + 16);

  let yRow = yOrden + 36;
  for (const [label, valor] of ordenRows) {
    doc.fillColor(GRIS).font("Helvetica").fontSize(9.5).text(label, 58, yRow);
    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(9.5).text(String(valor), 190, yRow, { width: pageW - 270 });
    yRow += 15;
  }

  // ---- Evento ----
  const yEvento = yOrden + hOrden + 16;
  const eventoRows = [
    ["Evento", orden.event?.name || "—"],
    ["Fecha", orden.funcion?.fecha || orden.event?.date || "—"],
    ["Hora", formatHora(orden.funcion?.hora) || "—"],
    ["Lugar", orden.event?.venue || "—"],
    ["Sala", orden.funcion?.sala || "—"],
  ];
  const hEvento = 36 + 15 * eventoRows.length + 6;
  doc.roundedRect(40, yEvento, pageW - 80, hEvento, 8).fill("#FFFFFF");
  doc.fillColor(VIOLETA).font("Helvetica-Bold").fontSize(10).text("EVENTO", 58, yEvento + 16);

  yRow = yEvento + 36;
  for (const [label, valor] of eventoRows) {
    doc.fillColor(GRIS).font("Helvetica").fontSize(9.5).text(label, 58, yRow);
    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(9.5).text(String(valor), 190, yRow, { width: pageW - 270 });
    yRow += 15;
  }

  // ---- Boletos ----
  const seats = Array.isArray(orden.seats) ? orden.seats : [];
  const ySeats = yEvento + hEvento + 16;
  const hSeats = 58 + 16 * seats.length + 6;
  doc.roundedRect(40, ySeats, pageW - 80, hSeats, 8).fill("#FFFFFF");
  doc.fillColor(VIOLETA).font("Helvetica-Bold").fontSize(10).text("BOLETOS", 58, ySeats + 16);

  const colSeatX = 58;
  const colZoneX = 200;
  const colPriceX = 350;
  const colPriceW = pageW - 350 - 56;
  doc.fillColor(GRIS).font("Helvetica-Bold").fontSize(9)
    .text("ASIENTO", colSeatX, ySeats + 36)
    .text("ZONA", colZoneX, ySeats + 36)
    .text("PRECIO", colPriceX, ySeats + 36, { width: colPriceW, align: "right" });
  doc.moveTo(58, ySeats + 50).lineTo(pageW - 58, ySeats + 50).lineWidth(0.75).strokeColor(GRIS).stroke();

  yRow = ySeats + 58;
  for (const seat of seats) {
    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(9.5).text(String(seat.id || "—"), colSeatX, yRow);
    doc.fillColor(GRIS).font("Helvetica").fontSize(9.5).text(String(seat.zone || "General"), colZoneX, yRow);
    doc.font("Helvetica-Bold").fillColor(INDIGO)
      .text(formatRD(seat.price), colPriceX, yRow, { width: colPriceW, align: "right" });
    yRow += 16;
  }

  // ---- Totales (salto de página si no caben) ----
  let yTotal = ySeats + hSeats + 16;
  const totalRows = [
    ["Subtotal", formatRD(orden.pricing?.subtotal)],
    ["Tarifa", formatRD(orden.pricing?.fee)],
    ["Total pagado", formatRD(orden.pricing?.total)],
  ];
  const hTotal = 18 + 18 * totalRows.length + 14;
  if (yTotal + hTotal > doc.page.height - 60) {
    doc.addPage();
    doc.save();
    doc.rect(0, 0, pageW, doc.page.height).fill("#F5F3FF");
    doc.restore();
    yTotal = 40;
  }
  doc.roundedRect(pageW - 40 - 230, yTotal, 230, hTotal, 8).fill("#FFFFFF");
  yRow = yTotal + 18;
  for (const [label, valor] of totalRows) {
    doc.fillColor(GRIS).font("Helvetica").fontSize(9.5).text(label, pageW - 40 - 214, yRow);
    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(9.5).text(String(valor), pageW - 40 - 214, yRow, { width: 198, align: "right" });
    yRow += 18;
  }

  // ---- Pie ----
  doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text(
    "Astro Tickets · comprobante de pago · si tienes dudas, contacta a soporte.",
    40, doc.page.height - 54, { width: pageW - 80 }
  );

  doc.end();

  const buffer = await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return buffer;
}

/** Nombre de archivo sugerido para el comprobante. */
function nombreArchivoComprobante(orden) {
  const limpio = (orden.event?.name || "orden")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `astro-comprobante_${limpio}_${orden.payment?.transactionId || orden.orderId || "orden"}.pdf`;
}

module.exports = { generarPdfComprobante, nombreArchivoComprobante };
