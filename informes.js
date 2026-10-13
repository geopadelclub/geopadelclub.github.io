/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const MIN_DIA_PISTA = 690;
function aplicarPermisosInformes() {
const on = typeof esAdmin === 'function' && esAdmin();
$('nav-informes').style.display = on ? '' : 'none';
if (!on && $('tab-informes').classList.contains('active')) cambiarPestana('reservas');
}
function rangoInforme(tipo) {
const hoy = fechaLocalISO(), [y, m] = hoy.split('-').map(Number);
const pad = n => String(n).padStart(2, '0');
if (tipo === 'mes') return [`${y}-${pad(m)}-01`, hoy];
if (tipo === 'mesAnt') { const ini = new Date(y, m - 2, 1), fin = new Date(y, m - 1, 0); return [fechaLocalISO(ini), fechaLocalISO(fin)]; }
return [sumarDiasISO(hoy, -(parseInt(tipo, 10) - 1)), hoy];
}
function entrarInformes() {
if (!esAdmin()) return;
if (!$('infDesde').value) { const [d, h] = rangoInforme('mes'); $('infDesde').value = d; $('infHasta').value = h; cargarInforme(); }
}
const pctTxt = (a, b) => b > 0 ? (Math.round(a / b * 1000) / 10).toLocaleString('es-ES') + ' %' : '—';
const barra = p => `<span class="inf-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></span>`;
const horasTxt = h => { const t = Math.round(Number(h) * 60), hh = Math.floor(t / 60), mm = t % 60; return `${hh} h ${String(mm).padStart(2, '0')} min`; };
function tablaInforme(cab, filas, vacio) {
return `<div class="table-wrap"><table class="tabla-productos" style="min-width:420px"><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.length ? filas.join('') : `<tr><td colspan="${cab.length}" class="tabla-empty">${esc(vacio)}</td></tr>`}</tbody></table></div>`;
}
function dibujarInforme(r) {
const o = r.ocupacion || {}, disp = Number(o.disponibles) || 0, min = Number(o.minutos) || 0;
const pOcu = disp ? min / disp * 100 : 0;
const ingresos = (r.pistas || []).reduce((s, p) => s + (Number(p.ingresos) || 0), 0);
const sem = (r.semanas || []).map(s => {
const d = (Number(s.dias) || 0) * 9 * MIN_DIA_PISTA, p = d ? Number(s.minutos) / d * 100 : 0;
return `<tr><td><b>${esc(fmtFecha(s.semana))}</b></td><td>${esc(s.reservas)}</td><td>${esc(pctTxt(Number(s.minutos), d))}${barra(p)}</td><td>${eur(s.ingresos)}</td></tr>`;
});
const pis = (r.pistas || []).map(p => `<tr><td><b>${esc(p.pista)}</b></td><td>${esc(p.reservas)}</td><td>${esc(pctTxt(Number(p.minutos), (Number(r.dias) || 0) * MIN_DIA_PISTA))}</td><td>${eur(p.ingresos)}</td></tr>`);
const fra = (r.franjas || []).map(f => `<tr><td><b>${esc(f.franja)}</b></td><td>${esc(f.reservas)}</td><td>${eur(f.ingresos)}</td></tr>`);
const hor = (r.horas || []).map(h => `<tr><td><b>${esc(h.empleado)}</b></td><td>${esc(horasTxt(h.horas))}</td><td>${Number(h.sin_salida) ? `<span class="limp-ko">${esc(h.sin_salida)}</span>` : '0'}</td></tr>`);
$('infContenido').innerHTML = `
<div class="card"><div class="kpi-row">
<div class="kpi"><span>Ocupación de pistas</span><h2>${esc(pctTxt(min, disp))}</h2></div>
<div class="kpi"><span>Reservas</span><h2>${esc(o.reservas || 0)}</h2></div>
<div class="kpi ef"><span>Facturado en reservas</span><h2>${eur(ingresos)}</h2></div></div>
<p class="limp-leyenda" style="margin-top:12px">Ocupación = minutos reservados entre los minutos abiertos (9:00–14:00 y 17:00–23:30, 9 pistas). Facturado = precio de las reservas no canceladas, no lo cobrado.</p></div>
<div class="card"><h3><i class="ri-calendar-2-line" aria-hidden="true"></i>Por semana</h3>${tablaInforme(['Semana del', 'Reservas', 'Ocupación', 'Facturado'], sem, 'Sin reservas en este periodo')}</div>
<div class="card"><h3><i class="ri-layout-grid-line" aria-hidden="true"></i>Por pista</h3>${tablaInforme(['Pista', 'Reservas', 'Ocupación', 'Facturado'], pis, 'Sin reservas en este periodo')}</div>
<div class="card"><h3><i class="ri-time-line" aria-hidden="true"></i>Por franja</h3>${tablaInforme(['Franja', 'Reservas', 'Facturado'], fra, 'Sin reservas en este periodo')}</div>
<div class="card"><h3><i class="ri-user-star-line" aria-hidden="true"></i>Horas trabajadas</h3>${tablaInforme(['Empleado', 'Horas', 'Entradas sin salida'], hor, 'Sin fichajes en este periodo')}
<p class="limp-leyenda" style="margin-top:12px">Se emparejan Entrada y Salida seguidas (máximo 16 h entre ambas). «Entradas sin salida» son fichajes que conviene revisar.</p></div>`;
}
async function cargarInforme() {
const msg = $('msgInforme'), btn = $('btnInforme');
const desde = $('infDesde').value, hasta = $('infHasta').value;
if (!desde || !hasta || hasta < desde) { msg.style.color = 'var(--red)'; msg.innerText = 'Revisa las fechas'; return; }
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Calculando...');
msg.innerText = '';
try {
const { data, error } = await supabaseClient.rpc('informe_club', { p_desde: desde, p_hasta: hasta });
if (error) throw error;
if (!data || !data.ok) { msg.style.color = 'var(--red)'; msg.innerText = data && data.error === 'rango_invalido' ? 'El rango máximo es de un año' : 'No tienes permiso para ver informes'; return; }
dibujarInforme(data);
} catch (err) {
console.error(err);
msg.style.color = 'var(--red)';
msg.innerText = 'No se pudo generar el informe: ' + (err.message || err);
} finally { setBusy(btn, false); }
}
$('btnInforme').addEventListener('click', cargarInforme);
$('infAtajos').addEventListener('click', e => {
const b = e.target.closest('button[data-rango]');
if (!b) return;
const [d, h] = rangoInforme(b.dataset.rango);
$('infDesde').value = d; $('infHasta').value = h;
cargarInforme();
});