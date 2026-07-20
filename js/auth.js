/* ============================================================
   Astro Tickets — auth.js
   Gestión de sesión, usuarios y panel de administrador
   ============================================================ */

const Auth = (() => {

  /* ---------- Usuarios de demo (localStorage) ---------- */
  const USERS_KEY = "astro_users";
  const SESSION_KEY = "astro_session";

  const DEFAULT_USERS = [
    { id: 1, nombre: "Administrador", email: "admin@astro.com", password: "admin123", role: "admin", avatar: "AD" },
    { id: 2, nombre: "Aris Torres", email: "aris@correo.com", password: "12345678", role: "user", avatar: "AT" },
    { id: 3, nombre: "Kaelen Vargas", email: "vox@correo.com", password: "12345678", role: "user", avatar: "KV" },
  ];

  function getUsers() {
    const stored = localStorage.getItem(USERS_KEY);
    if (!stored) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return [...DEFAULT_USERS];
    }
    return JSON.parse(stored);
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function findUser(email, password) {
    const users = getUsers();
    return users.find(u => u.email === email && u.password === password);
  }

  function findUserByEmail(email) {
    const users = getUsers();
    return users.find(u => u.email === email);
  }

  function createUser(nombre, email, password) {
    const users = getUsers();
    if (users.find(u => u.email === email)) return null;
    const initials = nombre.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
    const newUser = {
      id: users.length + 1,
      nombre,
      email,
      password,
      role: "user",
      avatar: initials
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
  }

  /* ---------- Session ---------- */
  function setSession(user) {
    const session = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      loginAt: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
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
      adminForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("admin-email").value.trim();
        const password = document.getElementById("admin-password").value;
        const errorEl = document.getElementById("admin-login-error");

        const user = findUser(email, password);
        if (user && user.role === "admin") {
          setSession(user);
          window.location.href = "admin.html";
        } else {
          if (errorEl) errorEl.style.display = "block";
        }
      });
    }

    // Regular login form
    const loginForm = document.querySelector('form[data-redirect="catalogo.html"]');
    const loginEmail = document.getElementById("email");
    const loginPassword = document.getElementById("password");

    if (loginForm && loginEmail && loginPassword) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        const user = findUser(email, password);

        if (user) {
          setSession(user);
          if (user.role === "admin") {
            window.location.href = "admin.html";
          } else {
            window.location.href = "catalogo.html";
          }
        } else {
          // Try creating the user if coming from registration
          // For login, show error (simple alert for demo)
          const errorDiv = loginForm.querySelector(".login-error");
          if (errorDiv) {
            errorDiv.style.display = "block";
          } else {
            // Check if user doesn't exist, suggest registration
            const existing = findUserByEmail(email);
            if (!existing) {
              alert("No existe una cuenta con este correo. Regístrate primero.");
            } else {
              alert("Contraseña incorrecta. Intenta de nuevo.");
            }
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
      regForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const nombre = regName.value.trim();
        const email = regEmail.value.trim();
        const password = regPassword.value;
        const password2 = regPassword2.value;

        if (password !== password2) {
          alert("Las contraseñas no coinciden.");
          return;
        }

        if (password.length < 8) {
          alert("La contraseña debe tener al menos 8 caracteres.");
          return;
        }

        const newUser = createUser(nombre, email, password);
        if (newUser) {
          alert("¡Cuenta creada! Ahora inicia sesión.");
          window.location.href = "index.html";
        } else {
          alert("Este correo ya está registrado. Inicia sesión.");
          window.location.href = "index.html";
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
    isLoggedIn,
    isAdmin,
    logout,
    setSession,
    getUsers,
    createUser,
    buildUserPanel
  };

})();

document.addEventListener("DOMContentLoaded", () => Auth.init());
