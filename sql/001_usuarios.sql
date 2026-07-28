-- ============================================================
-- Astro Tickets — Esquema: usuarios
-- ============================================================
-- Ejecutar con: psql -U tu_usuario -d astro_tickets -f sql/001_usuarios.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100)        NOT NULL,
    email         VARCHAR(150)        NOT NULL UNIQUE,
    password_hash TEXT                NOT NULL,
    role          VARCHAR(20)         NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
    avatar        VARCHAR(4)          NOT NULL,
    creado_en     TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Usuario admin de arranque (contraseña: admin123)
-- El hash se genera desde Node con bcrypt; este INSERT es solo un ejemplo
-- de referencia. Usa el script seed.js del backend en su lugar (ver README).
