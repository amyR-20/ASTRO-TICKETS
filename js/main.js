/* ============================================================
   Astro Tickets — JS compartido v3
   Decoraciones, navbar responsive, animaciones y más
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Navbar: sombra al hacer scroll ---------- */
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    const onScroll = () => {
      navbar.style.boxShadow =
        window.scrollY > 10
          ? "0 4px 20px rgba(108, 63, 209, 0.08)"
          : "none";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Mostrar/ocultar contraseña ---------- */
  document.querySelectorAll(".toggle-visibility").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const icon = btn.querySelector(".material-symbols-outlined");
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      icon.textContent = isHidden ? "visibility_off" : "visibility";
    });
  });

  /* ---------- Password strength indicator ---------- */
  const pwInput = document.getElementById("password");
  const pwStrength = document.getElementById("password-strength");
  const pwStrengthText = document.getElementById("password-strength-text");
  if (pwInput && pwStrength) {
    pwInput.addEventListener("input", () => {
      const val = pwInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
      if (/\d/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      const levels = ["", "weak", "fair", "good", "strong"];
      const labels = ["", "Débil", "Regular", "Buena", "Fuerte"];
      const cls = levels[score] || "";

      pwStrength.className = "password-strength" + (cls ? " " + cls : "");
      if (pwStrengthText) {
        pwStrengthText.textContent = val.length > 0 ? labels[score] || "" : "";
      }
    });
  }

  /* ---------- Formularios con redirect ---------- */
  document.querySelectorAll("form[data-redirect]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const dest = form.getAttribute("data-redirect");
      if (!btn) { window.location.href = dest; return; }
      btn.disabled = true;
      btn.innerHTML =
        '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">progress_activity</span> Procesando…';
      setTimeout(() => { window.location.href = dest; }, 700);
    });
  });

  /* ---------- Búsqueda / filtro de eventos ---------- */
  const searchInput = document.getElementById("event-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.trim().toLowerCase();
      document.querySelectorAll("[data-event-name]").forEach((card) => {
        const name = card.getAttribute("data-event-name").toLowerCase();
        const place = (card.getAttribute("data-event-place") || "").toLowerCase();
        const match = name.includes(term) || place.includes(term);
        card.style.display = match ? "" : "none";
      });
    });
  }

  const categoryFilter = document.getElementById("event-category");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => {
      const value = categoryFilter.value;
      document.querySelectorAll("[data-event-category]").forEach((card) => {
        const cat = card.getAttribute("data-event-category");
        card.style.display = value === "todas" || cat === value ? "" : "none";
      });
    });
  }

  /* ============================================================
     SEAT MAP — Asientos numerados (evento.html)
     ============================================================ */
  const seatGridPlatino = document.getElementById("seat-grid-platino");
  const seatGridVip = document.getElementById("seat-grid-vip");
  const seatGridGeneral = document.getElementById("seat-grid-general");

  if (seatGridPlatino) {
    const evMain = document.querySelector('main[data-event-name]');
    const PRICES = evMain ? {
      platino: parseInt(evMain.dataset.pricePlatino) || 4500,
      vip: parseInt(evMain.dataset.priceVip) || 3200,
      general: parseInt(evMain.dataset.priceGeneral) || 1800
    } : { platino: 4500, vip: 3200, general: 1800 };
    const TAKEN_SEATS = new Set(["A3","A4","B2","B5","C1","C8","D4","D5","E6","F3","F7","G2","G9","H1","H5","H10","I4","I6"]);
    const selectedSeats = new Map();

    function buildSeatGrid(container, zone, rows, cols) {
      // Column labels
      const colRow = document.createElement("div");
      colRow.className = "seat-col-labels";
      const labelRowSpan = document.createElement("span");
      labelRowSpan.style.width = "22px";
      colRow.appendChild(labelRowSpan);
      for (let c = 1; c <= cols; c++) {
        const colLabel = document.createElement("span");
        colLabel.textContent = c;
        colRow.appendChild(colLabel);
      }
      container.appendChild(colRow);

      for (let r = 0; r < rows; r++) {
        const rowEl = document.createElement("div");
        rowEl.className = "seat-row";
        const rowLetter = String.fromCharCode(65 + r);
        rowEl.innerHTML = `<span class="seat-row-label">${rowLetter}</span>`;

        const aisleAfter = Math.floor(cols / 2);
        for (let c = 1; c <= cols; c++) {
          if (c === aisleAfter + 1) {
            const aisle = document.createElement("div");
            aisle.className = "seat-aisle";
            rowEl.appendChild(aisle);
          }
          const id = rowLetter + c;
          const taken = TAKEN_SEATS.has(id);
          const seat = document.createElement("div");
          seat.className = "seat" + (taken ? " taken" : "");
          seat.dataset.id = id;
          seat.dataset.zone = zone;
          seat.dataset.price = PRICES[zone];
          seat.textContent = c;

          if (!taken) {
            seat.addEventListener("click", () => toggleSeat(seat));
          }
          rowEl.appendChild(seat);
        }
        container.appendChild(rowEl);
      }
    }

    function toggleSeat(seatEl) {
      const id = seatEl.dataset.id;
      if (selectedSeats.has(id)) {
        selectedSeats.delete(id);
        seatEl.classList.remove("selected");
      } else {
        selectedSeats.set(id, seatEl.dataset);
        seatEl.classList.add("selected");
      }
      updateSeatDisplay();
    }

    function updateSeatDisplay() {
      const display = document.getElementById("selected-seats-display");
      const input = document.getElementById("selected-seats-input");
      const countEl = document.getElementById("ticket-count-display");
      const totalEl = document.getElementById("purchase-total");
      const btn = document.getElementById("btn-continuar");

      if (!display) return;

      let html = "";
      let total = 0;

      // Group by zone
      const byZone = {};
      selectedSeats.forEach((data, id) => {
        if (!byZone[data.zone]) byZone[data.zone] = [];
        byZone[data.zone].push(id);
      });

      Object.entries(byZone).forEach(([zone, ids]) => {
        ids.sort();
        ids.forEach(id => {
          html += `<span class="seat-tag">${id} <span style="font-weight:400;opacity:0.6;">·</span> ${zone}</span>`;
        });
        total += ids.length * PRICES[zone];
      });

      if (html === "") {
        html = '<span style="font-size: 0.78rem; color: var(--color-on-surface-variant);">Haz clic en los asientos del mapa</span>';
      }

      display.innerHTML = html;
      if (input) input.value = Array.from(selectedSeats.keys()).join(",");
      if (countEl) countEl.textContent = selectedSeats.size;
      if (totalEl) totalEl.textContent = "RD$ " + total.toLocaleString("es-DO");
      if (btn) btn.disabled = selectedSeats.size === 0;

      // Update pago.html totals if present
      const pagoSeats = document.getElementById("pago-seats");
      const pagoQty = document.getElementById("pago-qty");
      const pagoSubtotal = document.getElementById("pago-subtotal");
      const pagoFee = document.getElementById("pago-fee");
      const pagoTotal = document.getElementById("pago-total");
      if (pagoSeats) pagoSeats.textContent = Array.from(selectedSeats.keys()).join(", ") || "—";
      if (pagoQty) pagoQty.textContent = selectedSeats.size;
      if (pagoSubtotal) pagoSubtotal.textContent = "RD$ " + total.toLocaleString("es-DO");
      if (pagoFee) pagoFee.textContent = "RD$ " + Math.round(total * 0.05).toLocaleString("es-DO");
      if (pagoTotal) pagoTotal.textContent = "RD$ " + Math.round(total * 1.05).toLocaleString("es-DO");
    }

    buildSeatGrid(seatGridPlatino, "platino", 2, 10);
    buildSeatGrid(seatGridVip, "vip", 3, 10);
    buildSeatGrid(seatGridGeneral, "general", 3, 10);

    // Save seat selection to sessionStorage on form submit
    const seatForm = document.getElementById('seat-form');
    if (seatForm) {
      seatForm.addEventListener('submit', () => {
        const main = document.querySelector('main[data-event-name]');
        if (!main) return;
        const seats = [];
        selectedSeats.forEach((data, id) => {
          seats.push({ id, zone: data.zone, price: parseInt(data.price) });
        });
        const subtotal = seats.reduce((s, seat) => s + seat.price, 0);
        const fee = Math.round(subtotal * 0.05);
        const purchase = {
          event: {
            name: main.dataset.eventName,
            img: main.dataset.eventImg,
            date: main.dataset.eventDate,
            venue: main.dataset.eventVenue,
            category: main.dataset.eventCategory
          },
          seats,
          pricing: { subtotal, fee, total: subtotal + fee }
        };
        sessionStorage.setItem('astro_purchase', JSON.stringify(purchase));
      });
    }
  }

  /* ============================================================
     PAYMENT TABS + STRIPE CARD (pago.html)
     ============================================================ */
  const payTabs = document.querySelectorAll(".pay-method-tab");
  if (payTabs.length) {
    payTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        payTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const method = tab.dataset.method;
        document.querySelectorAll(".pay-method-panel").forEach(p => {
          p.classList.toggle("active", p.dataset.panel === method);
        });
      });
    });
  }

  /* --- Stripe card live preview --- */
  const cardNumberInput = document.getElementById("card-number");
  const cardNameInput = document.getElementById("card-name");
  const cardExpInput = document.getElementById("card-exp");
  const cardCvvInput = document.getElementById("card-cvv");
  const stripeCard = document.getElementById("stripe-card");

  const CARD_BRANDS = {
    visa: /^4/,
    mastercard: /^(5[1-5]|2[2-7])/,
    amex: /^3[47]/
  };

  function detectBrand(num) {
    const clean = num.replace(/\s/g, "");
    if (CARD_BRANDS.visa.test(clean)) return "VISA";
    if (CARD_BRANDS.mastercard.test(clean)) return "MASTERCARD";
    if (CARD_BRANDS.amex.test(clean)) return "AMEX";
    return "VISA";
  }

  function formatCardNumber(val) {
    const clean = val.replace(/\D/g, "").substring(0, 16);
    return clean.replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(val) {
    const clean = val.replace(/\D/g, "").substring(0, 4);
    if (clean.length >= 3) return clean.substring(0, 2) + "/" + clean.substring(2);
    return clean;
  }

  if (cardNumberInput) {
    cardNumberInput.addEventListener("input", () => {
      const raw = cardNumberInput.value.replace(/\D/g, "");
      cardNumberInput.value = formatCardNumber(raw);
      const display = document.getElementById("card-number-display");
      if (display) {
        const formatted = formatCardNumber(raw).padEnd(19, "•");
        display.textContent = formatted;
      }
      const brand = document.getElementById("card-brand-display");
      if (brand) brand.textContent = detectBrand(raw);
    });
  }

  if (cardNameInput) {
    cardNameInput.addEventListener("input", () => {
      const display = document.getElementById("card-name-display");
      if (display) display.textContent = cardNameInput.value.toUpperCase() || "NOMBRE APELLIDO";
    });
  }

  if (cardExpInput) {
    cardExpInput.addEventListener("input", () => {
      cardExpInput.value = formatExpiry(cardExpInput.value);
      const display = document.getElementById("card-exp-display");
      if (display) display.textContent = cardExpInput.value || "MM/AA";
    });
  }

  if (cardCvvInput) {
    cardCvvInput.addEventListener("focus", () => {
      if (stripeCard) stripeCard.classList.add("flipped");
    });
    cardCvvInput.addEventListener("blur", () => {
      if (stripeCard) stripeCard.classList.remove("flipped");
    });
    cardCvvInput.addEventListener("input", () => {
      cardCvvInput.value = cardCvvInput.value.replace(/\D/g, "").substring(0, 4);
      const display = document.getElementById("cvv-display");
      if (display) display.textContent = cardCvvInput.value || "•••";
    });
  }

  /* ============================================================
     PURCHASE FLOW — pago.html & comprobante.html
     ============================================================ */
  const storedRaw = sessionStorage.getItem('astro_purchase');
  if (storedRaw) {
    try {
      const purchase = JSON.parse(storedRaw);

      /* ---- pago.html: populate order summary ---- */
      if (document.querySelector('.order-summary')) {
        const s = purchase;
        if (document.getElementById('pago-seats')) {
          document.getElementById('pago-seats').textContent = s.seats.map(seat => seat.id).join(', ') || '—';
          document.getElementById('pago-qty').textContent = s.seats.length;
          document.getElementById('pago-subtotal').textContent = 'RD$ ' + s.pricing.subtotal.toLocaleString('es-DO');
          document.getElementById('pago-fee').textContent = 'RD$ ' + s.pricing.fee.toLocaleString('es-DO');
          document.getElementById('pago-total').textContent = 'RD$ ' + s.pricing.total.toLocaleString('es-DO');
        }
        const evtEl = document.getElementById('summary-event');
        if (evtEl) evtEl.textContent = s.event.name;
        const dateEl = document.getElementById('summary-date');
        if (dateEl) dateEl.textContent = s.event.date;
        document.querySelectorAll('[id^="pay-total-"]').forEach(el => {
          el.textContent = 'RD$ ' + s.pricing.total.toLocaleString('es-DO');
        });
      }

      /* ---- comprobante.html: populate receipt ---- */
      if (document.getElementById('receipt-event-name')) {
        const s = purchase;

        // Image
        const img = document.getElementById('receipt-image');
        if (img) {
          img.src = s.event.img || '';
          img.alt = s.event.name || '';
        }

        // Event name
        document.getElementById('receipt-event-name').textContent = s.event.name;

        // Date / time parsing: "20 de agosto, 2026 · 8:00 pm"
        const dateParts = (s.event.date || '').split(' · ');
        const dateEl = document.getElementById('receipt-date');
        if (dateEl) dateEl.textContent = dateParts[0] || s.event.date;
        const timeEl = document.getElementById('receipt-time-value');
        if (timeEl && dateParts[1]) {
          const t = dateParts[1];
          const m = t.match(/(\d+):(\d+)\s*(am|pm)/i);
          if (m) {
            let h = parseInt(m[1]);
            if (m[3].toLowerCase() === 'pm' && h < 12) h += 12;
            if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
            timeEl.textContent = String(h).padStart(2, '0') + ':' + m[2];
          } else {
            timeEl.textContent = t;
          }
        }

        // Venue: "Teatro Nacional, Santo Domingo" → name & detail
        const venueParts = (s.event.venue || '').split(', ');
        const venueEl = document.getElementById('receipt-venue-name');
        if (venueEl) venueEl.textContent = venueParts[0] || s.event.venue;
        const detailEl = document.getElementById('receipt-venue-detail');
        if (detailEl) detailEl.textContent = venueParts.slice(1).join(', ') || '—';

        // Reservation code
        const codeEl = document.getElementById('receipt-reservation-code');
        if (codeEl && s.payment) codeEl.textContent = s.payment.reservationCode || 'AST-0000';

        // Quantity + type: group seats by zone
        const byZone = {};
        s.seats.forEach(seat => {
          if (!byZone[seat.zone]) byZone[seat.zone] = { count: 0, label: seat.zone };
          byZone[seat.zone].count++;
        });
        const qtyParts = Object.entries(byZone).map(([z, info]) => {
          const label = z.charAt(0).toUpperCase() + z.slice(1);
          return info.count + 'x Entradas ' + label;
        });
        const qtyEl = document.getElementById('receipt-qty-type');
        if (qtyEl) qtyEl.textContent = qtyParts.join(' + ') || s.seats.length + 'x Entradas';

        // Price
        const priceEl = document.getElementById('receipt-price');
        if (priceEl) priceEl.textContent = 'RD$ ' + s.pricing.total.toLocaleString('es-DO');

        // Order number
        const orderEl = document.getElementById('receipt-order-number');
        if (orderEl && s.payment) orderEl.textContent = '#' + s.payment.transactionId;

        // Payment method
        const methodEl = document.getElementById('receipt-payment-method');
        if (methodEl && s.payment) {
          if (s.payment.method === 'card') methodEl.textContent = (s.payment.cardBrand || 'Tarjeta') + ' ****' + (s.payment.cardLast4 || '');
          else if (s.payment.method === 'paypal') methodEl.textContent = 'PayPal';
          else if (s.payment.method === 'apple') methodEl.textContent = 'Apple Pay';
          else if (s.payment.method === 'google') methodEl.textContent = 'Google Pay';
          else if (s.payment.method === 'transfer') methodEl.textContent = 'Transferencia bancaria';
          else methodEl.textContent = s.payment.method;
        }

        // Transaction ID
        const txnEl = document.getElementById('receipt-transaction-id');
        if (txnEl && s.payment) txnEl.textContent = s.payment.transactionId || '—';

        // Purchase date
        const purchaseDateEl = document.getElementById('receipt-purchase-date');
        if (purchaseDateEl && s.purchasedAt) {
          purchaseDateEl.textContent = new Date(s.purchasedAt).toLocaleDateString('es-DO', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          });
        }
      }
    } catch (_) {}
  }

  /* ============================================================
     HISTORY — Save & Render Purchase History
     ============================================================ */

  /* ---- Save completed purchase to astro_history (localStorage) ---- */
  function savePurchaseToHistory(purchase) {
    const history = JSON.parse(localStorage.getItem('astro_history') || '[]');
    if (!purchase.purchasedAt) purchase.purchasedAt = new Date().toISOString();
    if (!purchase.status) purchase.status = 'paid';
    const exists = history.some(h =>
      h.payment && purchase.payment &&
      h.payment.transactionId === purchase.payment.transactionId
    );
    if (!exists && purchase.payment) {
      history.unshift(purchase);
      localStorage.setItem('astro_history', JSON.stringify(history));
    }
  }

  /* ---- Helpers ---- */
  function t(key) { return typeof I18n !== 'undefined' ? I18n.t(key) : key; }
  const statusLabelMap = {
    paid: t('history.paid'),
    pending: t('history.pending'),
    cancelled: t('history.cancelled'),
    refunded: t('history.refunded'),
    completed: t('history.completed'),
    available: t('history.available'),
    'selling-fast': t('history.selling_fast'),
    'past-event': t('history.past_event')
  };
  const statusClassMap = {
    paid: 'paid',
    pending: 'pending',
    cancelled: 'cancelled',
    refunded: 'refunded',
    completed: 'completed',
    available: 'available',
    'selling-fast': 'selling-fast',
    'past-event': 'past-event'
  };

  function timeAgo(isoStr) {
    if (!isoStr) return 'just now';
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    const lang = (typeof I18n !== 'undefined' ? I18n.getLang() : 'es');
    if (mins < 1) return lang === 'es' ? 'ahora mismo' : 'just now';
    if (mins < 60) return lang === 'es' ? mins + ' min' : mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return lang === 'es' ? hrs + ' h' : hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return lang === 'es' ? days + ' d' : days + 'd ago';
    return new Date(isoStr).toLocaleDateString();
  }

  const MONTHS_ES = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11 };
  function parseSpanishDate(str) {
    if (!str) return null;
    const m1 = str.match(/(\d+)\s+de\s+(\w+)[,\s]*(\d{4})/i);
    if (m1) {
      const month = MONTHS_ES[m1[2].toLowerCase()];
      if (month !== undefined) return new Date(parseInt(m1[3]), month, parseInt(m1[1]));
    }
    const m2 = str.match(/(\d+)\s+(\w+)\s+(\d{4})/i);
    if (m2) {
      const month = MONTHS_ES[m2[2].toLowerCase()];
      if (month !== undefined) return new Date(parseInt(m2[3]), month, parseInt(m2[1]));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  /* ---- History page population ---- */
  if (document.getElementById('purchase-list')) {
    let history = JSON.parse(localStorage.getItem('astro_history') || '[]');

    // Seed demo data if empty
    if (history.length === 0) {
      const now = new Date();
      const demoData = [
        {
          event: {
            name: 'Noche de Jazz en Vivo',
            img: 'multimedia/jazz.jpg',
            date: '20 de agosto, 2026 · 8:00 pm',
            venue: 'Teatro Nacional, Santo Domingo',
            category: 'Concierto'
          },
          seats: [
            { id: 'G4', zone: 'general', price: 1800 },
            { id: 'G5', zone: 'general', price: 1800 },
            { id: 'H7', zone: 'general', price: 1800 }
          ],
          pricing: { subtotal: 5400, fee: 270, total: 5670 },
          payment: {
            method: 'card',
            cardBrand: 'VISA',
            cardLast4: '4821',
            cardHolder: 'Carlos Méndez',
            transactionId: 'TXN-2026-0729-A8K2',
            reservationCode: 'RSV-JAZZ-X9M3'
          },
          purchasedAt: new Date(now.getTime() - 2 * 60000).toISOString(),
          status: 'paid'
        },
        {
          event: {
            name: 'Sinfónica de Otoño',
            img: 'multimedia/sinfonica.jpg',
            date: '10 de octubre, 2026 · 8:00 pm',
            venue: 'Teatro Nacional, Santo Domingo',
            category: 'Concierto'
          },
          seats: [
            { id: 'B3', zone: 'vip', price: 3200 },
            { id: 'B4', zone: 'vip', price: 3200 }
          ],
          pricing: { subtotal: 6400, fee: 320, total: 6720 },
          payment: {
            method: 'card',
            cardBrand: 'MASTERCARD',
            cardLast4: '9034',
            cardHolder: 'Ana López',
            transactionId: 'TXN-2026-0725-CF71',
            reservationCode: 'RSV-SINF-K2W8'
          },
          purchasedAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
          status: 'paid'
        }
      ];
      localStorage.setItem('astro_history', JSON.stringify(demoData));
      history = demoData;
    }

    const emptyEl = document.getElementById('history-empty');
    const listEl = document.getElementById('purchase-list');

    if (history.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (listEl) listEl.innerHTML = '';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';

      // Stats
      const totalEvents = history.length;
      let totalTickets = 0;
      let activeTickets = 0;
      let nextEvent = null;
      const now = new Date();

      history.forEach(p => {
        const qty = (p.seats || []).length;
        totalTickets += qty;
        if (p.status === 'paid' || p.status === 'completed' || (!p.status)) {
          activeTickets += qty;
        }
        // Parse event date to find next
        if (p.event && p.event.date) {
          const dateStr = p.event.date;
          const datePart = (dateStr || '').split(' · ')[0];
          // Try to parse the Spanish date
          const parsed = parseSpanishDate(datePart);
          if (parsed && (p.status === 'paid' || p.status === 'completed' || !p.status)) {
            if (!nextEvent || parsed > now && (!nextEvent.date || parsed < nextEvent.date)) {
              nextEvent = { date: parsed, name: p.event.name, raw: datePart };
            }
          }
        }
      });

      document.getElementById('stat-total-events').textContent = totalEvents;
      document.getElementById('stat-active-tickets').textContent = activeTickets;
      document.getElementById('stat-tickets-purchased').textContent = totalTickets;
      document.getElementById('stat-next-event').textContent = nextEvent && nextEvent.date > now
        ? nextEvent.name
        : '—';

      // Recent Success — latest purchase
      const latest = history[0];
      if (latest) {
        const confirmedEl = document.getElementById('rsc-confirmed');
        if (confirmedEl) {
          const timeEl = document.getElementById('rsc-time');
          if (timeEl) timeEl.textContent = timeAgo(latest.purchasedAt);
          const msgEl = confirmedEl.querySelector('.rc-msg');
          if (msgEl) {
            const tkLabel = latest.seats.length === 1 ? t('history.ticket') : t('history.tickets');
            msgEl.textContent = `"${latest.event.name}" — ${latest.seats.length} ${tkLabel} ${t('history.ready_msg_short')}`;
          }
        }
      }

      // Render purchase cards
      listEl.innerHTML = '';
      history.forEach((p, idx) => {
        const status = p.status || 'paid';
        const statusLabel = statusLabelMap[status] || status;
        const statusClass = statusClassMap[status] || 'paid';
        const qty = (p.seats || []).length;
        const orderNum = p.payment?.transactionId || ('#' + (idx + 1));

        // Group seats for display
        const byZone = {};
        (p.seats || []).forEach(seat => {
          if (!byZone[seat.zone]) byZone[seat.zone] = [];
          byZone[seat.zone].push(seat.id);
        });
        const zoneStr = Object.entries(byZone)
          .map(([z, ids]) => z.charAt(0).toUpperCase() + z.slice(1) + ': ' + ids.join(', '))
          .join(' · ');

        // Date
        const dateParts = (p.event.date || '').split(' · ');
        const eventDateDisplay = dateParts[0] || p.event.date;

        // Venue short
        const venueShort = (p.event.venue || '').split(',')[0];

        const card = document.createElement('div');
        card.className = 'purchase-card';
        card.dataset.index = idx;

        card.innerHTML = `
          <div class="purchase-card-img">
            <img src="${p.event.img || ''}" alt="${p.event.name}" loading="lazy" />
          </div>
          <div class="purchase-card-body">
            <span class="purchase-status ${statusClass}">${statusLabel}</span>
            <h3 class="purchase-event-name">${p.event.name}</h3>
            <div class="purchase-info">
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">calendar_month</span> ${eventDateDisplay}
              </span>
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">confirmation_number</span> ${qty} ${qty === 1 ? t('history.ticket') : t('history.tickets')}
              </span>
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">category</span> ${zoneStr || '—'}
              </span>
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">location_on</span> ${venueShort || '—'}
              </span>
            </div>
            <div class="purchase-actions">
              <button class="btn-purchase-download" data-action="download" data-index="${idx}">
                <span class="material-symbols-outlined">download</span> ${I18n.t('history.download_pdf')}
              </button>
              <button class="btn-purchase-details" data-action="details" data-index="${idx}">
                <span class="material-symbols-outlined">visibility</span> ${I18n.t('history.view_details')}
              </button>
            </div>
            <span class="purchase-order">${orderNum}</span>
            <span class="purchase-price">RD$ ${p.pricing.total.toLocaleString('es-DO')}</span>
          </div>
        `;

        // Click on card → open details
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          openDetailPanel(idx, history);
        });

        listEl.appendChild(card);
      });

      // Wire up buttons
      listEl.querySelectorAll('[data-action="details"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openDetailPanel(parseInt(btn.dataset.index), history);
        });
      });
      listEl.querySelectorAll('[data-action="download"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Placeholder — could trigger print or PDF generation
          alert('PDF download: ' + history[parseInt(btn.dataset.index)].payment?.transactionId);
        });
      });
    }
  }

  /* ---- Re-render history on language change ---- */
  const langBtn = document.getElementById('lang-btn');
  if (langBtn && document.getElementById('purchase-list')) {
    langBtn.addEventListener('click', () => {
      setTimeout(() => window.location.reload(), 150);
    });
  }

  /* ---- Detail Panel ---- */
  const detailPanel = document.getElementById('detail-panel');
  const detailOverlay = document.getElementById('detail-overlay');
  const detailClose = document.getElementById('detail-close');
  const detailContent = document.getElementById('detail-content');

  function openDetailPanel(idx, history) {
    const p = history[idx];
    if (!p || !detailPanel || !detailContent) return;

    const status = p.status || 'paid';
    const isCancelled = status === 'cancelled';

    detailPanel.classList.toggle('cancelled-mode', isCancelled);

    const qty = (p.seats || []).length;
    const seatRows = (p.seats || []).map(seat => `
      <div class="detail-ticket-row">
        <span class="detail-ticket-seat">${seat.id}</span>
        <span class="detail-ticket-zone">${seat.zone.charAt(0).toUpperCase() + seat.zone.slice(1)}</span>
        <span class="detail-ticket-price">RD$ ${parseInt(seat.price).toLocaleString('es-DO')}</span>
      </div>
    `).join('');

    const dateParts = (p.event.date || '').split(' · ');
    const eventDateDisplay = dateParts[0] || p.event.date;
    const eventTime = dateParts[1] || '—';

    const purchaseDate = p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString('es-DO', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const methodDisplay = p.payment?.method === 'card'
      ? (p.payment.cardBrand || 'Card') + ' ****' + (p.payment.cardLast4 || '')
      : (p.payment?.method || '—');

    const emailDisplay = 'user@example.com'; // placeholder

    const statusDot = statusClassMap[status] || 'paid';
    const statusLabel = statusLabelMap[status] || status;

    detailContent.innerHTML = `
      <img class="detail-hero-img" src="${p.event.img || ''}" alt="${p.event.name}" />
      <h2 class="detail-event-name">${p.event.name}</h2>

      <div class="detail-status-bar">
        <span class="status-dot ${statusDot}"></span>
        <span class="status-label ${statusDot}">${statusLabel}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-field">
          <div class="detail-field-label">${t('history.reservation_code')}</div>
          <div class="detail-field-value">${p.payment?.reservationCode || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.order_number')}</div>
          <div class="detail-field-value">${p.payment?.transactionId || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.event_date')}</div>
          <div class="detail-field-value">${eventDateDisplay}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.event_time')}</div>
          <div class="detail-field-value">${eventTime}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.purchase_date')}</div>
          <div class="detail-field-value">${purchaseDate}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.venue')}</div>
          <div class="detail-field-value">${p.event.venue || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.category')}</div>
          <div class="detail-field-value">${p.event.category || '—'}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.payment_method')}</div>
          <div class="detail-field-value">${methodDisplay}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.tickets_label')}</div>
          <div class="detail-field-value">${qty}</div>
        </div>
        <div class="detail-field">
          <div class="detail-field-label">${t('history.email')}</div>
          <div class="detail-field-value">${emailDisplay}</div>
        </div>
      </div>

      <div class="detail-ticket-list">
        <div class="detail-ticket-row" style="background:#F9FAFB;font-weight:600;color:#374151;">
          <span>${t('history.seat')}</span>
          <span>${t('history.zone')}</span>
          <span>${t('history.price')}</span>
        </div>
        ${seatRows}
      </div>

      <div class="detail-total">
        <span class="detail-total-label">${t('history.total_paid')}</span>
        <span class="detail-total-value">RD$ ${p.pricing.total.toLocaleString('es-DO')}</span>
      </div>

      <div class="detail-actions">
        <button class="btn-purchase-download">
          <span class="material-symbols-outlined">download</span> ${t('history.download_pdf')}
        </button>
        <button class="btn-purchase-details" onclick="window.print()">
          <span class="material-symbols-outlined">print</span> ${t('history.print')}
        </button>
      </div>
    `;

    detailPanel.classList.add('open');
    detailOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeDetailPanel() {
    if (detailPanel) detailPanel.classList.remove('open');
    if (detailOverlay) detailOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  if (detailClose) detailClose.addEventListener('click', closeDetailPanel);
  if (detailOverlay) detailOverlay.addEventListener('click', closeDetailPanel);

  const cardForm = document.getElementById('card-form');
  if (cardForm) {
    cardForm.addEventListener('submit', () => {
      const purchase = JSON.parse(sessionStorage.getItem('astro_purchase') || '{}');
      if (!purchase.payment) {
        const cardNumber = (document.getElementById('card-number')?.value || '').replace(/\s/g, '');
        const last4 = cardNumber.slice(-4);
        const brand = document.getElementById('card-brand-display')?.textContent || 'VISA';
        const holder = document.getElementById('card-name')?.value || 'Titular';
        const now = new Date();
        const txnId = 'TXN-' + now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') + '-' +
          Math.random().toString(36).substring(2, 6).toUpperCase();
        const resvCode = 'RSV-' + Math.random().toString(36).substring(2, 6).toUpperCase() +
          Math.random().toString(36).substring(2, 4).toUpperCase();
        purchase.payment = {
          method: 'card',
          cardBrand: brand,
          cardLast4: last4,
          cardHolder: holder,
          transactionId: txnId,
          reservationCode: resvCode
        };
        purchase.purchasedAt = now.toISOString();
        sessionStorage.setItem('astro_purchase', JSON.stringify(purchase));
        savePurchaseToHistory(purchase);
      }
    });
  }

  /* ---- Alt payment buttons: save & redirect ---- */
  document.querySelectorAll('.pay-alt-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const panel = this.closest('.pay-method-panel');
      const method = panel ? panel.dataset.panel : 'unknown';
      const purchase = JSON.parse(sessionStorage.getItem('astro_purchase') || '{}');
      if (!purchase.payment) {
        const now = new Date();
        const txnId = 'TXN-' + now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') + '-' +
          Math.random().toString(36).substring(2, 6).toUpperCase();
        const resvCode = 'RSV-' + Math.random().toString(36).substring(2, 6).toUpperCase() +
          Math.random().toString(36).substring(2, 4).toUpperCase();
        purchase.payment = {
          method,
          transactionId: txnId,
          reservationCode: resvCode
        };
        purchase.purchasedAt = now.toISOString();
        sessionStorage.setItem('astro_purchase', JSON.stringify(purchase));
        savePurchaseToHistory(purchase);
      }
    });
  });

  /* ---------- Toast ---------- */
  const toast = document.getElementById("purchase-toast");
  if (toast) {
    setTimeout(() => toast.classList.add("show"), 500);
    setTimeout(() => toast.classList.remove("show"), 5500);
  }

  /* ---------- Modal admin ---------- */
  const eventModal = document.getElementById("event-modal");
  document.querySelectorAll("[data-open-event-modal]").forEach((btn) => {
    btn.addEventListener("click", () => eventModal && eventModal.classList.add("show"));
  });
  document.querySelectorAll("[data-close-event-modal]").forEach((btn) => {
    btn.addEventListener("click", () => eventModal && eventModal.classList.remove("show"));
  });
  if (eventModal) {
    eventModal.addEventListener("click", (e) => {
      if (e.target === eventModal) eventModal.classList.remove("show");
    });
  }

  /* ============================================================
     DECORACIONES Y ANIMACIONES
     ============================================================ */

  /* ---------- Scroll reveal: elementos aparecen al entrar en viewport ---------- */
  const revealTargets = document.querySelectorAll(
    ".card, .glass-panel, .stat-card, .event-card, .section-head, .email-preview, .steps"
  );

  revealTargets.forEach((el, i) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(24px)";
    el.style.transition = `opacity 0.5s cubic-bezier(0.4,0,0.2,1) ${(i % 6) * 0.07}s, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${(i % 6) * 0.07}s`;
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------- Contadores animados en stat cards ---------- */
  document.querySelectorAll(".stat-card .value").forEach((el) => {
    const text = el.textContent.trim();
    const match = text.match(/^RD\$\s*([\d,.]+(?:\s*[MKK])?)$/i);
    const numMatch = text.match(/([\d,.]+)/);
    if (!numMatch && !match) return;

    const raw = match ? match[1] : numMatch[1];
    const clean = parseFloat(raw.replace(/,/g, ""));
    if (isNaN(clean)) return;

    const prefix = text.startsWith("RD$") ? "RD$ " : "";
    const suffix = text.endsWith(" ago") ? " ago" : "";
    let start = 0;
    const duration = 900;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (clean - start) * ease);

      if (clean >= 1000) {
        el.textContent = prefix + current.toLocaleString("es-DO") + suffix;
      } else {
        el.textContent = prefix + current + suffix;
      }

      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  /* ---------- Partículas flotantes decorativas ---------- */
  const atmosphere = document.querySelector(".atmosphere");
  if (atmosphere) {
    for (let i = 0; i < 18; i++) {
      const dot = document.createElement("span");
      dot.className = "particle";
      const size = Math.random() * 4 + 2;
      Object.assign(dot.style, {
        position: "absolute",
        width: size + "px",
        height: size + "px",
        borderRadius: "50%",
        background: ["#6c3fd1", "#d63384", "#0ea5e9", "#d4bfff"][Math.floor(Math.random() * 4)],
        opacity: String(Math.random() * 0.25 + 0.08),
        top: Math.random() * 100 + "%",
        left: Math.random() * 100 + "%",
        animation: `particleFloat ${Math.random() * 20 + 15}s ease-in-out infinite`,
        animationDelay: `-${Math.random() * 20}s`,
        pointerEvents: "none",
      });
      atmosphere.appendChild(dot);
    }
  }

  /* ---------- Cursor glow: resplandor que sigue al mouse ---------- */
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);

  let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  function animateGlow() {
    glowX += (mouseX - glowX) * 0.08;
    glowY += (mouseY - glowY) * 0.08;
    glow.style.transform = `translate(${glowX - 150}px, ${glowY - 150}px)`;
    requestAnimationFrame(animateGlow);
  }
  animateGlow();

  /* ---------- Efecto parallax en atmosphere al scroll ---------- */
  const glowA = document.querySelector(".atmosphere .glow-a");
  const glowB = document.querySelector(".atmosphere .glow-b");
  if (glowA && glowB) {
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      glowA.style.transform = `translate(${y * 0.02}px, ${y * -0.03}px)`;
      glowB.style.transform = `translate(${y * -0.025}px, ${y * 0.02}px)`;
    }, { passive: true });
  }

  /* ---------- Tilt 3D en event cards ---------- */
  document.querySelectorAll(".event-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform =
        `translateY(-6px) perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });

  /* ---------- Bar chart animado ---------- */
  document.querySelectorAll(".bar-chart .bar").forEach((bar) => {
    const target = bar.style.height;
    bar.style.height = "0%";
    bar.style.transition = "height 0.8s cubic-bezier(0.34,1.56,0.64,1)";
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => { bar.style.height = target; }, 100);
          obs.unobserve(bar);
        }
      });
    }, { threshold: 0.2 });
    obs.observe(bar);
  });

  /* ---------- Botones ripple ---------- */
  document.querySelectorAll(".btn-primary, .btn-secondary").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      Object.assign(ripple.style, {
        position: "absolute",
        width: size + "px",
        height: size + "px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.3)",
        left: e.clientX - rect.left - size / 2 + "px",
        top: e.clientY - rect.top - size / 2 + "px",
        transform: "scale(0)",
        animation: "rippleEffect 0.5s ease-out forwards",
        pointerEvents: "none",
      });
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  /* ---------- Smooth scroll para links internos ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#") return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  /* ---------- Navbar activo: highlight según scroll ---------- */
  const sections = document.querySelectorAll("main section[id]");
  if (sections.length) {
    const navLinksMap = {};
    document.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => {
      navLinksMap[a.getAttribute("href")] = a;
    });
    window.addEventListener("scroll", () => {
      let current = "";
      sections.forEach((sec) => {
        if (window.scrollY >= sec.offsetTop - 120) {
          current = "#" + sec.id;
        }
      });
      Object.values(navLinksMap).forEach((a) => a.classList.remove("active"));
      if (navLinksMap[current]) navLinksMap[current].classList.add("active");
    }, { passive: true });
  }

});

/* ---------- Keyframes inyectados dinámicamente ---------- */
(function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes particleFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(20px, -40px) scale(1.2); }
      50% { transform: translate(-30px, 20px) scale(0.8); }
      75% { transform: translate(15px, 30px) scale(1.1); }
    }

    @keyframes rippleEffect {
      to { transform: scale(4); opacity: 0; }
    }

    .cursor-glow {
      position: fixed;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(108,63,209,0.06) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
      top: 0;
      left: 0;
      will-change: transform;
    }
    @media (pointer: coarse) {
      .cursor-glow { display: none; }
    }

    @media (max-width: 700px) {
      .navbar .container {
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
      }
      .nav-links {
        flex-wrap: wrap;
        justify-content: center;
        gap: 2px;
        width: 100%;
      }
      .nav-links a {
        font-size: 0.72rem;
        padding: 6px 12px;
      }
    }
  `;
  document.head.appendChild(style);
})();
