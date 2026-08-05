/* ============================================================
   Reporte por evento — panel administrativo
   Selecciona un evento y muestra ventas, funciones, zonas,
   compradores, transacciones y tendencia de los últimos 14 días.
   ============================================================ */
(function () {
  const fmt = (n) => (Number(n) || 0).toLocaleString("es-DO");
  const fmtMoney = (n) => "RD$ " + fmt(Math.round(Number(n) || 0));

  const select = document.getElementById("report-event-select");
  const area = document.getElementById("reporte-area");
  const empty = document.getElementById("reporte-empty");
  const body = document.getElementById("reporte-body");
  const printBtn = document.getElementById("report-print-btn");
  const pdfBtn = document.getElementById("report-pdf-btn");

  if (!select || !area || !body) return;

  let currentId = null;
  let current = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function t(key) {
    return I18n.t(key);
  }

  function estadoBadge(estado) {
    const map = { activa: "badge-success", agotada: "badge-error", programada: "badge-info", finalizada: "badge-info", cancelada: "badge-error" };
    const label = t("report.estado_" + estado);
    const shown = label.indexOf("report.estado_") === 0 ? estado : label;
    return `<span class="badge ${map[estado] || "badge-info"}">${esc(shown)}</span>`;
  }

  async function cargarEventos() {
    try {
      const eventos = await Api.getEventos();
      const frag = document.createDocumentFragment();
      eventos.forEach((ev) => {
        const opt = document.createElement("option");
        opt.value = ev.id;
        opt.textContent = I18n.eventName(ev.name || ev.nombre) + (ev.date ? " · " + I18n.date(ev.date) : "");
        frag.appendChild(opt);
      });
      select.innerHTML = '<option value="" data-i18n="report.select_placeholder">' + t("report.select_placeholder") + "</option>";
      select.appendChild(frag);

      const preseleccion = new URLSearchParams(location.search).get("evento");
      if (preseleccion && Array.from(select.options).some((o) => o.value === preseleccion)) {
        select.value = preseleccion;
        cargarReporte(preseleccion);
      } else if (currentId) {
        select.value = currentId;
        cargarReporte(currentId);
      }
    } catch (err) {
      select.innerHTML = '<option value="" data-i18n="report.no_events">' + t("report.no_events") + "</option>";
    }
  }

  async function cargarReporte(id) {
    currentId = id;
    if (!id) {
      showEmpty();
      return;
    }
    showLoading();
    try {
      current = await Api.getReporteEvento(id);
      render();
    } catch (err) {
      showError(err.message || t("report.empty"));
    }
  }

  function showEmpty() {
    area.hidden = true;
    empty.hidden = false;
    if (printBtn) printBtn.disabled = true;
    if (pdfBtn) pdfBtn.disabled = true;
  }

  function showLoading() {
    area.hidden = false;
    empty.hidden = true;
    if (printBtn) printBtn.disabled = true;
    if (pdfBtn) pdfBtn.disabled = true;
    body.innerHTML = '<div class="card" style="padding:48px;text-align:center;color:var(--color-on-surface-variant)">' +
      '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite;display:block;margin-bottom:12px;">progress_activity</span>' +
      esc(t("report.loading")) + "</div>";
  }

  function showError(msg) {
    area.hidden = false;
    empty.hidden = true;
    if (printBtn) printBtn.disabled = true;
    if (pdfBtn) pdfBtn.disabled = true;
    body.innerHTML = '<div class="card" style="padding:48px;text-align:center;color:var(--color-on-surface-variant)">' +
      '<span class="material-symbols-outlined" style="display:block;margin-bottom:12px;">error</span>' + esc(msg) + "</div>";
  }

  function render() {
    if (!current) return;
    area.hidden = false;
    empty.hidden = true;
    if (printBtn) printBtn.disabled = false;
    if (pdfBtn) pdfBtn.disabled = false;
    body.innerHTML = renderStats() + renderTendencia() + renderFunciones() + renderCompradores() + renderReembolsos() + renderTransacciones();
  }

  function renderStats() {
    const r = current.resumen || {};
    const pct = Math.max(0, Math.min(100, Number(r.pctVendido) || 0));
    return `
      <div class="stats-grid" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <span class="icon material-symbols-outlined">payments</span>
          <p class="text-muted" style="margin-top: 12px;" data-i18n="report.ingresos">Ingresos</p>
          <p class="value">${fmtMoney(r.ingresos)}</p>
          <p class="delta">${fmt(r.transacciones)} ${t("report.transacciones")}</p>
        </div>
        <div class="card stat-card">
          <span class="icon material-symbols-outlined">confirmation_number</span>
          <p class="text-muted" style="margin-top: 12px;" data-i18n="report.boletos">Boletos vendidos</p>
          <p class="value">${fmt(r.boletos)}</p>
          <p class="delta">${fmt(r.compradores)} ${t("report.compradores")}</p>
        </div>
        <div class="card stat-card">
          <span class="icon material-symbols-outlined">receipt_long</span>
          <p class="text-muted" style="margin-top: 12px;" data-i18n="report.transacciones">Transacciones</p>
          <p class="value">${fmt(r.transacciones)}</p>
          <p class="delta">${fmt(r.pendiente)} pendiente</p>
        </div>
        <div class="card stat-card">
          <span class="icon material-symbols-outlined">groups</span>
          <p class="text-muted" style="margin-top: 12px;" data-i18n="report.compradores">Compradores</p>
          <p class="value">${fmt(r.compradores)}</p>
          <p class="delta">${fmt(r.capacidad)} ${t("report.capacidad")}</p>
        </div>
        <div class="card stat-card">
          <span class="icon material-symbols-outlined">donut_small</span>
          <p class="text-muted" style="margin-top: 12px;" data-i18n="report.ocupacion">Ocupación</p>
          <p class="value">${pct}%</p>
          <div style="height: 8px; border-radius: 999px; background: var(--color-surface-variant); overflow: hidden; margin-top: 10px;">
            <div style="height: 100%; width: ${pct}%; border-radius: 999px; background: linear-gradient(90deg, var(--cosmic-purple), var(--stellar-blue));"></div>
          </div>
        </div>
      </div>`;
  }

  function renderTendencia() {
    const tend = current.tendencia || [];
    const porDia = {};
    tend.forEach((d) => { porDia[d.dia] = d; });

    const dias = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dia = d.toISOString().slice(0, 10);
      const datos = porDia[dia] || { dia, transacciones: 0, boletos: 0, ingresos: 0 };
      datos._fecha = d;
      dias.push(datos);
    }

    const max = Math.max(1, ...dias.map((d) => Number(d.boletos) || 0));
    const totalBoletos = dias.reduce((a, d) => a + (Number(d.boletos) || 0), 0);

    const barras = dias.map((d) => {
      const h = Math.max(3, Math.round(((Number(d.boletos) || 0) / max) * 100));
      const etiqueta = d._fecha.toLocaleDateString("es-DO", { day: "numeric" });
      const tooltip = I18n.date(d._fecha) + " · " + fmt(d.boletos) + " · " + fmtMoney(d.ingresos);
      return `<div class="bar-col" title="${esc(tooltip)}"><div class="bar" style="height:${h}%;"></div><span class="bar-label">${etiqueta}</span></div>`;
    }).join("");

    return `
      <div class="card" style="padding: 28px; margin-bottom: 24px;">
        <div class="flex-between" style="margin-bottom: 20px;">
          <h2 style="font-size: 1.25rem;" data-i18n="report.tendencia">Tendencia · últimos 14 días</h2>
          <span class="text-muted" style="font-size: 0.85rem;">${fmt(totalBoletos)} ${t("report.boletos")}</span>
        </div>
        <div class="bar-chart" style="height: 200px;">
          ${totalBoletos === 0 ? `<div class="bar-col"><div class="bar" style="height:8px;"></div><span class="bar-label">${esc(t("report.sin_ventas"))}</span></div>` : barras}
        </div>
      </div>`;
  }

  function renderFunciones() {
    const rows = current.porFuncion || [];
    if (!rows.length) {
      return `
        <div class="card" style="padding: 24px; margin-bottom: 24px;">
          <h2 style="font-size: 1.25rem; margin-bottom: 12px;" data-i18n="report.por_funcion">Ventas por función</h2>
          <p class="text-muted">${esc(t("report.sin_funciones"))}</p>
        </div>`;
    }
    return `
      <div class="card" style="padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 1.25rem; margin-bottom: 12px;" data-i18n="report.por_funcion">Ventas por función</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th data-i18n="report.col_fecha">Fecha</th>
                <th data-i18n="report.col_hora">Hora</th>
                <th data-i18n="report.col_sala">Sala</th>
                <th data-i18n="report.col_estado">Estado</th>
                <th data-i18n="report.capacidad">Capacidad</th>
                <th data-i18n="report.col_vendidos">Vendidos</th>
                <th data-i18n="report.col_disponibles">Disponibles</th>
                <th data-i18n="report.col_ingresos">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((f) => `
                <tr>
                  <td>${esc(I18n.date(f.fecha))}</td>
                  <td>${esc(I18n.time(f.hora))}</td>
                  <td>${esc(f.sala)}</td>
                  <td>${estadoBadge(f.estado)}</td>
                  <td>${fmt(f.capacidad)}</td>
                  <td>${fmt(f.vendidos)}</td>
                  <td>${fmt(f.disponibles)}</td>
                  <td>${fmtMoney(f.ingresos)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderCompradores() {
    const rows = current.compradores || [];
    if (!rows.length) return "";
    return `
      <div class="card" style="padding: 24px; margin-bottom: 24px;">
        <h2 style="font-size: 1.25rem; margin-bottom: 12px;" data-i18n="report.compradores_lista">Compradores</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th data-i18n="report.col_comprador">Comprador</th>
                <th data-i18n="report.col_email">Email</th>
                <th data-i18n="report.transacciones">Transacciones</th>
                <th data-i18n="report.col_boletos">Boletos</th>
                <th data-i18n="report.col_gastado">Gastado</th>
                <th data-i18n="report.col_ultima">Última compra</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((c) => `
                <tr>
                  <td>${esc(c.nombre)}</td>
                  <td>${esc(c.email)}</td>
                  <td>${fmt(c.transacciones)}</td>
                  <td>${fmt(c.boletos)}</td>
                  <td>${fmtMoney(c.gastado)}</td>
                  <td>${esc(I18n.dateTime(c.ultima))}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderReembolsos() {
    const rows = current.reembolsos || [];
    if (!rows.length) {
      return `
        <div class="card" style="padding: 24px; margin-bottom: 24px;">
          <h2 style="font-size: 1.25rem; margin-bottom: 12px;" data-i18n="report.reembolsos_lista">Reembolsos</h2>
          <p class="text-muted">${esc(t("report.sin_reembolsos"))}</p>
        </div>`;
    }
    const estadoMap = { solicitado: "badge-info", aprobado: "badge-success", rechazado: "badge-error" };
    const estadoLabel = (estado) => {
      const label = t("report.refund_" + estado);
      return label.indexOf("report.refund_") === 0 ? estado : label;
    };
    const monto = rows.reduce((a, r) => a + (Number(r.monto) || 0), 0);
    return `
      <div class="card" style="padding: 24px; margin-bottom: 24px;">
        <div class="flex-between" style="margin-bottom: 12px;">
          <h2 style="font-size: 1.25rem;" data-i18n="report.reembolsos_lista">Reembolsos</h2>
          <span class="text-muted" style="font-size: 0.85rem;">${fmt(rows.length)} · ${fmtMoney(monto)}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th data-i18n="report.col_fecha">Fecha</th>
                <th data-i18n="report.col_transaccion">Transacción</th>
                <th data-i18n="report.col_comprador">Comprador</th>
                <th data-i18n="report.col_monto">Monto</th>
                <th data-i18n="report.col_motivo">Motivo</th>
                <th data-i18n="report.col_estado">Estado</th>
                <th data-i18n="report.col_autorizado">Autorizado por</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r) => `
                <tr>
                  <td>${esc(I18n.dateTime(r.creadoEn))}</td>
                  <td>${esc(r.transaccion || "—")}</td>
                  <td>${esc(r.comprador || r.email || "—")}</td>
                  <td>${fmtMoney(r.monto)}</td>
                  <td>${esc(r.motivo || "—")}</td>
                  <td><span class="badge ${estadoMap[r.estado] || "badge-info"}">${esc(estadoLabel(r.estado))}</span></td>
                  <td>${esc(r.adminNombre || "—")}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderTransacciones() {
    const rows = current.transacciones || [];
    if (!rows.length) {
      return `
        <div class="card" style="padding: 24px;">
          <h2 style="font-size: 1.25rem; margin-bottom: 12px;" data-i18n="report.transacciones_lista">Últimas transacciones</h2>
          <p class="text-muted">${esc(t("report.sin_ventas"))}</p>
        </div>`;
    }
    const metodoLabel = { card: "Card", transfer: "Transfer", cash: "Cash" };
    return `
      <div class="card" style="padding: 24px;">
        <h2 style="font-size: 1.25rem; margin-bottom: 12px;" data-i18n="report.transacciones_lista">Últimas transacciones</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th data-i18n="report.col_transaccion">Transacción</th>
                <th data-i18n="report.col_comprador">Comprador</th>
                <th data-i18n="report.col_boletos">Boletos</th>
                <th data-i18n="report.col_metodo">Método</th>
                <th data-i18n="report.col_total">Total</th>
                <th data-i18n="report.col_fecha">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((tr) => `
                <tr>
                  <td>${esc(tr.transaccion || tr.codigoReserva || "—")}</td>
                  <td>${esc(tr.comprador || tr.email || "—")}</td>
                  <td>${fmt(tr.boletos)}</td>
                  <td>${esc(metodoLabel[tr.metodoPago] || tr.metodoPago || "—")}</td>
                  <td>${fmtMoney(tr.total)}</td>
                  <td>${esc(I18n.dateTime(tr.creadaEn))}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  if (select) {
    select.addEventListener("change", () => cargarReporte(select.value));
  }
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }
  if (pdfBtn) {
    pdfBtn.addEventListener("click", async () => {
      if (!currentId) return;
      pdfBtn.disabled = true;
      const original = pdfBtn.innerHTML;
      pdfBtn.innerHTML = '<span class="material-symbols-outlined" style="animation:spin 1s linear infinite;">progress_activity</span>';
      try {
        const ev = current && current.evento ? current.evento : {};
        const nombre = (ev.nombre || "evento").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "evento";
        const result = await Api.descargarReporte("/admin/reportes/evento/" + encodeURIComponent(currentId) + ".pdf", "astro-tickets_reporte-" + nombre + ".pdf");
        showToast(t("report.downloaded") + " " + result.filename);
      } catch (err) {
        alert(err.message || "No se pudo descargar el reporte.");
      } finally {
        pdfBtn.innerHTML = original;
        pdfBtn.disabled = false;
      }
    });
  }

  window.addEventListener("astro:langchange", () => {
    if (currentId) cargarReporte(currentId);
    else cargarEventos();
  });

  cargarEventos();
})();
