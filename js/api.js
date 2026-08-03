/* ============================================================
   Astro Tickets — js/api.js
   Helpers de fetch para conectar el frontend con el backend.
   Se carga DESPUÉS de auth.js para poder usar Auth.getToken().
   ============================================================ */

const Api = (() => {

  const API_BASE = "http://localhost:3000/api";

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    headers["Content-Type"] = "application/json";

    // Si hay sesión, mandamos el token (para crear eventos y comprar)
    if (typeof Auth !== "undefined" && Auth.getToken) {
      const token = Auth.getToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }

    const res = await fetch(API_BASE + path, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

    if (!res.ok) {
      // 401: sesión inválida o expirada. Limpieza centralizada de las
      // credenciales; la página decide si además redirige al login.
      if (res.status === 401) {
        if (typeof Auth !== "undefined" && Auth.clearSession) {
          Auth.clearSession();
        } else {
          try {
            localStorage.removeItem("astro_token");
            localStorage.removeItem("astro_session");
          } catch (_) {}
        }
      }
      const err = new Error(data.error || data.mensaje || "Error de conexión con el servidor.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- Autenticación ---------- */
  async function perfil() {
    return request("/auth/perfil");
  }

  /* ---------- Eventos ---------- */
  async function getEventos(estado) {
    const q = estado ? "?estado=" + encodeURIComponent(estado) : "";
    const data = await request("/eventos" + q);
    return data.eventos || [];
  }

  async function getEvento(id) {
    const data = await request("/eventos/" + encodeURIComponent(id));
    return data.evento;
  }

  async function crearEvento(datos) {
    return request("/eventos", { method: "POST", body: datos });
  }

  async function actualizarEvento(id, datos) {
    return request("/eventos/" + encodeURIComponent(id), { method: "PUT", body: datos });
  }

  async function eliminarEvento(id) {
    return request("/eventos/" + encodeURIComponent(id), { method: "DELETE" });
  }

  /* ---------- Órdenes / compras ---------- */
  async function crearOrden(datos) {
    return request("/ordenes", { method: "POST", body: datos });
  }

  async function getMisCompras() {
    const data = await request("/ordenes/mis-compras");
    return data.compras || [];
  }

  return {
    perfil,
    getEventos,
    getEvento,
    crearEvento,
    actualizarEvento,
    eliminarEvento,
    crearOrden,
    getMisCompras,
  };

})();
