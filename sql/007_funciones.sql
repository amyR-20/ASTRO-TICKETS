/* ============================================================
   Astro Tickets — sql/007_funciones.sql (Fases 4 + 5)
   Identidad de FUNCIÓN por evento + concurrencia + auditoría.
   - Cada evento pasa a tener UNA O MÁS funciones (funciones_evento).
   - Asientos, reservas, órdenes y entradas quedan asociados a una
     función concreta (funcion_id), no solo al evento.
   - Un asiento vendido en una función NO bloquea el mismo asiento
     en otra función del mismo evento.
   - Restricciones UNIQUE que impiden vender/reservar dos veces el
     mismo asiento dentro de la misma función.
   - Auditoría con campo de razón y función.
   No destructivo: migra los datos existentes creando una función
   por evento y asociando los asientos/reservas/ordenes/entradas
   actuales a esa función.
   ============================================================ */

BEGIN;

-- ------------------------------------------------------------
-- 1. FUNCIONES_EVENTO: cada presentación (fecha + hora) de un evento
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funciones_evento (
    id              SERIAL PRIMARY KEY,
    evento_id       TEXT        NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    fecha           DATE        NOT NULL,
    hora            TIME        NOT NULL,
    sala            VARCHAR(120),
    estado          VARCHAR(20) NOT NULL DEFAULT 'programada'
                    CHECK (estado IN ('programada', 'en_venta', 'agotada', 'cancelada')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (evento_id, fecha, hora)
);

CREATE INDEX IF NOT EXISTS idx_funciones_evento ON funciones_evento(evento_id);
CREATE INDEX IF NOT EXISTS idx_funciones_estado ON funciones_evento(estado);
CREATE INDEX IF NOT EXISTS idx_funciones_fecha ON funciones_evento(fecha);

-- ------------------------------------------------------------
-- 2. ASIENTOS: pasa a ser POR FUNCIÓN (funcion_id).
--    Se elimina la unicidad antigua (evento_id, asiento_id) porque
--    impediría vender el mismo asiento en funciones distintas.
-- ------------------------------------------------------------
ALTER TABLE asientos
  ADD COLUMN IF NOT EXISTS funcion_id INTEGER REFERENCES funciones_evento(id) ON DELETE CASCADE;

ALTER TABLE asientos DROP CONSTRAINT IF EXISTS asientos_evento_id_asiento_id_key;
DROP INDEX IF EXISTS idx_asientos_funcion_seat;

-- Un asiento solo puede existir UNA vez por función
CREATE UNIQUE INDEX IF NOT EXISTS uq_asientos_funcion_asiento
  ON asientos(funcion_id, asiento_id) WHERE funcion_id IS NOT NULL;

-- La plantilla del evento (sin función) sigue siendo única por evento
CREATE UNIQUE INDEX IF NOT EXISTS uq_asientos_evento_plantilla
  ON asientos(evento_id, asiento_id) WHERE funcion_id IS NULL;

-- ------------------------------------------------------------
-- 3. RESERVAS: por función + estado. Una reserva activa por
--    (función, asiento). Las vencidas pasan a 'expirada'.
-- ------------------------------------------------------------
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS funcion_id INTEGER REFERENCES funciones_evento(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'expirada', 'completada', 'cancelada'));

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_evento_id_asiento_id_key;
DROP INDEX IF EXISTS uq_reservas_activas;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_activas
  ON reservas(funcion_id, asiento_id) WHERE estado = 'activa';

-- ------------------------------------------------------------
-- 4. ORDENES: cada compra apunta a una función concreta
-- ------------------------------------------------------------
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS funcion_id INTEGER REFERENCES funciones_evento(id);
CREATE INDEX IF NOT EXISTS idx_ordenes_funcion ON ordenes(funcion_id);

-- ------------------------------------------------------------
-- 5. ENTRADAS: por función. No se puede vender dos veces el mismo
--    asiento en la misma función.
-- ------------------------------------------------------------
ALTER TABLE entradas
  ADD COLUMN IF NOT EXISTS funcion_id INTEGER REFERENCES funciones_evento(id);

ALTER TABLE entradas DROP CONSTRAINT IF EXISTS entradas_evento_id_asiento_id_key;
DROP INDEX IF EXISTS uq_entradas_funcion_asiento;

CREATE UNIQUE INDEX IF NOT EXISTS uq_entradas_funcion_asiento
  ON entradas(funcion_id, asiento_id) WHERE funcion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entradas_funcion ON entradas(funcion_id);

-- ------------------------------------------------------------
-- 6. AUDITORIA: razón de la acción + función asociada
-- ------------------------------------------------------------
ALTER TABLE auditoria
  ADD COLUMN IF NOT EXISTS razon TEXT,
  ADD COLUMN IF NOT EXISTS funcion_id INTEGER;

-- ------------------------------------------------------------
-- 7. BACKFILL: una función por cada evento que aún no tenga ninguna.
-- ------------------------------------------------------------
INSERT INTO funciones_evento (evento_id, fecha, hora, sala, estado)
SELECT
  e.id,
  COALESCE(e.fecha, CURRENT_DATE),
  COALESCE(e.hora, TIME '20:00'),
  e.lugar,
  CASE WHEN e.estado = 'cancelado' THEN 'cancelada' ELSE 'en_venta' END
FROM eventos e
WHERE NOT EXISTS (SELECT 1 FROM funciones_evento f WHERE f.evento_id = e.id);

-- ------------------------------------------------------------
-- 8. ASOCIAR asientos/reservas/ordenes/entradas existentes a la
--    función creada para su evento (la más antigua).
-- ------------------------------------------------------------
UPDATE asientos a
SET funcion_id = (SELECT f.id FROM funciones_evento f
                  WHERE f.evento_id = a.evento_id ORDER BY f.id LIMIT 1)
WHERE a.funcion_id IS NULL
  AND EXISTS (SELECT 1 FROM funciones_evento f WHERE f.evento_id = a.evento_id);

-- Tras asociar los asientos existentes a la función por defecto, se
-- vuelve a crear la PLANTILLA del evento (asientos sin función) para
-- que las nuevas funciones se clonen a partir de ella con sus zonas.
INSERT INTO asientos (evento_id, asiento_id, fila, columna, zona, estado)
SELECT fa.evento_id, fa.asiento_id, fa.fila, fa.columna, fa.zona, 'available'
FROM asientos fa
JOIN funciones_evento f ON f.id = fa.funcion_id
WHERE fa.funcion_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM asientos t
    WHERE t.evento_id = fa.evento_id
      AND t.asiento_id = fa.asiento_id
      AND t.funcion_id IS NULL
  );

UPDATE reservas r
SET funcion_id = (SELECT f.id FROM funciones_evento f
                  WHERE f.evento_id = r.evento_id ORDER BY f.id LIMIT 1)
WHERE r.funcion_id IS NULL
  AND EXISTS (SELECT 1 FROM funciones_evento f WHERE f.evento_id = r.evento_id);

UPDATE ordenes o
SET funcion_id = (SELECT f.id FROM funciones_evento f
                  WHERE f.evento_id = o.evento_id ORDER BY f.id LIMIT 1)
WHERE o.funcion_id IS NULL
  AND EXISTS (SELECT 1 FROM funciones_evento f WHERE f.evento_id = o.evento_id);

UPDATE entradas en
SET funcion_id = (SELECT f.id FROM funciones_evento f
                  WHERE f.evento_id = en.evento_id ORDER BY f.id LIMIT 1)
WHERE en.funcion_id IS NULL
  AND EXISTS (SELECT 1 FROM funciones_evento f WHERE f.evento_id = en.evento_id);

COMMIT;
