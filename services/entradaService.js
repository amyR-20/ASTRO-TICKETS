/* ============================================================
   Astro Tickets — services/entradaService.js
   Generación de QR y PDF de cada entrada, y envío por correo.
   ============================================================ */

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");

const INDIGO = "#1E1B4B";
const VIOLETA = "#7C3AED";
const GRIS = "#6B7280";

/** Formatea el precio en pesos chilenos ($ 1.200). */
function formatCLP(valor) {
  const n = Number(valor || 0);
  return "$ " + Math.round(n).toLocaleString("es-CL");
}

/** Devuelve la fecha de un evento en formato "jueves 3 de agosto". */
function formatFecha(fecha) {
  if (!fecha) return "";
  const d = new Date(fecha.getTime ? fecha.getTime() : fecha);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Normaliza la hora de un evento a "HH:MM". */
function formatHora(hora) {
  if (!hora) return "";
  const h = String(hora);
  return h.slice(0, 5);
}

/**
 * Genera el PDF de una entrada como un Buffer.
 * entrada: fila completa de entradaModel.obtenerEntrada()
 */
async function generarPdfEntrada(entrada) {
  const qrToken = entrada.qr_token;
  if (!qrToken) throw new Error("La entrada no tiene código QR asociado.");

  const dataUrl = await QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: { dark: INDIGO, light: "#FFFFFF" },
  });
  const qrBuffer = Buffer.from(dataUrl.split(",")[1], "base64");

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: `Entrada — ${entrada.evento_nombre}`,
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
    .text("Boleta electrónica · acceso validado con código QR", 40, 72);

  // ---- Línea de la boleta (borde recortado) ----
  const yBoleta = 104;
  doc.moveTo(40, yBoleta).lineTo(pageW - 40, yBoleta)
    .lineWidth(1.5).strokeColor(VIOLETA).stroke();

  // ---- Bloque del evento ----
  doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(17)
    .text(entrada.evento_nombre, 40, 128, { width: pageW - 200 });
  doc.font("Helvetica").fontSize(10).fillColor(GRIS)
    .text(
      `${entrada.evento_categoria || "Evento"} · ${formatFecha(entrada.evento_fecha)} · ${formatHora(entrada.evento_hora)}`,
      40, 154, { width: pageW - 200 }
    );
  doc.text(`Lugar: ${entrada.evento_lugar || "Por confirmar"}`, 40, 172, { width: pageW - 200 });

  // ---- Código QR ----
  const qrSize = 150;
  const qrX = pageW - 40 - qrSize;
  const qrY = 128;
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
  doc.font("Helvetica").fontSize(7).fillColor(GRIS)
    .text("ESCANEAR EN ACCESO", qrX, qrY + qrSize + 4, { width: qrSize, align: "center" });

  // ---- Detalle del asiento ----
  const yDetalle = 210;
  doc.roundedRect(40, yDetalle, pageW - 80, 150, 8).fill("#FFFFFF");
  doc.fillColor(VIOLETA).font("Helvetica-Bold").fontSize(10).text("DETALLE DEL ASIENTO", 58, 228);

  const detalleRows = [
    ["Zona", entrada.zona || "General"],
    ["Asiento", entrada.asiento || entrada.asiento_id || "—"],
    ["Precio", formatCLP(entrada.precio)],
    ["Estado", entrada.estado === "usada" ? "Ya utilizada" : "Válida"],
  ];
  let yRow = 250;
  for (const [label, valor] of detalleRows) {
    doc.fillColor(GRIS).font("Helvetica").fontSize(10).text(label, 58, yRow);
    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(10.5).text(String(valor), 200, yRow);
    yRow += 26;
  }

  // ---- Códigos de verificación ----
  const yCodes = yDetalle + 150 + 18;
  doc.fontSize(8).fillColor(GRIS).text("CÓDIGO DE LA ENTRADA", 40, yCodes);
  doc.font("Courier-Bold").fontSize(10).fillColor(INDIGO).text(entrada.codigo || "—", 40, yCodes + 12);
  doc.fontSize(8).fillColor(GRIS).text("CÓDIGO DE LA COMPRA", 40, yCodes + 34);
  doc.font("Courier").fontSize(10).fillColor(INDIGO).text(entrada.codigo_reserva || "—", 40, yCodes + 46);

  // ---- Pie ----
  doc.font("Helvetica").fontSize(7.5).fillColor(GRIS).text(
    `Comprada por ${entrada.comprador || "—"} (${entrada.email || "—"}) el ${formatFecha(entrada.comprada_en)}.`,
    40, doc.page.height - 70, { width: pageW - 80 }
  );
  doc.text(
    "Astro Tickets · entrada electrónica · conserva este PDF hasta el día del evento.",
    40, doc.page.height - 54, { width: pageW - 80 }
  );

  doc.end();

  const buffer = await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return buffer;
}

/** Genera la imagen QR (PNG) de una entrada para mostrar en pantalla. */
async function generarQrPng(qrToken) {
  return QRCode.toBuffer(qrToken, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: INDIGO, light: "#FFFFFF" },
  });
}

/** Nombre de archivo sugerido para la entrada. */
function nombreArchivo(entrada) {  const limpio = (entrada.evento_nombre || "evento")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `entrada-${limpio}-${entrada.asiento || entrada.asiento_id || entrada.id}.pdf`;
}

// ---- Correo ----

/** Configura el transporter de nodemailer según .env. Devuelve null si no hay SMTP. */
function transporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

/**
 * Envía por correo el PDF de una entrada al comprador.
 * Devuelve { enviado, motivo } para que el controller responda con
 * claridad si el correo no está configurado.
 */
async function enviarPdfPorEmail(entrada) {
  const trans = transporter();
  if (!trans) {
    return { enviado: false, motivo: "SMTP no configurado" };
  }
  if (!entrada.email) {
    return { enviado: false, motivo: "El comprador no tiene correo registrado" };
  }

  const buffer = await generarPdfEntrada(entrada);
  await trans.sendMail({
    from: process.env.SMTP_FROM || "Astro Tickets <no-responder@astro.tickets>",
    to: entrada.email,
    subject: `Tu entrada — ${entrada.evento_nombre}`,
    text: `Hola ${entrada.comprador || ""},\n\nAdjuntamos tu entrada para ${entrada.evento_nombre}.\n\nQue lo disfrutes.\nAstro Tickets`,
    attachments: [
      { filename: nombreArchivo(entrada), content: buffer, contentType: "application/pdf" },
    ],
  });
  return { enviado: true };
}

module.exports = { generarPdfEntrada, generarQrPng, nombreArchivo, enviarPdfPorEmail, formatCLP };
