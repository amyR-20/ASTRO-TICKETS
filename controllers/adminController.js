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
               (SELECT COUNT(*) FROM entradas en JOIN ordenes o2 ON o2.id = en.orden_id
                WHERE o2.evento_id = e.id AND o2.estado IN ('paid','completada'))::int AS boletos,
               (SELECT COALESCE(SUM(total), 0) FROM ordenes
                WHERE evento_id = e.id AND estado IN ('paid','completada'))::numeric AS ingresos
        FROM eventos e
        ORDER BY ingresos DESC, e.nombre ASC
      `),
      usuarioModel.listar({ limite: 20 }),
      pool.query(`SELECT a.id,a.creado_en,a.exitoso,a.email_intentado,a.ip,a.user_agent,
        u.id usuario_id,u.username,u.nombre FROM accesos_usuarios a
        LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.creado_en DESC LIMIT 100`),
    ]);

    const transacciones = await ordenModel.listarTodas({ limite: 10 });

    return res.json({
      stats: {
        ingresos: Number(stats.rows[0].ingresos),
        boletos: Number(stats.rows[0].boletos),
        usuarios: Number(stats.rows[0].usuarios),
        eventosActivos: Number(stats.rows[0].eventos_activos),
        transacciones: Number(stats.rows[0].transacciones),
      },
      ventasPorEvento: ventasPorEvento.rows,
      transacciones,
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
      pool.query(`SELECT e.nombre,
        (SELECT COUNT(*) FROM entradas en JOIN ordenes o2 ON o2.id = en.orden_id
         WHERE o2.evento_id = e.id)::int boletos,
        (SELECT COALESCE(SUM(o3.total),0) FROM ordenes o3
         WHERE o3.evento_id = e.id) ingresos
        FROM eventos e GROUP BY e.id ORDER BY ingresos DESC`),
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
    const [statsResult, eventosResult, usuariosResult, txnsResult, listadoResult, resumenResult] = await Promise.all([
      pool.query(`SELECT
        COALESCE(SUM(total) FILTER (WHERE estado IN ('paid','completed','completada')),0) ingresos,
        COUNT(*) FILTER (WHERE estado IN ('paid','completed','completada')) transacciones,
        (SELECT COUNT(*) FROM entradas) boletos,
        (SELECT COUNT(*) FROM usuarios) usuarios,
        (SELECT COUNT(*) FROM eventos WHERE estado='published') eventos_activos FROM ordenes`),
      pool.query(`SELECT e.id,e.nombre,e.fecha,e.hora,e.lugar,e.estado,
        f.id funcion_id,f.fecha funcion_fecha,f.hora funcion_hora,f.sala,f.estado funcion_estado,
        COUNT(DISTINCT a.id)::int capacidad,
        COUNT(DISTINCT a.id) FILTER (WHERE a.estado='sold')::int vendidos,
        COUNT(DISTINCT a.id) FILTER (WHERE a.estado='available')::int disponibles,
        (SELECT COALESCE(SUM(o.total),0) FROM ordenes o WHERE o.funcion_id=f.id AND o.estado IN ('paid','completed','completada')) ingresos
        FROM eventos e LEFT JOIN funciones_evento f ON f.evento_id=e.id
        LEFT JOIN asientos a ON a.funcion_id=f.id
        GROUP BY e.id,f.id ORDER BY e.fecha,e.nombre,f.fecha,f.hora`),
      pool.query(`SELECT id,username,nombre,email,role,estado,ultimo_login FROM usuarios ORDER BY ultimo_login DESC NULLS LAST LIMIT 18`),
      pool.query(`SELECT o.transaccion,e.nombre evento,u.username,o.total,o.estado,o.creada_en
        FROM ordenes o JOIN eventos e ON e.id=o.evento_id LEFT JOIN usuarios u ON u.id=o.usuario_id
        ORDER BY o.creada_en DESC LIMIT 18`),
      pool.query(`SELECT e.id AS evento_id, e.nombre, e.lugar, e.ciudad, e.estado AS evento_estado,
        COALESCE((SELECT f.fecha FROM funciones_evento f WHERE f.evento_id = e.id ORDER BY f.fecha, f.hora LIMIT 1), e.fecha) AS fecha,
        COALESCE((SELECT f.hora FROM funciones_evento f WHERE f.evento_id = e.id ORDER BY f.fecha, f.hora LIMIT 1), e.hora) AS hora,
        en.asiento_id, en.zona, en.precio, en.estado AS boleto_estado, en.codigo,
        a.fila, a.columna
        FROM eventos e
        LEFT JOIN entradas en ON en.evento_id = e.id
        LEFT JOIN asientos a ON a.asiento_id = en.asiento_id AND a.funcion_id = en.funcion_id
        ORDER BY e.nombre, e.fecha, a.fila, a.columna`),
      pool.query(`SELECT e.id AS evento_id, e.nombre,
        COALESCE((SELECT COUNT(*) FROM asientos a JOIN funciones_evento f ON f.id = a.funcion_id
                  WHERE f.evento_id = e.id), 0)::int AS boletos_totales,
        COALESCE((SELECT COUNT(*) FROM asientos a JOIN funciones_evento f ON f.id = a.funcion_id
                  WHERE f.evento_id = e.id AND a.estado = 'available'), 0)::int AS disponibles,
        COALESCE((SELECT COUNT(*) FROM asientos a JOIN funciones_evento f ON f.id = a.funcion_id
                  WHERE f.evento_id = e.id AND a.estado = 'sold'), 0)::int AS boletos,
        COUNT(DISTINCT en.id) FILTER (WHERE o.estado IN ('paid','completed','completada'))::int AS pagados,
        COALESCE(ROUND(AVG(en.precio) FILTER (WHERE o.estado IN ('paid','completed','completada')), 2), 0)::numeric AS precio_promedio,
        COALESCE((SELECT SUM(o2.total) FROM ordenes o2
                  WHERE o2.evento_id = e.id AND o2.estado IN ('paid','completed','completada')), 0)::numeric AS ingresos
        FROM eventos e
        LEFT JOIN entradas en ON en.evento_id = e.id
        LEFT JOIN ordenes o ON o.id = en.orden_id
        GROUP BY e.id, e.nombre
        ORDER BY ingresos DESC, e.nombre`)
    ]);
    const stats = statsResult.rows[0];
    const eventos = eventosResult.rows;
    const usuarios = usuariosResult.rows;
    const txns = txnsResult.rows;
    const listadoEventos = listadoResult.rows;
    const resumenIngresos = resumenResult.rows;
    const qrEventos = new Map();
    for (const item of listadoEventos) {
      const evId = String(item.evento_id);
      if (!qrEventos.has(evId)) qrEventos.set(evId, await QRCode.toBuffer(`ASTRO-EVENTO:${evId}`, { width: 180, margin: 1, color: { dark: '#24134f', light: '#ffffff' } }));
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

    sectionTitle('Eventos y funciones', 'Reporte de boletos disponibles por evento y su estado operativo.');
    if (!eventos.length) doc.fillColor(muted).fontSize(9).text('No hay funciones registradas.');
    const efWidths=[96,115,72,66,82,62];
    ensure(34);
    {
      const y=doc.y;
      doc.save().roundedRect(42,y,W,24,6).fill(purple).restore();
      let hx=48;
      ['CÓDIGO','EVENTO','CAPACIDAD','VENDIDOS','DISPONIBLES','ESTADO'].forEach((c,i)=>{doc.fillColor('#fff').font('Helvetica-Bold').fontSize(6.5).text(c,hx,y+8,{width:efWidths[i]-8,height:10,lineBreak:false});hx+=efWidths[i];});
      doc.y=y+30;
    }
    eventos.forEach((item,i)=>{
      ensure(42); const y=doc.y;
      if(i%2===0) doc.save().rect(42,y-3,W,36).fill('#faf9fd').restore();
      let x=48;
      doc.fillColor(purple).font('Helvetica-Bold').fontSize(6.5).text(String(item.id||item.evento_id||'-').toUpperCase(),x,y+10,{width:efWidths[0]-8,height:12,ellipsis:true,lineBreak:false});
      x+=efWidths[0];
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(6.5).text(item.nombre,x,y+4,{width:efWidths[1]-8,height:9,ellipsis:true,lineBreak:false});
      doc.fillColor(muted).font('Helvetica').fontSize(5.8).text(`${date(item.funcion_fecha||item.fecha)} ${String(item.funcion_hora||item.hora||'').slice(0,5)} | F#${item.funcion_id||'-'}`,x,y+15,{width:efWidths[1]-8,height:8,ellipsis:true,lineBreak:false});
      x+=efWidths[1];
      [item.capacidad,item.vendidos,item.disponibles].forEach((v,vi)=>{doc.fillColor(dark).font('Helvetica').fontSize(6.5).text(String(v??'-'),x,y+10,{width:efWidths[2+vi]-8,height:12,ellipsis:true,lineBreak:false});x+=efWidths[2+vi];});
      const estado=item.disponibles>0?'ACTIVO':'AGOTADO';
      doc.fillColor(estado==='ACTIVO'?green:'#c0392b').font('Helvetica-Bold').fontSize(6.5).text(estado,x,y+10,{width:efWidths[5]-8,height:12,ellipsis:true,lineBreak:false});
      doc.y=y+36;
    });

    sectionTitle('Listado de Eventos','Presenta el detalle de los eventos registrados en el sistema junto con la información necesaria para su identificación y control.');
    const porEvento = new Map();
    for (const t of listadoEventos) {
      if (!porEvento.has(t.evento_id)) porEvento.set(t.evento_id, []);
      porEvento.get(t.evento_id).push(t);
    }
    for (const [evId, boletos] of porEvento) {
      const ev = boletos[0];
      ensure(150);
      const ey=doc.y;
      doc.save().roundedRect(42,ey,W,92,10).lineWidth(1).strokeColor(line).stroke().restore();
      doc.fillColor(purple).font('Helvetica-Bold').fontSize(8.5).text(String(ev.evento_id).toUpperCase(),56,ey+11,{width:330});
      doc.fillColor(dark).font('Helvetica-Bold').fontSize(11).text(ev.nombre,56,ey+23,{width:330});
      doc.fillColor(muted).font('Helvetica').fontSize(8).text(`${date(ev.fecha)}  |  ${String(ev.hora||'').slice(0,5)}  |  ${[ev.lugar,ev.ciudad].filter(Boolean).join(' · ')}`,56,ey+40,{width:350});
      doc.fillColor(green).font('Helvetica-Bold').fontSize(7.5).text(`ESTADO: ${String(ev.evento_estado||'').toUpperCase()}`,56,ey+56);
      doc.fillColor(dark).font('Helvetica').fontSize(8).text(`Boletos emitidos: ${boletos.length}`,56,ey+68,{width:200});
      const qrEv=qrEventos.get(String(evId)); if(qrEv) doc.image(qrEv,461,ey+8,{fit:[76,76]});
      doc.y=ey+104;
      const leWidths=[70,50,90,80,70];
      tableHeader(['SECCIÓN','FILA','PRECIO','ESTADO','CÓDIGO'],leWidths);
      boletos.forEach((b,i)=>tableRow([b.zona||'-',b.fila||'-',money(b.precio),b.boleto_estado||'-',b.codigo||'-'],leWidths,i));
    }

    sectionTitle('Resumen de Ingresos','Presenta un resumen consolidado de las ventas e ingresos generados por los eventos registrados en el sistema.');
    const totBoletos = resumenIngresos.reduce((a,r)=>a+Number(r.boletos),0);
    const totTotales = resumenIngresos.reduce((a,r)=>a+Number(r.boletos_totales),0);
    const totDisp = resumenIngresos.reduce((a,r)=>a+Number(r.disponibles),0);
    const totIngresos = resumenIngresos.reduce((a,r)=>a+Number(r.ingresos),0);
    const totPagados = resumenIngresos.reduce((a,r)=>a+Number(r.pagados),0);
    const totPrecio = totPagados ? (totIngresos/totPagados) : 0;
    const incCards=[['EVENTOS REGISTRADOS',resumenIngresos.length],['BOLETOS VENDIDOS',totBoletos],['DISPONIBLES',totDisp],['INGRESO ACUMULADO',money(totIngresos)],['PRECIO PROMEDIO',money(totPrecio)]];
    const incY=doc.y;
    incCards.forEach((card,i)=>{const x=42+i*103;doc.save().roundedRect(x,incY,97,60,10).fill(i===3?purple:pale).restore();doc.fillColor(i===3?'#ded5ff':muted).font('Helvetica-Bold').fontSize(6.5).text(card[0],x+10,incY+13,{width:77});doc.fillColor(i===3?'#fff':dark).fontSize(i===3||i===4?10:13).text(String(card[1]),x+10,incY+28,{width:77});});
    doc.y=incY+82;
    const riWidths=[100,116,70,53,42,73,57];
    ensure(34);
    {
      const y=doc.y;
      doc.save().roundedRect(42,y,W,24,6).fill(purple).restore();
      let hx=48;
      ['CÓDIGO','EVENTO','BOLETOS TOTALES','DISPONIBLES','VENDIDOS','PRECIO PROMEDIO','INGRESOS'].forEach((c,i)=>{doc.fillColor('#fff').font('Helvetica-Bold').fontSize(6.5).text(c,hx,y+8,{width:riWidths[i]-6,height:10,lineBreak:false});hx+=riWidths[i];});
      doc.y=y+30;
    }
    resumenIngresos.forEach((r,i)=>tableRow([String(r.evento_id).toUpperCase(),r.nombre,r.boletos_totales,r.disponibles,r.boletos,money(r.precio_promedio),money(r.ingresos)],riWidths,i));
    ensure(30);
    const ty=doc.y;
    doc.save().roundedRect(42,ty,W,26,6).fill(dark).restore();
    let tx=48;
    ['TOTAL GENERAL','',totTotales,totDisp,totBoletos,money(totPrecio),money(totIngresos)].forEach((v,i)=>{doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8).text(String(v),tx,ty+8,{width:riWidths[i]-8,height:12,lineBreak:false});tx+=riWidths[i];});
    doc.y=ty+32;

    sectionTitle('Transacciones recientes','Pagos y órdenes más recientes del sistema.',70+Math.min(txns.length,20)*24);
    const txWidths=[86,145,72,70,70,68]; tableHeader(['TRANSACCIÓN','EVENTO','USUARIO','TOTAL','ESTADO','FECHA'],txWidths);
    txns.forEach((t,i)=>tableRow([t.transaccion,t.evento,t.username,money(t.total),t.estado,date(t.creada_en)],txWidths,i));

    sectionTitle('Usuarios y administradores','Actividad reciente y estado de las cuentas.',70+Math.min(usuarios.length,20)*24);
    const userWidths=[60,56,90,130,50,50,75]; tableHeader(['CÓDIGO','USUARIO','NOMBRE','CORREO','ROL','ESTADO','ACCESO'],userWidths);
    usuarios.forEach((u,i)=>tableRow([`USR-${String(u.id).padStart(4,'0')}`,u.username,u.nombre,u.email,u.role,u.estado,date(u.ultimo_login)],userWidths,i));

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

/**
 * GET /api/admin/reportes/evento/:id — reporte completo por evento.
 * Ventas, funciones, zonas, tendencia (14 días), compradores y
 * transacciones en una sola llamada. Incluye eventos nuevos: la
 * consulta corre contra la BD real (ordenes/entradas/asientos).
 */
async function getReporteEventoData(id) {
  const PAGADO = "'paid','completada'";

    const [evento, resumen, porFuncion, porZona, tendencia, compradores, transacciones, reembolsos] = await Promise.all([
      pool.query(
        `SELECT id, nombre, imagen, fecha, hora, lugar, estado, capacidad
         FROM eventos WHERE id = $1`,
        [id]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(total), 0)::numeric AS ingresos,
           (SELECT COUNT(*)::int FROM entradas
            WHERE evento_id = $1 AND estado IN ('activa','usada')) AS boletos,
           COUNT(*)::int AS transacciones,
           COUNT(DISTINCT COALESCE(usuario_id::text, datos_comprador->>'email'))::int AS compradores,
           COALESCE(SUM(total) FILTER (WHERE estado = 'pending'), 0)::numeric AS pendiente,
           (SELECT COUNT(*)::int FROM asientos a
            JOIN funciones_evento f ON f.id = a.funcion_id
            WHERE f.evento_id = $1) AS capacidad
         FROM ordenes
         WHERE evento_id = $1 AND estado IN (${PAGADO})`,
        [id]
      ),
      pool.query(
        `SELECT f.id, f.fecha, f.hora, f.sala, f.estado,
                (SELECT COUNT(*)::int FROM asientos a WHERE a.funcion_id = f.id) AS capacidad,
                (SELECT COUNT(*)::int FROM asientos a WHERE a.funcion_id = f.id AND a.estado = 'sold') AS vendidos,
                (SELECT COUNT(*)::int FROM asientos a WHERE a.funcion_id = f.id AND a.estado = 'available') AS disponibles,
                COALESCE((SELECT SUM(en.precio) FROM entradas en
                          JOIN asientos a2 ON a2.evento_id = en.evento_id AND a2.asiento_id = en.asiento_id
                          WHERE a2.funcion_id = f.id AND en.estado IN ('activa','usada')), 0)::numeric AS ingresos
         FROM funciones_evento f
         WHERE f.evento_id = $1
         ORDER BY f.fecha, f.hora`,
        [id]
      ),
      pool.query(
        `SELECT en.zona, COUNT(*)::int AS boletos,
                COALESCE(SUM(en.precio), 0)::numeric AS ingresos
         FROM entradas en
         WHERE en.evento_id = $1 AND en.estado IN ('activa','usada')
         GROUP BY en.zona
         ORDER BY ingresos DESC, boletos DESC`,
        [id]
      ),
      pool.query(
        `SELECT to_char(o.creada_en::date, 'YYYY-MM-DD') AS dia,
                COUNT(DISTINCT o.id)::int AS transacciones,
                COUNT(en.id)::int AS boletos,
                COALESCE(SUM(o.total), 0)::numeric AS ingresos
         FROM ordenes o
         LEFT JOIN entradas en ON en.orden_id = o.id
         WHERE o.evento_id = $1 AND o.estado IN (${PAGADO})
           AND o.creada_en >= now() - interval '14 days'
         GROUP BY o.creada_en::date
         ORDER BY dia`,
        [id]
      ),
      pool.query(
        `SELECT COALESCE(u.id::text, o.datos_comprador->>'email') AS id,
                COALESCE(u.nombre, o.datos_comprador->>'nombre') AS nombre,
                COALESCE(u.email, o.datos_comprador->>'email') AS email,
                COUNT(DISTINCT o.id)::int AS transacciones,
                COUNT(en.id)::int AS boletos,
                COALESCE(SUM(o.total), 0)::numeric AS gastado,
                MAX(o.creada_en) AS ultima
         FROM ordenes o
         LEFT JOIN usuarios u ON u.id = o.usuario_id
         LEFT JOIN entradas en ON en.orden_id = o.id
         WHERE o.evento_id = $1 AND o.estado IN (${PAGADO})
         GROUP BY 1, 2, 3
         ORDER BY gastado DESC
         LIMIT 50`,
        [id]
      ),
      pool.query(
        `SELECT o.id, o.transaccion, o.codigo_reserva, o.metodo_pago, o.total,
                o.estado, o.creada_en,
                COALESCE(u.nombre, o.datos_comprador->>'nombre') AS comprador,
                COALESCE(u.email, o.datos_comprador->>'email') AS email,
                COUNT(en.id)::int AS boletos
         FROM ordenes o
         LEFT JOIN usuarios u ON u.id = o.usuario_id
         LEFT JOIN entradas en ON en.orden_id = o.id
         WHERE o.evento_id = $1
         GROUP BY o.id, u.nombre, u.email
         ORDER BY o.creada_en DESC
         LIMIT 30`,
        [id]
      ),
      pool.query(
        `SELECT r.id, r.monto, r.motivo, r.estado, r.creado_en,
                o.transaccion, o.total AS orden_total,
                COALESCE(u.nombre, o.datos_comprador->>'nombre') AS comprador,
                COALESCE(u.email, o.datos_comprador->>'email') AS email,
                a.nombre AS admin_nombre
         FROM reembolsos r
         JOIN ordenes o ON o.id = r.orden_id
         LEFT JOIN usuarios u ON u.id = o.usuario_id
         LEFT JOIN usuarios a ON a.id = r.autorizado_por
         WHERE o.evento_id = $1
         ORDER BY r.creado_en DESC
         LIMIT 50`,
        [id]
      ),
    ]);

    if (!evento.rows.length) return null;

    const ev = evento.rows[0];
    const resumenRow = resumen.rows[0];
    const capacidad = Number(resumenRow.capacidad);

    return {
      evento: {
        id: ev.id,
        nombre: ev.nombre,
        imagen: ev.imagen,
        fecha: ev.fecha instanceof Date ? ev.fecha.toISOString().slice(0, 10) : ev.fecha,
        lugar: ev.lugar,
        estado: ev.estado,
        capacidad: Number(ev.capacidad),
      },
      resumen: {
        ingresos: Number(resumenRow.ingresos),
        boletos: Number(resumenRow.boletos),
        transacciones: Number(resumenRow.transacciones),
        compradores: Number(resumenRow.compradores),
        pendiente: Number(resumenRow.pendiente),
        capacidad,
        pctVendido: capacidad > 0 ? Math.round((Number(resumenRow.boletos) / capacidad) * 100) : 0,
      },
      porFuncion: porFuncion.rows.map((r) => ({
        id: r.id,
        fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
        hora: String(r.hora || "").slice(0, 5),
        sala: r.sala,
        estado: r.estado,
        capacidad: Number(r.capacidad),
        vendidos: Number(r.vendidos),
        disponibles: Number(r.disponibles),
        ingresos: Number(r.ingresos),
      })),
      porZona: porZona.rows.map((r) => ({
        zona: r.zona,
        boletos: Number(r.boletos),
        ingresos: Number(r.ingresos),
      })),
      tendencia: tendencia.rows.map((r) => ({
        dia: r.dia,
        transacciones: Number(r.transacciones),
        boletos: Number(r.boletos),
        ingresos: Number(r.ingresos),
      })),
      compradores: compradores.rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        email: r.email,
        transacciones: Number(r.transacciones),
        boletos: Number(r.boletos),
        gastado: Number(r.gastado),
        ultima: r.ultima,
      })),
      transacciones: transacciones.rows.map((r) => ({
        id: r.id,
        transaccion: r.transaccion,
        codigoReserva: r.codigo_reserva,
        metodoPago: r.metodo_pago,
        total: Number(r.total),
        estado: r.estado,
        creadaEn: r.creada_en,
        comprador: r.comprador,
        email: r.email,
        boletos: Number(r.boletos),
      })),
      reembolsos: reembolsos.rows.map((r) => ({
        id: r.id,
        monto: Number(r.monto),
        motivo: r.motivo,
        estado: r.estado,
        creadoEn: r.creado_en,
        transaccion: r.transaccion,
        ordenTotal: Number(r.orden_total),
        comprador: r.comprador,
        email: r.email,
        adminNombre: r.admin_nombre,
      })),
    };
}

/**
 * GET /api/admin/reportes/evento/:id — reporte completo por evento (JSON).
 */
async function reporteEvento(req, res) {
  try {
    const data = await getReporteEventoData(req.params.id);
    if (!data) return res.status(404).json({ error: "Evento no encontrado." });
    return res.json(data);
  } catch (err) {
    console.error("Error generando reporte por evento:", err);
    return res.status(500).json({ error: "Error interno al generar el reporte." });
  }
}

/**
 * GET /api/admin/reportes/evento/:id.pdf — PDF por evento con el mismo
 * formato del reporte ejecutivo general, limitado a un solo evento.
 */
async function reporteEventoPdf(req, res) {
  try {
    const data = await getReporteEventoData(req.params.id);
    if (!data) return res.status(404).json({ error: "Evento no encontrado." });

    const { evento, resumen, porFuncion, porZona, compradores, transacciones, reembolsos } = data;

    const slug = String(evento.nombre || evento.id)
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "evento";

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=astro-tickets_reporte-${slug}.pdf`,
      "Cache-Control": "private, no-store",
    });

    const doc = new PDFDocument({
      size: "A4", margin: 42, bufferPages: true,
      info: { Title: `Reporte por evento - ${evento.nombre}`, Author: "Astro Tickets" },
    });
    doc.pipe(res);

    const W = 511;
    const purple = "#6c3fd1", dark = "#17132b", muted = "#6b7280", pale = "#f4f0ff", green = "#0f9f78", line = "#e9e5f2";
    const num = (v) => Number(v || 0).toLocaleString("es-DO");
    const money = (value) => `RD$ ${Number(value || 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const date = (value) => value ? new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "-";
    const datetime = (value) => value ? new Date(value).toLocaleString("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
    const time = (value) => value ? String(value).slice(0, 5) : "-";
    const ensure = (height = 80) => { if (doc.y + height > 760) doc.addPage(); };
    const sectionTitle = (title, subtitle, required = 70) => { ensure(required); const y = doc.y + 6; doc.fillColor(dark).font("Helvetica-Bold").fontSize(15).text(title, 42, y, { width: W }); if (subtitle) doc.fillColor(muted).font("Helvetica").fontSize(8.5).text(subtitle, 42, y + 22, { width: W }); doc.y = y + (subtitle ? 43 : 28); };
    const tableHeader = (columns, widths) => { ensure(34); const y = doc.y; doc.save().roundedRect(42, y, W, 24, 6).fill(purple).restore(); let x = 48; columns.forEach((c, i) => { doc.fillColor("#fff").font("Helvetica-Bold").fontSize(7.2).text(c, x, y + 8, { width: widths[i] - 8, height: 10, lineBreak: false }); x += widths[i]; }); doc.y = y + 30; };
    const tableRow = (values, widths, index) => { ensure(28); const y = doc.y; if (index % 2 === 0) doc.save().rect(42, y - 3, W, 24).fill("#faf9fd").restore(); let x = 48; values.forEach((v, i) => { doc.fillColor(dark).font("Helvetica").fontSize(7.2).text(String(v ?? "-"), x, y + 4, { width: widths[i] - 8, height: 14, ellipsis: true, lineBreak: false }); x += widths[i]; }); doc.y = y + 24; };

    // Encabezado
    doc.save().rect(0, 0, 595, 150).fill(dark).restore();
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(23).text("ASTRO TICKETS", 42, 36);
    doc.fillColor("#d8ccff").font("Helvetica").fontSize(10).text("REPORTE POR EVENTO", 42, 70);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(14).text(String(evento.nombre || "-"), 42, 88, { width: 400 });
    doc.fillColor("#b7afc9").fontSize(8).text(`${evento.lugar || "-"}  |  ${date(evento.fecha)}  |  Generado ${new Date().toLocaleString("es-DO")}`, 42, 114);
    if (evento.id) {
      const qr = await QRCode.toBuffer(`ASTRO-EVENTO:${evento.id}`, { width: 180, margin: 1, color: { dark: "#24134f", light: "#ffffff" } });
      doc.save().roundedRect(455, 26, 96, 96, 10).fill("#ffffff").restore();
      doc.image(qr, 461, 32, { fit: [84, 84] });
    }
    doc.y = 174;

    // Tarjetas resumen
    const pct = Math.max(0, Math.min(100, Number(resumen.pctVendido) || 0));
    const cards = [
      ["INGRESOS", money(resumen.ingresos)],
      ["BOLETOS VENDIDOS", num(resumen.boletos)],
      ["TRANSACCIONES", num(resumen.transacciones)],
      ["COMPRADORES", num(resumen.compradores)],
      ["OCUPACIÓN", `${pct}%`],
    ];
    const cardY = doc.y;
    cards.forEach((card, i) => {
      const x = 42 + i * 100;
      doc.save().roundedRect(x, cardY, 94, 60, 10).fill(i === 0 ? purple : pale).restore();
      doc.fillColor(i === 0 ? "#ded5ff" : muted).font("Helvetica-Bold").fontSize(6).text(card[0], x + 9, cardY + 12, { width: 76 });
      doc.fillColor(i === 0 ? "#fff" : dark).font("Helvetica-Bold").fontSize(11).text(String(card[1]), x + 9, cardY + 28, { width: 78 });
    });
    doc.y = cardY + 82;

    // Ventas por función
    sectionTitle("Ventas por función", "Detalle de cada función del evento con su ocupación e ingresos.");
    if (!porFuncion.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text("No hay funciones registradas para este evento.");
    } else {
      const widths = [62, 44, 68, 62, 52, 52, 52, 84];
      tableHeader(["FECHA", "HORA", "SALA", "ESTADO", "CAPACIDAD", "VENDIDOS", "DISPONIBLES", "INGRESOS"], widths);
      porFuncion.forEach((f, i) => tableRow([date(f.fecha), time(f.hora), f.sala, String(f.estado || "-").toUpperCase(), num(f.capacidad), num(f.vendidos), num(f.disponibles), money(f.ingresos)], widths, i));
    }

    // Ventas por zona
    sectionTitle("Ventas por zona", "Distribución de boletos e ingresos por zona del recinto.");
    if (!porZona.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text("No hay boletos vendidos por zona.");
    } else {
      const widths = [170, 90, 160, 70];
      tableHeader(["ZONA", "BOLETOS", "INGRESOS", "% DEL TOTAL"], widths);
      const totalZonaBoletos = porZona.reduce((a, z) => a + Number(z.boletos), 0) || 1;
      porZona.forEach((z, i) => tableRow([z.zona || "-", num(z.boletos), money(z.ingresos), `${Math.round((Number(z.boletos) / totalZonaBoletos) * 100)}%`], widths, i));
    }

    // Compradores
    sectionTitle("Compradores", "Clientes que compraron boletos para este evento, ordenados por gasto.");
    if (!compradores.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text("Aún no hay compradores para este evento.");
    } else {
      const widths = [95, 120, 62, 55, 95, 78];
      tableHeader(["COMPRADOR", "EMAIL", "TRANSACCIONES", "BOLETOS", "GASTADO", "ÚLTIMA COMPRA"], widths);
      compradores.forEach((c, i) => tableRow([c.nombre || "-", c.email || "-", num(c.transacciones), num(c.boletos), money(c.gastado), datetime(c.ultima)], widths, i));
    }

    // Reembolsos
    sectionTitle("Reembolsos", "Solicitudes y devoluciones procesadas para este evento.");
    if (!reembolsos.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text("No hay reembolsos registrados para este evento.");
    } else {
      const widths = [70, 80, 95, 60, 78, 55, 70];
      tableHeader(["FECHA", "TRANSACCIÓN", "COMPRADOR", "MONTO", "MOTIVO", "ESTADO", "AUTORIZADO POR"], widths);
      reembolsos.forEach((r, i) => tableRow([datetime(r.creadoEn), r.transaccion || "-", r.comprador || r.email || "-", money(r.monto), r.motivo || "-", String(r.estado || "-").toUpperCase(), r.adminNombre || "-"], widths, i));
    }

    // Transacciones recientes
    sectionTitle("Transacciones recientes", "Últimos pagos registrados para este evento.");
    if (!transacciones.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(9).text("No hay transacciones registradas para este evento.");
    } else {
      const widths = [88, 112, 50, 58, 72, 80];
      tableHeader(["TRANSACCIÓN", "COMPRADOR", "BOLETOS", "MÉTODO", "TOTAL", "FECHA"], widths);
      transacciones.forEach((tr, i) => tableRow([tr.transaccion || tr.codigoReserva || "-", tr.comprador || tr.email || "-", num(tr.boletos), tr.metodoPago || "-", money(tr.total), datetime(tr.creadaEn)], widths, i));
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.save().moveTo(42, 783).lineTo(553, 783).strokeColor(line).stroke();
      doc.fillColor(muted).font("Helvetica").fontSize(7).text("Astro Tickets - reporte interno confidencial", 42, 790, { width: 360, lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, 480, 790, { width: 70, align: "right", lineBreak: false });
      doc.restore();
    }
    doc.end();
  } catch (err) {
    console.error("Error generando PDF por evento:", err);
    if (!res.headersSent) return res.status(500).json({ error: "Error interno al generar el PDF." });
    return res.end();
  }
}

module.exports = { dashboard, resumen, auditoria, reservasPorVencer, reporteCsv, reportePdf, reporteEvento, reporteEventoPdf };
