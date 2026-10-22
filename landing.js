/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const SB_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
};
const MAPA_TARIFAS = { 'Entre semana mañana': 'semanaManana', 'Entre semana tarde': 'semanaTarde', 'Fin de semana': 'finde' };
function formatearPrecio(v) {
    return Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function cargarTarifas() {
    try {
        const res = await fetch(
            SUPABASE_URL + '/rest/v1/tarifas?select=franja,precio_60min,precio_90min,precio_120min',
            { headers: SB_HEADERS }
        );
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        (data || []).forEach(t => {
            const k = MAPA_TARIFAS[t.franja];
            if (!k) return;
            [['60', t.precio_60min], ['90', t.precio_90min], ['120', t.precio_120min]].forEach(([dur, val]) => {
                const el = document.querySelector(`[data-tarifa="${k}-${dur}"]`);
                if (el && val !== null && val !== undefined && val !== '') el.textContent = formatearPrecio(val);
            });
        });
    } catch (e) {
        console.warn('No se pudieron cargar las tarifas dinámicas:', e);
    }
}
async function cargarHuecosHoy() {
    const box = document.getElementById('huecosHoy');
    if (!box) return;
    try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/web_disponibilidad', {
            method: 'POST',
            headers: { ...SB_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_fecha: hoyISO() })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || !data.ok || !Array.isArray(data.slots)) {
            box.innerHTML = `<p class="huecos-vacio">${t('huecos.error')} <a href="reservar">${t('huecos.ver')}</a></p>`;
            return;
        }
        const slots = data.slots.map(s => ({ hora: s.hora, opciones: s.opciones || [] })).filter(s => s.opciones.length);
        if (!slots.length) {
            box.innerHTML = '<p class="huecos-vacio">Hoy ya no quedan huecos. <a href="reservar">Ver otros días</a></p>';
            return;
        }
        box.innerHTML = slots.slice(0, 12).map(s => {
            const precioMin = Math.min(...s.opciones.map(o => Number(o.precio) || 0));
            return `<a class="hueco-chip" href="reservar" aria-label="Reservar a las ${s.hora} desde ${formatearPrecio(precioMin)}">${s.hora}<span style="font-size:12px;font-weight:700;letter-spacing:.01em">desde ${formatearPrecio(precioMin)}</span></a>`;
        }).join('');
    } catch (e) {
        console.warn('No se pudo cargar la disponibilidad:', e);
        box.innerHTML = '<p class="huecos-vacio">Disponibilidad no disponible ahora mismo. <a href="reservar">Ver reservas</a></p>';
    }
}
function iniciarLanding() {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    idle(() => { cargarTarifas(); cargarHuecosHoy(); }, { timeout: 3000 });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarLanding);
} else {
    iniciarLanding();
}