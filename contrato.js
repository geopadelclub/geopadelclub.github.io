/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const CT_DIAS = [['lun', 'Lunes'], ['mar', 'Martes'], ['mie', 'Miércoles'], ['jue', 'Jueves'], ['vie', 'Viernes'], ['sab', 'Sábado'], ['dom', 'Domingo']];
const CT_HORAS_MAX = 48;
let ctCache = { usuario: null, data: undefined };
let ctResolver = null;
const ctMin = h => { const [a, b] = String(h || '').split(':').map(Number); return (isNaN(a) ? 0 : a) * 60 + (isNaN(b) ? 0 : b); };
const ctHoras = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`; };
const ctNum = n => String(Number(n)).replace('.', ',');
function ctUsuario() { return usuarioSesion ? usuarioSesion.user : null; }
function ctMinutosDia(d) {
    if (!d || !d.on) return 0;
    let t = 0;
    if (d.ini && d.fin && ctMin(d.fin) > ctMin(d.ini)) t += ctMin(d.fin) - ctMin(d.ini);
    if (d.ini2 && d.fin2 && ctMin(d.fin2) > ctMin(d.ini2)) t += ctMin(d.fin2) - ctMin(d.ini2);
    return t;
}
function ctMinutosSemana(horario) {
    return CT_DIAS.reduce((s, [k]) => s + ctMinutosDia(horario && horario[k]), 0);
}
async function cargarContrato(forzar) {
    const u = ctUsuario();
    if (!u || !supabaseClient) return null;
    if (!forzar && ctCache.usuario === u && ctCache.data !== undefined) return ctCache.data;
    const { data, error } = await supabaseClient.from('contratos_jornada').select('*').eq('usuario', u).order('created_at', { ascending: false }).limit(1);
    if (error) { console.error(error); throw error; }
    ctCache = { usuario: u, data: (data && data[0]) || null };
    return ctCache.data;
}
function ctJornadaDeContrato(c, fecha) {
    if (!c) return null;
    const h = c.horario || {};
    const act = CT_DIAS.filter(([k]) => h[k] && h[k].on).length;
    if (!act) return null;
    const [y, m, d] = fecha.split('-').map(Number);
    const k = CT_DIAS[(new Date(y, m - 1, d, 12).getDay() + 6) % 7][0];
    if (!(h[k] && h[k].on)) return 0;
    return Math.round(Number(c.horas_semanales) / act * 60);
}
function ctResumenHtml(c) {
    if (!c) return '<p class="limp-leyenda" style="color:var(--orange-text);font-weight:700"><i class="ri-error-warning-line" aria-hidden="true"></i>Aún no has indicado tu contrato. Se te pedirá al fichar por primera vez.</p>';
    const filas = CT_DIAS.map(([k, n]) => {
        const d = (c.horario || {})[k];
        if (!d || !d.on) return `<tr><td><b>${esc(n)}</b></td><td class="tabla-empty" style="text-align:left !important">Libranza</td></tr>`;
        const tramos = [d.ini && d.fin ? `${d.ini}–${d.fin}` : '', d.ini2 && d.fin2 ? `${d.ini2}–${d.fin2}` : ''].filter(Boolean).join(' · ');
        return `<tr><td><b>${esc(n)}</b></td><td>${esc(tramos)}</td></tr>`;
    }).join('');
    const desde = new Date(c.created_at);
    return `<p style="font-size:15px;font-weight:700;color:var(--heading);margin-bottom:6px">${esc(ctNum(c.horas_semanales))} h semanales</p>
<p class="limp-leyenda">Declarado el ${esc(isNaN(desde.getTime()) ? '' : desde.toLocaleDateString('es-ES'))}${c.vigente_desde ? ' · vigente desde ' + esc(fmtFecha(c.vigente_desde)) : ''}</p>
${c.notas ? `<p class="limp-leyenda">Nota: ${esc(c.notas)}</p>` : ''}
<div class="table-wrap"><table class="tabla-productos" style="min-width:260px"><tbody>${filas}</tbody></table></div>`;
}
async function dibujarContratoResumen() {
    const box = $('contratoResumen');
    if (!box || !usuarioSesion) return;
    try { box.innerHTML = ctResumenHtml(await cargarContrato(true)); }
    catch (e) { box.innerHTML = `<p class="limp-leyenda" style="color:var(--red)">${esc(esErrorTabla(e) ? 'Falta crear la tabla «contratos_jornada». Ejecuta migracion_tienda_contratos.sql en Supabase.' : 'No se pudo cargar tu contrato: ' + (e.message || e))}</p>`; }
}
function ctDibujarFilas(c) {
    const h = (c && c.horario) || {};
    $('ctFilas').innerHTML = CT_DIAS.map(([k, n]) => {
        const d = h[k] || {};
        const on = c ? !!d.on : (k !== 'sab' && k !== 'dom');
        return `<div class="ct-fila" data-dia="${k}">
<label class="ct-dia"><input type="checkbox" class="ct-on" ${on ? 'checked' : ''}><span>${esc(n)}</span></label>
<div class="ct-horas">
<input type="time" class="ct-ini" value="${esc(d.ini || (on ? '09:00' : ''))}" aria-label="${esc(n)}: entrada">
<span>–</span>
<input type="time" class="ct-fin" value="${esc(d.fin || (on ? '14:00' : ''))}" aria-label="${esc(n)}: salida">
</div>
<div class="ct-horas">
<input type="time" class="ct-ini2" value="${esc(d.ini2 || '')}" aria-label="${esc(n)}: segunda entrada (opcional)">
<span>–</span>
<input type="time" class="ct-fin2" value="${esc(d.fin2 || '')}" aria-label="${esc(n)}: segunda salida (opcional)">
</div></div>`;
    }).join('');
    ctActualizar();
}
function ctLeerHorario() {
    const h = {};
    document.querySelectorAll('#ctFilas .ct-fila').forEach(f => {
        h[f.dataset.dia] = {
            on: f.querySelector('.ct-on').checked,
            ini: f.querySelector('.ct-ini').value, fin: f.querySelector('.ct-fin').value,
            ini2: f.querySelector('.ct-ini2').value, fin2: f.querySelector('.ct-fin2').value
        };
    });
    return h;
}
function ctActualizar() {
    document.querySelectorAll('#ctFilas .ct-fila').forEach(f => {
        const on = f.querySelector('.ct-on').checked;
        f.classList.toggle('off', !on);
        f.querySelectorAll('input[type="time"]').forEach(i => { i.disabled = !on; });
    });
    const min = ctMinutosSemana(ctLeerHorario());
    $('ctCalculo').innerText = min ? `Según el horario: ${ctHoras(min)} a la semana` : 'Marca los días y las horas que trabajas';
}
async function abrirContrato(obligatorio) {
    let c = null;
    try { c = await cargarContrato(false); } catch (e) { toast('No se pudo cargar tu contrato: ' + (e.message || e), 'err'); return false; }
    $('ctObligatorio').hidden = !obligatorio;
    $('ctTitulo').innerText = c ? 'Modificar mi contrato' : 'Tu contrato';
    $('ctHoras').value = c ? c.horas_semanales : '';
    $('ctNotas').value = c && c.notas ? c.notas : '';
    $('ctDesde').value = fechaLocalISO();
    $('msgContrato').innerText = '';
    ctDibujarFilas(c);
    abrirOverlay('modalContrato');
    return true;
}
function cerrarContrato(guardado) {
    cerrarOverlay('modalContrato');
    if (ctResolver) { const r = ctResolver; ctResolver = null; r(!!guardado); }
}
async function guardarContrato() {
    const msg = $('msgContrato'), btn = $('btnGuardarContrato');
    const err = t => { msg.style.color = 'var(--red)'; msg.innerText = t; };
    const horas = parseFloat(String($('ctHoras').value).replace(',', '.'));
    const horario = ctLeerHorario();
    const notas = $('ctNotas').value.trim();
    const desde = $('ctDesde').value;
    if (isNaN(horas) || horas <= 0 || horas > CT_HORAS_MAX) return err(`Indica las horas semanales de tu contrato (entre 0,5 y ${CT_HORAS_MAX})`);
    if (!desde) return err('Indica desde cuándo rige este horario');
    const activos = CT_DIAS.filter(([k]) => horario[k].on);
    if (!activos.length) return err('Marca al menos un día de trabajo');
    for (const [k, n] of activos) {
        const d = horario[k];
        if (!d.ini || !d.fin || ctMin(d.fin) <= ctMin(d.ini)) return err(`${n}: revisa la hora de entrada y de salida`);
        const uno = !!d.ini2, otro = !!d.fin2;
        if (uno !== otro) return err(`${n}: completa el segundo tramo o déjalo vacío`);
        if (uno && ctMin(d.fin2) <= ctMin(d.ini2)) return err(`${n}: revisa el segundo tramo`);
        if (uno && ctMin(d.ini2) < ctMin(d.fin)) return err(`${n}: el segundo tramo debe empezar después del primero`);
    }
    const limpio = {};
    CT_DIAS.forEach(([k]) => {
        const d = horario[k];
        limpio[k] = d.on ? { on: true, ini: d.ini, fin: d.fin, ini2: d.ini2 || '', fin2: d.fin2 || '' } : { on: false };
    });
    const calc = ctMinutosSemana(limpio) / 60;
    if (Math.abs(calc - horas) > 0.5 && !(await customConfirm(`Las horas que has escrito (${ctNum(horas)} h) no coinciden con las del horario (${ctNum(Math.round(calc * 10) / 10)} h). ¿Guardar igualmente?`))) return;
    setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...');
    try {
        const u = ctUsuario();
        const { error } = await supabaseClient.from('contratos_jornada').insert({ usuario: u, horas_semanales: Math.round(horas * 10) / 10, horario: limpio, notas: notas || null, vigente_desde: desde, declarado_por: u });
        if (error) throw error;
        ctCache = { usuario: null, data: undefined };
        toast('Contrato guardado');
        cerrarContrato(true);
        dibujarContratoResumen();
        if (typeof fxAplicarContrato === 'function') fxAplicarContrato();
    } catch (ex) {
        console.error(ex);
        err(esErrorTabla(ex) ? 'Falta crear la tabla «contratos_jornada». Ejecuta migracion_tienda_contratos.sql en Supabase.' : 'No se pudo guardar: ' + (ex.message || ex));
    } finally { setBusy(btn, false); }
}
async function asegurarContrato() {
    if (typeof esJefa === 'function' && esJefa()) return true;
    let c;
    try { c = await cargarContrato(false); }
    catch (e) { console.error(e); return true; }
    if (c) return true;
    if (!(await abrirContrato(true))) return false;
    return new Promise(res => { ctResolver = res; });
}
function entrarContrato() { if (typeof esJefa === 'function' && esJefa()) return; dibujarContratoResumen(); }
$('btnEditarContrato').addEventListener('click', () => abrirContrato(false));
$('btnGuardarContrato').addEventListener('click', guardarContrato);
$('btnCancelarContrato').addEventListener('click', () => cerrarContrato(false));
$('btnCerrarContrato').addEventListener('click', () => cerrarContrato(false));
$('ctFilas').addEventListener('input', ctActualizar);
$('ctFilas').addEventListener('change', ctActualizar);