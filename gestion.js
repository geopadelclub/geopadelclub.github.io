/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const LIMP_TAREAS = ['Estructura', 'Césped', 'Cristales'];
const LIMP_DIAS_AVISO = 14;
const MSG_FALTA_TABLA = t => `Falta crear la tabla «${t}» en Supabase. Ejecuta migracion_deudas_limpieza.sql en el SQL Editor.`;
const esErrorTabla = err => /relation|does not exist|schema cache|could not find/i.test(String((err && err.message) || ''));
const fmtFecha = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fmtFechaHora = v => { const d = new Date(v); return isNaN(d.getTime()) ? '-' : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); };
function ahoraLocalInput() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

let deudas = [];
function iniciarFormDeuda() {
    $('deudaFecha').value = fechaLocalISO();
    $('deudaHora').value = '';
}
enlazarBuscadorCliente($('deudaNombre'), $('deudaTelefono'));

async function cargarDeudas() {
    const tb = $('deudasBody');
    if (!tb || !supabaseClient) return;
    try {
        const { data: pend } = await supabaseClient.from('deudas').select('importe').neq('estado', 'Resuelta');
        const total = redondear2((pend || []).reduce((s, d) => s + (Number(d.importe) || 0), 0));
        $('deudaTotal').innerText = eur(total);
    } catch (e) { console.error(e); }

    const filtro = $('deudaFiltro')?.value || 'Pendiente';
    let q = supabaseClient.from('deudas').select('*');
    if (filtro === 'Pendiente') q = q.neq('estado', 'Resuelta');
    else if (filtro === 'Resuelta') q = q.eq('estado', 'Resuelta');
    q = q.order('fecha', { ascending: false }).order('hora', { ascending: false }).order('id', { ascending: false });

    const { data, error } = await conReintento(() => leerTodo(() => q));
    if (error) {
        console.error(error);
        tb.innerHTML = `<tr><td colspan="6" class="tabla-empty" style="color:var(--red)">${esc(esErrorTabla(error) ? MSG_FALTA_TABLA('deudas') : 'Error al cargar deudas: ' + error.message)}</td></tr>`;
        return;
    }
    deudas = data || [];
    dibujarDeudas();
}

function dibujarDeudas() {
    const tb = $('deudasBody');
    if (!tb) return;
    const q = $('deudaBuscar').value.toLowerCase().trim();
    const lista = deudas.filter(d =>
        !q || String(d.nombre).toLowerCase().includes(q) || String(d.telefono || '').toLowerCase().includes(q));
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="6" class="tabla-empty">No hay deudas en esta lista</td></tr>'; return; }
    tb.innerHTML = lista.map(d => {
        const res = d.estado === 'Resuelta';
        const tel = d.telefono ? `<a href="tel:${esc(d.telefono)}" style="color:var(--blue);font-weight:700">${esc(d.telefono)}</a>` : '—';
        const hora = String(d.hora || '').slice(0, 5);
        const estado = res
            ? `<span class="badge-deuda ok"><i class="ri-check-line" aria-hidden="true"></i>Resuelta</span>${d.resuelta_por ? `<small style="display:block;color:var(--muted);font-weight:600;margin-top:3px">${esc(d.resuelta_por)} · ${esc(fmtFechaHora(d.resuelta_at))}</small>` : ''}`
            : '<span class="badge-deuda pend"><i class="ri-time-line" aria-hidden="true"></i>Pendiente</span>';
        const accion = res
            ? `<button type="button" class="btn-add gray" data-act="reabrir" data-id="${esc(d.id)}"><i class="ri-arrow-go-back-line" aria-hidden="true"></i>Reabrir</button>`
            : `<button type="button" class="btn-add" data-act="resolver" data-id="${esc(d.id)}"><i class="ri-check-double-line" aria-hidden="true"></i>Resolver</button>`;
        return `<tr class="${res ? 'deuda-resuelta' : ''}">
<td><b>${esc(d.nombre)}</b></td>
<td>${tel}</td>
<td>${esc(fmtFecha(d.fecha))}${hora ? ' · ' + esc(hora) : ''}</td>
<td><b>${eur(d.importe)}</b></td>
<td>${estado}</td>
<td>${accion}<button type="button" class="btn-add danger" data-act="eliminar" data-id="${esc(d.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>Eliminar</button></td>
</tr>`;
    }).join('');
}

async function anadirDeuda(e) {
    e.preventDefault();
    const msg = $('msgDeuda'), btn = $('btnAddDeuda');
    const err = t => { msg.style.color = 'var(--red)'; msg.innerText = t; };
    const nombre = $('deudaNombre').value.trim();
    const telefono = normalizarTelefono($('deudaTelefono').value);
    const fecha = $('deudaFecha').value;
    const hora = $('deudaHora').value;
    const importe = parseFloat($('deudaImporte').value);
    if (!nombre) return err('Escribe el nombre');
    if ($('deudaTelefono').value.trim() && !telefonoValido($('deudaTelefono').value)) return err('El teléfono no parece válido (mínimo 9 cifras)');
    if (!fecha || !hora) return err('Indica el día y la hora');
    if (isNaN(importe) || importe <= 0) return err('Indica el dinero que debe (mayor que 0)');
    setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...');
    try {
        const { error } = await supabaseClient.from('deudas').insert({
            nombre, telefono: telefono || null, fecha, hora, importe: redondear2(importe),
            estado: 'Pendiente', creado_por: nombreUsuario()
        });
        if (error) throw error;
        $('formDeuda').reset();
        iniciarFormDeuda();
        msg.style.color = 'var(--green)'; msg.innerText = 'Deuda añadida';
        setTimeout(() => { if (msg.innerText === 'Deuda añadida') msg.innerText = ''; }, 3000);
        cargarDeudas();
    } catch (ex) {
        console.error(ex);
        err(esErrorTabla(ex) ? MSG_FALTA_TABLA('deudas') : 'No se pudo guardar: ' + (ex.message || ex));
    } finally { setBusy(btn, false); }
}

async function cambiarEstadoDeuda(id, resolver) {
    const d = deudas.find(x => String(x.id) === String(id));
    if (!d) return;
    const msg = resolver
        ? `¿Marcar como resuelta la deuda de ${d.nombre} (${eur(d.importe)})?`
        : '¿Volver a poner esta deuda como pendiente?';
    if (!(await customConfirm(msg))) return;
    const upd = resolver
        ? { estado: 'Resuelta', resuelta_por: nombreUsuario(), resuelta_at: new Date().toISOString() }
        : { estado: 'Pendiente', resuelta_por: null, resuelta_at: null };
    const { error } = await supabaseClient.from('deudas').update(upd).eq('id', id);
    if (error) return toast('No se pudo actualizar la deuda: ' + error.message, 'err');
    toast(resolver ? 'Deuda resuelta' : 'Deuda reabierta');
    cargarDeudas();
}

async function eliminarDeuda(id) {
    const d = deudas.find(x => String(x.id) === String(id));
    if (!d) return;
    if (!(await customConfirm(`¿Anular la deuda de ${d.nombre} (${eur(d.importe)})?`))) return;
    const empleado = nombreUsuario();
    const { data, error } = await supabaseClient.rpc('anular_deuda', {
        p_deuda_id: id,
        p_empleado: empleado
    });
    if (error || (data && !data.ok)) {
        return toast('No se pudo anular la deuda: ' + (error?.message || data?.error), 'err');
    }
    toast('Deuda anulada');
    cargarDeudas();
}

let limpiezas = [], limpUltimas = [];
async function iniciarFormLimpieza() {
    const cont = $('limpPistas'), tar = $('limpTareas');
    cont.innerHTML = listaPistas.map(p => `<label class="pistas-checkbox-item"><input type="checkbox" name="chkLimpPista" value="${esc(p)}"><span>${esc(p)}</span></label>`).join('');
    tar.innerHTML = LIMP_TAREAS.map(t => `<label class="pistas-checkbox-item"><input type="checkbox" name="chkLimpTarea" value="${esc(t)}"><span>${esc(t)}</span></label>`).join('');
    $('limpEmpleado').value = usuarioSesion ? usuarioSesion.nombre : '';
    $('limpFecha').value = ahoraLocalInput();
    try {
        const { data } = await supabaseClient.from('usuarios').select('nombre').eq('estado', 'Activo').order('nombre');
        const dl = $('dlTrabajadores');
        dl.innerHTML = '';
        (data || []).forEach(u => { if (u.nombre) dl.appendChild(new Option('', u.nombre)); });
    } catch (e) { }
}
function limpiezaSeleccionarPistas(on) {
    document.querySelectorAll('input[name="chkLimpPista"]').forEach(c => { c.checked = on; });
}
function ultimasLimpiezas() {
    const mapa = {};
    limpUltimas.forEach(l => {
        const k = l.pista + '|' + l.tarea;
        if (!mapa[k] || new Date(l.fecha_hora) > new Date(mapa[k].fecha_hora)) mapa[k] = l;
    });
    return mapa;
}
function diasDesde(v) { return Math.floor((Date.now() - new Date(v).getTime()) / 86400000); }
function limpiezasVencidas() {
    const ult = ultimasLimpiezas(), lim = LIMP_DIAS_AVISO * 86400000, venc = [];
    listaPistas.forEach(p => {
        const items = [];
        LIMP_TAREAS.forEach(t => {
            const l = ult[p + '|' + t];
            if (!l) items.push({ tarea: t, sin: true });
            else if (Date.now() - new Date(l.fecha_hora).getTime() > lim) items.push({ tarea: t, dias: diasDesde(l.fecha_hora) });
        });
        if (items.length) venc.push({ pista: p, items });
    });
    return venc;
}
const textoVencido = it => it.sin ? `${it.tarea}: sin registro` : `${it.tarea}: hace ${it.dias} días`;
async function cargarLimpiezas(mostrarAviso) {
    const tbE = $('limpEstadoBody'), tbH = $('limpHistBody');
    if (!tbE || !supabaseClient) return false;
    const { data, error } = await supabaseClient.from('limpiezas').select('*')
        .order('fecha_hora', { ascending: false }).limit(40);
    if (error) {
        console.error(error);
        const m = esErrorTabla(error) ? MSG_FALTA_TABLA('limpiezas') : 'Error al cargar limpiezas: ' + error.message;
        tbE.innerHTML = `<tr><td colspan="4" class="tabla-empty" style="color:var(--red)">${esc(m)}</td></tr>`;
        tbH.innerHTML = '<tr><td colspan="5" class="tabla-empty">—</td></tr>';
        return false;
    }
    limpiezas = data || [];
    const u = await supabaseClient.from('limpiezas_ultimas').select('*');
    if (!u.error) limpUltimas = u.data || [];
    else {
        const t = await leerTodo(() => supabaseClient.from('limpiezas').select('*').order('fecha_hora', { ascending: false }).order('id', { ascending: false }));
        limpUltimas = t.data || limpiezas;
    }
    dibujarLimpieza();
    if (mostrarAviso) mostrarAvisoLimpieza();
    return true;
}
function dibujarLimpieza() {
    const ult = ultimasLimpiezas(), lim = LIMP_DIAS_AVISO * 86400000;
    $('limpEstadoBody').innerHTML = listaPistas.map(p => {
        const celdas = LIMP_TAREAS.map(t => {
            const l = ult[p + '|' + t];
            if (!l) return '<td class="limp-cell"><span class="limp-ko">Sin registro</span></td>';
            const venc = Date.now() - new Date(l.fecha_hora).getTime() > lim;
            // FIX: usar fechaLocalISO en vez del hack 'en-CA'
            return `<td class="limp-cell"><span class="${venc ? 'limp-ko' : 'limp-ok'}">${esc(fmtFecha(fechaLocalISO(new Date(l.fecha_hora))))}</span><small>hace ${diasDesde(l.fecha_hora)} d · ${esc(l.empleado)}</small></td>`;
        }).join('');
        return `<tr><td><b>${esc(p)}</b></td>${celdas}</tr>`;
    }).join('');
    const hist = limpiezas.slice(0, 40);
    $('limpHistBody').innerHTML = hist.length ? hist.map(l => `<tr>
<td>${esc(fmtFechaHora(l.fecha_hora))}</td><td><b>${esc(l.pista)}</b></td><td>${esc(l.tarea)}</td><td>${esc(l.empleado)}</td>
<td><button type="button" class="btn-del-prod" data-id="${esc(l.id)}" aria-label="Eliminar registro"><i class="ri-delete-bin-line" aria-hidden="true"></i></button></td></tr>`).join('')
        : '<tr><td colspan="5" class="tabla-empty">Aún no hay limpiezas registradas</td></tr>';
    const venc = limpiezasVencidas(), banner = $('avisoLimpiezaBanner');
    if (venc.length) {
        const n = venc.reduce((s, v) => s + v.items.length, 0);
        banner.innerHTML = `<i class="ri-error-warning-line" aria-hidden="true"></i>${n} ${n === 1 ? 'limpieza pendiente' : 'limpiezas pendientes'} en ${venc.length} ${venc.length === 1 ? 'pista' : 'pistas'} (más de 2 semanas o sin registro). Revisa la tabla en rojo.`;
        banner.hidden = false;
    } else banner.hidden = true;
}
function mostrarAvisoLimpieza() {
    const venc = limpiezasVencidas();
    if (!venc.length) return;
    $('avisoLimpCuerpo').innerHTML = `<p style="font-weight:700;color:var(--text)">Estas pistas llevan más de 2 semanas sin limpiarse (o no tienen registro):</p><ul class="aviso-lista">${venc.map(v => `<li>${esc(v.pista)}<small>${esc(v.items.map(textoVencido).join(' · '))}</small></li>`).join('')}</ul>`;
    abrirOverlay('modalAvisoLimpieza');
}
function cerrarAvisoLimpieza() { cerrarOverlay('modalAvisoLimpieza'); }
async function entrarPestanaLimpieza() {
    $('limpFecha').value = ahoraLocalInput();
    if (!$('limpEmpleado').value && usuarioSesion) $('limpEmpleado').value = usuarioSesion.nombre;
    await cargarLimpiezas(true);
}
async function registrarLimpieza(e) {
    e.preventDefault();
    const msg = $('msgLimpieza'), btn = $('btnLimpieza');
    const err = t => { msg.style.color = 'var(--red)'; msg.innerText = t; };
    const pistas = Array.from(document.querySelectorAll('input[name="chkLimpPista"]:checked')).map(c => c.value);
    const tareas = Array.from(document.querySelectorAll('input[name="chkLimpTarea"]:checked')).map(c => c.value);
    const empleado = $('limpEmpleado').value.trim();
    const cuando = new Date($('limpFecha').value);
    if (!pistas.length) return err('Selecciona al menos una pista');
    if (!tareas.length) return err('Selecciona qué se ha limpiado');
    if (!empleado) return err('Indica quién lo ha limpiado');
    if (isNaN(cuando.getTime())) return err('Indica cuándo se ha limpiado');
    if (cuando.getTime() > Date.now() + 5 * 60000) return err('La fecha no puede estar en el futuro');
    const iso = cuando.toISOString();
    const filas = [];
    pistas.forEach(p => tareas.forEach(t => filas.push({ pista: p, tarea: t, empleado, fecha_hora: iso })));
    setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...');
    try {
        const { error } = await supabaseClient.from('limpiezas').insert(filas);
        if (error) throw error;
        document.querySelectorAll('input[name="chkLimpPista"], input[name="chkLimpTarea"]').forEach(c => { c.checked = false; });
        msg.style.color = 'var(--green)'; msg.innerText = `Limpieza registrada (${pistas.length} ${pistas.length === 1 ? 'pista' : 'pistas'})`;
        setTimeout(() => { if (msg.innerText.startsWith('Limpieza registrada')) msg.innerText = ''; }, 4000);
        await cargarLimpiezas(false);
    } catch (ex) {
        console.error(ex);
        err(esErrorTabla(ex) ? MSG_FALTA_TABLA('limpiezas') : 'No se pudo guardar: ' + (ex.message || ex));
    } finally { setBusy(btn, false); }
}
async function eliminarLimpieza(id) {
    if (!(await customConfirm('¿Eliminar este registro de limpieza?'))) return;
    const { error } = await supabaseClient.from('limpiezas').delete().eq('id', id);
    if (error) return toast('No se pudo eliminar: ' + error.message, 'err');
    toast('Registro eliminado');
    cargarLimpiezas(false);
}
$('formDeuda').addEventListener('submit', anadirDeuda);
$('deudasBody').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'eliminar') eliminarDeuda(b.dataset.id);
    else cambiarEstadoDeuda(b.dataset.id, b.dataset.act === 'resolver');
});
$('formLimpieza').addEventListener('submit', registrarLimpieza);
$('limpHistBody').addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (b) eliminarLimpieza(b.dataset.id);
});