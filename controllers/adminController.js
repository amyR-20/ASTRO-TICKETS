/* ============================================================
   Astro Tickets — controllers/adminController.js (Fases 4 + 5)
   Panel de administración: resumen por función, reservas por
   vencer y auditoría (sin datos sensibles).
   ============================================================ */

const { pool } = require("../config/database");
const funcionModel = require("../models/funcionModel");
const ordenModel = require("../models/ordenModel");
const usuarioModel = require("../models/usuarioModel");

/**
 * GET /api/admin/dashboard — cifras para el panel de administración.
 * Devuelve estadísticas generales, ventas por evento, últimas
 * transacciones y usuarios recientes en una sola llamada.
 */
async function dashboard(req, res) {
  try {
    const [stats, ventasPorEvento, usuarios] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COALESCE(SUM(total), 0) FROM ordenes WHERE estado IN ('paid','completada')) AS ingresos,
          (SELECT COUNT(*) FROM entradas) AS boletos,
          (SELECT COUNT(*) FROM usuarios) AS usuarios,
          (SELECT COUNT(*) FROM eventos WHERE estado = 'published') AS eventos_activos,
          (SELECT COUNT(*) FROM ordenes WHERE estado IN ('paid','completada')) AS transacciones
      `),
      pool.query(`
        SELECT e.id, e.nombre, e.imagen,
               COUNT(en.id)::int AS boletos,
               COALESCE(SUM(o.total), 0)::numeric AS ingresos
        FROM eventos e
        LEFT JOIN ordenes o ON o.evento_id = e.id AND o.estado IN ('paid','completada')
        LEFT JOIN entradas en ON en.orden_id = o.id
        GROUP BY e.id
        ORDER BY ingresos DESC, e.nombre ASC
      `),
      usuarioModel.listar({ limite: 20 }),
    ]);

    const transacciones = await ordenModel.listarTodas();

    return res.json({
      stats: {
        ingresos: Number(stats.rows[0].ingresos),
        boletos: Number(stats.rows[0].boletos),
        usuarios: Number(stats.rows[0].usuarios),
        eventosActivos: Number(stats.rows[0].eventos_activos),
        transacciones: Number(stats.rows[0].transacciones),
      },
      ventasPorEvento: ventasPorEvento.rows,
      transacciones: transacciones.slice(0, 10),
      usuarios,
    });
  } catch (err) {
    console.error("Error generando dashboard admin:", err);
    return res.status(500).json({ error: "Error interno al generar el dashboard." });
  }
}

/** GET /api/admin/resumen — inventario por evento/función. */
async function resumen(req, res) {
  try {
    const resumen = await funcionModel.resumenGlobal();
    const pendientes = await funcionModel.reservasPorVencer(30);
    return res.json({ eventos: resumen, reservasPorVencer: pendientes });
  } catch (err) {
    console.error("Error generando resumen admin:", err);
    return res.status(500).json({ error: "Error interno al generar el resumen." });
  }
}

/** GET /api/admin/auditoria — historial de acciones administrativas. */
async function auditoria(req, res) {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    const { rows } = await pool.query(
      `SELECT a.creado_en, a.usuario_id, u.nombre AS usuario_nombre,
              a.accion, a.entidad, a.entidad_id, a.funcion_id, a.razon, a.detalle
       FROM auditoria a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ORDER BY a.creado_en DESC
       LIMIT $1`,
      [limite]
    );
    return res.json({ auditoria: rows });
  } catch (err) {
    console.error("Error leyendo auditoría:", err);
    return res.status(500).json({ error: "Error interno al leer la auditoría." });
  }
}

/** GET /api/admin/reservas-por-vencer — reservas que expiran pronto. */
async function reservasPorVencer(req, res) {
  try {
    const minutos = Number(req.query.minutos) || 10;
    const filas = await funcionModel.reservasPorVencer(minutos);
    return res.json({ reservas: filas });
  } catch (err) {
    console.error("Error leyendo reservas por vencer:", err);
    return res.status(500).json({ error: "Error interno al leer las reservas." });
  }
}

module.exports = { dashboard, resumen, auditoria, reservasPorVencer };
