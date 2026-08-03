/* ============================================================
   Astro Tickets — sql/004_usuarios_rastreo.sql (Fase 2)
   Trazabilidad de usuarios + tabla de auditoría de accesos.
   No destructivo. No elimina datos.
   ============================================================ */

BEGIN;

-- usuarios: trazabilidad
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultimo_login  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'suspendido'));
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);

-- accesos_usuarios: auditoría de intentos de acceso.
-- Nunca guarda contraseñas, hashes, tokens ni secretos.
CREATE TABLE IF NOT EXISTS accesos_usuarios (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  email_intentado VARCHAR(255) NOT NULL,
  exitoso         BOOLEAN NOT NULL DEFAULT false,
  metodo          VARCHAR(20) NOT NULL DEFAULT 'password'
                  CHECK (metodo IN ('password', 'google')),
  motivo_fallo    VARCHAR(100),
  ip              VARCHAR(45),
  user_agent      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accesos_usuario_id ON accesos_usuarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_accesos_email ON accesos_usuarios(email_intentado);

COMMIT;
