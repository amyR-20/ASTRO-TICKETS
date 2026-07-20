/* ============================================================
   Astro Tickets — JS compartido v3
   Decoraciones, navbar responsive, animaciones y más
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Navbar responsive ---------- */
  const navbar = document.querySelector(".navbar");
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen);
      toggle.querySelector(".material-symbols-outlined").textContent =
        isOpen ? "close" : "menu";
    });

    links.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.querySelector(".material-symbols-outlined").textContent = "menu";
      });
    });

    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.querySelector(".material-symbols-outlined").textContent = "menu";
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.querySelector(".material-symbols-outlined").textContent = "menu";
      }
    });
  }

  /*Navbar: sombra al hacer scroll */
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
    const PRICES = { platino: 4500, vip: 3200, general: 1800 };
    const TAKEN_SEATS = new Set(["A3","A4","B2","B5","C1","C8","D4","D5","E6","F3","F7","G2","G9","H1","H5","H10","I4","I6"]);
    const selectedSeats = new Map();

    function buildSeatGrid(container, zone, rows, cols) {
      // Column labels
      const colRow = document.createElement("div");
      colRow.className = "seat-col-labels";
      colRow.innerHTML = '<span style="width:22px"></span>';
      for (let c = 1; c <= cols; c++) {
        colRow.innerHTML += `<span>${c}</span>`;
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
            rowEl.innerHTML += '<div class="seat-aisle"></div>';
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

    @media (max-width: 860px) {
      .nav-links {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(248, 245, 255, 0.97);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 12px;
        border-bottom: 1px solid rgba(108,63,209,0.08);
        box-shadow: 0 12px 40px rgba(108,63,209,0.12);
        display: none;
        animation: menuSlide 0.25s ease;
      }
      .nav-links.open { display: flex; }
      .nav-links a {
        padding: 14px 16px;
        border-radius: 10px;
        font-size: 0.9rem;
      }
      .nav-links a.active { background: rgba(108,63,209,0.1); }
      .nav-toggle { display: flex !important; }
    }
    @keyframes menuSlide {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
})();
