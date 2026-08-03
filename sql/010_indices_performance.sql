/* ============================================================
   Astro Tickets — sql/010_indices_performance.sql
   Índices compuestos para las consultas más frecuentes
   (inventario por función, reservas del checkout y ventas por
   evento del dashboard). No destructivo. No elimina datos.
   ============================================================ */

BEGIN;

-- Inventario por función: COUNT(*) FILTER (WHERE estado = ...) y
-- listados de asientos agrupados por zona.
CREATE INDEX IF NOT EXISTS idx_asientos_funcion_estado ON asientos(funcion_id, estado);

-- Reservas del usuario en una función (checkout y revalidación de pago).
CREATE INDEX IF NOT EXISTS idx_reservas_usuario_funcion_activa
  ON reservas(usuario_id, funcion_id)
  WHERE estado = 'activa';

-- Ventas por evento del dashboard: órdenes pagadas agrupadas por evento.
CREATE INDEX IF NOT EXISTS idx_ordenes_evento_estado ON ordenes(evento_id, estado);

COMMIT;
