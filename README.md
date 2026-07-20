# Astro Tickets — Frontend

Prototipo de frontend estático (HTML + CSS + JS, sin frameworks) para el
**Sistema de Ventas de Boletas de Eventos** (Ingeniería de Software II, UNPHU).

## Estructura

```
├── index.html         Entrada: Inicio de sesión
├── registro.html       Entrada: Registro de usuario
├── catalogo.html        Salida: Listado de eventos disponibles + Entrada: Búsqueda de eventos
├── evento.html            Entrada: Compra de boletas (detalle de evento)
├── pago.html                Entrada: Datos de pago
├── comprobante.html    Salida: Comprobante de compra + Salida: Notificación de confirmación
├── historial.html          Salida: Historial de compras
├── admin.html               Entrada: Gestión de eventos + Salidas: reporte de ventas,
│                              boletos disponibles, ingresos generales, usuarios
│                              registrados y transacciones diarias
├── css/styles.css       Estilos compartidos (una sola hoja para todas las páginas)
└── js/main.js             Interacciones del prototipo (sin lógica de negocio real)
```

Cada archivo HTML solo contiene marcado. No hay CSS ni JS embebido: todas las
páginas enlazan `css/styles.css` y `js/main.js`.

## Qué se cambió respecto al export original de Stitch

El export original (`stitch_astros_ticket_portal.zip`) traía dos prototipos
(`code.html` de login y de panel admin) con CSS y Tailwind config duplicados
dentro de cada archivo, y con una narrativa "espacial" tomada literalmente
(usuarios llamados "Exploradores", fechas como "SOL 1–30", último acceso como
"Warp", botón "Manifestar Nuevo Portal", tarjeta de upsell "Pack de
Expansión", widget flotante de navegación entre prototipos, login social con
Google/Apple) que no tiene relación con los requisitos del documento —
un sistema real de venta de boletas para conciertos, teatro, deportes y
conferencias.

Cambios realizados:

1. **Separación de código**: se extrajo el CSS a `css/styles.css` y el JS a
   `js/main.js`. Los `<script>` de configuración de Tailwind (duplicados en
   cada archivo) se eliminaron y se sustituyeron por CSS con variables
   (`:root`), la misma paleta y tipografía del `DESIGN.md` original.
2. **Se quitó todo lo que no tenía sentido para el proyecto**: el
   vocabulario espacial literal, el login social, el widget flotante de
   navegación, el "Pack de Expansión" y demás relleno de marketing sin
   respaldo en los requisitos.
3. **Se unificaron las páginas sueltas en un solo sitio navegable**: el
   export solo traía login y admin; se agregaron las pantallas que hacían
   falta para que cada Entrada y Salida del documento tenga una página real
   (catálogo, detalle/compra, pago, comprobante, historial).
4. **Las Entradas y Salidas se reconstruyeron a partir del segundo
   documento** (`Requisitos_Ingenieria_software_2`), no de las capturas del
   Stitch export:
   - Entradas 1–6 (Registro, Login, Compra de boletas, Datos de pago,
     Búsqueda de eventos, Gestión de eventos) → cada una tiene su propia
     página/formulario con los campos exactos que lista el documento.
   - Salidas 1–9 (reporte de ventas por evento, comprobante de compra,
     historial de compras, listado de eventos disponibles, boletos
     disponibles por evento, ingresos generales, usuarios registrados,
     transacciones diarias, notificación de confirmación) → cada una es una
     sección o página real con datos de ejemplo.
   - Nota: en el documento, la **Salida 8** está titulada "Reporte de
     transacciones diarias" pero su descripción es la de una confirmación
     de compra (que ya es el contenido de la Salida 9). Se construyó la
     Salida 8 según su título (tabla de transacciones del día) para no
     duplicar la Salida 9, que sí quedó como la notificación de compra.
     Vale la pena revisar esa sección del documento con el equipo.
5. Se mantuvo la identidad visual (morado/rosa, "glassmorphism", tipografía
   Plus Jakarta Sans + Inter + Space Grotesk) porque es un sistema de diseño
   coherente y utilizable — solo se limpió el contenido y la estructura del
   código, no el estilo visual.

## Cómo verlo

Es HTML estático: abre `index.html` en el navegador, o sirve la carpeta con
cualquier servidor estático (ej. `python3 -m http.server`) para que los
enlaces relativos entre páginas funcionen bien.

## Conexión con el backend (Node.js + PostgreSQL)

Los formularios usan `data-redirect="pagina.html"` para simular en el
cliente lo que hará el backend (login, registro, compra, pago, gestión de
eventos). Cuando el equipo conecte el backend real, ese atributo se
reemplaza por una petición `fetch()` al endpoint correspondiente:

- Login → `POST /api/auth/login`
- Registro → `POST /api/auth/registro`
- Compra de boletas → `POST /api/compras`
- Datos de pago → `POST /api/pagos`
- Gestión de eventos (admin) → `POST /api/eventos`, `PUT /api/eventos/:id`

Las tablas y tarjetas con datos de ejemplo (usuarios, eventos, transacciones)
deben reemplazarse por los datos que devuelva la API sobre PostgreSQL.
