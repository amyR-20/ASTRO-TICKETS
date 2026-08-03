/* ============================================================
   Astro Tickets — controllers/adminController.js (Fases 4 + 5)
   Panel de administración: resumen por función, reservas por
   vencer y auditoría (sin datos sensibles).
   ============================================================ */

const { pool } = require("../config/database");
const funcionModel = require("../models/funcionModel");
const ordenModel = require("../models/ordenModel");
const usuarioModel = require("../models/usuarioModel");
const PDFDocument = require("pdfkit");

/**
 * GET /api/admin/dashboard — cifras para el panel de administración.
 * Devuelve estadísticas generales, ventas por evento, últimas
 * transacciones y usuarios recientes en una sola llamada.
 */
async function dashboard(req, res) {
  try {
    const [stats, ventasPorEvento, usuarios, accesos] = await Promise.all([
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
      pool.query(`SELECT a.id,a.creado_en,a.exitoso,a.email_intentado,a.ip,a.user_agent,
        u.id usuario_id,u.username,u.nombre FROM accesos_usuarios a
        LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.creado_en DESC LIMIT 100`),
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
      accesos: accesos.rows,
    });
  } catch (err) {
    console.error("Error generando dashboard admin:", err);
    return res.status(500).json({ error: "Error interno al generar el dashboard." });
  }
}

function csvValue(value) {
  const s=String(value == null ? "" : value);
  return `"${s.replace(/"/g,'""')}"`;
}

/** GET /api/admin/reportes/:tipo.csv — archivos que Excel abre directamente. */
async function reporteCsv(req,res) {
  try {
    const tipo=req.params.tipo;
    let filename,headers,rows;
    if(tipo==="usuarios") {
      filename="usuarios.csv";headers=["ID","Usuario","Nombre","Correo","Rol","Estado","Último acceso"];
      rows=(await pool.query(`SELECT id,username,nombre,email,role,estado,ultimo_login FROM usuarios ORDER BY ultimo_login DESC NULLS LAST`)).rows.map(u=>[u.id,u.username,u.nombre,u.email,u.role,u.estado,u.ultimo_login]);
    } else if(tipo==="accesos") {
      filename="accesos.csv";headers=["Fecha","Usuario","Nombre","Correo intentado","Resultado","IP","Navegador"];
      rows=(await pool.query(`SELECT a.creado_en,u.username,u.nombre,a.email_intentado,CASE WHEN a.exitoso THEN 'Exitoso' ELSE 'Fallido' END resultado,a.ip,a.user_agent FROM accesos_usuarios a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.creado_en DESC`)).rows.map(a=>Object.values(a));
    } else if(tipo==="transacciones") {
      filename="transacciones.csv";headers=["Orden","Transacción","Usuario","Evento","Total","Estado","Fecha"];
      rows=(await pool.query(`SELECT o.id,o.transaccion,u.username,e.nombre,o.total,o.estado,o.creada_en FROM ordenes o LEFT JOIN usuarios u ON u.id=o.usuario_id JOIN eventos e ON e.id=o.evento_id ORDER BY o.creada_en DESC`)).rows.map(o=>Object.values(o));
    } else return res.status(404).json({error:"Tipo de reporte no válido."});
    const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvValue).join(',')).join('\r\n');
    res.set({"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store"});
    return res.send(csv);
  } catch(err){console.error("Error generando CSV:",err);return res.status(500).json({error:"No se pudo generar el reporte."});}
}

/** GET /api/admin/reportes/general.pdf — resumen administrativo consolidado. */
async function reportePdf(req,res) {
  try {
    const [stats,ventas,usuarios,txns]=await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total),0) ingresos,COUNT(*) transacciones FROM ordenes WHERE estado IN ('paid','completed')`),
      pool.query(`SELECT e.nombre,COUNT(en.id)::int boletos,COALESCE(SUM(o.total),0) ingresos FROM eventos e LEFT JOIN ordenes o ON o.evento_id=e.id LEFT JOIN entradas en ON en.orden_id=o.id GROUP BY e.id ORDER BY ingresos DESC`),
      pool.query(`SELECT username,nombre,email,estado,ultimo_login FROM usuarios ORDER BY ultimo_login DESC NULLS LAST LIMIT 40`),
      pool.query(`SELECT o.transaccion,e.nombre evento,o.total,o.estado,o.creada_en FROM ordenes o JOIN eventos e ON e.id=o.evento_id ORDER BY o.creada_en DESC LIMIT 40`)
    ]);
    res.set({"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=astro-tickets_reporte-general.pdf","Cache-Control":"private, no-store"});
    const doc=new PDFDocument({size:"A4",margin:42});doc.pipe(res);
    doc.fillColor("#6c3fd1").font("Helvetica-Bold").fontSize(20).text("ASTRO TICKETS");doc.fillColor("#111827").fontSize(16).text("Reporte administrativo general");doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(new Date().toLocaleString("es-DO"));
    doc.moveDown().font("Helvetica-Bold").fillColor("#111827").fontSize(12).text(`Ingresos: RD$ ${Number(stats.rows[0].ingresos).toLocaleString('es-DO')}   ·   Transacciones: ${stats.rows[0].transacciones}`);
    const section=(title,headers,items)=>{doc.moveDown(1.2).fillColor("#6c3fd1").font("Helvetica-Bold").fontSize(12).text(title);doc.moveDown(.4);items.forEach((row,i)=>{if(doc.y>740)doc.addPage();doc.fillColor(i%2?'#374151':'#111827').font("Helvetica").fontSize(8).text(headers.map((h,j)=>`${h}: ${row[j]??'—'}`).join('  |  '),{width:510});});};
    section("Ventas por evento",["Evento","Boletos","Ingresos"],ventas.rows.map(v=>[v.nombre,v.boletos,`RD$ ${Number(v.ingresos).toLocaleString('es-DO')}`]));
    section("Usuarios",["Usuario","Nombre","Correo","Estado","Último acceso"],usuarios.rows.map(u=>[u.username,u.nombre,u.email,u.estado,u.ultimo_login?new Date(u.ultimo_login).toLocaleString('es-DO'):'—']));
    section("Transacciones recientes",["Transacción","Evento","Total","Estado","Fecha"],txns.rows.map(t=>[t.transaccion,t.evento,`RD$ ${Number(t.total).toLocaleString('es-DO')}`,t.estado,new Date(t.creada_en).toLocaleString('es-DO')]));
    doc.end();
  } catch(err){console.error("Error generando PDF admin:",err);if(!res.headersSent)res.status(500).json({error:"No se pudo generar el PDF."});else res.end();}
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

module.exports = { dashboard, resumen, auditoria, reservasPorVencer, reporteCsv, reportePdf };
