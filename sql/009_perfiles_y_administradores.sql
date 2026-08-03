BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bio VARCHAR(240);

-- Tres identidades administrativas, usando las cuentas existentes para conservar sus contraseñas.
UPDATE usuarios SET role='admin', updated_at=now() WHERE lower(username) IN ('amy','sarah');
UPDATE usuarios SET username='victor', nombre='Víctor', role='admin', updated_at=now()
 WHERE lower(email)='admin@astro.com' AND lower(username)='administrador';

COMMIT;
