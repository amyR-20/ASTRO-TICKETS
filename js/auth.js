clear/* ============================================================
   Astro Tickets — auth.js
   Gestión de sesión, usuarios y panel de administrador
   ============================================================ */

const Auth = (() => {

  /* ---------- Conexión al backend real ---------- */
  const API_BASE = "http://localhost:3000/api";
  const SESSION_KEY = "astro_session";
  const TOKEN_KEY = "astro_token";

  /**
   * Llama a POST /api/auth/login. Devuelve { token, usuario } si es
   * exitoso, o lanza un Error con el mensaje que mandó el backend.
   */
  async function loginRequest(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesión.");
    return data; // { token, usuario }
  }

  /**
   * Llama a POST /api/auth/registro. Devuelve { mensaje, usuario } si es
   * exitoso, o lanza un Error con el mensaje que mandó el backend.
   */
  async function registroRequest(nombre, email, password, password2) {
    const res = await fetch(`${API_BASE}/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password, password2 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al registrar la cuenta.");
    return data; // { mensaje, usuario }
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
            ${session.avatar}
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
          ${session.role === "admin" ? `
          <a href="admin.html" class="user-panel-action">
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

        const avatarBtn = document.createElement("button");
        avatarBtn.className = "nav-user-avatar";
        avatarBtn.innerHTML = session.avatar;
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
            ${session.role === "admin" ? `
            <a href="admin.html" class="user-panel-action">
              <span class="material-symbols-outlined">admin_panel_settings</span> Panel admin
            </a>` : ""}
            <button class="user-panel-action user-panel-logout" style="width: 100%; border: none; background: none; cursor: pointer;">
              <span class="material-symbols-outlined">logout</span> Cerrar sesión
            </button>
          </div>
        `;

        avatarBtn.addEventListener("click", (e) => {
          e.stopPropagation();
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

  /* ---------- Init on DOMContentLoaded ---------- */
  function init() {
    // Admin login form
    const adminForm = document.getElementById("admin-login-form");
    if (adminForm) {
      adminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("admin-email").value.trim();
        const password = document.getElementById("admin-password").value;
        const errorEl = document.getElementById("admin-login-error");

        try {
          const { token, usuario } = await loginRequest(email, password);
          if (usuario.role !== "admin") {
            if (errorEl) errorEl.style.display = "block";
            return;
          }
          setSession(usuario, token);
          window.location.href = "admin.html";
        } catch (err) {
          if (errorEl) errorEl.style.display = "block";
        }
      });
    }

    // Regular login form
    const loginForm = document.querySelector('form[data-redirect="catalogo.html"]');
    const loginEmail = document.getElementById("email");
    const loginPassword = document.getElementById("password");

    if (loginForm && loginEmail && loginPassword) {
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
    const regPassword = document.getElementById("password");
    const regPassword2 = document.getElementById("password2");

    if (regForm && regName && regEmail && regPassword && regPassword2) {
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = regName.value.trim();
        const email = regEmail.value.trim();
        const password = regPassword.value;
        const password2 = regPassword2.value;

        // Estas dos validaciones se pueden dejar en el cliente para dar
        // feedback inmediato, pero el backend las vuelve a validar igual.
        if (password !== password2) {
          alert("Las contraseñas no coinciden.");
          return;
        }
        if (password.length < 8) {
          alert("La contraseña debe tener al menos 8 caracteres.");
          return;
        }

        try {
          const data = await registroRequest(nombre, email, password, password2);
          alert(data.mensaje || "¡Cuenta creada! Ahora inicia sesión.");
          window.location.href = "index.html";
        } catch (err) {
          alert(err.message);
        }
      });
    }

    // Update navbars
    updateNavUser();

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
