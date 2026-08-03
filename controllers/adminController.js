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
const QRCode = require("qrcode");

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
async function reportePdfLegacy(req,res) {
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

async function reportePdf(req, res) {
  try {
    const [statsResult, eventosResult, usuariosResult, txnsResult] = await Promise.all([
      pool.query(`SELECT
        COALESCE(SUM(total) FILTER (WHERE estado IN ('paid','completed','completada')),0) ingresos,
        COUNT(*) FILTER (WHERE estado IN ('paid','completed','completada')) transacciones,
        (SELECT COUNT(*) FROM entradas) boletos,
        (SELECT COUNT(*) FROM usuarios) usuarios,
        (SELECT COUNT(*) FROM eventos WHERE estado='published') eventos_activos`),
      pool.query(`SELECT e.id,e.nombre,e.fecha,e.hora,e.lugar,e.estado,
        f.id funcion_id,f.fecha funcion_fecha,f.hora funcion_hora,f.sala,f.estado funcion_estado,
        COUNT(DISTINCT a.id)::int capacidad,
        COUNT(DISTINCT a.id) FILTER (WHERE a.estado='sold')::int vendidos,
        COUNT(DISTINCT a.id) FILTER (WHERE a.estado='available')::int disponibles,
        (SELECT COALESCE(SUM(o.total),0) FROM ordenes o WHERE o.funcion_id=f.id AND o.estado IN ('paid','completed','completada')) ingresos
        FROM eventos e LEFT JOIN funciones_evento f ON f.evento_id=e.id
        LEFT JOIN asientos a ON a.funcion_id=f.id
        GROUP BY e.id,f.id ORDER BY e.fecha,e.nombre,f.fecha,f.hora`),
      pool.query(`SELECT username,nombre,email,role,estado,ultimo_login FROM usuarios ORDER BY ultimo_login DESC NULLS LAST LIMIT 18`),
      pool.query(`SELECT o.transaccion,e.nombre evento,u.username,o.total,o.estado,o.creada_en
        FROM ordenes o JOIN eventos e ON e.id=o.evento_id LEFT JOIN usuarios u ON u.id=o.usuario_id
        ORDER BY o.creada_en DESC LIMIT 18`)
    ]);
    const stats = statsResult.rows[0];
    const eventos = eventosResult.rows;
    const usuarios = usuariosResult.rows;
    const txns = txnsResult.rows;
    const qrBuffers = new Map();
    for (const item of eventos) {
      if (item.funcion_id) qrBuffers.set(String(item.funcion_id), await QRCode.toBuffer(`ASTRO-FUNCION:${item.funcion_id}`, { width: 180, margin: 1, color: { dark: '#24134f', light: '#ffffff' } }));
    }

    res.set({ "Content-Type":"application/pdf", "Content-Disposition":"attachment; filename=astro-tickets_reporte-ejecutivo.pdf", "Cache-Control":"private, no-store" });
    const doc = new PDFDocument({ size:"A4", margin:42, bufferPages:true, info:{ Title:"Reporte ejecutivo Astro Tickets", Author:"Astro Tickets" } });
    doc.pipe(res);
    const W = 511;
    const purple = "#6c3fd1", dark = "#17132b", muted = "#6b7280", pale = "#f4f0ff", green = "#0f9f78", line = "#e9e5f2";
    const money = (value) => `RD$ ${Number(value || 0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const date = (value) => value ? new Date(value).toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric'}) : '-';
    const ensure = (height=80) => { if (doc.y + height > 760) doc.addPage(); };
    const sectionTitle = (title, subtitle, required=70) => { ensure(required); const y=doc.y+6; doc.fillColor(dark).font('Helvetica-Bold').fontSize(15).text(title,42,y,{width:W}); if(subtitle) doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(subtitle,42,y+22,{width:W}); doc.y=y+(subtitle?43:28); };
    const tableHeader = (columns, widths) => { ensure(34); const y=doc.y; doc.save().roundedRect(42,y,W,24,6).fill(purple).restore(); let x=48; columns.forEach((c,i)=>{doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.2).text(c,x,y+8,{width:widths[i]-8,height:10,lineBreak:false});x+=widths[i];});doc.y=y+30; };
    const tableRow = (values,widths,index) => { ensure(28); const y=doc.y; if(index%2===0) doc.save().rect(42,y-3,W,24).fill('#faf9fd').restore(); let x=48; values.forEach((v,i)=>{doc.fillColor(dark).font('Helvetica').fontSize(7.2).text(String(v??'-'),x,y+4,{width:widths[i]-8,height:14,ellipsis:true,lineBreak:false});x+=widths[i];});doc.y=y+24; };

    doc.save().rect(0,0,595,150).fill(dark).restore();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(23).text('ASTRO TICKETS',42,40);
    doc.fillColor('#d8ccff').font('Helvetica').fontSize(10).text('REPORTE EJECUTIVO DE OPERACIONES',42,72);
    doc.fillColor('#b7afc9').fontSize(8).text(`Generado ${new Date().toLocaleString('es-DO')}  |  Panel administrativo`,42,100);
    doc.y=174;
    const cards=[['INGRESOS',money(stats.ingresos)],['TRANSACCIONES',stats.transacciones],['BOLETOS',stats.boletos],['USUARIOS',stats.usuarios]];
    const cardY=doc.y;
    cards.forEach((card,i)=>{const x=42+i*128;doc.save().roundedRect(x,cardY,116,60,10).fill(i===0?purple:pale).restore();doc.fillColor(i===0?'#ded5ff':muted).font('Helvetica-Bold').fontSize(7).text(card[0],x+12,cardY+13,{width:92});doc.fillColor(i===0?'#fff':dark).fontSize(i===0?12:16).text(String(card[1]),x+12,cardY+29,{width:94});});
    doc.y=cardY+82;

    sectionTitle('Eventos y funciones', 'Cada QR identifica la función dentro del reporte operativo.');
    if (!eventos.length) doc.fillColor(muted).fontSize(9).text('No hay funciones registradas.');
    for (const item of eventos) {
      ensure(112); const y=doc.y;
      doc.save().roundedRect(42,y,W,98,10).lineWidth(1).strokeColor(line).stroke().restore();
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(11).text(item.nombre,56,y+13,{width:330});
      doc.fillColor(muted).font('Helvetica').fontSize(8).text(`${date(item.funcion_fecha||item.fecha)}  |  ${String(item.funcion_hora||item.hora||'').slice(0,5)}  |  ${item.sala||item.lugar||'-'}`,56,y+31,{width:350});
      doc.fillColor(purple).font('Helvetica-Bold').fontSize(7.5).text(`FUNCIÓN #${item.funcion_id||'-'}`,56,y+49);
      doc.fillColor(dark).font('Helvetica').fontSize(8).text(`Capacidad: ${item.capacidad}    Vendidos: ${item.vendidos}    Disponibles: ${item.disponibles}`,56,y+65,{width:330});
      doc.fillColor(green).font('Helvetica-Bold').fontSize(9).text(money(item.ingresos),56,y+80,{width:180});
      const qr=qrBuffers.get(String(item.funcion_id)); if(qr) doc.image(qr,461,y+12,{fit:[76,76]});
      doc.y=y+110;
    }

    sectionTitle('Transacciones recientes','Pagos y órdenes más recientes del sistema.',70+Math.min(txns.length,20)*24);
    const txWidths=[86,145,72,70,70,68]; tableHeader(['TRANSACCIÓN','EVENTO','USUARIO','TOTAL','ESTADO','FECHA'],txWidths);
    txns.forEach((t,i)=>tableRow([t.transaccion,t.evento,t.username,money(t.total),t.estado,date(t.creada_en)],txWidths,i));

    sectionTitle('Usuarios y administradores','Actividad reciente y estado de las cuentas.',70+Math.min(usuarios.length,20)*24);
    const userWidths=[74,100,157,56,56,68]; tableHeader(['USUARIO','NOMBRE','CORREO','ROL','ESTADO','ACCESO'],userWidths);
    usuarios.forEach((u,i)=>tableRow([u.username,u.nombre,u.email,u.role,u.estado,date(u.ultimo_login)],userWidths,i));

    const range=doc.bufferedPageRange();
    for(let i=0;i<range.count;i++){doc.switchToPage(i);doc.save().moveTo(42,783).lineTo(553,783).strokeColor(line).stroke();doc.fillColor(muted).font('Helvetica').fontSize(7).text('Astro Tickets - reporte interno confidencial',42,790,{width:360,lineBreak:false});doc.text(`${i+1} / ${range.count}`,480,790,{width:70,align:'right',lineBreak:false});doc.restore();}
    doc.end();
  } catch(err) {
    console.error('Error generando PDF ejecutivo:',err);
    // El reporte ejecutivo usa tablas de funciones y auditoria que pueden no
    // existir todavia en instalaciones antiguas. Si esa consulta falla antes
    // de enviar contenido, generar el reporte general compatible en vez de
    // dejar el boton sin descarga.
    if(!res.headersSent) {
      console.warn('Usando reporte PDF compatible como respaldo.');
      return reportePdfLegacy(req, res);
    }
    return res.end();
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

module.exports = { dashboard, resumen, auditoria, reservasPorVencer, reporteCsv, reportePdf };
