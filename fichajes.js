/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const FX_MAX_TRAMO_MIN = 16 * 60;
let fxEmpleados = {};
let fxEmpleadosListos = false;
let fxJefas = new Set();
const fxPad = n => String(n).padStart(2, '0');
const fxHM = min => `${Math.floor(min / 60)}:${fxPad(min % 60)}`;
const fxDec = min => (min / 60).toFixed(2).replace('.', ',');
const fxHora = d => `${fxPad(d.getHours())}:${fxPad(d.getMinutes())}`;
const fxTs = f => f.created_at;
const fxNombre = emp => fxEmpleados[emp] || emp;
const fxFecha = iso => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };
const fxDiaSemana = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''); };
const fxMesTxt = ym => { const [y, m] = ym.split('-').map(Number); const t = new Date(y, m - 1, 1, 12).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); };
function fxRango(tipo) {
    const hoy = fechaLocalISO(), [y, m] = hoy.split('-').map(Number);
    if (tipo === 'hoy') return [hoy, hoy];
    if (tipo === 'mes') return [`${y}-${fxPad(m)}-01`, hoy];
    return [fechaLocalISO(new Date(y, m - 2, 1)), fechaLocalISO(new Date(y, m - 1, 0))];
}
function aplicarPermisosFichajes() {
    const jefa = typeof esJefa === 'function' && esJefa();
    const box = $('fxEmpleadoBox');
    if (box) box.style.display = jefa ? '' : 'none';
    [['cardFichar', jefa], ['cardContrato', jefa]].forEach(([id, ocultar]) => { const e = $(id); if (e) e.style.display = ocultar ? 'none' : ''; });
}
async function fxCargarEmpleados() {
    const sel = $('fxEmpleado');
    try {
        const { data, error } = await supabaseClient.from('usuarios').select('usuario, nombre, estado, rol').order('nombre');
        if (error) throw error;
        fxEmpleados = {};
        fxJefas = new Set();
        (data || []).forEach(u => { if (u.usuario) { fxEmpleados[u.usuario] = u.nombre || u.usuario; if (String(u.rol || '').trim().toLowerCase() === 'jefa') fxJefas.add(u.usuario); } });
        const actual = sel.value;
        sel.innerHTML = '<option value="">Todos los empleados</option>' + (data || []).filter(u => u.usuario && !fxJefas.has(u.usuario))
            .map(u => `<option value="${esc(u.usuario)}">${esc(u.nombre || u.usuario)}${u.estado && u.estado !== 'Activo' ? ' (inactivo)' : ''}</option>`).join('');
        sel.value = actual;
        fxEmpleadosListos = true;
    } catch (err) { console.error(err); }
}
function fxCalcular(filas, desde, hasta, jornadaDe) {
    const porEmp = {}, mapa = {}, ahora = Date.now();
    filas.forEach(f => { (porEmp[f.empleado] = porEmp[f.empleado] || []).push(f); });
    const dia = (emp, t) => { const fecha = fechaLocalISO(t), k = emp + '|' + fecha; return mapa[k] || (mapa[k] = { emp, fecha, tramos: [], incid: [], enCurso: false }); };
    Object.keys(porEmp).forEach(emp => {
        const lista = porEmp[emp].map(f => ({ tipo: f.tipo, t: new Date(fxTs(f)) })).filter(x => !isNaN(x.t.getTime())).sort((a, b) => a.t - b.t);
        let ab = null;
        lista.forEach(x => {
            if (x.tipo === 'Entrada') {
                if (ab) dia(emp, ab).incid.push(`Entrada ${fxHora(ab)} sin salida`);
                ab = x.t;
            } else if (x.tipo === 'Salida') {
                if (ab && x.t - ab <= FX_MAX_TRAMO_MIN * 60000) {
                    dia(emp, ab).tramos.push({ ini: ab, fin: x.t, min: Math.round((x.t - ab) / 60000) });
                } else {
                    if (ab) dia(emp, ab).incid.push(`Entrada ${fxHora(ab)} sin salida`);
                    dia(emp, x.t).incid.push(`Salida ${fxHora(x.t)} sin entrada`);
                }
                ab = null;
            }
        });
        if (ab) {
            const d = dia(emp, ab);
            if (ahora - ab.getTime() <= FX_MAX_TRAMO_MIN * 60000) d.enCurso = true;
            else d.incid.push(`Entrada ${fxHora(ab)} sin salida`);
        }
    });
    const dias = Object.values(mapa).filter(d => d.fecha >= desde && d.fecha <= hasta);
    dias.forEach(d => {
        d.tramos.sort((a, b) => a.ini - b.ini);
        d.total = d.tramos.reduce((s, t) => s + t.min, 0);
        d.pausa = 0;
        for (let i = 1; i < d.tramos.length; i++) {
            const p = d.tramos[i - 1], c = d.tramos[i];
            if (fechaLocalISO(p.fin) === fechaLocalISO(c.ini)) d.pausa += Math.max(0, Math.round((c.ini - p.fin) / 60000));
        }
        const j = jornadaDe(d.emp, d.fecha);
        d.jorn = isFinite(j.min) ? j.min : 0; d.sinContrato = !j.contrato;
        d.ord = Math.min(d.total, j.min);
        d.extra = Math.max(0, d.total - j.min);
    });
    dias.sort((a, b) => fxNombre(a.emp).localeCompare(fxNombre(b.emp), 'es') || a.fecha.localeCompare(b.fecha));
    const meses = {};
    dias.forEach(d => {
        const k = d.emp + '|' + d.fecha.slice(0, 7);
        const m = meses[k] || (meses[k] = { emp: d.emp, mes: d.fecha.slice(0, 7), dias: 0, total: 0, ord: 0, extra: 0, pausa: 0, incid: 0, sinContrato: false });
        if (d.sinContrato) m.sinContrato = true;
        if (d.tramos.length) m.dias++;
        m.total += d.total; m.ord += d.ord; m.extra += d.extra; m.pausa += d.pausa; m.incid += d.incid.length;
    });
    const listaMeses = Object.values(meses).sort((a, b) => fxNombre(a.emp).localeCompare(fxNombre(b.emp), 'es') || a.mes.localeCompare(b.mes));
    return { dias, meses: listaMeses };
}
const fxTramosTxt = d => d.tramos.map(t => `${fxHora(t.ini)}–${fxHora(t.fin)}${fechaLocalISO(t.fin) !== fechaLocalISO(t.ini) ? ' (+1 día)' : ''}`).join(' · ') + (d.enCurso ? (d.tramos.length ? ' · ' : '') + 'en curso' : '');
const fxMin = m => m ? fxHM(m) + ' h' : '—';
const fxJornadaTxt = d => d.jorn ? fxHM(d.jorn) + ' h' + (d.sinContrato ? ' *' : '') : (d.sinContrato ? '— *' : 'Libranza');
function fxTabla(cab, filas, clase, vacio) {
    const t = `<table class="${clase}"><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.join('') : `<tr><td colspan="${cab.length}" class="tabla-empty">${esc(vacio)}</td></tr>`}</tbody></table>`;
    return clase === 'fx-table' ? t : `<div class="table-wrap">${t}</div>`;
}
function fxFilasDia(dias, pantalla) {
    return dias.map(d => {
        const inc = d.incid.length ? (pantalla ? `<span class="limp-ko">${esc(d.incid.join(' · '))}</span>` : esc(d.incid.join(' · '))) : (d.enCurso ? 'En curso' : '');
        return `<tr><td><b>${esc(fxNombre(d.emp))}</b></td><td>${esc(fxDiaSemana(d.fecha))} ${esc(fxFecha(d.fecha))}</td><td>${esc(fxTramosTxt(d))}</td><td>${esc(fxMin(d.pausa))}</td><td>${esc(fxJornadaTxt(d))}</td><td><b>${esc(fxMin(d.total))}</b></td><td>${esc(fxMin(d.ord))}</td><td>${esc(fxMin(d.extra))}</td><td>${inc || '—'}</td></tr>`;
    });
}
function fxFilasMes(meses) {
    return meses.map(m => `<tr><td><b>${esc(fxNombre(m.emp))}</b>${m.sinContrato ? ' *' : ''}</td><td>${esc(fxMesTxt(m.mes))}</td><td>${m.dias}</td><td><b>${esc(fxMin(m.total))}</b></td><td>${esc(fxMin(m.ord))}</td><td>${esc(fxMin(m.extra))}</td><td>${m.incid || '—'}</td></tr>`);
}
const FX_CAB_DIA = ['Empleado', 'Fecha', 'Tramos (entrada–salida)', 'Pausas', 'Jornada del día', 'Horas trabajadas', 'Ordinarias', 'Exceso s/ jornada', 'Incidencias'];
const FX_CAB_MES = ['Empleado', 'Mes', 'Días trabajados', 'Horas trabajadas', 'Ordinarias', 'Exceso s/ jornada', 'Incidencias'];
function fxDibujar(r) {
    const tot = r.dias.reduce((s, d) => ({ t: s.t + d.total, o: s.o + d.ord, e: s.e + d.extra, i: s.i + d.incid.length, n: s.n + (d.tramos.length ? 1 : 0) }), { t: 0, o: 0, e: 0, i: 0, n: 0 });
    $('fxContenido').innerHTML = `
<div class="card"><div class="kpi-row">
<div class="kpi ef"><span>Horas trabajadas</span><h2>${esc(fxHM(tot.t))} h</h2></div>
<div class="kpi"><span>Ordinarias</span><h2>${esc(fxHM(tot.o))} h</h2></div>
<div class="kpi ta"><span>Exceso sobre jornada</span><h2>${esc(fxHM(tot.e))} h</h2></div>
<div class="kpi"><span>Días trabajados</span><h2>${tot.n}</h2></div>
<div class="kpi"><span>Incidencias</span><h2 class="${tot.i ? 'limp-ko' : ''}">${tot.i}</h2></div></div></div>
<div class="card"><h3><i class="ri-calendar-2-line" aria-hidden="true"></i>Resumen por mes</h3>${fxTabla(FX_CAB_MES, fxFilasMes(r.meses), 'tabla-productos', 'Sin fichajes en este periodo')}
<p class="limp-leyenda" style="margin-top:12px">Los meses solo suman los días incluidos en el periodo elegido.</p></div>
<div class="card"><h3><i class="ri-list-check-2" aria-hidden="true"></i>Detalle por día</h3>${fxTabla(FX_CAB_DIA, fxFilasDia(r.dias, true), 'tabla-productos', 'Sin fichajes en este periodo')}
<p class="limp-leyenda" style="margin-top:12px">Horas netas = suma de cada tramo Entrada→Salida. Las pausas son el tiempo entre una Salida y la siguiente Entrada del mismo día y no se cuentan como trabajadas. «Jornada del día» sale del contrato de cada trabajador (horas semanales ÷ días de trabajo; los días de libranza tienen jornada 0). «Exceso s/ jornada» = horas que superan esa jornada; que sean horas extraordinarias legalmente depende del convenio y del contrato. ${r.sinContrato.length ? `<b>*</b> Sin contrato indicado (${esc(r.sinContrato.map(fxNombre).join(', '))}): no se puede calcular el exceso hasta que lo indiquen.` : ''} Una incidencia es una Entrada sin Salida (o al revés): conviene revisarla.</p></div>`;
}
async function fxCargarContratos(emps) {
    const out = {};
    if (!emps.length) return out;
    try {
        const { data, error } = await leerTodo(() => supabaseClient.from('contratos_jornada').select('usuario, horas_semanales, horario, notas, vigente_desde, created_at').in('usuario', emps).order('vigente_desde', { ascending: false }).order('created_at', { ascending: false }));
        if (error) throw error;
        (data || []).forEach(c => { (out[c.usuario] = out[c.usuario] || []).push(c); });
    } catch (e) { console.error('contratos', e); }
    return out;
}
let fxUltimoState = null;
async function fxGenerar() {
    const msg = $('fxMsg'), btn = $('fxVer');
    const err = t => { msg.style.color = 'var(--red)'; msg.innerText = t; return false; };
    const desde = $('fxDesde').value, hasta = $('fxHasta').value;
    if (!desde || !hasta || hasta < desde) return err('Revisa las fechas');
    if (sumarDiasISO(desde, 366) < hasta) return err('El rango máximo es de un año');
    const jefa = esJefa();
    const emp = jefa ? $('fxEmpleado').value : (usuarioSesion && usuarioSesion.user);
    if (!jefa && !emp) return err('No se pudo identificar al empleado');
    setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Calculando...');
    msg.innerText = '';
    try {
        const ini = new Date(sumarDiasISO(desde, -1) + 'T00:00:00'), fin = new Date(sumarDiasISO(hasta, 2) + 'T00:00:00');
        const { data, error } = await leerTodo(() => {
            let q = supabaseClient.from('fichajes').select('empleado, tipo, created_at').gte('created_at', ini.toISOString()).lt('created_at', fin.toISOString()).order('created_at', { ascending: true });
            if (emp) q = q.eq('empleado', emp);
            return q;
        });
        if (error) throw error;
        const filas = (data || []).filter(x => !fxJefas.has(x.empleado));
        const contratos = await fxCargarContratos(Array.from(new Set(filas.map(x => x.empleado))));
        const sin = new Set();
        const jornadaDe = (e, fecha) => {
            const cs = contratos[e] || [];
            let c = null;
            for (const x of cs) { if ((x.vigente_desde || '0000-00-00') <= fecha) { c = x; break; } }
            if (!c && cs.length) c = cs[cs.length - 1];
            const m = c && typeof ctJornadaDeContrato === 'function' ? ctJornadaDeContrato(c, fecha) : null;
            if (m === null) { sin.add(e); return { min: Infinity, contrato: false }; }
            return { min: m, contrato: true };
        };
        const res = fxCalcular(filas, desde, hasta, jornadaDe);
        res.sinContrato = Array.from(sin).filter(e => res.dias.some(d => d.emp === e));
        fxUltimoState = { res, desde, hasta, emp, generado: new Date() };
        fxDibujar(res);
        msg.style.color = 'var(--muted)';
        msg.innerText = `Generado ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;
        return true;
    } catch (e) {
        console.error(e);
        return err('No se pudo generar el registro: ' + (e.message || e));
    } finally { setBusy(btn, false); }
}
function fxCelda(v) {
    v = String(v ?? '');
    return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
async function fxExportarCSV() {
    const btn = $('fxCsv');
    setBusy(btn, true);
    try {
        if (!(await fxGenerar())) return;
        const u = fxUltimoState;
        if (!u) return toast('Genera el registro antes de exportar', 'warn');
        const r = u.res;
        if (!r.dias.length) return toast('No hay fichajes en este periodo', 'warn');
        const f = a => a.map(fxCelda).join(';');
        const l = [f(['REGISTRO DE JORNADA · GEOPADEL']), f(['Periodo', `${fxFecha(u.desde)} a ${fxFecha(u.hasta)}`]), f(['Criterio', 'Jornada del día según el contrato de cada trabajador (horas semanales / días de trabajo; libranza = 0). * = sin contrato']), f(['Generado', u.generado.toLocaleString('es-ES')]), '',
        f(['DETALLE POR DÍA']), f(['Empleado', 'Fecha', 'Tramos', 'Pausas (h:mm)', 'Jornada del día (h:mm)', 'Horas trabajadas (h:mm)', 'Horas trabajadas (decimal)', 'Ordinarias (h:mm)', 'Exceso s/ jornada (h:mm)', 'Incidencias'])];
        r.dias.forEach(d => l.push(f([fxNombre(d.emp), fxFecha(d.fecha), fxTramosTxt(d), fxHM(d.pausa), fxHM(d.jorn) + (d.sinContrato ? ' *' : ''), fxHM(d.total), fxDec(d.total), fxHM(d.ord), fxHM(d.extra), d.incid.join(' | ')])));
        l.push('', f(['RESUMEN POR MES']), f(['Empleado', 'Mes', 'Días trabajados', 'Horas trabajadas (h:mm)', 'Horas trabajadas (decimal)', 'Ordinarias (h:mm)', 'Exceso s/ jornada (h:mm)', 'Incidencias']));
        r.meses.forEach(m => l.push(f([fxNombre(m.emp), fxMesTxt(m.mes), m.dias, fxHM(m.total), fxDec(m.total), fxHM(m.ord), fxHM(m.extra), m.incid])));
        const quien = u.emp ? u.emp : 'todos';
        descargarBlob(new Blob(['﻿' + l.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `geopadel_jornada_${quien}_${u.desde}_${u.hasta}.csv`);
        toast('Registro de jornada exportado');
    } finally { setBusy(btn, false); }
}
function fxHtmlEmpleado(emp, u) {
    const dias = u.res.dias.filter(d => d.emp === emp), meses = u.res.meses.filter(m => m.emp === emp);
    const cabD = FX_CAB_DIA.slice(1), cabM = FX_CAB_MES.slice(1);
    const quitar = fila => fila.replace(/<tr><td>.*?<\/td>/, '<tr>');
    return `<section class="fx-page">
<div class="fx-head"><img src="./Geopadel.webp" alt="Geopadel" width="150" height="150"><div><h1>Registro de jornada</h1><p>${esc(fxNombre(emp))} · ${esc(fxFecha(u.desde))} – ${esc(fxFecha(u.hasta))}</p></div>
<div class="fx-meta">Geopadel<br>Impreso: ${esc(u.generado.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }))}</div></div>
<h2>Resumen por mes</h2>${fxTabla(cabM, fxFilasMes(meses).map(quitar), 'fx-table', 'Sin fichajes')}
<h2>Detalle por día</h2>${fxTabla(cabD, fxFilasDia(dias, false).map(quitar), 'fx-table', 'Sin fichajes')}
<p class="fx-nota">Horas netas = suma de tramos Entrada→Salida; las pausas no se cuentan. Exceso sobre la jornada del día según el contrato del trabajador${u.res.sinContrato.includes(emp) ? ` (* sin contrato indicado: no se calcula exceso)` : ''}. Registro diario de jornada (art. 34.9 del Estatuto de los Trabajadores); los registros se conservan 4 años.</p>
<div class="fx-firmas"><div>Firma del trabajador</div><div>Firma de la empresa</div></div></section>`;
}
async function fxImprimir() {
    const btn = $('fxImprimir');
    setBusy(btn, true);
    try {
        if (!(await fxGenerar())) return;
        const u = fxUltimoState;
        if (!u) return;
        const emps = Array.from(new Set(u.res.dias.map(d => d.emp)));
        if (!emps.length) return toast('No hay fichajes en este periodo para imprimir', 'warn');
        const area = $('printArea');
        area.innerHTML = emps.map(e => fxHtmlEmpleado(e, u)).join('');
        await Promise.all(Array.from(area.querySelectorAll('img')).map(im => im.complete ? null : new Promise(res => { im.onload = im.onerror = res; })));
        window.print();
    } catch (e) {
        console.error(e);
        toast('No se pudo preparar la impresión: ' + (e.message || e), 'err');
    } finally { setBusy(btn, false); }
}
function fxAplicarContrato() { if (!esJefa() && $('fxDesde').value) fxGenerar(); }
async function entrarFichajes() {
    aplicarPermisosFichajes();
    if (!$('fxDesde').value) {
        const [d, h] = fxRango('mes');
        $('fxDesde').value = d; $('fxHasta').value = h;
    }
    if (esPersonal() && !fxEmpleadosListos) await fxCargarEmpleados();
    fxGenerar();
}
$('fxVer').addEventListener('click', fxGenerar);
$('fxCsv').addEventListener('click', fxExportarCSV);
$('fxImprimir').addEventListener('click', fxImprimir);
$('fxAtajos').addEventListener('click', e => {
    const b = e.target.closest('button[data-fx]');
    if (!b) return;
    const [d, h] = fxRango(b.dataset.fx);
    $('fxDesde').value = d; $('fxHasta').value = h;
    fxGenerar();
});