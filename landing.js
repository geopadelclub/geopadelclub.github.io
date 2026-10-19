/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(async () => {
    const cargarSupabase = () => new Promise((res, rej) => {
        if (window.supabase && window.supabase.createClient) return res();
        const s = document.createElement('script');
        s.src = 'assets/supabase.min.js';
        s.async = true;
        s.onload = res;
        s.onerror = () => rej(new Error('No se pudo cargar Supabase'));
        document.head.appendChild(s);
    });
    try {
        await cargarSupabase();
    } catch (e) {
        console.warn(e);
        return;
    }
    if (!window.supabase || !window.supabase.createClient) return;
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    cargarTarifas(sb);
    cargarHuecosHoy(sb);
})();
const MAPA_TARIFAS = { 'Entre semana mañana': 'semanaManana', 'Entre semana tarde': 'semanaTarde', 'Fin de semana': 'finde' };
function formatearPrecio(v) {
    return Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
async function cargarTarifas(sb) {
    try {
        const { data, error } = await sb.from('tarifas').select('franja, precio_60min, precio_90min, precio_120min');
        if (error) throw error;
        (data || []).forEach(t => {
            const k = MAPA_TARIFAS[t.franja];
            if (!k) return;
            [['60', t.precio_60min], ['90', t.precio_90min], ['120', t.precio_120min]].forEach(([dur, val]) => {
                const el = document.querySelector(`[data-tarifa="${k}-${dur}"]`);
                if (el && val !== null && val !== undefined && val !== '') {
                    el.textContent = formatearPrecio(val);
                }
            });
        });
    } catch (e) {
        console.warn('No se pudieron cargar las tarifas dinámicas:', e);
    }
}
function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
async function cargarHuecosHoy(sb) {
    const box = document.getElementById('huecosHoy');
    if (!box) return;
    try {
        const { data, error } = await sb.rpc('web_disponibilidad', { p_fecha: hoyISO() });
        if (error) throw error;
        if (!data || !data.ok || !Array.isArray(data.slots)) {
            box.innerHTML = `<p class="huecos-vacio">${t('huecos.error')} <a href="reservar">${t('huecos.ver')}</a></p>`;
            return;
        }
        const slots = data.slots
            .map(s => ({ hora: s.hora, opciones: s.opciones || [] }))
            .filter(s => s.opciones.length);
        if (!slots.length) {
            box.innerHTML = '<p class="huecos-vacio">Hoy ya no quedan huecos. <a href="reservar">Ver otros días</a></p>';
            return;
        }
        box.innerHTML = slots.slice(0, 12).map(s => {
            const precioMin = Math.min(...s.opciones.map(o => Number(o.precio) || 0));
            return `<a class="hueco-chip" href="reservar" aria-label="Reservar a las ${s.hora} desde ${formatearPrecio(precioMin)}">${s.hora}<span style="font-size:12px;opacity:.8;font-weight:600">desde ${formatearPrecio(precioMin)}</span></a>`;
        }).join('');
    } catch (e) {
        console.warn('No se pudo cargar la disponibilidad:', e);
        box.innerHTML = '<p class="huecos-vacio">Disponibilidad no disponible ahora mismo. <a href="reservar">Ver reservas</a></p>';
    }
}