document.addEventListener("DOMContentLoaded", async () => {
  if (!Auth.getToken()) return location.replace("index.html");
  const $ = (id) => document.getElementById(id);
  let avatarUrl = null;
  const renderAvatar = (usuario) => {
    const preview = $("profile-preview");
    if (avatarUrl) preview.innerHTML = `<img src="${avatarUrl}" alt="Foto de ${usuario.nombre}">`;
    else preview.textContent = usuario.avatar || usuario.nombre.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase();
  };
  try {
    const { usuario } = await Api.perfil();
    avatarUrl = usuario.avatar_url || null;
    $("profile-name").value = usuario.nombre || ""; $("profile-username").value = usuario.username || ""; $("profile-email").value = usuario.email || ""; $("profile-bio").value = usuario.bio || "";
    $("profile-heading").textContent = usuario.nombre; $("profile-role").textContent = usuario.role === "admin" ? "Administrador" : "Usuario"; renderAvatar(usuario);

    const langSel = $("prefs-lang"), themeSel = $("prefs-theme");
    if (langSel) langSel.value = usuario.idioma_pref || "es";
    if (themeSel) themeSel.value = usuario.tema_pref || "auto";
    const aplicarTema = () => {
      const t = (themeSel && themeSel.value) || "auto";
      const finalT = t === "auto" ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
      document.documentElement.setAttribute("data-theme", finalT);
    };
    if (themeSel) themeSel.addEventListener("change", aplicarTema);
    if (langSel || themeSel) {
      $("prefs-form").addEventListener("submit", async (event) => {
        event.preventDefault(); const button = event.submitter; button.disabled = true; $("prefs-status").textContent = "Guardando…";
        try {
          const idioma = langSel ? langSel.value : undefined, tema = themeSel ? themeSel.value : undefined;
          const data = await Api.actualizarPreferencias({ idioma, tema });
          if (idioma) { try { localStorage.setItem("astro_lang", idioma); } catch (_) {} }
          if (tema) { try { localStorage.setItem("astro_theme", tema); } catch (_) {} }
          if (typeof Auth !== "undefined" && Auth.setSession) Auth.setSession({ ...data.usuario }, Auth.getToken());
          $("prefs-status").textContent = "Preferencias guardadas.";
          aplicarTema();
        } catch (error) { $("prefs-status").textContent = error.message; }
        finally { button.disabled = false; }
      });
    }

    $("profile-photo").addEventListener("change", (event) => {
      const file = event.target.files[0]; if (!file) return;
      if (file.size > 700 * 1024) { alert("La foto debe pesar menos de 700 KB."); event.target.value = ""; return; }
      const reader = new FileReader(); reader.onload = () => { avatarUrl = reader.result; renderAvatar(usuario); }; reader.readAsDataURL(file);
    });
    $("profile-photo-remove").onclick = () => { avatarUrl = null; renderAvatar(usuario); };
    $("profile-form").addEventListener("submit", async (event) => {
      event.preventDefault(); const button = event.submitter; button.disabled = true; $("profile-status").textContent = "Guardando…";
      try {
        const data = await Api.actualizarPerfil({ nombre: $("profile-name").value, username: $("profile-username").value, bio: $("profile-bio").value, avatarUrl });
        Auth.setSession(data.usuario, Auth.getToken()); $("profile-status").textContent = "Cambios guardados correctamente."; $("profile-heading").textContent = data.usuario.nombre;
      } catch (error) { $("profile-status").textContent = error.message; }
      finally { button.disabled = false; }
    });
  } catch (error) { $("profile-status").textContent = error.message; }
});

/* ============ Mis reembolsos ============ */
document.addEventListener("DOMContentLoaded", async () => {
  const section = document.getElementById("reembolsos-seccion");
  const container = document.getElementById("reembolsos-container");
  if (!section || !container) return;
  if (!Auth.getToken()) return;
  const sesion = Auth.getSession();
  if (sesion && sesion.role === "admin") { section.hidden = true; return; }

  const fmtMoney = (n) => "RD$ " + (Number(n) || 0).toLocaleString("es-DO");
  const t = (k) => (typeof I18n !== "undefined" && I18n.t ? I18n.t(k) : k);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fechaHora = (d) => (typeof I18n !== "undefined" && I18n.dateTime ? I18n.dateTime(d) : new Date(d).toLocaleString());
  const soloFecha = (d) => (typeof I18n !== "undefined" && I18n.date ? I18n.date(d) : new Date(d).toLocaleDateString());
  const estadoBadge = (estado) => {
    const map = { solicitado: "badge-info", aprobado: "badge-success", rechazado: "badge-error" };
    let label = t("report.refund_" + estado);
    if (label.indexOf("report.refund_") === 0) label = estado;
    return `<span class="badge ${map[estado] || "badge-info"}">${esc(label)}</span>`;
  };

  async function cargar() {
    container.innerHTML = `<p class="text-muted">${esc(t("reembolsos.loading"))}</p>`;
    try {
      const data = await Api.getMisReembolsos();
      const reembolsables = data.reembolsables || [];
      const reembolsos = data.reembolsos || [];
      let html = "";

      if (reembolsos.length) {
        html += `<h3 style="font-size:1rem;margin:18px 0 10px;">${esc(t("reembolsos.historial"))}</h3>
          <div class="table-wrap"><table>
            <thead><tr>
              <th>${esc(t("reembolsos.col_evento"))}</th>
              <th>${esc(t("reembolsos.col_monto"))}</th>
              <th>${esc(t("reembolsos.col_motivo"))}</th>
              <th>${esc(t("reembolsos.col_estado"))}</th>
              <th>${esc(t("reembolsos.col_fecha"))}</th>
            </tr></thead>
            <tbody>
              ${reembolsos.map((r) => `
                <tr>
                  <td>${esc(r.evento_nombre)}</td>
                  <td>${fmtMoney(r.monto)}</td>
                  <td>${esc(r.motivo || "—")}</td>
                  <td>${estadoBadge(r.estado)}</td>
                  <td>${esc(fechaHora(r.creado_en))}</td>
                </tr>`).join("")}
            </tbody>
          </table></div>`;
      } else {
        html += `<p class="text-muted" style="margin:14px 0;">${esc(t("reembolsos.no_requests"))}</p>`;
      }

      if (reembolsables.length) {
        html += `<h3 style="font-size:1rem;margin:18px 0 10px;">${esc(t("reembolsos.reembolsables"))}</h3>
          <div class="table-wrap"><table>
            <thead><tr>
              <th>${esc(t("reembolsos.col_evento"))}</th>
              <th>${esc(t("reembolsos.col_fecha"))}</th>
              <th>${esc(t("reembolsos.col_total"))}</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${reembolsables.map((o) => `
                <tr>
                  <td>${esc(o.evento_nombre)}</td>
                  <td>${esc(soloFecha(o.evento_fecha))}</td>
                  <td>${fmtMoney(o.total)}</td>
                  <td style="text-align:right;">
                    <button class="btn btn-ghost" style="padding:8px 12px;" data-solicitar-reembolso="${esc(o.id)}">
                      <span class="material-symbols-outlined">currency_exchange</span> ${esc(t("reembolsos.request"))}
                    </button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table></div>`;
      } else if (!reembolsos.length) {
        html = `<p class="text-muted" style="margin:14px 0;">${esc(t("reembolsos.no_orders"))}</p>`;
      }

      container.innerHTML = html || `<p class="text-muted" style="margin:14px 0;">${esc(t("reembolsos.no_orders"))}</p>`;

      container.querySelectorAll("[data-solicitar-reembolso]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const motivo = window.prompt(t("reembolsos.motivo_prompt"));
          if (motivo === null) return;
          btn.disabled = true;
          try {
            await Api.solicitarReembolso({ ordenId: btn.dataset.solicitarReembolso, motivo: motivo.trim() || null });
            showToast(t("reembolsos.request_done"));
            cargar();
          } catch (err) {
            alert(err.message || t("reembolsos.request_error"));
          } finally { btn.disabled = false; }
        });
      });
    } catch (err) {
      container.innerHTML = `<p class="text-muted" style="margin:14px 0;">${esc(err.message || t("reembolsos.request_error"))}</p>`;
    }
  }

  cargar();
  window.addEventListener("astro:langchange", cargar);
});
