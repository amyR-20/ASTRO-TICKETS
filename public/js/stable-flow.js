/* Flujo operativo respaldado exclusivamente por Neon. */
(() => {
  window.__stableFlow = true;
  const money = (n) => `RD$ ${(Number(n) || 0).toLocaleString("es-DO")}`;
  const query = new URLSearchParams(location.search);

  function requireSession() {
    if (typeof Auth === "undefined" || !Auth.getToken()) {
      location.href = "index.html";
      return false;
    }
    return true;
  }

  async function loadEvent() {
    const eventId = query.get("id");
    const main = document.querySelector("main.container.section");
    if (!eventId || !main || typeof Api === "undefined") return;
    try {
      const event = await Api.getEvento(eventId);
      const active = (event.funciones || []).filter((f) => f.estado === "activa");
      const functions = active.length ? active : [];
      document.title = `Astro Tickets · ${I18n.eventName(event.name)}`;
      main.dataset.eventId = event.id;
      main.dataset.eventName = I18n.eventName(event.name);
      main.dataset.eventVenue = event.venue || "";
      main.dataset.eventCategory = I18n.category(event.category || "");
      const image = document.querySelector(".detail-image img"); if (image) { image.src = event.image || "multimedia/logo.svg"; image.alt = I18n.eventName(event.name); }
      const title = document.querySelector("h1"); if (title) title.textContent = I18n.eventName(event.name);
      const eyebrow = document.querySelector(".eyebrow"); if (eyebrow) eyebrow.textContent = I18n.category(event.category || "");
      const description = document.querySelector(".detail-image").parentElement.querySelector(".card p"); if (description) description.textContent = event.description || "";
      const panel = document.querySelector(".purchase-panel");
      let select = document.getElementById("function-select");
      if (!select) {
        const wrap = document.createElement("div");
        wrap.style.marginBottom = "16px";
        wrap.innerHTML = '<label for="function-select" style="font-size:.82rem;font-weight:600;display:block;margin-bottom:6px">Función</label><select id="function-select" class="input"></select><p id="function-error" class="text-muted" style="font-size:.78rem;margin-top:6px"></p>';
        panel.insertBefore(wrap, panel.querySelector(".seat-stage"));
        select = wrap.querySelector("select");
      }
      select.innerHTML = functions.length ? functions.map((f) => `<option value="${f.id}">${String(f.date).slice(0, 10)} · ${String(f.time).slice(0, 5)}${f.sala ? ` · ${f.sala}` : ""}</option>`).join("") : '<option value="">Sin funciones disponibles</option>';
      const showFunction = async () => {
        if (!select.value) return renderSeats(null);
        try { renderSeats(await Api.getFuncion(select.value)); }
        catch (err) { document.getElementById("function-error").textContent = err.message; renderSeats(null); }
      };
      select.addEventListener("change", showFunction);
      await showFunction();
    } catch (err) {
      const panel = document.querySelector(".purchase-panel");
      if (panel) panel.insertAdjacentHTML("afterbegin", `<p class="pay-error-box">${err.message}</p>`);
    }
  }

  function renderSeats(detail) {
    const form = document.getElementById("seat-form");
    const button = document.getElementById("btn-continuar");
    const total = document.getElementById("purchase-total");
    const count = document.getElementById("ticket-count-display");
    const selected = new Map();
    const slots = ["seat-grid-platino", "seat-grid-vip", "seat-grid-general"].map((id) => document.getElementById(id));
    slots.forEach((slot) => { if (slot) slot.innerHTML = ""; });
    if (!detail) { if (button) button.disabled = true; return; }
    form.dataset.funcionId = detail.id;
    // Solo asientos vendidos (o bloqueados por el staff) se marcan "agotados".
    // Las reservas NO pintan como agotadas: solo quedan tomadas cuando la
    // compra se confirma (comprobante) y el asiento pasa a estado "sold".
    const taken = (s) => s.status === "sold" || s.status === "blocked";
    const zones = detail.zonas || [];
    const panel = document.querySelector(".purchase-panel");
    const firstGrid = document.getElementById("seat-grid-platino");
    const dynamic = document.getElementById("function-seat-zones") || document.createElement("div");
    dynamic.id = "function-seat-zones";
    dynamic.innerHTML = "";
    firstGrid.parentElement.insertBefore(dynamic, firstGrid.parentElement.querySelector(".seat-legend"));
    slots.forEach((slot) => { const label = slot?.previousElementSibling; if (label?.classList.contains("seat-zone-label")) label.style.display = "none"; if (slot) slot.style.display = "none"; });
    const update = () => {
      const amount = [...selected.values()].reduce((s, seat) => s + seat.price, 0);
      document.getElementById("selected-seats-input").value = [...selected.keys()].join(",");
      document.getElementById("selected-seats-display").innerHTML = selected.size ? [...selected.values()].map((s) => `<span class="seat-tag">${s.id} · ${s.zone}</span>`).join("") : "Haz clic en los asientos del mapa";
      count.textContent = selected.size; total.textContent = money(amount); button.disabled = !selected.size;
    };
    zones.forEach((zone) => {
      const name = zone.name.toLowerCase();
      const seats = (detail.asientos || []).filter((s) => String(s.type || "").toLowerCase() === name);
      if (!seats.length) return;
      const block = document.createElement("div");
      block.innerHTML = `<div class="seat-zone-label"><span>${zone.name}</span> · ${money(zone.price)}</div><div class="seat-grid"></div><div class="seat-zone-divider"></div>`;
      const grid = block.querySelector(".seat-grid");
      const rows = {};
      seats.forEach((s) => { (rows[s.row] ||= []).push(s); });
      Object.keys(rows).sort().forEach((row) => {
        const line = document.createElement("div"); line.className = "seat-row"; line.innerHTML = `<span class="seat-row-label">${row}</span>`;
        rows[row].sort((a, b) => a.col - b.col).forEach((seat) => {
          const el = document.createElement("button"); el.type = "button"; el.className = `seat${taken(seat) ? " taken" : ""}`; el.textContent = seat.col; el.disabled = taken(seat);
          if (!el.disabled) el.addEventListener("click", () => { if (selected.has(seat.id)) { selected.delete(seat.id); el.classList.remove("selected"); } else { selected.set(seat.id, { id: seat.id, zone: zone.name, price: Number(zone.price) }); el.classList.add("selected"); } update(); });
          line.appendChild(el);
        }); grid.appendChild(line);
      }); dynamic.appendChild(block);
    });
    update();
  }

  document.addEventListener("submit", async (event) => {
    if (event.target.id !== "seat-form") return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!requireSession()) return;
    const form = event.target; const seats = form.querySelector("#selected-seats-input").value.split(",").filter(Boolean);
    try {
      const btn = form.querySelector("button"); btn.disabled = true;
      await Api.reservarAsientos(form.dataset.funcionId, seats);
      location.href = `pago.html?funcion=${encodeURIComponent(form.dataset.funcionId)}`;
    } catch (err) { alert(err.message); form.querySelector("button").disabled = false; }
  }, true);

  async function checkout() {
    const funcionId = query.get("funcion"); if (!document.querySelector(".order-summary")) return;
    if (!requireSession() || !funcionId) return;
    try {
      const [resumen, detail] = await Promise.all([Api.getMisReservas(funcionId), Api.getFuncion(funcionId)]);
      window.__checkoutEventName = detail.evento.nombre;
      window.__checkoutDate = `${detail.fecha} · ${I18n.time(detail.hora)}`;
      const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      set("summary-event", I18n.eventName(detail.evento.nombre)); set("summary-date", window.__checkoutDate);
      set("pago-seats", resumen.reservas.map((r) => r.asiento).join(", ")); set("pago-qty", resumen.reservas.length);
      set("pago-subtotal", money(resumen.subtotal)); set("pago-fee", money(resumen.tarifa)); set("pago-total", money(resumen.total));
      document.querySelectorAll('[id^="pay-total-"]').forEach((el) => { el.textContent = money(resumen.total); });
      const form = document.getElementById("card-form");
      const submit = document.getElementById("stripe-submit");
      if (!window.Stripe) throw new Error("No se pudo cargar el formulario seguro de Stripe.");
      const [config, intento] = await Promise.all([Api.stripeConfig(), Api.crearIntentoPago(funcionId)]);
      const stripe = Stripe(config.publishableKey);
      const appearance = {
        theme: document.documentElement.dataset.theme === "dark" ? "night" : "stripe",
        variables: { colorPrimary: "#6c3fd1", borderRadius: "12px", fontFamily: "Inter, sans-serif" }
      };
      const elements = stripe.elements({ clientSecret: intento.clientSecret, appearance });
      elements.create("payment", { layout: "tabs" }).mount("#payment-element");
      if (submit) submit.disabled = false;
      form?.addEventListener("submit", async (event) => {
        event.preventDefault(); event.stopImmediatePropagation();
        if (submit) { submit.disabled = true; submit.dataset.original = submit.innerHTML; submit.innerHTML = '<span class="material-symbols-outlined">progress_activity</span><span>Procesando con Stripe…</span>'; }
        try {
          const result = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: `${location.origin}${location.pathname}?funcion=${encodeURIComponent(funcionId)}` } });
          if (result.error) throw new Error(result.error.message || "Stripe rechazó el pago.");
          const paymentIntent = result.paymentIntent;
          if (!paymentIntent || paymentIntent.status !== "succeeded") throw new Error("El pago continúa pendiente. No se emitieron entradas.");
          const data = await Api.crearOrden({ funcionId, payment: { paymentIntentId: paymentIntent.id } });
          location.href = `comprobante.html?orden=${encodeURIComponent(data.orden.id)}`;
        } catch (err) {
          document.getElementById("pay-error-text").textContent = err.message;
          document.getElementById("pay-error").style.display = "flex";
          if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.original || "Confirmar y pagar"; }
        }
      }, true);
    } catch (err) { document.getElementById("pay-error-text").textContent = err.message; document.getElementById("pay-error").style.display = "flex"; }
  }

  async function receipt() {
    const orderId = query.get("orden"); if (!document.getElementById("receipt-event-name")) return;
    if (!requireSession() || !orderId) return;
    try {
      const purchase = await Api.getOrden(orderId);
      window.__receiptEventName = purchase.event.name;
      const setReceipt = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || "-"; };
      const tkWord = purchase.seats.length === 1 ? I18n.t("history.ticket") : I18n.t("history.tickets");
      setReceipt("receipt-event-name", I18n.eventName(purchase.event.name)); setReceipt("receipt-order-number", `#${purchase.payment.transactionId}`); setReceipt("receipt-reservation-code", purchase.payment.reservationCode); setReceipt("receipt-price", money(purchase.pricing.total)); setReceipt("receipt-subtotal", money(purchase.pricing.subtotal)); setReceipt("receipt-fee", money(purchase.pricing.fee)); setReceipt("receipt-total", money(purchase.pricing.total)); setReceipt("receipt-qty-type", `${purchase.seats.length} ${tkWord}`); setReceipt("receipt-payment-method", purchase.payment.method); setReceipt("receipt-transaction-id", purchase.payment.transactionId); setReceipt("receipt-purchase-date", purchase.purchasedAt ? I18n.dateTime(purchase.purchasedAt) : ""); setReceipt("receipt-date", purchase.funcion.fecha || purchase.event.date); setReceipt("receipt-time-value", I18n.time(purchase.funcion.hora)); setReceipt("receipt-venue-name", purchase.event.venue); setReceipt("receipt-room", purchase.funcion.sala); setReceipt("receipt-buyer-name", purchase.comprador.nombre); setReceipt("receipt-email-sent", purchase.comprador.email);
      const hero = document.getElementById("receipt-image"); if (hero && purchase.event.img) { hero.src = purchase.event.img; hero.alt = I18n.eventName(purchase.event.name); }
      const detailedTickets = document.getElementById("receipt-tickets"); detailedTickets.innerHTML = "";
      purchase.seats.forEach((seat, index) => {
        const card = document.createElement("article"); card.className = "receipt-ticket"; card.dataset.ticketCode = seat.codigo;
        card.innerHTML = `<div class="receipt-ticket-poster" style="background-image:linear-gradient(90deg, rgba(20,12,45,.2), rgba(20,12,45,.75)), url('${purchase.event.img || ""}')"><span>ASTRO TICKETS</span><strong>${I18n.eventName(purchase.event.name)}</strong><small>${purchase.funcion.fecha || purchase.event.date} / ${I18n.time(purchase.funcion.hora)}</small></div><div class="receipt-ticket-main"><div class="receipt-ticket-info"><span class="receipt-ticket-label">${I18n.t("receipt.ticket")} ${index + 1}</span><strong class="receipt-ticket-seat">${I18n.t("history.seat")} ${seat.id} / ${seat.zone}</strong><span>${purchase.funcion.sala || purchase.event.venue || ""}</span><code class="receipt-ticket-code">${seat.codigo}</code></div><div class="receipt-ticket-qr" aria-label="Codigo QR del boleto"></div><button type="button" class="btn-ticket-download">${I18n.t("history.download_comprobante")}</button></div>`;
        card.querySelector(".receipt-ticket-info").insertAdjacentHTML("beforeend", `<span>${I18n.t("history.price")}: ${money(seat.price)}</span><span>${I18n.t("history.status")}: ${purchase.status || "paid"}</span>`);
        card.querySelector(".btn-ticket-download").onclick = () => Api.descargarPdfComprobante(orderId).catch((e) => alert(e.message));
        const printTicket = document.createElement("button"); printTicket.type = "button"; printTicket.className = "btn-ticket-download"; printTicket.textContent = I18n.t("history.print_ticket"); printTicket.onclick = () => { document.body.classList.add("printing-one-ticket"); card.classList.add("print-ticket-only"); window.addEventListener("afterprint", () => { document.body.classList.remove("printing-one-ticket"); card.classList.remove("print-ticket-only"); }, { once: true }); window.print(); }; card.querySelector(".receipt-ticket-main").appendChild(printTicket);
        Api.qrDataUrl(seat.codigo).then((url) => { card.querySelector(".receipt-ticket-qr").innerHTML = `<img class="receipt-qr-img" src="${url}" alt="QR del asiento ${seat.id}">`; }).catch((e) => { card.querySelector(".receipt-ticket-qr").textContent = e.message; }); detailedTickets.appendChild(card);
      });
      document.getElementById("btn-view-ticket")?.addEventListener("click", async () => {
        const codigos = (purchase.seats || []).map((s) => s.codigo).filter(Boolean);
        if (!codigos.length) { alert(I18n.t("history.no_tickets_to_download") || "No hay boletos para descargar."); return; }
        try { for (const codigo of codigos) await Api.descargarPdfEntrada(codigo); }
        catch (err) { alert(err.message || "Error al descargar el boleto."); }
      });
      document.getElementById("btn-print-ticket")?.addEventListener("click", () => window.print());
      document.getElementById("btn-resend")?.addEventListener("click", async (event) => { const button = event.currentTarget; const label = button.querySelector("span:last-child"); const original = label?.textContent; button.disabled = true; if (label) label.textContent = "Enviando..."; try { await Api.reenviarOrden(orderId); alert(`Confirmación enviada a ${purchase.comprador.email}.`); } catch (error) { alert(error.message); } finally { button.disabled = false; if (label) label.textContent = original; } });
      if (query.get("print") === "1") requestAnimationFrame(() => window.print());
      return;
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      set("receipt-event-name", purchase.event.name); set("receipt-order-number", `#${purchase.payment.transactionId}`); set("receipt-reservation-code", purchase.payment.reservationCode); set("receipt-price", money(purchase.pricing.total)); set("receipt-qty-type", `${purchase.seats.length}x Entradas`); set("receipt-payment-method", purchase.payment.method); set("receipt-transaction-id", purchase.payment.transactionId); set("receipt-date", purchase.funcion.fecha || purchase.event.date); set("receipt-time-value", purchase.funcion.hora || "—"); set("receipt-venue-name", purchase.funcion.sala || purchase.event.venue); set("receipt-email-sent", purchase.comprador.email || "—");
      const tickets = document.getElementById("receipt-tickets"); tickets.innerHTML = "";
      purchase.seats.forEach((seat) => { const card = document.createElement("div"); card.className = "receipt-ticket"; card.innerHTML = `<div class="receipt-ticket-qr"></div><div class="receipt-ticket-info"><span>${seat.id} · ${seat.zone}</span><span>${seat.codigo}</span></div><button class="btn-ticket-download">Descargar PDF</button>`; card.querySelector(".btn-ticket-download").onclick = () => Api.descargarPdfEntrada(seat.codigo).catch((e) => alert(e.message)); Api.qrDataUrl(seat.codigo).then((url) => { card.querySelector(".receipt-ticket-qr").innerHTML = `<img class="receipt-qr-img" src="${url}" alt="QR">`; }).catch((e) => { card.querySelector(".receipt-ticket-qr").textContent = e.message; }); tickets.appendChild(card); });
    } catch (err) { document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="pay-error-box">${err.message}</p>`); }
  }
  loadEvent(); checkout(); receipt();

  window.addEventListener("astro:langchange", () => {
    if (document.getElementById("summary-event") && window.__checkoutEventName) {
      document.getElementById("summary-event").textContent = I18n.eventName(window.__checkoutEventName);
    }
    if (document.getElementById("receipt-event-name") && window.__receiptEventName) {
      document.getElementById("receipt-event-name").textContent = I18n.eventName(window.__receiptEventName);
      document.querySelectorAll(".receipt-ticket-poster strong").forEach((el) => { el.textContent = I18n.eventName(window.__receiptEventName); });
    }
  });
})();
