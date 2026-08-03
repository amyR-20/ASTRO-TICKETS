/* ============================================================
   Astro Tickets — sql/008_funciones_zonas_entradas.sql
   Bloques A, B, G (y soporte E/F).
   - funciones_evento: capacidad, venta_habilitada, estado activa/finalizada
   - zonas: funcion_id (zonas por función, clonadas), precios reales
   - entradas: qr_token, usado_en, estado reembolsada
   No destructivo: ALTER TABLE + backfill. Sin DROP TABLE.
   ============================================================ */

BEGIN;

-- ------------------------------------------------------------
-- 1. FUNCIONES_EVENTO: capacidad + venta_habilitada
-- ------------------------------------------------------------
ALTER TABLE funciones_evento
  ADD COLUMN IF NOT EXISTS capacidad INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS venta_habilitada BOOLEAN NOT NULL DEFAULT true;

UPDATE funciones_evento f
   SET capacidad = (SELECT count(*) FROM asientos a WHERE a.funcion_id = f.id)
 WHERE capacidad = 0;

-- ------------------------------------------------------------
-- 2. FUNCIONES_EVENTO: estado con 'activa' y 'finalizada'
--    (mapeo en_venta -> activa; el CHECK anterior se reemplaza)
-- ------------------------------------------------------------
ALTER TABLE funciones_evento DROP CONSTRAINT IF EXISTS funciones_evento_estado_check;
UPDATE funciones_evento SET estado = 'activa' WHERE estado = 'en_venta';
ALTER TABLE funciones_evento
  ADD CONSTRAINT funciones_evento_estado_check
  CHECK (estado IN ('programada', 'activa', 'agotada', 'cancelada', 'finalizada'));

-- ------------------------------------------------------------
-- 3. ZONAS: por función (funcion_id NULL = plantilla del evento)
-- ------------------------------------------------------------
ALTER TABLE zonas
  ADD COLUMN IF NOT EXISTS funcion_id INTEGER REFERENCES funciones_evento(id) ON DELETE CASCADE;

-- Clonar la plantilla de zonas del evento a cada función (sin duplicar)
INSERT INTO zonas (evento_id, funcion_id, nombre, color, precio, cantidad, descripcion)
SELECT z.evento_id, f.id, z.nombre, z.color, z.precio, z.cantidad, z.descripcion
FROM zonas z
JOIN funciones_evento f ON f.evento_id = z.evento_id
WHERE z.funcion_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM zonas z2
    WHERE z2.funcion_id = f.id AND lower(z2.nombre) = lower(z.nombre)
  );

CREATE INDEX IF NOT EXISTS idx_zonas_funcion ON zonas(funcion_id);

-- ------------------------------------------------------------
-- 4. PRECIOS REALES de los eventos existentes
-- ------------------------------------------------------------
-- Jazz
UPDATE zonas SET precio = 2500 WHERE evento_id='evt-demo-jazz' AND lower(nombre)='platino';
UPDATE zonas SET precio = 1800 WHERE evento_id='evt-demo-jazz' AND lower(nombre)='vip';
UPDATE zonas SET precio = 1200 WHERE evento_id='evt-demo-jazz' AND lower(nombre)='general';
-- Ritmo Urbano
UPDATE zonas SET precio = 8500 WHERE evento_id='evt-demo-urbano' AND lower(nombre)='platino';
UPDATE zonas SET precio = 5500 WHERE evento_id='evt-demo-urbano' AND lower(nombre)='vip';
UPDATE zonas SET precio = 3000 WHERE evento_id='evt-demo-urbano' AND lower(nombre)='general';
-- Hamlet
UPDATE zonas SET precio = 1500 WHERE evento_id='evt-demo-hamlet' AND lower(nombre)='platino';
UPDATE zonas SET precio = 1000 WHERE evento_id='evt-demo-hamlet' AND lower(nombre)='vip';
UPDATE zonas SET precio =  700 WHERE evento_id='evt-demo-hamlet' AND lower(nombre)='general';
-- Clásico de Baloncesto
UPDATE zonas SET precio = 1500 WHERE evento_id='evt-demo-baloncesto' AND lower(nombre)='platino';
UPDATE zonas SET precio = 1000 WHERE evento_id='evt-demo-baloncesto' AND lower(nombre)='vip';
UPDATE zonas SET precio =  500 WHERE evento_id='evt-demo-baloncesto' AND lower(nombre)='general';
-- Conferencia de Innovación Digital
UPDATE zonas SET precio = 1500 WHERE evento_id='evt-demo-conferencia' AND lower(nombre)='vip';
UPDATE zonas SET precio =  800 WHERE evento_id='evt-demo-conferencia' AND lower(nombre)='general';
-- Sinfónica de Otoño
UPDATE zonas SET precio = 2500 WHERE evento_id='evt-demo-sinfonica' AND lower(nombre)='platino';
UPDATE zonas SET precio = 1730 WHERE evento_id='evt-demo-sinfonica' AND lower(nombre)='vip';
UPDATE zonas SET precio = 1200 WHERE evento_id='evt-demo-sinfonica' AND lower(nombre)='general';

-- ------------------------------------------------------------
-- 5. ENTRADAS: qr_token, usado_en, estado reembolsada
-- ------------------------------------------------------------
ALTER TABLE entradas
  ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS usado_en TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_entradas_qr_token
  ON entradas(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entradas_qr_token ON entradas(qr_token);

ALTER TABLE entradas DROP CONSTRAINT IF EXISTS entradas_estado_check;
ALTER TABLE entradas
  ADD CONSTRAINT entradas_estado_check
  CHECK (estado IN ('activa', 'usada', 'cancelada', 'reembolsada'));

COMMIT;
