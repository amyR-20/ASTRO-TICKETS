/* ============================================================
   Astro Tickets — sql/005_entradas_codigo.sql (Fase 2)
   Identificador único por entrada, generado en backend con
   crypto.randomUUID(). VARCHAR(36) = UUID completo, sin truncar.
   No destructivo. qr_token queda diferido a la fase PDF/QR.
   ============================================================ */

BEGIN;

-- Columna inicialmente nullable
ALTER TABLE entradas
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(36);

-- Backfill de las entradas existentes con UUIDv4 (aleatorio,
-- no secuencial, no adivinable). gen_random_uuid() es core en PG13+.
UPDATE entradas
   SET codigo = upper(replace(gen_random_uuid()::text, '-', ''))
 WHERE codigo IS NULL;

-- Comprobar unicidad antes de crear la restricción. Si hay duplicados,
-- se aborta toda la migración (rollback completo por estar en transacción).
DO $$
BEGIN
  IF EXISTS (
    SELECT codigo FROM entradas
    WHERE codigo IS NOT NULL
    GROUP BY codigo HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Códigos duplicados en entradas.codigo; migración abortada.';
  END IF;
END $$;

ALTER TABLE entradas
  ADD CONSTRAINT entradas_codigo_uniq UNIQUE (codigo);

COMMIT;
