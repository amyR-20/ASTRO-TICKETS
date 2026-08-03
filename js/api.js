/* ============================================================
   Astro Tickets — js/api.js
   Helpers de fetch para conectar el frontend con el backend.
   Se carga DESPUÉS de auth.js para poder usar Auth.getToken().
   ============================================================ */

const Api = (() => {

  const API_BASE = AstroConfig.API_BASE;

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

  async function actualizarPerfil(datos) {
    return request("/auth/perfil", { method: "PUT", body: datos });
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

  async function getFuncion(id) {
    return request("/funciones/" + encodeURIComponent(id));
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

  async function stripeConfig() {
    return request("/pagos/config");
  }

  async function crearIntentoPago(funcionId) {
    return request("/pagos/intents", { method: "POST", body: { funcionId } });
  }

  async function getMisCompras() {
    const data = await request("/ordenes/mis-compras");
    return data.compras || [];
  }

  async function getOrden(id) {
    const data = await request("/ordenes/" + encodeURIComponent(id));
    return data.orden;
  }

  async function reenviarOrden(id) {
    return request("/ordenes/" + encodeURIComponent(id) + "/reenviar", { method: "POST" });
  }

  /* ---------- Funciones / reservas ---------- */
  /** Reserva asientos para una función (requiere sesión). */
  async function reservarAsientos(funcionId, asientos) {
    return request(
      "/funciones/" + encodeURIComponent(funcionId) + "/reservar",
      { method: "POST", body: { asientos } }
    );
  }

  /** Libera las reservas del usuario para una función. */
  async function cancelarReservas(funcionId, asientos) {
    return request(
      "/funciones/" + encodeURIComponent(funcionId) + "/reservas",
      { method: "DELETE", body: { asientos } }
    );
  }

  async function getMisReservas(funcionId) {
    return request("/funciones/" + encodeURIComponent(funcionId) + "/mis-reservas");
  }

  /* ---------- Entradas (PDF / QR) ---------- */
  /** Descarga el PDF de una entrada por su código. */
  async function descargarPdfEntrada(codigo) {
    const headers = {};
    if (typeof Auth !== "undefined" && Auth.getToken) {
      const token = Auth.getToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }
    const res = await fetch(API_BASE + "/entradas/" + encodeURIComponent(codigo) + "/pdf", { headers });
    if (!res.ok) {
      let msg = "Error al descargar la entrada.";
      try { const d = await res.json(); msg = d.error || msg; } catch (_) {}
      if (res.status === 401 && typeof Auth !== "undefined" && Auth.clearSession) Auth.clearSession();
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entrada-" + codigo + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  /** Reenvía el PDF de una entrada por correo. */
  async function reenviarPdfEntrada(codigo) {
    return request("/entradas/" + encodeURIComponent(codigo) + "/reenviar", { method: "POST" });
  }

  /** Obtiene la imagen QR (PNG) de una entrada como data URL. */
  async function qrDataUrl(codigo) {
    const headers = {};
    if (typeof Auth !== "undefined" && Auth.getToken) {
      const token = Auth.getToken();
      if (token) headers["Authorization"] = "Bearer " + token;
    }
    const res = await fetch(API_BASE + "/entradas/" + encodeURIComponent(codigo) + "/qr", { headers });
    if (!res.ok) {
      let msg = "Error al obtener el QR.";
      try { const d = await res.json(); msg = d.error || msg; } catch (_) {}
      if (res.status === 401 && typeof Auth !== "undefined" && Auth.clearSession) Auth.clearSession();
      throw new Error(msg);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer el QR."));
      reader.readAsDataURL(blob);
    });
  }

  /** Valida una entrada en el acceso (solo admin). */
  async function validarEntrada(qrToken) {
    return request("/entradas/validar", { method: "POST", body: { qrToken } });
  }

  /* ---------- Panel admin ---------- */
  async function getAdminDashboard() {
    return request("/admin/dashboard");
  }

  async function getAdminResumen() {
    return request("/admin/resumen");
  }

  async function descargarReporte(path, filename) {
    const headers={}; const token=typeof Auth!=="undefined"&&Auth.getToken?Auth.getToken():null;
    if(!token) throw new Error("Tu sesion administrativa vencio. Vuelve a elegir tu perfil.");
    if(token) headers.Authorization="Bearer "+token;
    const res=await fetch(API_BASE+path,{headers});
    if(!res.ok){let data={};try{data=await res.json();}catch(_){}throw new Error(data.error||"No se pudo descargar el reporte.");}
    const blob=await res.blob();
    if(!blob.size) throw new Error("El servidor devolvio un reporte vacio.");
    const type=(res.headers.get("content-type")||"").toLowerCase();
    if(path.endsWith(".pdf")&&!type.includes("application/pdf")) throw new Error("El servidor no genero un PDF valido.");
    const disposition=res.headers.get("content-disposition")||"";
    const serverName=disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)?.[1];
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=decodeURIComponent(serverName||filename);a.style.display="none";document.body.appendChild(a);a.click();const downloadedName=a.download;a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    return {filename:downloadedName,size:blob.size,type:blob.type};
  }

  return {
    perfil,
    actualizarPerfil,
    getEventos,
    getEvento,
    getFuncion,
    crearEvento,
    actualizarEvento,
    eliminarEvento,
    crearOrden,
    stripeConfig,
    crearIntentoPago,
    getMisCompras,
    getOrden,
    reenviarOrden,
    reservarAsientos,
    cancelarReservas,
    getMisReservas,
    descargarPdfEntrada,
    reenviarPdfEntrada,
    qrDataUrl,
    validarEntrada,
    getAdminDashboard,
    getAdminResumen,
    descargarReporte,
  };

})();
