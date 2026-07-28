# Astro Tickets — Backend

Backend en Node.js + Express + PostgreSQL para el Sistema de Venta de
Boletas de Eventos. Por ahora incluye el **módulo de autenticación**
(registro, login, sesión con JWT); el resto (eventos, compras, pagos,
reportes admin) se agrega siguiendo el mismo patrón de carpetas.

## Estructura

```
├── server.js                  Punto de entrada
├── config/database.js         Conexión a PostgreSQL (pool de "pg")
├── models/usuarioModel.js     Queries SQL de la tabla usuarios
├── controllers/authController.js   Lógica de registro / login
├── middleware/authMiddleware.js    Verifica JWT y rol admin
├── routes/authRoutes.js       Define /api/auth/*
├── sql/001_usuarios.sql       Script para crear la tabla usuarios
├── seed.js                    Crea el usuario admin inicial
└── .env.example                Variables de entorno necesarias
```

## Instalación

1. Instala las dependencias:
   ```
   npm install
   ```

2. Crea la base de datos en PostgreSQL (si no existe):
   ```
   createdb astro_tickets
   ```

3. Copia `.env.example` a `.env` y coloca tus datos reales
   (conexión a la BD y un `JWT_SECRET` propio, no el de ejemplo):
   ```
   cp .env.example .env
   ```

4. Crea la tabla de usuarios:
   ```
   psql -U tu_usuario -d astro_tickets -f sql/001_usuarios.sql
   ```

5. Crea el usuario administrador inicial (admin@astro.com / admin123):
   ```
   node seed.js
   ```

6. Levanta el servidor:
   ```
   npm run dev
   ```
   Debería salir: `Servidor corriendo en http://localhost:3000`

## Probar los endpoints

Con el servidor corriendo, prueba con `curl` (o Postman/Thunder Client):

**Registro**
```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Aris Torres","email":"aris@correo.com","password":"12345678","password2":"12345678"}'
```

**Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@astro.com","password":"admin123"}'
```
Respuesta esperada: un `token` (JWT) + los datos del usuario.

**Perfil (ruta protegida, requiere el token del login)**
```bash
curl http://localhost:3000/api/auth/perfil \
  -H "Authorization: Bearer PEGA_AQUI_EL_TOKEN"
```

## Conectar con el frontend (ASTRO-TICKETS)

En `js/auth.js`, reemplaza las funciones que usan `localStorage`
(`findUser`, `createUser`, `setSession`) por `fetch()` a estos endpoints:

```js
// Login
const res = await fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});
const data = await res.json();
if (res.ok) {
  localStorage.setItem("astro_session", JSON.stringify(data.usuario));
  localStorage.setItem("astro_token", data.token); // guardar el JWT
  window.location.href = data.usuario.role === "admin" ? "admin.html" : "catalogo.html";
} else {
  alert(data.error);
}
```

```js
// Registro
const res = await fetch("http://localhost:3000/api/auth/registro", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nombre, email, password, password2 })
});
const data = await res.json();
if (res.ok) {
  alert(data.mensaje);
  window.location.href = "index.html";
} else {
  alert(data.error);
}
```

Nota: el `role` y `avatar` que necesita `updateNavUser()` /
`buildUserPanel()` ya vienen en `data.usuario` desde el login, así que
esa parte del frontend casi no cambia — solo cambia de dónde saca el
dato (de la API en vez de `localStorage`).

## Siguiente paso

Con esto ya tienes el patrón completo (rutas → controller → model → BD)
para replicar en los módulos que faltan: `eventos`, `compras`, `pagos` y
`reportes` (admin). Dime cuándo quieres que sigamos con el siguiente.
