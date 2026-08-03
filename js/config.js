/* ============================================================
   Astro Tickets — js/config.js
   Configuración centralizada del frontend.
   ÚNICA fuente de verdad para la URL del backend (API_BASE).
   Se carga ANTES de auth.js y api.js en todas las páginas.

   Prioridad de resolución:
   1. window.ASTRO_API_BASE  (si se define en la página / deploy)
   2. URL de producción       (PROD_API_BASE, editar aquí al publicar)
   3. http://localhost:3000/api (desarrollo local, detección automática)
   ============================================================ */

const AstroConfig = (() => {
  /* Edita esta línea al publicar el backend (ej. Render):
     "https://tu-app.onrender.com/api" */
  const PROD_API_BASE = "https://TU-BACKEND-URL-AQUI.onrender.com/api";

  const isLocal = () => {
    const h = (window.location.hostname || "").toLowerCase();
    const isFile = window.location.protocol === "file:";
    return isFile || h === "localhost" || h === "127.0.0.1" || h === "::1";
  };

  const API_BASE =
    typeof window.ASTRO_API_BASE === "string" && window.ASTRO_API_BASE.trim()
      ? window.ASTRO_API_BASE.trim().replace(/\/+$/, "")
      : isLocal()
        ? "http://localhost:3000/api"
        : PROD_API_BASE;

  return { API_BASE };
})();
