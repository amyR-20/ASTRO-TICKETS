/* ============================================================
   Astro Tickets — JS compartido v3
   Decoraciones, navbar responsive, animaciones y más
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Navbar: sombra al hacer scroll ---------- */
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    let navShadowRaf = 0;
    const onScroll = () => {
      if (navShadowRaf) return;
      navShadowRaf = requestAnimationFrame(() => {
        navShadowRaf = 0;
        navbar.style.boxShadow =
          window.scrollY > 10
            ? "0 4px 20px rgba(108, 63, 209, 0.08)"
            : "none";
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Footer: año dinámico ---------- */
  document.querySelectorAll(".footer-year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Menú móvil (hamburguesa) ---------- */
  const navToggleBtn = document.getElementById("nav-toggle");
  const navLinksEl = document.querySelector(".nav-links");
  const adminSidebarEl = document.querySelector(".admin-sidebar");
  if (navToggleBtn && (navLinksEl || adminSidebarEl)) {
    const drawerIsAdmin = !!adminSidebarEl;
    const drawerEl = drawerIsAdmin ? adminSidebarEl : navLinksEl;
    const toggleClass = drawerIsAdmin ? "open" : "nav-open";
    const iconEl = navToggleBtn.querySelector(".material-symbols-outlined");
    const closeMenu = () => {
      if (drawerEl) drawerEl.classList.remove(toggleClass);
      navToggleBtn.classList.remove("open");
      navToggleBtn.setAttribute("aria-expanded", "false");
      if (iconEl) iconEl.textContent = "menu";
    };
    navToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = drawerEl && drawerEl.classList.contains(toggleClass);
      if (drawerEl) drawerEl.classList.toggle(toggleClass, !isOpen);
      navToggleBtn.classList.toggle("open", !isOpen);
      navToggleBtn.setAttribute("aria-expanded", isOpen ? "false" : "true");
      if (iconEl) iconEl.textContent = isOpen ? "menu" : "close";
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    document.addEventListener("click", (e) => {
      const isOpen = drawerEl && drawerEl.classList.contains(toggleClass);
      if (isOpen && !e.target.closest(drawerIsAdmin ? ".admin-sidebar" : ".nav-links") && !e.target.closest("#nav-toggle")) {
        closeMenu();
      }
    });
    if (drawerEl) {
      drawerEl.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
    }
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
    // Los formularios de login/registro los gestiona auth.js y se marcan
    // con data-auth-handled; para ellos NO se fuerza el redirect de 700ms,
    // evitando que se navegue aunque el login/registro haya fallado.
    // #card-form se procesa de forma asíncrona con el backend (ver flujo
    // de compra en PURCHASE FLOW), así que también se excluye aquí.
    if (form.dataset.authHandled || form.id === "card-form" || form.id === "seat-form") return;
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
  // Las tarjetas las crea renderCatalogEvents() (asíncrono); guardamos la
  // lista en caché y la renovamos tras cada render para no re-consultar el DOM.
  let catalogCards = [];

  const refreshCatalogCards = () => {
    catalogCards = Array.prototype.slice.call(document.querySelectorAll("[data-event-name]"));
  };

  const applyCatalogFilter = () => {
    if (!searchInput) return;
    const term = searchInput.value.trim().toLowerCase();
    const cat = categoryFilter && categoryFilter.value ? categoryFilter.value : "";
    for (let i = 0; i < catalogCards.length; i++) {
      const card = catalogCards[i];
      const name = card.getAttribute("data-event-name").toLowerCase();
      const place = (card.getAttribute("data-event-place") || "").toLowerCase();
      const matchTerm = name.includes(term) || place.includes(term);
      const catMatch = !cat || cat === "todas" || card.getAttribute("data-event-category") === cat;
      card.hidden = !(matchTerm && catMatch);
    }
  };

  const searchInput = document.getElementById("event-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => { refreshCatalogCards(); applyCatalogFilter(); });
  }

  const categoryFilter = document.getElementById("event-category");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", () => { refreshCatalogCards(); applyCatalogFilter(); });
  }

  /* ============================================================
     SEAT MAP — Asientos numerados (evento.html)
     ============================================================ */
  const seatGridPlatino = document.getElementById("seat-grid-platino");
  const seatGridVip = document.getElementById("seat-grid-vip");
  const seatGridGeneral = document.getElementById("seat-grid-general");

  if (seatGridPlatino) {
    const evMain = document.querySelector('main[data-event-name]');

    // Asientos y zonas reales (backend) si la página trae un evento por ?id=
    let ALL_SEATS = [];
    let ZONE_PRICES = {};
    try {
      ALL_SEATS = evMain ? JSON.parse(evMain.dataset.seats || '[]') : [];
      const zones = evMain ? JSON.parse(evMain.dataset.zones || '[]') : [];
      zones.forEach((z) => { ZONE_PRICES[z.name.toLowerCase()] = Number(z.price) || 0; });
    } catch (_) {}

    let PRICES = evMain ? {
      platino: ZONE_PRICES.platino || parseInt(evMain.dataset.pricePlatino) || 4500,
      vip: ZONE_PRICES.vip || parseInt(evMain.dataset.priceVip) || 3200,
      general: ZONE_PRICES.general || parseInt(evMain.dataset.priceGeneral) || 1800
    } : { platino: 4500, vip: 3200, general: 1800 };
    // Mostrar el precio real de cada zona en su etiqueta
    document.querySelectorAll('.seat-zone-label').forEach((label, i) => {
      const key = ['platino', 'vip', 'general'][i];
      if (key && PRICES[key]) {
        const span = label.querySelector('span');
        const name = span ? span.textContent.trim() : key.charAt(0).toUpperCase() + key.slice(1);
        label.innerHTML = `<span>${name}</span> · RD$ ${PRICES[key].toLocaleString('es-DO')}`;
      }
    });

    let TAKEN_SEATS = new Set(
      ALL_SEATS.length
        ? ALL_SEATS.filter((s) => s.status === 'sold' || s.status === 'blocked').map((s) => s.id)
        : ["A3","A4","B2","B5","C1","C8","D4","D5","E6","F3","F7","G2","G9","H1","H5","H10","I4","I6"]
    );
    const selectedSeats = new Map();

    function buildSeatGrid(container, zone, rows, cols) {
      const zoneSeats = ALL_SEATS.filter((s) => (s.type || '').toLowerCase() === zone);
      const nCols = zoneSeats.length ? Math.max(...zoneSeats.map((s) => s.col)) : cols;
      const aisleAfter = Math.floor(nCols / 2);

      // Delegación: un solo listener por grid (los listeners por asiento
      // se re-creaban en cada render y eran cientos de closures).
      if (!container.dataset.seatDelegate) {
        container.dataset.seatDelegate = "1";
        container.addEventListener("click", (e) => {
          const seatEl = e.target.closest(".seat");
          if (!seatEl || seatEl.classList.contains("taken")) return;
          toggleSeat(seatEl);
        });
      }

      // Column labels
      const colRow = document.createElement("div");
      colRow.className = "seat-col-labels";
      const labelRowSpan = document.createElement("span");
      labelRowSpan.style.width = "22px";
      colRow.appendChild(labelRowSpan);
      for (let c = 1; c <= nCols; c++) {
        const colLabel = document.createElement("span");
        colLabel.textContent = c;
        colRow.appendChild(colLabel);
      }
      container.appendChild(colRow);

      // Mapa real: agrupar los asientos por fila
      if (zoneSeats.length) {
        const byRow = {};
        zoneSeats.forEach((s) => { (byRow[s.row] = byRow[s.row] || []).push(s); });
        const rowKeys = Object.keys(byRow).sort((a, b) => (a < b ? -1 : 1));

        rowKeys.forEach((rowKey) => {
          const rowEl = document.createElement("div");
          rowEl.className = "seat-row";
          rowEl.innerHTML = `<span class="seat-row-label">${rowKey}</span>`;

          const seatMap = {};
          byRow[rowKey].forEach((s) => { seatMap[s.col] = s; });

          for (let c = 1; c <= nCols; c++) {
            if (c === aisleAfter + 1) {
              const aisle = document.createElement("div");
              aisle.className = "seat-aisle";
              rowEl.appendChild(aisle);
            }
            const seatData = seatMap[c];
            if (!seatData) {
              const spacer = document.createElement("div");
              spacer.className = "seat-aisle";
              rowEl.appendChild(spacer);
              continue;
            }
            const id = seatData.id;
            const taken = seatData.status === 'sold' || seatData.status === 'blocked';
            const seat = document.createElement("div");
            seat.className = "seat" + (taken ? " taken" : "");
            seat.dataset.id = id;
            seat.dataset.zone = zone;
            seat.dataset.price = PRICES[zone];
            seat.textContent = c;
            rowEl.appendChild(seat);
          }
          container.appendChild(rowEl);
        });
        return;
      }

      // Fallback: mapa generado (filas x columnas) sin evento en la URL
      for (let r = 0; r < rows; r++) {
        const rowEl = document.createElement("div");
        rowEl.className = "seat-row";
        const rowLetter = String.fromCharCode(65 + r);
        rowEl.innerHTML = `<span class="seat-row-label">${rowLetter}</span>`;

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

    // Referencias del panel de selección cacheadas una sola vez
    let seatDisplayRefs = null;
    const getSeatDisplayRefs = () => {
      if (!seatDisplayRefs) {
        seatDisplayRefs = {
          display: document.getElementById("selected-seats-display"),
          input: document.getElementById("selected-seats-input"),
          countEl: document.getElementById("ticket-count-display"),
          totalEl: document.getElementById("purchase-total"),
          btn: document.getElementById("btn-continuar"),
          pagoSeats: document.getElementById("pago-seats"),
          pagoQty: document.getElementById("pago-qty"),
          pagoSubtotal: document.getElementById("pago-subtotal"),
          pagoFee: document.getElementById("pago-fee"),
          pagoTotal: document.getElementById("pago-total"),
        };
      }
      return seatDisplayRefs;
    };

    function updateSeatDisplay() {
      const refs = getSeatDisplayRefs();
      const display = refs.display;
      if (!display) return;

      let total = 0;

      // Group by zone
      const byZone = {};
      selectedSeats.forEach((data, id) => {
        if (!byZone[data.zone]) byZone[data.zone] = [];
        byZone[data.zone].push(id);
      });

      const parts = [];
      Object.entries(byZone).forEach(([zone, ids]) => {
        ids.sort();
        for (let i = 0; i < ids.length; i++) {
          parts.push(`<span class="seat-tag">${ids[i]} <span style="font-weight:400;opacity:0.6;">·</span> ${zone}</span>`);
        }
        total += ids.length * PRICES[zone];
      });

      if (parts.length === 0) {
        parts.push('<span style="font-size: 0.78rem; color: var(--color-on-surface-variant);">Haz clic en los asientos del mapa</span>');
      }

      display.innerHTML = parts.join("");
      const ids = Array.from(selectedSeats.keys());
      if (refs.input) refs.input.value = ids.join(",");
      if (refs.countEl) refs.countEl.textContent = selectedSeats.size;
      if (refs.totalEl) refs.totalEl.textContent = "RD$ " + total.toLocaleString("es-DO");
      if (refs.btn) refs.btn.disabled = selectedSeats.size === 0;

      // Update pago.html totals if present
      const idsStr = ids.join(", ");
      if (refs.pagoSeats) refs.pagoSeats.textContent = idsStr || "—";
      if (refs.pagoQty) refs.pagoQty.textContent = selectedSeats.size;
      if (refs.pagoSubtotal) refs.pagoSubtotal.textContent = "RD$ " + total.toLocaleString("es-DO");
      if (refs.pagoFee) refs.pagoFee.textContent = "RD$ " + Math.round(total * 0.05).toLocaleString("es-DO");
      if (refs.pagoTotal) refs.pagoTotal.textContent = "RD$ " + Math.round(total * 1.05).toLocaleString("es-DO");
    }

    buildSeatGrid(seatGridPlatino, "platino", 2, 10);
    buildSeatGrid(seatGridVip, "vip", 3, 10);
    buildSeatGrid(seatGridGeneral, "general", 3, 10);

    // Save seat selection to sessionStorage on form submit
    const seatForm = document.getElementById('seat-form');
    if (seatForm) {
      seatForm.addEventListener('submit', (e) => {
        const main = document.querySelector('main[data-event-name]');
        if (!main) return;

        // Evento sin función activa → no se puede vender (evita llegar a
        // pago.html y fallar al reservar con funcionId vacío).
        if (!main.dataset.funcionId) {
          e.preventDefault();
          const btn = seatForm.querySelector('button[type="submit"]');
          if (btn) btn.disabled = true;
          const display = document.getElementById('selected-seats-display');
          if (display) {
            display.innerHTML = '<span style="color:var(--color-error);font-size:0.8rem;">Este evento aún no tiene funciones disponibles. Prueba con otro evento.</span>';
          }
          return;
        }

        const seats = [];
        selectedSeats.forEach((data, id) => {
          seats.push({ id, zone: data.zone, price: parseInt(data.price) });
        });
        const subtotal = seats.reduce((s, seat) => s + seat.price, 0);
        const fee = Math.round(subtotal * 0.05);
        const purchase = {
          event: {
            id: main.dataset.eventId,
            name: main.dataset.eventName,
            img: main.dataset.eventImg,
            date: main.dataset.eventDate,
            venue: main.dataset.eventVenue,
            category: main.dataset.eventCategory
          },
          funcionId: main.dataset.funcionId || '',
          seats,
          pricing: { subtotal, fee, total: subtotal + fee }
        };
        sessionStorage.setItem('astro_purchase', JSON.stringify(purchase));

        // Navegar a pago.html (este form no lo gestiona el redirect genérico)
        const btn = seatForm.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">progress_activity</span> Continuar…';
        }
        window.location.href = 'pago.html';
      });
    }

    /* ---- Re-render del mapa con los datos reales del evento ----
       El script inline de evento.html (applyEvent) llama a
       window.renderSeatMap() tras recibir el evento del backend, para
       que asientos, zonas y precios mostrados sean los reales. */
    function renderSeatMap() {
      const ev = document.querySelector('main[data-event-name]');
      try {
        ALL_SEATS = ev ? JSON.parse(ev.dataset.seats || '[]') : [];
        const zones = ev ? JSON.parse(ev.dataset.zones || '[]') : [];
        ZONE_PRICES = {};
        zones.forEach((z) => { ZONE_PRICES[z.name.toLowerCase()] = Number(z.price) || 0; });
      } catch (_) { ALL_SEATS = []; ZONE_PRICES = {}; }

      PRICES = ev ? {
        platino: ZONE_PRICES.platino || parseInt(ev.dataset.pricePlatino) || 4500,
        vip: ZONE_PRICES.vip || parseInt(ev.dataset.priceVip) || 3200,
        general: ZONE_PRICES.general || parseInt(ev.dataset.priceGeneral) || 1800
      } : { platino: 4500, vip: 3200, general: 1800 };

      document.querySelectorAll('.seat-zone-label').forEach((label, i) => {
        const key = ['platino', 'vip', 'general'][i];
        if (key && PRICES[key]) {
          const span = label.querySelector('span');
          const name = span ? span.textContent.trim() : key.charAt(0).toUpperCase() + key.slice(1);
          label.innerHTML = `<span>${name}</span> · RD$ ${PRICES[key].toLocaleString('es-DO')}`;
        }
      });

      TAKEN_SEATS = new Set(
        ALL_SEATS.length
          ? ALL_SEATS.filter((s) => s.status === 'sold' || s.status === 'blocked').map((s) => s.id)
          : ["A3","A4","B2","B5","C1","C8","D4","D5","E6","F3","F7","G2","G9","H1","H5","H10","I4","I6"]
      );

      selectedSeats.clear();
      [seatGridPlatino, seatGridVip, seatGridGeneral].forEach((g) => { if (g) g.innerHTML = ''; });
      buildSeatGrid(seatGridPlatino, "platino", 2, 10);
      buildSeatGrid(seatGridVip, "vip", 3, 10);
      buildSeatGrid(seatGridGeneral, "general", 3, 10);
      updateSeatDisplay();
    }
    window.renderSeatMap = renderSeatMap;
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
  // El flujo operativo (stable-flow.js) siempre lleva ?orden= (comprobante) o
  // ?funcion= (pago). Si la URL lo indica, este bloque legacy no debe correr,
  // aunque haya quedado un astro_purchase en sessionStorage de un flujo viejo.
  const stableFlowUrl = /(^|[?&])(orden|funcion)=/.test(window.location.search);
  if (storedRaw && !window.__stableFlow && !stableFlowUrl) {
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

        /* ---- comprobante.html: boletos digitales (QR + descarga) ---- */
        const ticketsEl = document.getElementById('receipt-tickets');
        const btnViewTicket = document.getElementById('btn-view-ticket');
        const btnResend = document.getElementById('btn-resend');

        if (ticketsEl && (s.seats || []).length) {
          ticketsEl.innerHTML = '';
          (s.seats || []).forEach((seat, i) => {
            const zoneLabel = seat.zone
              ? seat.zone.charAt(0).toUpperCase() + seat.zone.slice(1)
              : '—';
            const card = document.createElement('div');
            card.className = 'receipt-ticket';
            card.innerHTML = `
              <div class="receipt-ticket-qr"><span class="qr-placeholder">QR</span></div>
              <div class="receipt-ticket-info">
                <span class="receipt-ticket-label">Boleto ${i + 1}</span>
                <span class="receipt-ticket-seat">${seat.id} · ${zoneLabel}</span>
                <span class="receipt-ticket-code">${seat.codigo || '—'}</span>
              </div>
              <button class="btn-ticket-download" type="button" data-download="${seat.codigo || ''}">
                <span class="material-symbols-outlined">download</span> ${t('history.download_pdf')}
              </button>
            `;
            ticketsEl.appendChild(card);

            // Cargar el QR real desde el backend
            const qrBox = card.querySelector('.receipt-ticket-qr');
            if (seat.codigo && typeof Api !== 'undefined' && Api.qrDataUrl) {
              Api.qrDataUrl(seat.codigo)
                .then((url) => { if (qrBox) qrBox.innerHTML = `<img src="${url}" alt="QR ${seat.id}" class="receipt-qr-img" />`; })
                .catch(() => { if (qrBox) qrBox.innerHTML = `<span class="qr-placeholder">${seat.id}</span>`; });
            } else if (qrBox) {
              qrBox.innerHTML = `<span class="qr-placeholder">${seat.id}</span>`;
            }

            // Descargar el PDF de este boleto
            const dlBtn = card.querySelector('[data-download]');
            if (dlBtn) {
              dlBtn.addEventListener('click', async () => {
                const codigo = dlBtn.dataset.download;
                if (!codigo) { alert('Este boleto aún no tiene PDF generado.'); return; }
                try { await Api.descargarPdfEntrada(codigo); }
                catch (err) { alert(err.message || 'Error al descargar el boleto.'); }
              });
            }
          });
        }

        // Botón "Ver mi Boleto": mostrar la sección de boletos
        if (btnViewTicket && ticketsEl) {
          btnViewTicket.addEventListener('click', () => {
            ticketsEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        }

        // Botón "Reenviar Confirmación"
        if (btnResend) {
          btnResend.addEventListener('click', async () => {
            const first = (s.seats || []).find((x) => x.codigo);
            if (!first) { alert('No hay boletos para reenviar.'); return; }
            btnResend.disabled = true;
            try {
              const res = await Api.reenviarPdfEntrada(first.codigo);
              alert(res.mensaje || 'Entrada reenviada a tu correo.');
            } catch (err) {
              alert(err.message || 'No se pudo reenviar la entrada.');
            } finally {
              btnResend.disabled = false;
            }
          });
        }
      }
    } catch (_) {}
  }

  /* ============================================================
     HISTORY — Save & Render Purchase History
     ============================================================ */

  // Las compras viven exclusivamente en Neon.
  function savePurchaseToHistory() {}

  /* ---- Helpers ---- */
  function t(key) { return typeof I18n !== 'undefined' ? I18n.t(key) : key; }
  function statusLabelOf(status) {
    const labels = {
      paid: t('history.paid'),
      pending: t('history.pending'),
      cancelled: t('history.cancelled'),
      refunded: t('history.refunded'),
      completed: t('history.completed'),
      available: t('history.available'),
      'selling-fast': t('history.selling_fast'),
      'past-event': t('history.past_event')
    };
    return labels[status] || status;
  }
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
  (async function loadHistory() {
    if (!document.getElementById('purchase-list')) return;

    let history = [];

    // Cargar compras reales desde el backend (Neon)
    try {
      if (typeof Api !== "undefined") {
        const compras = await Api.getMisCompras();
        if (compras.length) history = compras.map(p => ({
          ...p,
          event: {
            ...p.event,
            date: formatEventDate(p.event),
          }
        }));
      }
    } catch (err) { console.error("No se pudo cargar el historial:", err); history = []; }

    function formatEventDate(evt) {
      if (!evt || !evt.date) return evt && evt.date;
      // El backend devuelve "YYYY-MM-DD"; lo mostramos en formato legible
      if (/^\d{4}-\d{2}-\d{2}$/.test(evt.date)) {
        const d = new Date(evt.date + 'T12:00:00');
        if (!isNaN(d.getTime())) {
          return I18n.date(d, { day: 'numeric', month: 'long', year: 'numeric' });
        }
      }
      return evt.date;
    }

    // Seed demo data if empty (solo si no hay nada en ninguna parte)
    if (false && history.length === 0) {
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
        ? I18n.eventName(nextEvent.name)
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
            msgEl.textContent = `"${I18n.eventName(latest.event.name)}" — ${latest.seats.length} ${tkLabel} ${t('history.ready_msg_short')}`;
          }
        }
      }

      // Render purchase cards
      listEl.innerHTML = '';
      history.forEach((p, idx) => {
        const status = p.status || 'paid';
        const statusLabel = statusLabelOf(status);
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
        const functionTime = I18n.time(p.funcion?.hora || (p.event.date || '').split(' · ')[1] || '—');
        const purchaseDateDisplay = p.purchasedAt ? I18n.date(p.purchasedAt, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
        const orderId = p.orderId;

        const card = document.createElement('div');
        card.className = 'purchase-card';
        card.dataset.index = idx;

        card.innerHTML = `
          <div class="purchase-card-img">
            <img src="${p.event.img || ''}" alt="${p.event.name}" loading="lazy" />
          </div>
          <div class="purchase-card-body">
            <span class="purchase-status ${statusClass}">${statusLabel}</span>
            <h3 class="purchase-event-name">${I18n.eventName(p.event.name)}</h3>
            <div class="purchase-info">
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">calendar_month</span> ${eventDateDisplay}
              </span>
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">schedule</span> ${functionTime}
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
              <span class="purchase-info-item">
                <span class="material-symbols-outlined">shopping_bag</span> ${t('history.bought')}: ${purchaseDateDisplay}
              </span>
            </div>
            <div class="purchase-actions">
              <button class="btn-purchase-download" data-action="download" data-index="${idx}" data-order-id="${orderId}">
                <span class="material-symbols-outlined">download</span> ${I18n.t('history.download_comprobante')}
              </button>
              <button class="btn-purchase-details" data-action="ticket" data-order-id="${orderId}">
                <span class="material-symbols-outlined">confirmation_number</span> ${t('history.view_ticket')}
              </button>
              <button class="btn-purchase-details" data-action="print" data-order-id="${orderId}">
                <span class="material-symbols-outlined">print</span> ${t('history.print_ticket')}
              </button>
              <button class="btn-purchase-details" data-action="resend" data-order-id="${orderId}">
                <span class="material-symbols-outlined">mail</span> ${t('history.resend_ticket')}
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
      listEl.querySelectorAll('[data-action="ticket"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.location.href = 'comprobante.html?orden=' + encodeURIComponent(btn.dataset.orderId);
        });
      });
      listEl.querySelectorAll('[data-action="print"]').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation(); window.open('comprobante.html?orden=' + encodeURIComponent(btn.dataset.orderId) + '&print=1', '_blank', 'noopener');
      }));
      listEl.querySelectorAll('[data-action="resend"]').forEach(btn => btn.addEventListener('click', async (e) => {
        e.stopPropagation(); const original = btn.innerHTML; btn.disabled = true; btn.textContent = 'Enviando...';
        try { await Api.reenviarOrden(btn.dataset.orderId); alert('Confirmación enviada al correo registrado.'); }
        catch (err) { alert(err.message || 'No se pudo enviar la confirmación.'); }
        finally { btn.disabled = false; btn.innerHTML = original; }
      }));
      listEl.querySelectorAll('[data-action="download"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const orderId = btn.dataset.orderId;
          if (!orderId) {
            alert(I18n.t('history.no_tickets_to_download') || 'No hay comprobante para descargar.');
            return;
          }
          try {
            await Api.descargarPdfComprobante(orderId);
          } catch (err) {
            alert(err.message || 'Error al descargar el comprobante.');
          }
        });
      });
    }
  })();

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
        <span class="text-right">
          ${seat.codigo ? `<button type="button" class="btn-ghost btn" style="padding:4px 10px;font-size:0.78rem;" data-transfer-codigo="${String(seat.codigo).replace(/"/g, '&quot;')}"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px;">swap_horiz</span> ${t('history.transfer')}</button>` : ''}
        </span>
      </div>
    `).join('');

    const dateParts = (p.event.date || '').split(' · ');
    const eventDateDisplay = dateParts[0] || p.event.date;
    const eventTime = dateParts[1] || '—';

    const purchaseDate = p.purchasedAt ? I18n.dateTime(p.purchasedAt, {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '—';

    const methodDisplay = p.payment?.method === 'card'
      ? (p.payment.cardBrand || 'Card') + ' ****' + (p.payment.cardLast4 || '')
      : (p.payment?.method || '—');

    const emailDisplay = p.comprador?.email || '—';

    const statusDot = statusClassMap[status] || 'paid';
    const statusLabel = statusLabelOf(status);

    detailContent.innerHTML = `
      <img class="detail-hero-img" src="${p.event.img || ''}" alt="${I18n.eventName(p.event.name)}" fetchpriority="high" decoding="async" />
      <h2 class="detail-event-name">${I18n.eventName(p.event.name)}</h2>

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
          <div class="detail-field-value">${I18n.category(p.event.category) || '—'}</div>
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
        <div class="detail-ticket-row" style="background:var(--color-surface-container-low);color:var(--color-on-surface);font-weight:600;">
          <span>${t('history.seat')}</span>
          <span>${t('history.zone')}</span>
          <span>${t('history.price')}</span>
          <span></span>
        </div>
        ${seatRows}
      </div>

      <div class="detail-total">
        <span class="detail-total-label">${t('history.total_paid')}</span>
        <span class="detail-total-value">RD$ ${p.pricing.total.toLocaleString('es-DO')}</span>
      </div>

      <div class="detail-actions">
        <button class="btn-purchase-download" data-detail-download>
          <span class="material-symbols-outlined">download</span> ${t('history.download_comprobante')}
        </button>
        <button class="btn-purchase-details" data-detail-comprobante>
          <span class="material-symbols-outlined">confirmation_number</span> ${t('history.view_ticket')}
        </button>
      </div>
    `;

    // Descargar el comprobante de pago de esta compra
    const dlBtn = detailContent.querySelector('[data-detail-download]');
    if (dlBtn) {
      dlBtn.addEventListener('click', async () => {
        if (!p.orderId) { alert('No se pudo identificar la orden. Actualiza tu historial.'); return; }
        try {
          await Api.descargarPdfComprobante(p.orderId);
        } catch (err) { alert(err.message || 'Error al descargar el comprobante.'); }
      });
    }

    // Abrir el comprobante completo en una sección propia (no window.print)
    const compBtn = detailContent.querySelector('[data-detail-comprobante]');
    if (compBtn) {
      compBtn.addEventListener('click', () => {
        if (!p.orderId) { alert('No se pudo identificar la orden. Actualiza tu historial.'); return; }
        window.location.href = 'comprobante.html?orden=' + encodeURIComponent(p.orderId);
      });
    }

    // Transferir un boleto a otra persona por correo
    detailContent.querySelectorAll('[data-transfer-codigo]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const codigo = btn.dataset.transferCodigo;
        const email = prompt(t('history.transfer_prompt'));
        if (email === null) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { alert(t('history.transfer_invalid_email')); return; }
        btn.disabled = true;
        try {
          const res = await Api.transferirEntrada(codigo, email.trim());
          alert(res.mensaje || t('history.transfer_done'));
        } catch (err) {
          alert(err.message || t('history.transfer_failed'));
        } finally {
          btn.disabled = false;
        }
      });
    });

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

  /* ============================================================
     PURCHASE FLOW REAL — reserva + compra contra el backend
     (pago.html → comprobante.html)
     ============================================================ */
  function buildTxnId(now) {
    return 'TXN-' + now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') + '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  function buildResvCode() {
    return 'RSV-' + Math.random().toString(36).substring(2, 6).toUpperCase() +
      Math.random().toString(36).substring(2, 4).toUpperCase();
  }

  function showPayError(msg) {
    const box = document.getElementById('pay-error');
    if (box) { box.textContent = msg; box.style.display = 'flex'; }
    if (typeof alert === 'function') alert(msg);
  }

  async function realizarCompra(method, extraPayment, btn) {
    const purchase = JSON.parse(sessionStorage.getItem('astro_purchase') || '{}');

    if (typeof Auth !== "undefined" && Auth.getToken && !Auth.getToken()) {
      showPayError('Inicia sesión para completar la compra.');
      window.location.href = 'index.html';
      return;
    }

    const funcionId = purchase.funcionId;
    const seatIds = (purchase.seats || []).map((s) => s.id);
    if (!funcionId) { showPayError('Falta información de la función del evento. Vuelve a elegir tus asientos.'); return; }
    if (!seatIds.length) { showPayError('No seleccionaste ningún asiento.'); return; }

    const original = btn ? btn.innerHTML : null;
    const setBusy = (busy) => {
      if (!btn) return;
      btn.disabled = busy;
      btn.innerHTML = busy
        ? '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">progress_activity</span> Procesando…'
        : original;
    };

    try {
      setBusy(true);

      // 1) Reservar los asientos elegidos en la función
      await Api.reservarAsientos(funcionId, seatIds);

      // 2) Confirmar la compra en el backend
      const now = new Date();
      const payment = Object.assign({
        method,
        transactionId: buildTxnId(now),
        reservationCode: buildResvCode(),
      }, extraPayment || {});

      const sesion = (typeof Auth !== 'undefined' && Auth.getSession) ? Auth.getSession() : null;
      const data = await Api.crearOrden({
        funcionId,
        payment,
        buyer: sesion ? { nombre: sesion.nombre, email: sesion.email } : null,
      });
      const orden = data.orden || {};

      // 3) Guardar el resultado para el comprobante e historial
      const entradas = orden.asientos || [];
      purchase.seats = purchase.seats.map((s, i) => {
        const e = entradas[i] || {};
        return {
          ...s,
          codigo: e.codigo || s.codigo,
          qrToken: e.qrToken || s.qrToken,
          estado: e.estado || 'activa',
        };
      });
      purchase.payment = Object.assign({}, payment, {
        cardBrand: extraPayment ? extraPayment.cardBrand : undefined,
        cardLast4: extraPayment ? extraPayment.cardLast4 : undefined,
        cardHolder: extraPayment ? extraPayment.cardHolder : undefined,
      });
      purchase.purchasedAt = now.toISOString();
      purchase.status = 'paid';
      purchase.ordenId = orden.id;
      sessionStorage.setItem('astro_purchase', JSON.stringify(purchase));
      savePurchaseToHistory(purchase);

      window.location.href = 'comprobante.html';
    } catch (err) {
      setBusy(false);
      console.error("Error en la compra:", err);
      showPayError(err.message || 'No se pudo completar la compra. Inténtalo de nuevo.');
      // Liberar la reserva para que otros puedan tomar los asientos
      try { await Api.cancelarReservas(funcionId, seatIds); } catch (_) {}
    }
  }

  const cardForm = document.getElementById('card-form');
  if (cardForm && !window.__stableFlow) {
    cardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cardNumber = (document.getElementById('card-number')?.value || '').replace(/\s/g, '');
      const extra = {
        cardBrand: document.getElementById('card-brand-display')?.textContent || 'VISA',
        cardLast4: cardNumber.slice(-4),
        cardHolder: document.getElementById('card-name')?.value || 'Titular',
      };
      const btn = cardForm.querySelector('button[type="submit"]');
      realizarCompra('card', extra, btn);
    });
  }

  /* ---- Alt payment buttons: pagar y guardar ---- */
  if (!window.__stableFlow) document.querySelectorAll('.pay-alt-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const panel = this.closest('.pay-method-panel');
      const method = panel ? panel.dataset.panel : 'unknown';
      realizarCompra(method, null, this);
    });
  });

  /* ---------- Toast ---------- */
  const toast = document.getElementById("purchase-toast");
  if (toast) {
    setTimeout(() => toast.classList.add("show"), 500);
    setTimeout(() => toast.classList.remove("show"), 5500);
  }

  /* ============================================================
     EVENT CREATOR — Full-page event creation form
     ============================================================ */
  const ev = {
    creator: document.getElementById("ev-creator"),
    main: document.getElementById("resumen"),
    // General info
    name: document.getElementById("ce-name"),
    desc: document.getElementById("ce-desc"),
    category: document.getElementById("ce-category"),
    date: document.getElementById("ce-date"),
    time: document.getElementById("ce-time"),
    venue: document.getElementById("ce-venue"),
    city: document.getElementById("ce-city"),
    address: document.getElementById("ce-address"),
    imgInput: document.getElementById("ce-img-input"),
    bannerInput: document.getElementById("ce-banner-input"),
    dropzoneImg: document.getElementById("ce-dropzone-img"),
    dropzoneBanner: document.getElementById("ce-dropzone-banner"),
    statusDraft: document.getElementById("ce-status-draft"),
    statusPublish: document.getElementById("ce-status-publish"),
    // Venue
    rows: document.getElementById("ce-rows"),
    cols: document.getElementById("ce-cols"),
    capacity: document.getElementById("ce-capacity"),
    genBtn: document.getElementById("ce-gen-seats"),
    seatGrid: document.getElementById("ce-seat-grid"),
    // Types
    typesGrid: document.getElementById("ce-types-grid"),
    addTypeBtn: document.getElementById("ce-add-type"),
    // Assign
    assignGrid: document.getElementById("ce-assign-grid"),
    assignPanel: document.getElementById("ce-assign-panel"),
    assignType: document.getElementById("ce-assign-type"),
    assignStatus: document.getElementById("ce-assign-status"),
    assignSave: document.getElementById("ce-assign-save"),
    assignClear: document.getElementById("ce-assign-clear"),
    // Pricing
    pricingBody: document.getElementById("ce-pricing-body"),
    // Preview
    previewImg: document.getElementById("preview-img-src"),
    previewName: document.getElementById("preview-name"),
    previewDate: document.getElementById("preview-date"),
    previewTime: document.getElementById("preview-time"),
    previewVenue: document.getElementById("preview-venue"),
    previewCapacity: document.getElementById("preview-capacity"),
    previewAvailable: document.getElementById("preview-available"),
    previewPrice: document.getElementById("preview-price"),
    previewLegend: document.getElementById("preview-legend-items"),
    previewMiniMap: document.getElementById("preview-mini-map"),
    // Actions
    publishBtn: document.getElementById("ce-publish"),
    saveDraftBtn: document.getElementById("ce-save-draft"),
    previewBtn: document.getElementById("ce-preview-btn")
  };

  // ---- Catalog render (runs on any page) ----
  async function renderCatalogEvents() {
    const grid = document.getElementById("catalog-events");
    if (!grid) return;

    // Intentar cargar desde el backend (Neon); si no está disponible,
    // usar los eventos guardados en localStorage como respaldo.
    let events = [];
    try {
      if (typeof Api !== "undefined") {
        events = await Api.getEventos("published");
      }
    } catch (_) {
      events = [];
    }
    if (!events.length) {
      events = JSON.parse(localStorage.getItem("astro_events") || "[]");
    }
    const published = events.filter(e => e.status === "published" || !e.status);

    // Remover tarjetas dinámicas insertadas previamente
    grid.querySelectorAll("[data-dynamic]").forEach(el => el.remove());

    // Estado de disponibilidad según el inventario real de cada función
    // (funciones[].stats proviene de las estadísticas del backend).
    function badgeDisponibilidad(evt) {
      const funcs = evt.funciones || [];
      const activas = funcs.filter((f) => f.estado === "activa" && f.stats && f.stats.capacidad > 0);
      if (activas.length) {
        const pcts = activas.map((f) => f.stats.pctDisponible);
        if (pcts.every((p) => p === 0)) return { label: t('catalog.soldout'), cls: 'badge-error' };
        if (Math.min(...pcts) <= 20) return { label: t('catalog.sellingfast'), cls: 'badge-warning' };
        return { label: t('catalog.available'), cls: 'badge-info' };
      }
      const conAsientos = funcs.filter((f) => f.stats && f.stats.capacidad > 0);
      if (conAsientos.length && conAsientos.every((f) => f.stats.disponibles === 0)) {
        return { label: t('catalog.soldout'), cls: 'badge-error' };
      }
      return { label: t('catalog.available'), cls: 'badge-info' };
    }

    published.forEach(evt => {
      const dateObj = new Date(evt.date + "T" + (evt.time || "20:00"));
      const dateDisplay = I18n.date(dateObj, { day: "numeric", month: "short", year: "numeric" });
      const venueShort = (evt.venue || "").split(",")[0].trim();
      const cat = evt.category || "";
      const evtName = I18n.eventName(evt.name);

      const card = document.createElement("a");
      card.className = "card event-card";
      card.href = "evento.html?id=" + evt.id;
      card.setAttribute("data-dynamic", "true");
      card.setAttribute("data-event-name", evtName.toLowerCase());
      card.setAttribute("data-event-place", (venueShort || "").toLowerCase());
      card.setAttribute("data-event-category", I18n.category(cat).toLowerCase());

      card.innerHTML = `
        <div class="thumb">
          <img src="${evt.image}" alt="${evtName}" loading="lazy" decoding="async" onerror="this.src='multimedia/logo.svg'" />
          <span class="badge ${badgeDisponibilidad(evt).cls}">${badgeDisponibilidad(evt).label}</span>
        </div>
        <div class="body">
          <h3 style="font-size: 1.08rem;">${evtName}</h3>
          <p class="meta">${venueShort ? venueShort + ' · ' : ''}${dateDisplay}</p>
          <p class="text-muted" style="font-size: 0.82rem; line-height: 1.4; margin-top: 6px;">${evt.description || ''}</p>
        </div>
      `;
      grid.appendChild(card);
    });

    // Renovar la caché del filtro de búsqueda tras insertar tarjetas nuevas
    if (typeof refreshCatalogCards === "function") refreshCatalogCards();
  }

  renderCatalogEvents();
  window.addEventListener("astro:langchange", () => renderCatalogEvents());

  // ---- Seed demo events (runs on any page) ----
  function seedDemoEvents() {
    const existing = localStorage.getItem("astro_events");
    if (existing) return;
    const demos = [
      { id: "evt-demo-jazz", name: "Noche de Jazz en Vivo", date: "2026-08-20", time: "20:00", venue: "Teatro Nacional, Santo Domingo", category: "Concierto", description: "Una velada íntima con los mejores exponentes del jazz contemporáneo.", image: "multimedia/jazz.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 4500, qty: 20, desc: "" }, { name: "VIP", color: "#d63384", price: 3200, qty: 30, desc: "" }, { name: "General", color: "#10b981", price: 1800, qty: 30, desc: "" }], seats: [], rows: 8, cols: 10, capacity: 80, status: "published", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "evt-demo-urbano", name: "Festival Ritmo Urbano", date: "2026-09-05", time: "21:00", venue: "Estadio Olímpico, Santo Domingo", category: "Concierto", description: "La música urbana más vibrante en un solo escenario.", image: "multimedia/urbano.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 5500, qty: 36, desc: "" }, { name: "VIP", color: "#d63384", price: 3800, qty: 48, desc: "" }, { name: "General", color: "#10b981", price: 2200, qty: 60, desc: "" }], seats: [], rows: 12, cols: 12, capacity: 144, status: "published", createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "evt-demo-hamlet", name: "Hamlet, Obra de Teatro", date: "2026-09-12", time: "19:30", venue: "Casa de Teatro, Santo Domingo", category: "Teatro", description: "La obra clásica de Shakespeare reinventada.", image: "multimedia/hamlet.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 3500, qty: 16, desc: "" }, { name: "VIP", color: "#d63384", price: 2500, qty: 16, desc: "" }, { name: "General", color: "#10b981", price: 1400, qty: 24, desc: "" }], seats: [], rows: 7, cols: 8, capacity: 56, status: "published", createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "evt-demo-baloncesto", name: "Clásico de Baloncesto", date: "2026-09-18", time: "20:00", venue: "Palacio de los Deportes, Santo Domingo", category: "Deportes", description: "La emoción del baloncesto profesional en vivo.", image: "multimedia/baloncesto.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 3800, qty: 30, desc: "" }, { name: "VIP", color: "#d63384", price: 2800, qty: 30, desc: "" }, { name: "General", color: "#10b981", price: 1600, qty: 40, desc: "" }], seats: [], rows: 10, cols: 10, capacity: 100, status: "published", createdAt: "2026-01-04T00:00:00.000Z" },
      { id: "evt-demo-conferencia", name: "Conferencia de Innovación Digital", date: "2026-09-30", time: "09:00", venue: "Centro de Convenciones, Santo Domingo", category: "Conferencia", description: "Tendencias digitales que transforman el futuro.", image: "multimedia/conferencia.jpg", zones: [{ name: "VIP", color: "#d63384", price: 3200, qty: 40, desc: "" }, { name: "General", color: "#10b981", price: 2000, qty: 60, desc: "" }], seats: [], rows: 10, cols: 10, capacity: 100, status: "published", createdAt: "2026-01-05T00:00:00.000Z" },
      { id: "evt-demo-sinfonica", name: "Sinfónica de Otoño", date: "2026-10-10", time: "20:00", venue: "Teatro Nacional, Santo Domingo", category: "Concierto", description: "La orquesta sinfónica en una velada inolvidable.", image: "multimedia/sinfonica.jpg", zones: [{ name: "Platino", color: "#ef4444", price: 4800, qty: 20, desc: "" }, { name: "VIP", color: "#d63384", price: 3500, qty: 30, desc: "" }, { name: "General", color: "#10b981", price: 2200, qty: 30, desc: "" }], seats: [], rows: 8, cols: 10, capacity: 80, status: "published", createdAt: "2026-01-06T00:00:00.000Z" }
    ];
    localStorage.setItem("astro_events", JSON.stringify(demos));
  }

  // Neon es la única fuente de eventos; no se generan datos demo en el navegador.

  // If not on admin page, skip creator init
  if (!ev.creator) { /* skip */ } else {

  const COLOR_PRESETS = ["#6c3fd1","#d63384","#0ea5e9","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];
  const DEFAULT_TYPES = [
    { name: "General", color: "#10b981", price: 25, qty: 300, desc: "Acceso general al evento" },
    { name: "VIP", color: "#d63384", price: 75, qty: 80, desc: "Acceso VIP con beneficios" },
    { name: "Palco", color: "#6c3fd1", price: 120, qty: 40, desc: "Palco privado con vista preferencial" },
    { name: "Preferencial", color: "#f59e0b", price: 50, qty: 120, desc: "Asientos preferenciales" },
    { name: "Platinum", color: "#ef4444", price: 200, qty: 20, desc: "Experiencia Platinum completa" },
    { name: "Front Stage", color: "#8b5cf6", price: 150, qty: 30, desc: "Primeras filas frente al escenario" },
    { name: "Backstage", color: "#0ea5e9", price: 250, qty: 10, desc: "Acceso backstage incluido" }
  ];

  let evSeats = [];
  let evSelectedSeats = new Set();
  let evSeatTypes = JSON.parse(JSON.stringify(DEFAULT_TYPES));
  let editingEventId = null;
  let recommendedQtysDone = false;

  // ---- Navigation ----
  document.querySelectorAll('.nav-links a[href^="#"], .admin-sidebar a[href^="#"]').forEach(a => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      if (id === "crear-evento") {
        e.preventDefault();
        showCreator();
      }
    });
  });

  // "Nuevo evento" & "Crear nuevo evento"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-event-modal]");
    if (!btn) return;
    e.preventDefault();
    void showCreator(btn.dataset.eventId || null);
  });

  window.showCreator = async function(editId) {
    editingEventId = editId || null;
    if (ev.creator) ev.creator.classList.add("active");
    if (ev.main) ev.main.style.display = "none";
    document.querySelectorAll(".site-footer").forEach(f => f.style.display = "none");
    if (editId) {
      try {
        if (typeof Api === "undefined") throw new Error("La API no esta disponible");
        const event = await Api.getEvento(editId);
        if (!event) throw new Error("El evento no existe");
        loadEventForEditing(event);
      } catch (error) {
        console.error("No se pudo cargar el evento:", error);
        alert(error.message || "No se pudo cargar el evento para editarlo.");
        hideCreator();
        return;
      }
    } else {
      resetCreator();
    }
    updatePreview();
  };

  window.hideCreator = function() {
    if (ev.creator) ev.creator.classList.remove("active");
    if (ev.main) ev.main.style.display = "";
    document.querySelectorAll(".site-footer").forEach(f => f.style.display = "");
    window.location.hash = "#eventos";
  };

  function resetCreator() {
    editingEventId = null;
    ev.name.value = "";
    ev.desc.value = "";
    ev.category.value = "Concierto";
    ev.date.value = "";
    ev.time.value = "20:00";
    ev.venue.value = "";
    ev.city.value = "";
    ev.address.value = "";
    ev.rows.value = 8;
    ev.cols.value = 10;
    ev.capacity.value = "";
    evSeats = [];
    evSelectedSeats.clear();
    evSeatTypes = JSON.parse(JSON.stringify(DEFAULT_TYPES));
    recommendedQtysDone = false;
    setStatus("draft");
    ev.previewImg.src = "multimedia/logo.svg";
    ev.seatGrid.innerHTML = '<div class="sg-stage">' + t('admin.ev_stage') + '</div>';
    ev.assignGrid.innerHTML = '<div class="sg-stage">' + t('admin.ev_stage') + '</div>';
    ev.assignPanel.classList.remove("show");
    renderTypes();
    updateProgress();
  }

  function loadEventForEditing(event) {
    ev.name.value = event.name || "";
    ev.desc.value = event.description || "";
    ev.category.value = event.category || "Concierto";
    ev.date.value = event.date || "";
    ev.time.value = event.time || "20:00";
    ev.address.value = event.address || "";
    // Split combined venue string into venue / city if city is not stored separately
    const rawVenue = event.venue || "";
    if (event.city) {
      const suffix = ", " + event.city;
      ev.venue.value = rawVenue.endsWith(suffix) ? rawVenue.slice(0, -suffix.length) : rawVenue;
      ev.city.value = event.city;
    } else {
      const parts = rawVenue.split(",").map(s => s.trim());
      ev.venue.value = parts[0] || "";
      ev.city.value = parts[1] || "";
    }
    ev.previewImg.src = event.image || "multimedia/logo.svg";
    setStatus(event.status || "draft");
    // Al editar se conservan las cantidades guardadas; no se re-sugieren.
    recommendedQtysDone = true;
    if (event.zones && event.zones.length) {
      evSeatTypes = event.zones.map(z => ({
        name: z.name,
        color: z.color || COLOR_PRESETS[evSeatTypes.findIndex(t => t.name === z.name) % COLOR_PRESETS.length] || COLOR_PRESETS[0],
        price: z.price,
        qty: z.qty || (z.rows * z.cols),
        desc: z.desc || ""
      }));
    }
    // Restore seats if saved
    if (event.seats && event.seats.length) {
      evSeats = JSON.parse(JSON.stringify(event.seats));
      ev.rows.value = event.rows || 8;
      ev.cols.value = event.cols || 10;
      renderSeatGrid(ev.seatGrid, evSeats, event.cols || 10);
      renderSeatGrid(ev.assignGrid, evSeats, event.cols || 10);
      updateCapacity();
    }
    renderTypes();
    updateProgress();
  }

  // ---- Status toggle ----
  function setStatus(status) {
    ev.statusDraft.classList.toggle("active-draft", status === "draft");
    ev.statusPublish.classList.toggle("active-published", status === "published");
  }
  if (ev.statusDraft) ev.statusDraft.addEventListener("click", () => setStatus("draft"));
  if (ev.statusPublish) ev.statusPublish.addEventListener("click", () => setStatus("published"));

  // ---- Image drag & drop ----
  function setupDropzone(dz, input, isBanner) {
    if (!dz) return;
    dz.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file) handleImageFile(file, dz, isBanner);
    });
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file, dz, isBanner);
    });
  }

  function handleImageFile(file, dz, isBanner) {
    if (!file.type.startsWith("image/")) {
      alert("Selecciona una imagen JPG, PNG o WEBP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = isBanner ? 1920 : 1280;
        const maxHeight = isBanner ? 720 : 1280;
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        // Una sola pasada con calidad 0.7 (antes re-codificaba hasta 5 veces
        // en el hilo principal, congelando la UI).
        let optimized = canvas.toDataURL("image/jpeg", 0.7);
        if (optimized.length > 900000) {
          optimized = canvas.toDataURL("image/jpeg", 0.5);
        }
        if (optimized.length > 900000) {
          alert("La imagen es demasiado grande. Usa una imagen de menor resolucion.");
          return;
        }
        dz.classList.add("has-image");
        dz.innerHTML = `<img src="${optimized}" alt="Vista previa del evento" />`;
        if (!isBanner) ev.previewImg.src = optimized;
      };
      img.onerror = () => alert("No se pudo leer la imagen seleccionada.");
      img.src = reader.result;
    };
    reader.onerror = () => alert("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  }
  setupDropzone(ev.dropzoneImg, ev.imgInput, false);
  setupDropzone(ev.dropzoneBanner, ev.bannerInput, true);

  // ---- Seat Generation ----
  function generateSeats() {
    const numRows = parseInt(ev.rows.value) || 8;
    const numCols = parseInt(ev.cols.value) || 10;
    evSeats = [];
    for (let r = 0; r < numRows; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      for (let c = 1; c <= numCols; c++) {
        evSeats.push({
          id: rowLetter + c,
          row: rowLetter,
          col: c,
          type: null,
          status: "available"
        });
      }
    }
    renderSeatGrid(ev.seatGrid, evSeats, numCols);
    renderSeatGrid(ev.assignGrid, evSeats, numCols);
    if (!recommendedQtysDone && evSeatTypes.length) {
      sugerirCantidades();
      recommendedQtysDone = true;
    }
    updateCapacity();
    updatePreview();
    updateProgress();
  }

  function renderSeatGrid(container, seats, cols) {
    if (!container) return;
    const numRows = seats.length > 0 ? (seats[seats.length - 1].row.charCodeAt(0) - 65 + 1) : 0;
    container.innerHTML = '<div class="sg-stage">' + t('admin.ev_stage') + '</div>';
    const aisleAfter = Math.floor(cols / 2);

    // Mapa id -> asiento: evita el find() lineal dentro del bucle de celdas
    const seatById = new Map();
    for (let i = 0; i < seats.length; i++) seatById.set(seats[i].id, seats[i]);
    const typeByName = new Map();
    for (let i = 0; i < evSeatTypes.length; i++) typeByName.set(evSeatTypes[i].name, evSeatTypes[i]);

    // Delegación para el grid de asignación (un solo listener)
    if (container === ev.assignGrid && !container.dataset.assignDelegate) {
      container.dataset.assignDelegate = "1";
      container.addEventListener("click", (e) => {
        const seat = e.target.closest(".sg-seat");
        if (!seat) return;
        const id = seat.dataset.id;
        if (evSelectedSeats.has(id)) {
          evSelectedSeats.delete(id);
          seat.classList.remove("selected");
        } else {
          evSelectedSeats.add(id);
          seat.classList.add("selected");
        }
        ev.assignPanel.classList.toggle("show", evSelectedSeats.size > 0);
        if (evSelectedSeats.size > 0) {
          const title = ev.assignPanel.querySelector(".sa-title");
          if (title) title.textContent = t('admin.ev_assign_title') + " (" + evSelectedSeats.size + ")";
        }
      });
    }

    for (let r = 0; r < numRows; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      const rowEl = document.createElement("div");
      rowEl.className = "sg-row";
      rowEl.innerHTML = `<span class="sg-row-label">${rowLetter}</span>`;

      for (let c = 1; c <= cols; c++) {
        if (c === aisleAfter + 1) {
          const aisle = document.createElement("div");
          aisle.className = "sg-aisle";
          rowEl.appendChild(aisle);
        }
        const seatId = rowLetter + c;
        const seatData = seatById.get(seatId);
        const seat = document.createElement("div");
        seat.className = "sg-seat";
        seat.dataset.id = seatId;
        seat.textContent = c;

        if (seatData && seatData.type) {
          const type = typeByName.get(seatData.type);
          if (type) {
            seat.classList.add("assigned");
            seat.style.background = type.color;
            seat.style.borderColor = type.color;
          }
          if (seatData.status === "reserved") seat.style.opacity = "0.6";
          if (seatData.status === "blocked") { seat.style.background = "#ccc"; seat.style.borderColor = "#ccc"; seat.style.color = "#999"; seat.style.cursor = "not-allowed"; }
        }

        if (container === ev.assignGrid && evSelectedSeats.has(seatId)) seat.classList.add("selected");

        rowEl.appendChild(seat);
      }
      container.appendChild(rowEl);
    }
  }

  function updateCapacity() {
    const total = evSeats.length;
    if (ev.capacity) ev.capacity.value = total;
    if (total > 0) {
      const suma = evSeatTypes.reduce((s, t) => s + t.qty, 0);
      if (suma > total) {
        recortarZonas();
        showToast("La capacidad cambió: las cantidades de zona se ajustaron a la capacidad total (" + total + " asientos).");
      }
    }
  }

  function recortarZonas() {
    const limite = evSeats.length;
    let usado = 0;
    evSeatTypes.forEach((tipo) => {
      if (usado >= limite) { tipo.qty = 0; return; }
      if (tipo.qty > limite - usado) tipo.qty = limite - usado;
      usado += tipo.qty;
    });
    renderTypes();
  }

  // Distribuye la capacidad total entre los tipos de asiento como cantidades
  // recomendadas (proporcional a la cantidad original de cada zona).
  function sugerirCantidades() {
    const limite = evSeats.length;
    if (!limite || !evSeatTypes.length) return;
    const totalOriginal = evSeatTypes.reduce((s, t) => s + t.qty, 0);
    if (totalOriginal <= 0) {
      const base = Math.floor(limite / evSeatTypes.length);
      const resto = limite - base * evSeatTypes.length;
      evSeatTypes.forEach((t, i) => { t.qty = base + (i < resto ? 1 : 0); });
    } else {
      let asignado = 0;
      evSeatTypes.forEach((t, i) => {
        if (i === evSeatTypes.length - 1) { t.qty = limite - asignado; return; }
        t.qty = Math.max(0, Math.floor((t.qty / totalOriginal) * limite));
        asignado += t.qty;
      });
    }
    renderTypes();
    updatePricing();
    updatePreview();
  }

  if (ev.genBtn) {
    ev.genBtn.addEventListener("click", generateSeats);
  }

  // ---- Seat Types ----
  function renderTypes() {
    if (!ev.typesGrid) return;
    ev.typesGrid.innerHTML = "";
    evSeatTypes.forEach((type, i) => {
      const card = document.createElement("div");
      card.className = "st-type-card";
      card.innerHTML = `
        <div class="st-header">
          <span class="st-name">
            <span class="st-color-dot" style="background:${type.color}"></span>
            <input class="ev-input-sm st-name-input" value="${type.name}" style="width:auto;display:inline;margin:0;font-weight:600;" />
          </span>
          <button class="st-remove" data-idx="${i}"><span class="material-symbols-outlined" style="font-size:1rem;">close</span></button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          <div style="flex:1;min-width:60px;">
            <div style="font-size:0.65rem;color:var(--color-on-surface-variant);margin-bottom:2px;">${t('admin.ev_pprice')}</div>
            <input class="ev-input-sm st-price-input" type="number" value="${type.price}" style="font-weight:700;color:var(--cosmic-purple);" />
          </div>
          <div style="flex:1;min-width:60px;">
            <div style="font-size:0.65rem;color:var(--color-on-surface-variant);margin-bottom:2px;">${t('admin.ev_pqty')}</div>
            <input class="ev-input-sm st-qty-input" type="number" value="${type.qty}" />
          </div>
        </div>
        <input class="ev-input-sm st-desc-input" value="${type.desc}" placeholder="Descripci&oacute;n" style="margin-top:6px;" />
        <div class="color-presets">
          ${COLOR_PRESETS.map(c => `<span class="color-preset${c === type.color ? ' selected' : ''}" style="background:${c}" data-color="${c}"></span>`).join('')}
        </div>
      `;

      // Wire up inputs
      const nameInput = card.querySelector(".st-name-input");
      nameInput.addEventListener("input", () => { evSeatTypes[i].name = nameInput.value; updatePricing(); updatePreview(); });
      const priceInput = card.querySelector(".st-price-input");
      priceInput.addEventListener("input", () => { evSeatTypes[i].price = parseInt(priceInput.value) || 0; updatePricing(); updatePreview(); });
      const qtyInput = card.querySelector(".st-qty-input");
      qtyInput.addEventListener("input", () => {
        let valor = parseInt(qtyInput.value) || 0;
        if (valor < 0) valor = 0;
        evSeatTypes[i].qty = valor;
        if (evSeats.length > 0) {
          const limite = evSeats.length;
          const otras = evSeatTypes.reduce((sum, t, idx) => sum + (idx === i ? 0 : t.qty), 0);
          const resto = Math.max(0, limite - otras);
          if (evSeatTypes[i].qty > resto) {
            evSeatTypes[i].qty = resto;
            qtyInput.value = resto;
            showToast("La cantidad no puede superar la capacidad total (" + limite + " asientos).");
          }
        }
        updatePricing();
        updatePreview();
      });
      const descInput = card.querySelector(".st-desc-input");
      descInput.addEventListener("input", () => { evSeatTypes[i].desc = descInput.value; });
      card.querySelector(".st-remove").addEventListener("click", () => {
        evSeatTypes.splice(i, 1);
        renderTypes();
        updatePricing();
        updatePreview();
        updateProgress();
      });
      card.querySelectorAll(".color-preset").forEach(el => {
        el.addEventListener("click", () => {
          card.querySelectorAll(".color-preset").forEach(p => p.classList.remove("selected"));
          el.classList.add("selected");
          evSeatTypes[i].color = el.dataset.color;
          renderSeatGrid(ev.assignGrid, evSeats, parseInt(ev.cols.value) || 10);
          updatePreview();
        });
      });

      ev.typesGrid.appendChild(card);
    });
    updateAssignTypeOptions();
    updatePricing();
  }

  if (ev.addTypeBtn) {
    ev.addTypeBtn.addEventListener("click", () => {
      evSeatTypes.push({
        name: "Nuevo Tipo",
        color: COLOR_PRESETS[evSeatTypes.length % COLOR_PRESETS.length],
        price: 30,
        qty: evSeats.length ? Math.max(0, evSeats.length - evSeatTypes.reduce((s, t) => s + t.qty, 0)) : 50,
        desc: ""
      });
      renderTypes();
      updateProgress();
    });
  }

  function updateAssignTypeOptions() {
    if (!ev.assignType) return;
    ev.assignType.innerHTML = evSeatTypes.map(t => `<option value="${t.name}">${t.name} - RD$ ${t.price}</option>`).join("");
  }

  // ---- Seat Assignment ----
  function toggleAssignSeat(seatId) {
    // La delegación en renderSeatGrid gestiona el toggle real; esta función
    // se mantiene como respaldo y toca solo el asiento afectado (sin
    // reconstruir el grid completo).
    if (evSelectedSeats.has(seatId)) {
      evSelectedSeats.delete(seatId);
    } else {
      evSelectedSeats.add(seatId);
    }
    const seatEl = ev.assignGrid && ev.assignGrid.querySelector('.sg-seat[data-id="' + seatId + '"]');
    if (seatEl) seatEl.classList.toggle("selected", evSelectedSeats.has(seatId));
    ev.assignPanel.classList.toggle("show", evSelectedSeats.size > 0);
    if (evSelectedSeats.size > 0) {
      const title = ev.assignPanel.querySelector(".sa-title");
      if (title) title.textContent = t('admin.ev_assign_title') + " (" + evSelectedSeats.size + ")";
    }
  }

  if (ev.assignSave) {
    ev.assignSave.addEventListener("click", () => {
      const typeName = ev.assignType.value;
      const status = ev.assignStatus.value;
      evSelectedSeats.forEach(id => {
        const seat = evSeats.find(s => s.id === id);
        if (seat) { seat.type = typeName; seat.status = status; }
      });
      evSelectedSeats.clear();
      renderSeatGrid(ev.assignGrid, evSeats, parseInt(ev.cols.value) || 10);
      ev.assignPanel.classList.remove("show");
      updatePreview();
      updateProgress();
    });
  }

  if (ev.assignClear) {
    ev.assignClear.addEventListener("click", () => {
      evSelectedSeats.clear();
      renderSeatGrid(ev.assignGrid, evSeats, parseInt(ev.cols.value) || 10);
      ev.assignPanel.classList.remove("show");
    });
  }

  // ---- Pricing Table ----
  function updatePricing() {
    if (!ev.pricingBody) return;
    ev.pricingBody.innerHTML = "";
    let grandTotal = 0;
    evSeatTypes.forEach(type => {
      const total = type.price * type.qty;
      grandTotal += total;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="pt-color-dot" style="background:${type.color}"></span>${type.name}</td>
        <td class="pt-price">RD$ ${type.price.toLocaleString("es-DO")}</td>
        <td>${type.qty.toLocaleString("es-DO")}</td>
        <td style="font-weight:600;">RD$ ${total.toLocaleString("es-DO")}</td>
      `;
      ev.pricingBody.appendChild(row);
    });
    const totalRow = document.createElement("tr");
    totalRow.style.background = "var(--color-surface-container-low)";
    totalRow.innerHTML = `
      <td style="font-weight:700;">Total</td>
      <td></td>
      <td style="font-weight:600;">${evSeatTypes.reduce((s,t) => s + t.qty, 0).toLocaleString("es-DO")}</td>
      <td style="font-weight:700;color:var(--cosmic-purple);font-size:1rem;">RD$ ${grandTotal.toLocaleString("es-DO")}</td>
    `;
    ev.pricingBody.appendChild(totalRow);
  }

  // ---- Live Preview ----
  function updatePreview() {
    if (!ev.previewName) return;
    ev.previewName.textContent = ev.name.value.trim() || "Nombre del Evento";
    if (ev.date.value) {
      const d = new Date(ev.date.value + "T" + (ev.time.value || "20:00"));
      ev.previewDate.textContent = I18n.date(d, { day: "numeric", month: "long", year: "numeric" });
    } else { ev.previewDate.textContent = I18n.t("admin.ev_select_date"); }
    ev.previewTime.textContent = ev.time.value || "20:00";
    const venueParts = [ev.venue.value, ev.city.value].filter(Boolean);
    ev.previewVenue.textContent = venueParts.join(", ") || "Lugar del evento";

    const total = evSeats.length || evSeatTypes.reduce((s,t) => s + t.qty, 0);
    const assigned = evSeats.filter(s => s.type).length;
    ev.previewCapacity.textContent = total;
    ev.previewAvailable.textContent = total - assigned;

    const prices = evSeatTypes.map(t => t.price).filter(p => p > 0);
    if (prices.length) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      ev.previewPrice.textContent = min === max ? "RD$ " + min.toLocaleString("es-DO") : "RD$ " + min.toLocaleString("es-DO") + " - RD$ " + max.toLocaleString("es-DO");
    } else { ev.previewPrice.textContent = "RD$ 0"; }

    // Legend
    if (ev.previewLegend) {
      ev.previewLegend.innerHTML = evSeatTypes.map(t =>
        `<div class="preview-legend-item"><span class="dot" style="background:${t.color}"></span>${t.name}</div>`
      ).join("");
    }

    // Mini map
    if (ev.previewMiniMap) {
      const numCols = parseInt(ev.cols.value) || 10;
      const numRows = evSeats.length > 0 ? (evSeats[evSeats.length-1].row.charCodeAt(0) - 65 + 1) : 0;
      ev.previewMiniMap.innerHTML = "";
      const seatById = new Map();
      for (let i = 0; i < evSeats.length; i++) seatById.set(evSeats[i].id, evSeats[i]);
      const typeByName = new Map();
      for (let i = 0; i < evSeatTypes.length; i++) typeByName.set(evSeatTypes[i].name, evSeatTypes[i]);
      const mapScale = Math.min(1, 140 / (numCols * 10));
      for (let r = 0; r < Math.min(numRows, 10); r++) {
        const rowEl = document.createElement("div");
        rowEl.className = "pm-row";
        for (let c = 1; c <= Math.min(numCols, 16); c++) {
          const seatId = String.fromCharCode(65 + r) + c;
          const seat = seatById.get(seatId);
          const pm = document.createElement("div");
          pm.className = "pm-seat";
          if (seat && seat.type) {
            const type = typeByName.get(seat.type);
            if (type) { pm.style.background = type.color; pm.classList.add("assigned"); }
          }
          rowEl.appendChild(pm);
        }
        ev.previewMiniMap.appendChild(rowEl);
      }
    }
  }

  // ---- Real-time preview updates (debounce 150ms: no re-render por tecla) ----
  let previewTimer = 0;
  let progressTimer = 0;
  const debouncedPreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 150);
  };
  const debouncedProgress = () => {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(updateProgress, 150);
  };
  ["name","desc","category","date","time","venue","city","address"].forEach(field => {
    if (ev[field]) ev[field].addEventListener("input", debouncedPreview);
    if (ev[field] && ev[field].tagName === "SELECT") ev[field].addEventListener("change", updatePreview);
  });

  // ---- Progress bar ----
  const progressSteps = document.querySelectorAll(".ev-progress-step");
  const progressLines = document.querySelectorAll(".ev-progress-line");
  function updateProgress() {
    let done = 0;
    // Step 1: name + date
    if (ev.name.value.trim() && ev.date.value) done = 1;
    // Step 2: seats generated
    if (done === 1 && evSeats.length > 0) done = 2;
    // Step 3: at least one seat assigned
    if (done === 2 && evSeats.some(s => s.type)) done = 3;
    // Step 4: pricing (all types have prices)
    if (done === 3 && evSeatTypes.every(t => t.price > 0)) done = 4;

    progressSteps.forEach((step, i) => {
      const idx = i + 1;
      step.classList.remove("active", "done");
      if (idx <= done) step.classList.add("done");
      else if (idx === done + 1) step.classList.add("active");
    });
    progressLines.forEach((line, i) => {
      line.classList.toggle("done", i + 1 <= done);
    });
  }

  // ---- Live input progress ----
  ["name","date","rows","cols"].forEach(field => {
    if (ev[field]) ev[field].addEventListener("input", debouncedProgress);
    if (ev[field] && ev[field].tagName === "SELECT") ev[field].addEventListener("change", updateProgress);
  });

  // ---- Save / Publish ----
  function collectEventData(status) {
    const name = ev.name.value.trim();
    const date = ev.date.value;
    const time = ev.time.value;
    const venueParts = [ev.venue.value.trim(), ev.city.value.trim()].filter(Boolean).join(", ");
    const address = ev.address.value.trim();
    const fullVenue = address ? venueParts + " - " + address : venueParts || ev.venue.value.trim();

    return {
      id: editingEventId || "evt-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name,
      description: ev.desc.value.trim(),
      category: ev.category.value,
      date,
      time,
      venue: fullVenue,
      city: ev.city.value.trim(),
      address,
      image: ev.previewImg.src || "multimedia/logo.svg",
      status: status || (ev.statusDraft.classList.contains("active-draft") ? "draft" : "published"),
      rows: parseInt(ev.rows.value) || 8,
      cols: parseInt(ev.cols.value) || 10,
      zones: evSeatTypes.map(t => ({
        name: t.name,
        color: t.color,
        price: t.price,
        qty: t.qty,
        desc: t.desc,
        rows: t.qty ? Math.ceil(t.qty / (parseInt(ev.cols.value) || 10)) : 0,
        cols: t.qty ? Math.min(t.qty, parseInt(ev.cols.value) || 10) : 0
      })),
      seats: evSeats,
      capacity: evSeats.length,
      createdAt: new Date().toISOString()
    };
  }

  async function saveEvent(eventData) {
    if (typeof Api === "undefined") throw new Error("No se pudo conectar con Neon.");
    const saved = editingEventId
      ? await Api.actualizarEvento(editingEventId, eventData)
      : await Api.crearEvento(eventData);
    localStorage.removeItem("astro_events");
    await renderAdminEvents();
    return saved;

    // Guardar también en el backend (Neon)
  }

  if (ev.publishBtn) {
    ev.publishBtn.addEventListener("click", async () => {
      const name = ev.name.value.trim();
      if (!name || !ev.date.value) {
        alert(t('admin.ev_required'));
        return;
      }
      if (!evSeats.length) {
        alert("Primero genera el mapa de asientos del evento.");
        return;
      }
      if (!evSeats.some((seat) => seat.type)) {
        alert("Asigna al menos una zona a los asientos antes de publicar.");
        return;
      }
      const sumaZonas = evSeatTypes.reduce((s, t) => s + t.qty, 0);
      if (sumaZonas > evSeats.length) {
        alert(`La cantidad total de asientos (${sumaZonas}) no puede superar la capacidad del evento (${evSeats.length}).`);
        return;
      }
      const data = collectEventData("published");
      ev.publishBtn.disabled = true;
      try {
        await saveEvent(data);
        showToast(t('admin.ev_published_toast'));
        hideCreator();
      } catch (error) {
        alert(error.message || "No se pudo publicar el evento.");
      } finally {
        ev.publishBtn.disabled = false;
      }
    });
  }

  if (ev.saveDraftBtn) {
    ev.saveDraftBtn.addEventListener("click", async () => {
      const name = ev.name.value.trim();
      if (!name) {
        alert(t('admin.ev_required_name'));
        return;
      }
      const data = collectEventData("draft");
      ev.saveDraftBtn.disabled = true;
      try {
        await saveEvent(data);
        showToast(t('admin.ev_draft_toast'));
        hideCreator();
      } catch (error) {
        alert(error.message || "No se pudo guardar el borrador.");
      } finally {
        ev.saveDraftBtn.disabled = false;
      }
    });
  }

  if (ev.previewBtn) {
    ev.previewBtn.addEventListener("click", () => {
      updatePreview();
      updateCatalogPreview();
      const modal = document.getElementById("ev-preview-modal");
      if (modal) modal.classList.add("show");
    });
  }
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("#ev-preview-close");
    const modal = document.getElementById("ev-preview-modal");
    if (closeBtn && modal) modal.classList.remove("show");
    if (e.target === modal) modal.classList.remove("show");
  });

  function updateCatalogPreview() {
    const name = ev.name.value.trim() || "Nombre del Evento";
    const venueShort = (ev.venue.value || "").split(",")[0].trim() || "Lugar";
    const dateObj = ev.date.value ? new Date(ev.date.value + "T" + (ev.time.value || "20:00")) : null;
    const dateDisplay = dateObj ? I18n.date(dateObj, { day: "numeric", month: "short", year: "numeric" }) : "Fecha";
    const desc = ev.desc.value.trim() || "Descripción del evento";
    const prices = evSeatTypes.map(t => t.price).filter(p => p > 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;

    const img = document.getElementById("preview-card-img");
    if (img) img.src = ev.previewImg.src || "multimedia/logo.svg";
    const nameEl = document.getElementById("preview-card-name");
    if (nameEl) nameEl.textContent = name;
    const metaEl = document.getElementById("preview-card-meta");
    if (metaEl) metaEl.textContent = venueShort + " · " + dateDisplay;
    const descEl = document.getElementById("preview-card-desc");
    if (descEl) descEl.textContent = desc;
    const priceEl = document.getElementById("preview-card-price");
    if (priceEl) priceEl.textContent = minPrice ? "RD$ " + minPrice.toLocaleString("es-DO") : "RD$ 0";
  }

  function showToast(msg) {
    const existing = document.querySelector(".ev-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "ev-toast";
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;padding:14px 24px;background:#1a1425;color:#fff;border-radius:14px;font-size:0.85rem;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:300;animation:fadeIn 0.3s ease;";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; toast.style.transition = "opacity 0.3s"; setTimeout(() => toast.remove(), 400); }, 2500);
  }
  window.showToast = showToast;

  // ---- Render admin events ----
  async function renderAdminEvents() {
    const grid = document.getElementById("events-grid");
    if (!grid) return;

    let events = [];
    try {
      if (typeof Api !== "undefined") {
        events = await Api.getEventos();
      }
    } catch (_) {
      events = [];
    }
    if (!events.length) {
      events = JSON.parse(localStorage.getItem("astro_events") || "[]");
    }

    const createBtn = grid.querySelector(':scope > [data-open-event-modal]');
    grid.querySelectorAll(".event-card").forEach(c => c.remove());

    events.forEach(evt => {
      const minPrice = Math.min(...(evt.zones || []).map(z => z.price).filter(p => p > 0));
      const totalSeats = evt.capacity || (evt.zones || []).reduce((sum, z) => sum + (z.qty || z.rows * z.cols || 0), 0);
      const dateObj = new Date(evt.date + "T" + (evt.time || "20:00"));
      const dateDisplay = I18n.date(dateObj, { day: "numeric", month: "short", year: "numeric" });
      const statusBadge = evt.status === "draft" ? "badge-info" : "badge-success";
      const statusLabel = evt.status === "draft" ? t('admin.ev_draft') : t('admin.active');
      const evtName = I18n.eventName(evt.name);

      const card = document.createElement("div");
      card.className = "card event-card";
      card.innerHTML = `
        <div class="thumb">
          <img src="${evt.image}" alt="${evtName}" loading="lazy" decoding="async" onerror="this.src='multimedia/logo.svg'" />
          <span class="badge ${statusBadge}">${statusLabel}</span>
        </div>
        <div class="body">
          <div class="flex-between" style="margin-bottom: 6px;">
            <h3 style="font-size: 1rem;">${evtName}</h3>
            <div style="display: flex; gap: 6px;">
              <a class="btn-ghost btn" style="padding: 6px;" href="reporte-evento.html?evento=${encodeURIComponent(evt.id)}" title="${t('admin.report_event')}"><span class="material-symbols-outlined">monitoring</span></a>
              <button class="btn-ghost btn" style="padding: 6px;" data-event-id="${evt.id}" data-open-event-modal><span class="material-symbols-outlined">edit</span></button>
            </div>
          </div>
          <p class="meta">${evt.venue || ''} · ${dateDisplay}</p>
          <div class="price-row">
            <span class="text-muted" style="font-size: 0.82rem;">${(evt.zones || []).map(z => z.name).join(' · ')}</span>
            <span class="price">${minPrice ? 'RD$ ' + minPrice.toLocaleString("es-DO") : '—'}</span>
          </div>
        </div>
      `;
      grid.insertBefore(card, createBtn);
    });
  }

  renderAdminEvents();
  window.addEventListener("astro:langchange", () => renderAdminEvents());
  } // end if (!ev.creator) bail

  /* ============================================================
     DECORACIONES Y ANIMACIONES
     ============================================================ */

  /* ---------- Scroll reveal: elementos aparecen al entrar en viewport ----------
     Se omite si el usuario prefiere menos movimiento. Los elementos ya
     visibles en la carga no se ocultan (protege el LCP); solo se animan
     los que están por debajo del pliegue. */
  const revealTargets = document.querySelectorAll(
    ".card, .glass-panel, .stat-card, .event-card, .section-head, .email-preview, .steps"
  );
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (revealTargets.length && !reduceMotion) {
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    let revealIdx = 0;
    revealTargets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < viewportH * 0.9) return; // ya en (o cerca de) la primera pantalla: no ocultar
      el.style.opacity = "0";
      el.style.transform = "translateY(24px)";
      el.style.transition = `opacity 0.5s cubic-bezier(0.4,0,0.2,1) ${(revealIdx % 6) * 0.07}s, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${(revealIdx % 6) * 0.07}s`;
      revealIdx++;
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
  }

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

  /* ---------- Cursor glow: resplandor que sigue al mouse ----------
     Solo anima mientras el mouse se mueve; se detiene tras 2 s de
     inactividad y se pausa cuando la pestaña no es visible. */
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);

  let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;
  let glowRaf = 0;
  let glowIdleTimer = 0;
  let glowActive = false;

  function stopGlow() {
    glowActive = false;
    if (glowRaf) { cancelAnimationFrame(glowRaf); glowRaf = 0; }
    clearTimeout(glowIdleTimer);
  }

  function animateGlow() {
    glowX += (mouseX - glowX) * 0.08;
    glowY += (mouseY - glowY) * 0.08;
    glow.style.transform = `translate(${glowX - 150}px, ${glowY - 150}px)`;
    if (Math.abs(mouseX - glowX) < 0.4 && Math.abs(mouseY - glowY) < 0.4) {
      stopGlow();
      return;
    }
    glowRaf = requestAnimationFrame(animateGlow);
  }

  function startGlow() {
    if (reduceMotion) return;
    if (document.hidden) return;
    if (!glowActive) {
      glowActive = true;
      clearTimeout(glowIdleTimer);
      glowRaf = requestAnimationFrame(animateGlow);
    }
    clearTimeout(glowIdleTimer);
    glowIdleTimer = setTimeout(stopGlow, 2000);
  }

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    startGlow();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopGlow();
    else startGlow();
  });

  /* ---------- Efecto parallax en atmosphere al scroll ---------- */
  const glowA = document.querySelector(".atmosphere .glow-a");
  const glowB = document.querySelector(".atmosphere .glow-b");
  if (glowA && glowB) {
    let paraRaf = 0;
    const onParaScroll = () => {
      if (paraRaf) return;
      paraRaf = requestAnimationFrame(() => {
        paraRaf = 0;
        const y = window.scrollY;
        glowA.style.transform = `translate(${y * 0.02}px, ${y * -0.03}px)`;
        glowB.style.transform = `translate(${y * -0.025}px, ${y * 0.02}px)`;
      });
    };
    window.addEventListener("scroll", onParaScroll, { passive: true });
  }

  /* ---------- Tilt 3D en event cards (con rAF throttle y rect cacheado) ---------- */
  const tiltableCards = document.querySelectorAll(".event-card");
  if (!reduceMotion && tiltableCards.length) {
    let tiltRaf = 0;
    let tiltCard = null;
    let tiltRect = null;

    const applyTilt = () => {
      tiltRaf = 0;
      if (!tiltCard || !tiltRect) return;
      const { x, y } = tiltCard._tilt;
      tiltCard.style.transform =
        `translateY(-6px) perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
    };

    tiltableCards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        if (tiltCard !== card) { tiltCard = card; tiltRect = card.getBoundingClientRect(); }
        const x = (e.clientX - tiltRect.left) / tiltRect.width - 0.5;
        const y = (e.clientY - tiltRect.top) / tiltRect.height - 0.5;
        card._tilt = { x, y };
        if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt);
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        if (tiltCard === card) tiltCard = null;
      });
    });
  }

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

  /* ---------- Navbar activo: highlight según scroll (throttle + offsets cacheados) ---------- */
  const sections = document.querySelectorAll("#resumen, #eventos, #usuarios, #transacciones, #reembolsos, #validar, #reportes");
  if (sections.length) {
    const navLinksMap = {};
    document.querySelectorAll('.nav-links a[href^="#"], .admin-sidebar a[href^="#"]').forEach((a) => {
      navLinksMap[a.getAttribute("href")] = a;
    });
    const refreshOffsets = () => {
      sectionOffsets = Array.from(sections).map((sec) => ({ id: sec.id, top: sec.offsetTop }));
    };
    let sectionOffsets = [];
    refreshOffsets();
    setTimeout(refreshOffsets, 1500);
    window.addEventListener("resize", refreshOffsets, { passive: true });

    let navRaf = 0;
    let currentSection = "";
    window.addEventListener("scroll", () => {
      if (navRaf) return;
      navRaf = requestAnimationFrame(() => {
        navRaf = 0;
        let current = "";
        const y = window.scrollY;
        for (let i = 0; i < sectionOffsets.length; i++) {
          if (y >= sectionOffsets[i].top - 120) current = "#" + sectionOffsets[i].id;
        }
        if (current === currentSection) return;
        currentSection = current;
        const prev = document.querySelector(".nav-links a.active, .admin-sidebar a.active");
        if (prev) prev.classList.remove("active");
        if (navLinksMap[current]) navLinksMap[current].classList.add("active");
      });
    }, { passive: true });
  }

  /* ============================================================
     FASE 3.1 — Tema claro/oscuro/auto + chip usuario (panel admin)
     ============================================================ */
  const isAdminPage = document.body.classList.contains("admin-page");
  const themeRoot = document.documentElement;

  const resolveTheme = (pref) => {
    if (pref === "light" || pref === "dark") return pref;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };
  const persistTheme = (pref) => {
    try { localStorage.setItem("astro_theme", pref); } catch (e) {}
    themeRoot.setAttribute("data-theme", resolveTheme(pref));
  };

  const themeButtons = document.querySelectorAll(".theme-opt");
  if (themeButtons.length) {
    let current = (() => { try { return localStorage.getItem("astro_theme") || "auto"; } catch (e) { return "auto"; } })();
    const sync = (pref) => {
      themeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeValue === pref)));
    };
    sync(current);
    themeButtons.forEach((b) => {
      b.addEventListener("click", () => {
        current = b.dataset.themeValue;
        persistTheme(current);
        sync(current);
      });
    });
    const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (media) {
      const onSystemChange = () => { if (current === "auto") themeRoot.setAttribute("data-theme", resolveTheme("auto")); };
      if (media.addEventListener) media.addEventListener("change", onSystemChange);
      else if (media.addListener) media.addListener(onSystemChange);
    }
  }

  /* Chip de usuario y bienvenida desde la sesión */
  if (isAdminPage && typeof Auth !== "undefined") {
    const session = Auth.getSession();
    const nameEl = document.getElementById("admin-user-name");
    const emailEl = document.getElementById("admin-user-email");
    const avatarEl = document.getElementById("admin-user-avatar");
    const welcomeEl = document.getElementById("admin-welcome-name");
    if (session) {
      if (nameEl) nameEl.textContent = session.nombre || "Admin";
      if (emailEl) emailEl.textContent = session.email || "";
      if (welcomeEl) welcomeEl.textContent = session.nombre || "Admin";
      if (avatarEl) {
        if (session.avatarUrl && /^(https?:|data:|\/)/.test(session.avatarUrl)) {
          avatarEl.textContent = "";
          avatarEl.style.backgroundImage = "url(" + session.avatarUrl + ")";
          avatarEl.style.backgroundSize = "cover";
          avatarEl.style.backgroundPosition = "center";
        } else {
          avatarEl.textContent = ((session.nombre || "A")[0] || "A").toUpperCase();
        }
      }
    }
  }

  /* Menú de perfil del admin (chip avatar) */
  const adminChip = document.getElementById("admin-user-chip");
  const adminDropdown = document.getElementById("admin-user-dropdown");
  if (adminChip && adminDropdown) {
    adminChip.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = adminDropdown.classList.toggle("show");
      adminChip.classList.toggle("open", open);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".admin-user-chip")) {
        adminDropdown.classList.remove("show");
        adminChip.classList.remove("open");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        adminDropdown.classList.remove("show");
        adminChip.classList.remove("open");
      }
    });
    const adminLogoutBtn = document.getElementById("admin-user-logout");
    if (adminLogoutBtn) {
      adminLogoutBtn.addEventListener("click", () => {
        if (typeof Auth !== "undefined" && Auth.logout) Auth.logout();
        window.location.href = "index.html";
      });
    }
  }

  /* Enlaces próximamente (Reportes / Configuración) */
  document.querySelectorAll("[data-coming-soon]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      showToast(typeof I18n !== "undefined" ? I18n.t("admin.coming_soon") : "Disponible próximamente");
    });
  });

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

    @media (max-width: 560px) {
      .zone-row { flex-wrap: wrap; }
      .zone-row .field { flex: 1 1 calc(50% - 10px) !important; min-width: 0; }
    }
  `;
  document.head.appendChild(style);
})();
