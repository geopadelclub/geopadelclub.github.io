/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
window.$ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const redondear2 = n => Math.round((Number(n) || 0) * 100) / 100;
function toast(msg, tipo = 'ok', ms = 3500) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo === 'ok' ? '' : tipo);
    el.textContent = msg;
    box.appendChild(el);
    const dur = tipo === 'err' ? Math.max(ms, 6000) : ms;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, dur);
}
function setBusy(btn, on, txt) {
    if (!btn) return;
    if (on) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; if (txt) btn.innerHTML = txt; }
    else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
}
function fechaLocalISO(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sumarDiasISO(iso, dias) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + dias, 12, 0, 0)).toISOString().split('T')[0];
}
function estadoRed() { $('bannerOffline').classList.toggle('show', !navigator.onLine); }
function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function leerTodo(construir, pagina = 1000, maximo = 200000) {
    const filas = [];
    for (let desde = 0; desde < maximo; desde += pagina) {
        const { data, error } = await construir().range(desde, desde + pagina - 1);
        if (error) return { data: null, error };
        if (data && data.length) filas.push(...data);
        if (!data || data.length < pagina) break;
    }
    return { data: filas, error: null };
}
function fechaBonita(iso, mayuscula) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(y, m - 1, d, 12).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return mayuscula ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
function aplicarTema(t, guardar = true) {
    document.documentElement.setAttribute('data-theme', t);
    if (guardar) { try { localStorage.setItem('gp-theme', t); } catch (e) { } }
    const meta = $('metaTheme');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#364650' : '#fcfdfc');
    document.querySelectorAll('.theme-toggle').forEach(b => {
        b.innerHTML = t === 'dark' ? '<i class="ri-sun-line" aria-hidden="true"></i>' : '<i class="ri-moon-line" aria-hidden="true"></i>';
        b.setAttribute('aria-label', t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
        b.title = t === 'dark' ? 'Modo claro' : 'Modo oscuro';
    });
}
function alternarTema() {
    aplicarTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
function iniciarTema() {
    aplicarTema(document.documentElement.getAttribute('data-theme') || 'light', false);
    try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const seguir = e => { let g = null; try { g = localStorage.getItem('gp-theme'); } catch (x) { } if (!g) aplicarTema(e.matches ? 'dark' : 'light', false); };
        if (mq.addEventListener) mq.addEventListener('change', seguir);
    } catch (e) { }
}
function normalizarTelefono(t) {
    let d = String(t || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('34') && d.length === 11) d = d.slice(2);
    return d;
}
function telefonoValido(t) {
    const txt = String(t || '').trim();
    const n = normalizarTelefono(txt).length;
    return /^[+\d][\d\s().-]*$/.test(txt) && n >= 9 && n <= 15;
}
function esErrorRed(e) {
    if (!e || e.code) return false;
    return /failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i.test(String(e.message || e));
}
async function conReintento(fn, intentos = 2, espera = 700) {
    let ultimo = null;
    for (let i = 0; i <= intentos; i++) {
        let fallo = false;
        try {
            const r = await fn();
            if (r && r.error && esErrorRed(r.error)) { ultimo = { r }; fallo = true; } else return r;
        } catch (e) {
            if (!esErrorRed(e)) throw e;
            ultimo = { e }; fallo = true;
        }
        if (fallo && (i === intentos || !navigator.onLine)) break;
        await new Promise(ok => setTimeout(ok, espera * (i + 1)));
    }
    if (ultimo.e) throw ultimo.e;
    return ultimo.r;
}
function enlazarBuscadorCliente(inpNombre, inpTel, alElegir) {
    if (!inpNombre || !inpTel) return;
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    const dig = s => String(s || '').replace(/\D/g, '');
    const MAX = 6;
    function buscar() {
        const palabras = norm(inpNombre.value).split(' ').filter(Boolean);
        const usaNombre = norm(inpNombre.value).length >= 2;
        const qt = dig(inpTel.value), usaTel = qt.length >= 3;
        if (!usaNombre && !usaTel) return [];
        const todos = (typeof datosLocales !== 'undefined' && datosLocales.clientes) || [];
        const res = [];
        for (const c of todos) {
            const nn = norm(c.nombre);
            if (usaNombre && !palabras.every(p => nn.includes(p))) continue;
            if (usaTel && !dig(c.telefono).includes(qt)) continue;
            const empieza = usaNombre && nn.startsWith(palabras[0]) ? 0 : 1;
            res.push({ c, empieza });
        }
        res.sort((a, b) => a.empieza - b.empieza || String(a.c.nombre).localeCompare(String(b.c.nombre), 'es'));
        return res.slice(0, MAX).map(x => x.c);
    }
    function vincular(inp) {
        const wrap = document.createElement('div');
        wrap.className = 'cli-wrap';
        inp.parentNode.insertBefore(wrap, inp);
        wrap.appendChild(inp);
        const caja = document.createElement('div');
        caja.className = 'cli-sug';
        caja.setAttribute('role', 'listbox');
        caja.hidden = true;
        wrap.appendChild(caja);
        inp.setAttribute('role', 'combobox');
        inp.setAttribute('aria-autocomplete', 'list');
        inp.setAttribute('aria-expanded', 'false');
        let lista = [], activo = -1;
        const cerrar = () => { caja.hidden = true; activo = -1; inp.setAttribute('aria-expanded', 'false'); };
        const marcar = () => caja.querySelectorAll('.cli-op').forEach((e, i) => e.classList.toggle('on', i === activo));
        function elegir(c) {
            inpNombre.value = c.nombre || '';
            inpTel.value = c.telefono || '';
            cerrar();
            if (alElegir) alElegir(c);
        }
        function abrir() {
            lista = buscar();
            if (!lista.length) { cerrar(); return; }
            caja.innerHTML = lista.map((c, i) => `<div class="cli-op" role="option" data-i="${i}"><b>${esc(c.nombre)}</b><small>${c.telefono ? esc(c.telefono) : 'Sin teléfono'}</small></div>`).join('');
            activo = -1;
            caja.hidden = false;
            inp.setAttribute('aria-expanded', 'true');
        }
        inp.addEventListener('input', abrir);
        inp.addEventListener('focus', () => { if (inp.value.trim()) abrir(); });
        inp.addEventListener('blur', () => setTimeout(cerrar, 150));
        inp.addEventListener('keydown', e => {
            if (caja.hidden) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); activo = (activo + 1) % lista.length; marcar(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); activo = (activo - 1 + lista.length) % lista.length; marcar(); }
            else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); elegir(lista[activo]); }
            else if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
        });
        caja.addEventListener('mousedown', e => e.preventDefault());
        caja.addEventListener('click', e => {
            const o = e.target.closest('.cli-op');
            if (o && lista[+o.dataset.i]) elegir(lista[+o.dataset.i]);
        });
    }
    vincular(inpNombre);
    vincular(inpTel);
}
function customConfirm(mensaje, titulo = 'Confirmación') {
    return new Promise((resolve) => {
        const dialog = $('modalConfirmDialog');
        if (!dialog || typeof dialog.showModal !== 'function') {
            resolve(window.confirm(mensaje));
            return;
        }
        $('confirmDialogTitle').innerText = titulo;
        $('confirmDialogMessage').innerText = mensaje;
        $('confirmDialogInputBox').style.display = 'none';

        const btnOk = $('confirmDialogOk');
        const btnCancel = $('confirmDialogCancel');

        const cleanup = () => {
            btnCancel.removeEventListener('click', onCancel);
            dialog.removeEventListener('close', onClose);
        };

        const onCancel = () => dialog.close('cancel');
        const onClose = () => {
            const ok = dialog.returnValue === 'ok';
            cleanup();
            resolve(ok);
        };

        btnCancel.addEventListener('click', onCancel);
        dialog.addEventListener('close', onClose);

        dialog.showModal();
        btnOk.onclick = () => dialog.close('ok');
    });
}
function customPrompt(mensaje, valorDefecto = '', titulo = 'Entrada requerida') {
    return new Promise((resolve) => {
        const dialog = $('modalConfirmDialog');
        if (!dialog || typeof dialog.showModal !== 'function') {
            resolve(window.prompt(mensaje, valorDefecto));
            return;
        }
        $('confirmDialogTitle').innerText = titulo;
        $('confirmDialogMessage').innerText = mensaje;
        $('confirmDialogInputBox').style.display = 'block';
        const input = $('confirmDialogInput');
        input.value = valorDefecto;

        const btnOk = $('confirmDialogOk');
        const btnCancel = $('confirmDialogCancel');

        const cleanup = () => {
            btnCancel.removeEventListener('click', onCancel);
            dialog.removeEventListener('close', onClose);
        };

        const onCancel = () => dialog.close('cancel');
        const onClose = () => {
            const val = dialog.returnValue === 'ok' ? input.value : null;
            cleanup();
            resolve(val);
        };

        btnCancel.addEventListener('click', onCancel);
        dialog.addEventListener('close', onClose);

        dialog.showModal();
        setTimeout(() => input.focus(), 50);
        btnOk.onclick = () => dialog.close('ok');
    });
}