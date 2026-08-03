/* ============================================================
   Astro Tickets — auth.js
   Gestión de sesión, usuarios y panel de administrador
   ============================================================ */

const Auth = (() => {

  /* ---------- Conexión al backend real ---------- */
  const API_BASE = AstroConfig.API_BASE;
  const SESSION_KEY = "astro_session";
  const TOKEN_KEY = "astro_token";

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  /**
   * Llama a POST /api/auth/login. Devuelve { token, usuario } si es
   * exitoso, o lanza un Error con el mensaje que mandó el backend.
   */
 async function loginRequest(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password
      })
    });

    const contentType = res.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(
        text || "El servidor devolvió una respuesta inválida."
      );
    }

    if (!res.ok) {
      throw new Error(
        data.error ||
        data.mensaje ||
        "Correo o contraseña incorrectos."
      );
    }

    if (!data.usuario) {
      throw new Error(
        "El servidor no devolvió los datos del usuario."
      );
    }

    if (!data.token) {
      throw new Error(
        "El servidor no devolvió el token de acceso."
      );
    }

    return data;

  } catch (err) {
    console.error("Error en loginRequest:", err);

    if (err instanceof TypeError) {
      throw new Error(
        "No se pudo conectar con el servidor. Verifica que npm run dev esté ejecutándose."
      );
    }

    throw err;
  }
}
  /**
   * Llama a POST /api/auth/registro. Devuelve { mensaje, usuario } si es
   * exitoso, o lanza un Error con el mensaje que mandó el backend.
   */
  async function registroRequest(username, nombre, email, password, password2) {
    try {
      const res = await fetch(`${API_BASE}/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, nombre, email, password, password2 }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || "El servidor devolvió una respuesta inválida.");
      }

      if (!res.ok) {
        throw new Error(data.error || data.mensaje || "Error al registrar la cuenta.");
      }

      return data; // { mensaje, usuario } — solo si el backend respondió 2xx
    } catch (err) {
      console.error("Error en registroRequest:", err);
      if (err instanceof TypeError) {
        throw new Error(
          "No se pudo conectar con el servidor. Verifica que npm run dev esté ejecutándose."
        );
      }
      throw err;
    }
  }

  /* ---------- Session ---------- */
  // "user" aquí es el objeto que devuelve el backend en data.usuario
  function setSession(user, token) {
    const session = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      avatarUrl: user.avatar_url || user.avatarUrl || null,
      username: user.username,
      loginAt: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (token) localStorage.setItem(TOKEN_KEY, token);
    return session;
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function isLoggedIn() {
    return getSession() !== null;
  }

  function isAdmin() {
    const s = getSession();
    return s && s.role === "admin";
  }

  function logout() {
    clearSession();
  }

  /* ---------- User panel HTML ---------- */
  function buildUserPanel(container) {
    const session = getSession();
    if (!session || !container) return;

    const colorMap = {
      admin: "var(--cosmic-purple)",
      user: "var(--nebula-pink)"
    };

    container.innerHTML = `
      <div class="user-panel">
        <div class="user-panel-header">
          <div class="user-panel-avatar" style="background: linear-gradient(135deg, ${colorMap[session.role] || colorMap.user}, var(--stellar-blue));">
            ${session.avatarUrl ? `<img src="${session.avatarUrl}" alt="">` : session.avatar}
          </div>
          <div class="user-panel-info">
            <p class="user-panel-name">${session.nombre}</p>
            <p class="user-panel-email">${session.email}</p>
            <span class="user-panel-role">${session.role === "admin" ? "Administrador" : "Usuario"}</span>
          </div>
        </div>
        <div class="user-panel-actions">
          <a href="catalogo.html" class="user-panel-action">
            <span class="material-symbols-outlined">confirmation_number</span>
            <span>Comprar boletos</span>
          </a>
          <a href="historial.html" class="user-panel-action">
            <span class="material-symbols-outlined">receipt_long</span>
            <span>Mis compras</span>
          </a>
          <a href="perfil.html" class="user-panel-action">
            <span class="material-symbols-outlined">manage_accounts</span>
            <span>Perfil y configuración</span>
          </a>
          ${session.role === "admin" ? `
          <a href="admin-login.html" class="user-panel-action">
            <span class="material-symbols-outlined">admin_panel_settings</span>
            <span>Panel admin</span>
          </a>` : ""}
          <button class="user-panel-action user-panel-logout" id="user-logout-btn">
            <span class="material-symbols-outlined">logout</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    `;

    const logoutBtn = container.querySelector("#user-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearSession();
        window.location.href = "index.html";
      });
    }
  }

  /* ---------- Update navbars with user info ---------- */
  function updateNavUser() {
    const session = getSession();
    document.querySelectorAll(".nav-links").forEach(nav => {
      const existingPanel = nav.querySelector(".user-panel-wrapper");
      if (existingPanel) existingPanel.remove();

      if (session) {
        // Remove login/register links, add user avatar
        const loginLink = nav.querySelector('a[href="index.html"]');
        const regLink = nav.querySelector('a[href="registro.html"]');
        const adminLink = nav.querySelector('a[href="admin-login.html"]');

        // Replace login link with user avatar dropdown
        const wrapper = document.createElement("div");
        wrapper.className = "user-panel-wrapper";
        wrapper.style.position = "relative";

        // Campana de notificaciones
        const bellWrap = document.createElement("div");
        bellWrap.className = "nav-bell-wrap";
        bellWrap.style.position = "relative";
        const bellBtn = document.createElement("button");
        bellBtn.className = "nav-user-avatar nav-bell-btn";
        bellBtn.title = "Notificaciones";
        bellBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.25rem;">notifications_none</span><span class="nav-bell-badge" style="display:none;"></span>';
        const bellPanel = document.createElement("div");
        bellPanel.className = "user-panel-dropdown nav-bell-panel";
        bellPanel.innerHTML = `
          <div style="padding:14px 16px;border-bottom:1px solid var(--color-outline-variant);">
            <strong style="font-size:0.9rem;">Notificaciones</strong>
          </div>
          <div class="nav-bell-list" style="max-height:320px;overflow-y:auto;"></div>
          <div style="padding:10px 16px;border-top:1px solid var(--color-outline-variant);text-align:right;">
            <button class="btn btn-ghost" style="padding:6px 10px;font-size:0.72rem;" data-bell-read-all>Marcar todas como leídas</button>
          </div>`;
        bellBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const wasOpen = bellPanel.classList.contains("show");
          document.querySelectorAll(".nav-bell-panel.show, .user-panel-dropdown.show").forEach((p) => p.classList.remove("show"));
          if (!wasOpen) {
            bellPanel.classList.add("show");
            cargarNotificaciones();
          }
        });
        bellPanel.addEventListener("click", (e) => e.stopPropagation());
        const readAllBtn = bellPanel.querySelector("[data-bell-read-all]");
        if (readAllBtn) {
          readAllBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (typeof Api !== "undefined" && Api.marcarNotificacionesLeidas) {
              try { await Api.marcarNotificacionesLeidas(); } catch (_) {}
            }
            cargarNotificaciones();
          });
        }
        bellWrap.appendChild(bellBtn);
        bellWrap.appendChild(bellPanel);
        wrapper.appendChild(bellWrap);

        const avatarBtn = document.createElement("button");
        avatarBtn.className = "nav-user-avatar";
        avatarBtn.innerHTML = session.avatarUrl ? `<img src="${session.avatarUrl}" alt="${session.nombre}">` : session.avatar;
        avatarBtn.title = session.nombre;

        const panel = document.createElement("div");
        panel.className = "user-panel-dropdown";
        panel.innerHTML = `
          <div style="padding: 16px; border-bottom: 1px solid var(--color-outline-variant);">
            <p style="font-weight: 600; font-size: 0.9rem;">${session.nombre}</p>
            <p class="text-muted" style="font-size: 0.78rem;">${session.email}</p>
          </div>
          <div style="padding: 8px;">
            <a href="catalogo.html" class="user-panel-action">
              <span class="material-symbols-outlined">confirmation_number</span> Comprar boletos
            </a>
            <a href="historial.html" class="user-panel-action">
              <span class="material-symbols-outlined">receipt_long</span> Mis compras
            </a>
            <a href="perfil.html" class="user-panel-action">
              <span class="material-symbols-outlined">manage_accounts</span> Perfil y configuración
            </a>
            ${session.role === "admin" ? `
            <a href="admin-login.html" class="user-panel-action">
              <span class="material-symbols-outlined">admin_panel_settings</span> Panel admin
            </a>` : ""}
            <button class="user-panel-action user-panel-logout" style="width: 100%; border: none; background: none; cursor: pointer;">
              <span class="material-symbols-outlined">logout</span> Cerrar sesión
            </button>
          </div>
        `;

        avatarBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          bellPanel.classList.remove("show");
          panel.classList.toggle("show");
        });

        document.addEventListener("click", () => panel.classList.remove("show"));

        const logoutBtnInner = panel.querySelector(".user-panel-logout");
        if (logoutBtnInner) {
          logoutBtnInner.addEventListener("click", () => {
            clearSession();
            window.location.href = "index.html";
          });
        }

        wrapper.appendChild(avatarBtn);
        wrapper.appendChild(panel);

        if (loginLink) loginLink.replaceWith(wrapper);
        if (regLink) regLink.remove();
        if (adminLink && session.role !== "admin") adminLink.remove();
      }
    });
  }

  /* ---------- Campana de notificaciones ---------- */
  async function cargarNotificaciones() {
    if (typeof Api === "undefined" || !Api.getNotificaciones) return;
    try {
      const data = await Api.getNotificaciones();
      const lista = data.notificaciones || [];
      const noLeidas = data.noLeidas || 0;

      document.querySelectorAll(".nav-bell-badge").forEach((b) => {
        b.textContent = noLeidas > 9 ? "9+" : String(noLeidas);
        b.style.display = noLeidas ? "" : "none";
      });

      document.querySelectorAll(".nav-bell-list").forEach((list) => {
        if (!lista.length) {
          list.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center;font-size:0.78rem;">No tienes notificaciones</div>';
          return;
        }
        list.innerHTML = lista.map((n) => `
          <div class="nav-bell-item${n.leida ? "" : " nav-bell-item-unread"}">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="material-symbols-outlined" style="font-size:1rem;color:var(--cosmic-purple);">${n.tipo === "reembolso" ? "currency_exchange" : "notifications"}</span>
              <strong style="font-size:0.82rem;">${n.titulo || ""}</strong>
            </div>
            <p class="text-muted" style="font-size:0.76rem;margin:4px 0 2px;">${n.mensaje || ""}</p>
            <span class="text-muted" style="font-size:0.68rem;">${new Date(n.creado_en).toLocaleString()}</span>
          </div>`).join("");
      });

      if (noLeidas) {
        try { await Api.marcarNotificacionesLeidas(); } catch (_) {}
      }
    } catch (_) { /* silencioso */ }
  }

  async function iniciarCampana() {
    if (typeof Api === "undefined" || !Api.getNotificaciones) return;
    try {
      const data = await Api.getNotificaciones();
      const noLeidas = data.noLeidas || 0;
      document.querySelectorAll(".nav-bell-badge").forEach((b) => {
        b.textContent = noLeidas > 9 ? "9+" : String(noLeidas);
        b.style.display = noLeidas ? "" : "none";
      });

      const reembolsosNuevos = (data.notificaciones || []).filter((n) => n.tipo === "reembolso" && !n.leida);
      if (reembolsosNuevos.length) {
        let vistos = new Set();
        try { vistos = new Set(JSON.parse(sessionStorage.getItem("astro_notif_toasted") || "[]")); } catch (_) {}
        const nuevo = reembolsosNuevos.find((n) => !vistos.has(String(n.id)));
        if (nuevo) {
          vistos.add(String(nuevo.id));
          try { sessionStorage.setItem("astro_notif_toasted", JSON.stringify([...vistos])); } catch (_) {}
          const msg = (nuevo.titulo || "Notificación") + ". " + (nuevo.mensaje || "");
          setTimeout(() => {
            if (typeof showToast === "function") showToast(msg);
            else alert(msg);
          }, 1200);
        }
      }
    } catch (_) { /* silencioso */ }
  }

  /* ---------- Init on DOMContentLoaded ---------- */
  function init() {

    /* ---------- Guard de páginas privadas ---------- */
    const page = (location.pathname.split("/").pop() || "").toLowerCase();
    const requiereAdmin = page === "admin.html" || page === "reporte-evento.html";
    const requiereSesion = page === "historial.html";

    // Los administradores no compran boletos: se les saca del catálogo,
    // del detalle del evento y del flujo de pago hacia su panel.
    const paginaDeCliente = ["catalogo.html", "evento.html", "pago.html", "comprobante.html"].includes(page);
    if (paginaDeCliente && isAdmin()) {
      location.replace("admin.html");
      return;
    }

    // La pantalla administrativa siempre comienza con una eleccion explicita.
    // Evita que una sesion anterior (por ejemplo, Victor) entre de forma
    // automatica cuando Amy o Sarah quieren usar su propia cuenta.
    if (page === "admin-login.html") {
      clearSession();
      try { sessionStorage.removeItem("astro_admin_entry"); } catch (_) {}
    }

    if (requiereAdmin) {
      // Solo administradores pueden abrir admin.html (un usuario normal
      // o un visitante sin sesión sale inmediatamente al login).
      if (!isAdmin()) {
        location.replace("admin-login.html");
        return;
      }
    } else if (requiereSesion) {
      if (!isLoggedIn()) {
        location.replace("index.html");
        return;
      }
    }

    // En páginas privadas se valida el token contra el backend. Si el
    // backend responde 401 (token inválido/expirado), api.js ya limpió
    // astro_token/astro_session y aquí se redirige al login.
    async function verificarTokenServidor() {
      try {
        if (typeof Api === "undefined" || !Api.perfil) return;
        await Api.perfil();
      } catch (err) {
        if (err && err.status === 401) {
          location.replace("index.html");
        }
      }
    }
    if (requiereAdmin || requiereSesion) verificarTokenServidor();

    // Admin login form
   const adminForm = document.getElementById("admin-login-form");

if (adminForm) {
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("admin-email");
    const passwordInput = document.getElementById("admin-password");
    const errorEl = document.getElementById("admin-login-error");

    const email = emailInput?.value.trim().toLowerCase();
    const password = passwordInput?.value;

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.style.display = "none";
    }

    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent =
          "Ingresa el correo y la contraseña.";
        errorEl.style.display = "block";
      }
      return;
    }

    try {
      const { token, usuario } =
        await loginRequest(email, password);

      console.log("Usuario recibido:", usuario);

      const role = String(usuario?.role || "")
        .trim()
        .toLowerCase();

      if (role !== "admin") {
        throw new Error(
          `Esta cuenta tiene el rol "${usuario?.role || "sin rol"}" y no es administradora.`
        );
      }

      setSession(
        {
          ...usuario,
          role
        },
        token
      );

      try { sessionStorage.setItem("astro_admin_entry", "selected"); } catch (_) {}

      window.location.href = "admin.html";

    } catch (err) {
      console.error("Error en login admin:", err);

      if (errorEl) {
        errorEl.textContent =
          err.message || "No fue posible iniciar sesión.";
        errorEl.style.display = "block";
      } else {
        alert(
          err.message || "No fue posible iniciar sesión."
        );
      }
    }
  });
}

    // Regular login form
    const loginForm = document.querySelector('form[data-redirect="catalogo.html"]');
    const loginEmail = document.getElementById("email");
    const loginPassword = document.getElementById("password");

    if (loginForm && loginEmail && loginPassword) {
      // Este formulario lo gestiona auth.js; main.js no debe forzar el
      // redirect genérico de 700ms (que navegaba aunque el login fallara).
      loginForm.dataset.authHandled = "true";
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const remember = document.getElementById("remember")?.checked;
        if (remember) {
          loginForm.autocomplete = "on";
          loginEmail.autocomplete = "email";
          loginPassword.autocomplete = "current-password";
        }
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        try {
          const { token, usuario } = await loginRequest(email, password);
          setSession(usuario, token);
          window.location.href = usuario.role === "admin" ? "admin.html" : "catalogo.html";
        } catch (err) {
          const errorDiv = loginForm.querySelector(".login-error");
          if (errorDiv) {
            errorDiv.textContent = err.message;
            errorDiv.style.display = "block";
          } else {
            alert(err.message);
          }
        }
      });
    }

    // Registration form
    const regForm = document.querySelector('form[data-redirect="index.html"]');
    const regName = document.getElementById("nombre");
    const regEmail = document.getElementById("email");
    const regUsername = document.getElementById("username");
    const regPassword = document.getElementById("password");
    const regPassword2 = document.getElementById("password2");

    if (regForm && regName && regUsername && regEmail && regPassword && regPassword2) {
      // Este formulario lo gestiona auth.js; main.js no debe forzar el
      // redirect genérico de 700ms (navegaba aunque el registro fallara).
      regForm.dataset.authHandled = "true";
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = regName.value.trim();
        const username = regUsername.value.trim().toLowerCase();
        const email = regEmail.value.trim().toLowerCase();
        const password = regPassword.value;
        const password2 = regPassword2.value;

        if (!EMAIL_REGEX.test(email)) {
          alert("Ingresa un correo electrónico válido.");
          return;
        }
        if (password !== password2) {
          alert("Las contraseñas no coinciden.");
          return;
        }
        if (!/^[a-z0-9_]{3,24}$/.test(username)) {
          alert("El usuario debe tener 3 a 24 caracteres: letras, números o guion bajo.");
          return;
        }
        if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
          alert("Usa 10 caracteres o más, con mayúscula, minúscula, número y símbolo.");
          return;
        }

        try {
          const data = await registroRequest(username, nombre, email, password, password2);
          alert(data.mensaje || "¡Cuenta creada! Ahora inicia sesión.");
          window.location.href = "index.html";
        } catch (err) {
          alert(err.message);
        }
      });
    }

    // Update navbars
    updateNavUser();
    iniciarCampana();

    // Build user panel if container exists
    const panelContainer = document.getElementById("user-panel-container");
    if (panelContainer) buildUserPanel(panelContainer);
  }

  return {
    init,
    getSession,
    getToken,
    isLoggedIn,
    isAdmin,
    logout,
    setSession,
    buildUserPanel
  };

})();

document.addEventListener("DOMContentLoaded", () => Auth.init());
