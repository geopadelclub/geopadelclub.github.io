/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function entrarResumen() {
    if (!usuarioSesion) return;
    dibujarResumen();
    try {
        await Promise.all([
            cargarReservasHoy(),
            cargarCajaHoy(),
            cargarDeudas(),
            cargarLimpiezas(false)
        ]);
    } catch (e) {
        console.error(e);
    }
    dibujarResumen();
}
function resumenSaludo() {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
}
function resumenReservasProximas() {
    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    return (datosLocales.reservas || [])
        .filter(r => {
            const [hh, mm] = String(r.horaInicio || '00:00').split(':').map(Number);
            return (hh * 60 + mm) + (parseInt(r.duracionMin, 10) || 90) >= minAhora;
        })
        .sort((a, b) => String(a.horaInicio).localeCompare(String(b.horaInicio)));
}
function dibujarResumen() {
    const el = $('resumenContenido');
    if (!el) return;
    const nombre = usuarioSesion ? (usuarioSesion.nombre || usuarioSesion.user) : '';
    const primerNombre = nombre.split(' ')[0] || nombre;
    const caja = datosLocales.caja || { totalEfectivo: 0, totalTarjeta: 0, totalGeneral: 0 };
    const reservasHoy = datosLocales.reservas || [];
    const proximas = resumenReservasProximas();
    const pendientes = reservasHoy.filter(r => r.estado === 'Pendiente').length;
    const deudasPend = (typeof deudas !== 'undefined' ? deudas : []).filter(d => d.estado !== 'Resuelta');
    const totalDeudas = deudasPend.reduce((s, d) => s + (Number(d.importe) || 0), 0);
    const vencidas = typeof limpiezasVencidas === 'function' ? limpiezasVencidas() : [];
    const numLimp = vencidas.reduce((s, v) => s + v.items.length, 0);
    const hoy = fechaBonita(fechaLocalISO(), true);
    let alertasHtml = '';
    if (pendientes > 0) {
        alertasHtml += `<div class="res-alerta res-alerta-warn"><i class="ri-error-warning-line" aria-hidden="true"></i><div><b>${pendientes} ${pendientes === 1 ? 'reserva pendiente' : 'reservas pendientes'} de confirmar</b><p>Revisa el cuadrante para confirmarlas.</p></div><button type="button" class="btn-add" data-ir="reservas">Ir a Reservas</button></div>`;
    }
    if (numLimp > 0) {
        alertasHtml += `<div class="res-alerta res-alerta-warn"><i class="ri-brush-line" aria-hidden="true"></i><div><b>${numLimp} ${numLimp === 1 ? 'limpieza pendiente' : 'limpiezas pendientes'}</b><p>Hay pistas sin limpiar en las últimas 2 semanas.</p></div><button type="button" class="btn-add" data-ir="limpieza">Ir a Limpieza</button></div>`;
    }
    if (totalDeudas > 0) {
        alertasHtml += `<div class="res-alerta"><i class="ri-wallet-3-line" aria-hidden="true"></i><div><b>${eur(totalDeudas)} en deudas pendientes</b><p>${deudasPend.length} ${deudasPend.length === 1 ? 'cliente' : 'clientes'} con pagos pendientes.</p></div><button type="button" class="btn-add" data-ir="deudas">Ir a Deudas</button></div>`;
    }
    let proximasHtml;
    if (proximas.length) {
        proximasHtml = proximas.slice(0, 6).map(r => {
            const dur = parseInt(r.duracionMin, 10) || 90;
            const ini = timeToMin(r.horaInicio);
            const fin = minToTimeStr(ini + dur);
            const pend = r.estado === 'Pendiente';
            const estado = pend
                ? '<span class="badge-pendiente"><i class="ri-hourglass-line" aria-hidden="true"></i>Pendiente</span>'
                : '<span class="badge-confirmada"><i class="ri-check-line" aria-hidden="true"></i>Confirmada</span>';
            return `<li class="res-agenda-item"><div class="res-agenda-hora"><b>${esc(r.horaInicio)}</b><small>${esc(fin)}</small></div><div class="res-agenda-info"><b>${esc(r.pista)}</b><span>${esc(r.cliente)}</span></div><div class="res-agenda-estado">${estado}</div></li>`;
        }).join('');
    } else {
        proximasHtml = '<li class="res-agenda-vacia">No hay más reservas para hoy.</li>';
    }
    const esTrabajador = typeof esJefa === 'function' && !esJefa();
    const btnFichar = esTrabajador ? `<button type="button" class="res-accion" data-ir="fichajes"><i class="ri-time-line" aria-hidden="true"></i><span>Fichar</span></button>` : '';
    el.innerHTML = `
<div class="res-bienvenida">
<div>
<h2>${resumenSaludo()}, ${esc(primerNombre)}</h2>
<p>${esc(hoy)} · Aquí tienes el resumen del día.</p>
</div>
</div>
<div class="res-kpis">
<div class="res-kpi res-kpi-blue">
<span><i class="ri-calendar-check-line" aria-hidden="true"></i>Reservas hoy</span>
<h3>${reservasHoy.length}</h3>
<small>${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'} de confirmar</small>
</div>
<div class="res-kpi res-kpi-green">
<span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>Ingresos hoy</span>
<h3>${eur(caja.totalGeneral)}</h3>
<small>${eur(caja.totalEfectivo)} efectivo · ${eur(caja.totalTarjeta)} tarjeta</small>
</div>
<div class="res-kpi res-kpi-red">
<span><i class="ri-wallet-3-line" aria-hidden="true"></i>Deudas pendientes</span>
<h3>${eur(totalDeudas)}</h3>
<small>${deudasPend.length} ${deudasPend.length === 1 ? 'cliente' : 'clientes'}</small>
</div>
<div class="res-kpi res-kpi-amber">
<span><i class="ri-brush-line" aria-hidden="true"></i>Limpiezas</span>
<h3>${numLimp}</h3>
<small>${numLimp === 0 ? 'Todo al día' : 'Pistas con aviso'}</small>
</div>
</div>
${alertasHtml ? `<div class="res-alertas">${alertasHtml}</div>` : ''}
<div class="res-acciones">
<h3><i class="ri-flashlight-line" aria-hidden="true"></i>Acciones rápidas</h3>
<div class="res-acciones-grid">
<button type="button" class="res-accion" data-ir="nueva-reserva"><i class="ri-add-line" aria-hidden="true"></i><span>Nueva reserva</span></button>
<button type="button" class="res-accion" data-ir="tienda"><i class="ri-goblet-line" aria-hidden="true"></i><span>Abrir bar</span></button>
<button type="button" class="res-accion" data-ir="caja"><i class="ri-lock-line" aria-hidden="true"></i><span>Cerrar caja</span></button>
${btnFichar}
</div>
</div>
<div class="res-agenda">
<h3><i class="ri-list-ordered" aria-hidden="true"></i>Próximas reservas</h3>
<ul class="res-agenda-lista">${proximasHtml}</ul>
</div>`;
}
document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (!b) return;
    const tab = b.dataset.ir;
    if (tab === 'nueva-reserva') {
        if (typeof abrirModalNuevaReserva === 'function') abrirModalNuevaReserva();
        return;
    }
    if (typeof cambiarPestana === 'function') cambiarPestana(tab);
});