const Stripe = require("stripe");
const { pool } = require("../config/database");

function clienteStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe no está configurado en el servidor.");
  return new Stripe(secret);
}

async function resumenReserva(usuarioId, funcionId) {
  const { rows } = await pool.query(
    `SELECT r.precio
       FROM reservas r
      WHERE r.usuario_id=$1 AND r.funcion_id=$2
        AND r.estado='activa' AND r.expira_en > now()
      ORDER BY r.id`,
    [usuarioId, funcionId]
  );
  if (!rows.length) {
    const error = new Error("La reserva venció o no tiene asientos activos.");
    error.status = 409;
    throw error;
  }
  const subtotal = rows.reduce((total, r) => total + Number(r.precio), 0);
  const tarifa = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + tarifa) * 100) / 100;
  return { subtotal, tarifa, total, cantidad: rows.length };
}

async function crearIntento({ usuarioId, funcionId, email }) {
  const resumen = await resumenReserva(usuarioId, funcionId);
  const currency = String(process.env.STRIPE_CURRENCY || "dop").toLowerCase();
  const amount = Math.round(resumen.total * 100);
  const stripe = clienteStripe();
  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    receipt_email: email || undefined,
    metadata: {
      astro_usuario_id: String(usuarioId),
      astro_funcion_id: String(funcionId),
      astro_cantidad: String(resumen.cantidad),
    },
    description: `Astro Tickets · ${resumen.cantidad} entrada(s)`,
  }, { idempotencyKey: `astro-${usuarioId}-${funcionId}-${amount}` });
  return { clientSecret: intent.client_secret, paymentIntentId: intent.id, ...resumen, currency };
}

async function verificarPago({ paymentIntentId, usuarioId, funcionId }) {
  if (!paymentIntentId || !String(paymentIntentId).startsWith("pi_")) {
    const error = new Error("Identificador de pago de Stripe inválido."); error.status = 400; throw error;
  }
  const [intent, resumen] = await Promise.all([
    clienteStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }),
    resumenReserva(usuarioId, funcionId),
  ]);
  const esperado = Math.round(resumen.total * 100);
  const propietario = intent.metadata?.astro_usuario_id === String(usuarioId);
  const funcionCorrecta = intent.metadata?.astro_funcion_id === String(funcionId);
  if (intent.status !== "succeeded" || !propietario || !funcionCorrecta || intent.amount_received !== esperado) {
    const error = new Error("Stripe todavía no confirmó este pago o el monto no coincide."); error.status = 409; throw error;
  }
  const charge = intent.latest_charge && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const card = charge?.payment_method_details?.card;
  return {
    transactionId: intent.id,
    reservationCode: `AST-${intent.id.slice(-8).toUpperCase()}`,
    method: "stripe",
    cardBrand: card?.brand || null,
    cardLast4: card?.last4 || null,
    stripeStatus: intent.status,
  };
}

module.exports = { clienteStripe, crearIntento, verificarPago };
