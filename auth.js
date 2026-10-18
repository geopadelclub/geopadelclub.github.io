/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const supabaseClient = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { storage: window.localStorage, persistSession: true, autoRefreshToken: true }
    })
    : null;
let intentosFallidos = 0, bloqueoHasta = 0;
let tsLoginId = null, tsLoginToken = '';
function iniciarTurnstileLogin() {
    if (!TURNSTILE_SITEKEY || tsLoginId !== null) return;
    const box = $('cfLogin');
    if (!box) return;
    const pintar = () => {
        if (tsLoginId !== null || !window.turnstile) return;
        try {
            tsLoginId = window.turnstile.render('#cfLogin', {
                sitekey: TURNSTILE_SITEKEY,
                callback: t => { tsLoginToken = t; },
                'expired-callback': () => { tsLoginToken = ''; },
                'error-callback': () => {
                    tsLoginToken = '';
                    console.warn('Turnstile notificó un error de verificación o conexión.');
                }
            });
        } catch (e) {
            console.error('Error al renderizar Turnstile:', e);
        }
    };
    if (window.turnstile) { pintar(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.onload = pintar;
    document.head.appendChild(s);
}
function reiniciarTurnstileLogin() {
    tsLoginToken = '';
    if (window.turnstile && tsLoginId !== null) { try { window.turnstile.reset(tsLoginId); } catch (e) { } }
}
async function cargarPerfil(authUser) {
    const { data, error } = await supabaseClient.from('usuarios')
        .select('id, usuario, nombre, rol')
        .eq('auth_id', authUser.id).eq('estado', 'Activo').maybeSingle();
    if (error || !data) return null;
    return { id: data.id, user: data.usuario, nombre: data.nombre, rol: data.rol };
}
async function comprobarSesion() {
    if (!supabaseClient) { mostrarLogin(); return; }
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session) {
        if (sesionCaducada()) {
            await supabaseClient.auth.signOut();
            try { localStorage.removeItem(CLAVE_SESION_INI); } catch (e) { }
            mostrarLogin();
            toast('La sesión ha caducado. Vuelve a entrar.', 'warn');
            return;
        }
        const perfil = await cargarPerfil(data.session.user);
        if (perfil) {
            usuarioSesion = perfil;
            if (!localStorage.getItem(CLAVE_SESION_INI)) marcarInicioSesion();
            mostrarPanelAdmin();
            return;
        }
        await supabaseClient.auth.signOut();
    }
    mostrarLogin();
}
async function cerrarSesion() {
    if (canalRealtime) { supabaseClient.removeChannel(canalRealtime); canalRealtime = null; }
    await supabaseClient.auth.signOut();
    try { localStorage.removeItem(CLAVE_SESION_INI); } catch (e) { }
    usuarioSesion = null;
    $('password').value = '';
    $('msgLogin').innerText = '';
    cambiarPestana('reservas');
    mostrarLogin();
}
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_OUT' && usuarioSesion) { usuarioSesion = null; mostrarLogin(); }
    });
}
function mostrarLogin() {
    $('loginView').style.display = 'flex';
    $('adminView').style.display = 'none';
    iniciarTurnstileLogin();
    reiniciarTurnstileLogin();
}
function mostrarPanelAdmin() {
    if (!supabaseClient) {
        mostrarLogin();
        $('msgLogin').className = 'msg-error';
        $('msgLogin').innerText = 'No se pudo cargar la librería de base de datos. Revisa tu conexión y recarga.';
        return;
    }
    $('loginView').style.display = 'none';
    $('adminView').style.display = 'block';
    $('nombreEmpleado').innerText = usuarioSesion.nombre;
    $('rolEmpleado').innerText = usuarioSesion.rol || 'Trabajador';
    inicializarFechaHoy();
    pobladorPistasModal();
    iniciarFormDeuda();
    iniciarFormLimpieza();
    if (typeof aplicarPermisosCopia === 'function') aplicarPermisosCopia();
    if (typeof aplicarPermisosFichajes === 'function') aplicarPermisosFichajes();
    renderSelectorMesas();
    iniciarSuscripcionRealtime();
    cargarDatosGlobales();
    if (!esJefa()) cargarMisFichajes();
}
$('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const msgDiv = $('msgLogin'), btn = $('btnEntrar');
    if (!supabaseClient) { msgDiv.className = 'msg-error'; msgDiv.innerText = 'No se pudo cargar la base de datos. Recarga la página.'; return; }
    if (Date.now() < bloqueoHasta) {
        msgDiv.className = 'msg-error';
        msgDiv.innerText = `Demasiados intentos. Espera ${Math.ceil((bloqueoHasta - Date.now()) / 1000)} s.`;
        return;
    }
    const user = $('usuario').value.trim().toLowerCase().replace(/\s+/g, '');
    const pass = $('password').value;
    if (!user || !pass) { msgDiv.className = 'msg-error'; msgDiv.innerText = 'Introduce usuario y contraseña'; return; }
    if (TURNSTILE_SITEKEY && !tsLoginToken) { msgDiv.className = 'msg-error'; msgDiv.innerText = 'Completa la verificación anti-spam'; return; }
    btn.disabled = true; btn.innerText = "Verificando...";
    msgDiv.className = ''; msgDiv.innerText = 'Conectando...';
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: user + DOMINIO_LOGIN, password: pass,
            options: { captchaToken: tsLoginToken }
        });
        if (error) {
            if (error.code === 'captcha_failed' || /captcha/i.test(error.message || '')) {
                msgDiv.className = 'msg-error'; msgDiv.innerText = 'No se pudo verificar el anti-spam. Inténtalo de nuevo.';
            } else if (error.status === 400 || /invalid login/i.test(error.message || '')) {
                intentosFallidos++;
                if (intentosFallidos >= 5) { bloqueoHasta = Date.now() + 30000; intentosFallidos = 0; }
                msgDiv.className = 'msg-error'; msgDiv.innerText = /not confirmed/i.test(error.message || '') ? 'Este usuario no está confirmado. Contacta con el administrador.' : 'Credenciales incorrectas';
            } else throw error;
        } else {
            const perfil = await cargarPerfil(data.user);
            if (!perfil) {
                await supabaseClient.auth.signOut();
                msgDiv.className = 'msg-error'; msgDiv.innerText = 'Usuario inactivo o sin perfil. Contacta con el administrador.';
            } else {
                intentosFallidos = 0;
                usuarioSesion = perfil;
                marcarInicioSesion();
                reiniciarTurnstileLogin();
                msgDiv.className = 'msg-success'; msgDiv.innerText = '¡Bienvenido!';
                setTimeout(() => { btn.disabled = false; btn.innerText = "Entrar al Panel"; mostrarPanelAdmin(); }, 250);
                return;
            }
        }
    } catch (err) {
        console.error(err);
        msgDiv.className = 'msg-error'; msgDiv.innerText = 'Error de conexión. Inténtalo de nuevo.';
    }
    reiniciarTurnstileLogin();
    btn.disabled = false; btn.innerText = "Entrar al Panel";
});
const refrescar = {
    reservas: debounce(() => cargarReservasHoy(), 250),
    mesas: debounce(() => cargarMesasBar(), 250),
    ventas: debounce(() => cargarCajaHoy(), 400),
    productos: debounce(() => cargarProductos(), 300),
    tarifas: debounce(() => cargarTarifas(), 300),
    deudas: debounce(() => cargarDeudas(), 300),
    limpiezas: debounce(() => cargarLimpiezas(false), 300)
};
function iniciarSuscripcionRealtime() {
    if (canalRealtime) { supabaseClient.removeChannel(canalRealtime); canalRealtime = null; }
    canalRealtime = supabaseClient.channel('geopadel-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, refrescar.reservas)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservas' }, avisarNuevaReservaWeb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas_bar' }, refrescar.mesas)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, refrescar.ventas)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, refrescar.productos)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tarifas' }, refrescar.tarifas)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deudas' }, refrescar.deudas)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'limpiezas' }, refrescar.limpiezas)
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                mostrarFlashSync();
                if (canalConError) { canalConError = false; cargarDatosGlobales(); }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                canalConError = true;
            }
        });
}
let audioCtx = null;
function pitar() {
    try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination); o.frequency.value = 880;
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        o.start(); o.stop(audioCtx.currentTime + 0.6);
    } catch (e) { }
}
function avisarNuevaReservaWeb(p) {
    const r = p && p.new;
    if (!r || r.origen !== 'web' || r.estado !== 'Pendiente') return;
    toast(`Nueva reserva web: ${r.cliente || ''} · ${fechaBonita(r.fecha)} ${String(r.hora_inicio || '').slice(0, 5)}`, 'warn', 9000);
    pitar();
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { }
}
function mostrarFlashSync() {
    const el = $('gpSync');
    if (!el) return;
    el.style.opacity = 1;
    setTimeout(() => { el.style.opacity = 0; }, 1500);
}
window.addEventListener('online', () => { estadoRed(); if (usuarioSesion) cargarDatosGlobales(); });
window.addEventListener('offline', estadoRed);
document.addEventListener('visibilitychange', () => {
    if (document.hidden || !usuarioSesion) return;
    if (sesionCaducada()) { cerrarSesion(); toast('La sesión ha caducado. Vuelve a entrar.', 'warn'); return; }
    if (navigator.onLine) cargarDatosGlobales();
});
function cambiarPestana(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
    $(`tab-${tabName}`).classList.add('active');
    const nav = $(`nav-${tabName}`);
    nav.classList.add('active'); nav.setAttribute('aria-current', 'page');
    document.title = 'Geopadel · ' + ({ reservas: 'Reservas', tienda: 'Tienda', fichajes: 'Fichaje', caja: 'Caja', deudas: 'Deudas', limpieza: 'Limpieza', ajustes: 'Ajustes' }[tabName] || 'Panel');
    if (usuarioSesion) {
        if (tabName === 'deudas') cargarDeudas();
        if (tabName === 'tienda') { cargarMesasBar(); if (typeof entrarEscaparate === 'function') entrarEscaparate(); }
        if (tabName === 'ajustes' && typeof entrarAjustes === 'function') entrarAjustes();
        if (tabName === 'limpieza') entrarPestanaLimpieza();
        if (tabName === 'caja') { cargarHistorialCaja(); cargarCajaHoy(); }
        if (tabName === 'fichajes') { if (!esJefa()) { cargarMisFichajes(); if (typeof entrarContrato === 'function') entrarContrato(); } if (typeof entrarFichajes === 'function') entrarFichajes(); }
        if (tabName === 'reservas') { scrollAhoraPendiente = true; renderizarCuadrantePlaytomic(datosLocales.reservas || []); }
    }
}
document.querySelectorAll('.nav-tab').forEach(b => b.addEventListener('click', () => cambiarPestana(b.dataset.tab)));
async function fichar(tipo, btn) {
    const msg = $('msgFichaje');
    if (esJefa()) return;
    if (typeof asegurarContrato === 'function' && !(await asegurarContrato())) { msg.style.color = 'var(--orange-text)'; msg.innerText = 'Para fichar necesitas indicar tu contrato.'; return; }
    if (ultimoFichaje && ultimoFichaje.tipo === tipo) {
        if (!(await customConfirm(`Tu último fichaje ya fue de ${tipo}. ¿Registrar otra ${tipo} igualmente?`))) return;
    }
    setBusy(btn, true);
    try {
        const { error } = await supabaseClient.from('fichajes').insert({ empleado: usuarioSesion.user, tipo });
        if (error) throw error;
        msg.style.color = 'var(--green)';
        msg.innerText = `Fichaje de ${tipo} registrado correctamente`;
        await cargarMisFichajes();
    } catch (err) {
        msg.style.color = 'var(--red)';
        msg.innerText = "Error: " + (err.message || err);
    } finally { setBusy(btn, false); }
}
async function cargarMisFichajes() {
    const tbody = $('tablaFichajesBody');
    if (!tbody || !usuarioSesion) return;
    const { data, error } = await supabaseClient.from('fichajes').select('*').eq('empleado', usuarioSesion.user).order('created_at', { ascending: false }).limit(30);
    if (error) { tbody.innerHTML = `<tr><td colspan="3" class="tabla-empty" style="color:var(--red)">Error al cargar fichajes: ${esc(error.message)}</td></tr>`; return; }
    if (!data || !data.length) { ultimoFichaje = null; $('estadoFichaje').innerText = ''; tbody.innerHTML = `<tr><td colspan="3" class="tabla-empty">No hay registros de fichajes aún</td></tr>`; return; }
    const fmt = f => {
        const d = new Date(f.created_at || f.fecha_hora);
        return isNaN(d.getTime()) ? (f.created_at || f.fecha_hora || '-') : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
    };
    ultimoFichaje = { tipo: data[0].tipo };
    $('estadoFichaje').innerText = `Último fichaje: ${data[0].tipo} · ${fmt(data[0])}`;
    tbody.innerHTML = data.map(f => {
        const ent = f.tipo === 'Entrada';
        return `<tr>
<td><b>${esc(fmt(f))}</b></td>
<td><span class="badge-fichaje ${ent ? 'in' : 'out'}">${ent ? '<i class="ri-login-box-line" aria-hidden="true"></i>Entrada' : '<i class="ri-logout-box-line" aria-hidden="true"></i>Salida'}</span></td>
<td><b>${esc(f.empleado)}</b></td></tr>`;
    }).join('');
}
window.addEventListener('DOMContentLoaded', () => { iniciarTema(); estadoRed(); comprobarSesion(); });
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}