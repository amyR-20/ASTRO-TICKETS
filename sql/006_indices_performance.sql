/* ============================================================
   Astro Tickets — sql/006_indices_performance.sql (Fase 2)
   Índices sobre columnas de búsqueda/filtrado frecuente.
   No destructivo. No elimina datos.
   ============================================================ */

BEGIN;

CREATE INDEX IF NOT EXISTS idx_ordenes_usuario_id  ON ordenes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_entradas_orden_id   ON entradas(orden_id);
CREATE INDEX IF NOT EXISTS idx_entradas_evento_id  ON entradas(evento_id);
CREATE INDEX IF NOT EXISTS idx_zonas_evento_id     ON zonas(evento_id);

COMMIT;
