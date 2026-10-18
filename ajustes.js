/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const CLI_MAX_FILAS = 30;
const CLI_SPIN = '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>';
let cliFiltrados = [];
const cliNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const cliTel = s => String(s || '').replace(/[^\d+]/g, '');
function dibujarClientesAjustes() {
    const tb = $('cliBody');
    if (!tb) return;
    const q = cliNorm($('cliBuscar').value), qt = cliTel($('cliBuscar').value);
    const todos = datosLocales.clientes || [];
    cliFiltrados = todos.filter(c => !q || cliNorm(c.nombre).includes(q) || (qt.length >= 3 && cliTel(c.telefono).includes(qt)));
    const lista = cliFiltrados.slice(0, CLI_MAX_FILAS);
    $('cliContador').innerText = cliFiltrados.length > lista.length
        ? `Mostrando ${lista.length} de ${cliFiltrados.length} clientes. Escribe más letras para afinar.`
        : `${cliFiltrados.length} ${cliFiltrados.length === 1 ? 'cliente' : 'clientes'}`;
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="3" class="tabla-empty">No hay clientes con ese nombre o teléfono</td></tr>'; return; }
    tb.innerHTML = lista.map((c, i) => {
        const tel = c.telefono ? `<a href="tel:${esc(c.telefono)}" style="color:var(--blue);font-weight:700">${esc(c.telefono)}</a>` : '<span style="color:var(--muted)">Sin teléfono</span>';
        const sinTel = c.telefono ? '' : ' disabled title="El cliente no tiene teléfono"';
        const soloJefa = esJefa();
        return `<tr><td><b>${esc(c.nombre)}</b></td><td>${tel}</td><td class="esc-acciones">
${soloJefa ? `<button type="button" class="btn-add gray" data-cli="reset" data-i="${i}"${sinTel}><i class="ri-key-2-line" aria-hidden="true"></i>Restablecer código</button>` : ''}
<button type="button" class="btn-add blue" data-cli="habilitar" data-i="${i}"${sinTel}><i class="ri-global-line" aria-hidden="true"></i>Habilitar acceso web</button>
${soloJefa ? `<button type="button" class="btn-add danger" data-cli="borrar" data-i="${i}"><i class="ri-user-unfollow-line" aria-hidden="true"></i>Borrar datos (RGPD)</button>` : ''}
</td></tr>`;
    }).join('');
}
async function entrarAjustes() {
    dibujarClientesAjustes();
    await cargarClientes();
    dibujarClientesAjustes();
}
async function cliResetearCodigo(c, btn) {
    if (!esJefa()) return toast('Solo la jefa puede restablecer códigos', 'err');
    if (!(await customConfirm(`¿Restablecer el código web de «${c.nombre}» y habilitarle el acceso web?\n\nTendrá que crear uno nuevo en su próxima reserva. Hazlo solo si has comprobado que es él.`))) return;
    setBusy(btn, true, CLI_SPIN + 'Restableciendo...');
    try {
        const { data, error } = await supabaseClient.rpc('gp_resetear_codigo_cliente', { p_telefono: c.telefono });
        if (error) throw error;
        if (!data || !data.ok) return toast('No tienes permiso para hacerlo', 'err');
        const h = await supabaseClient.rpc('gp_habilitar_acceso_web', { p_telefono: c.telefono });
        if (h.error || !h.data || !h.data.ok) { console.warn('No se pudo habilitar el acceso web', h.error); return toast('Código restablecido, pero no se pudo habilitar el acceso web', 'warn'); }
        toast('Código web restablecido y acceso web habilitado');
    } catch (err) {
        toast('No se pudo restablecer: ' + (err.message || err), 'err');
    } finally { setBusy(btn, false); }
}
async function cliHabilitarAcceso(c, btn) {
    if (!(await customConfirm(`¿Habilitar el acceso web de «${c.nombre}»?\n\nPodrá crear su código en su próxima reserva online. Hazlo solo si has comprobado que es él.`))) return;
    setBusy(btn, true, CLI_SPIN + 'Habilitando...');
    try {
        const { data, error } = await supabaseClient.rpc('gp_habilitar_acceso_web', { p_telefono: c.telefono });
        if (error) throw error;
        if (!data || !data.ok) return toast('No tienes permiso para hacerlo', 'err');
        toast('Acceso web habilitado');
    } catch (err) {
        toast('No se pudo habilitar: ' + (err.message || err), 'err');
    } finally { setBusy(btn, false); }
}
async function cliBorrarDatos(c, btn) {
    if (!esJefa()) return toast('Solo la jefa puede borrar datos de clientes', 'err');
    if (!c.id) return toast('Falta el identificador del cliente. Recarga la lista e inténtalo de nuevo.', 'err');
    if (!(await customConfirm(`¿Borrar los datos personales de «${c.nombre}»?\n\nSe elimina su ficha y se quita su nombre y teléfono de reservas y deudas (los importes se conservan sin datos personales). Se cancelan sus reservas futuras sin cobros. No se puede deshacer.`))) return;
    setBusy(btn, true, CLI_SPIN + 'Borrando...');
    try {
        const { data, error } = await supabaseClient.rpc('gp_borrar_cliente', { p_id: c.id });
        if (error) throw error;
        if (!data || !data.ok) {
            const t = { deuda_pendiente: 'Tiene deudas pendientes. Resuélvelas antes de borrar sus datos.', reservas_pagadas: 'Tiene reservas futuras con cobros. Devuelve o elimina esas reservas antes.', no_encontrado: 'No hay ninguna ficha de cliente con ese nombre.', sin_permiso: 'No tienes permiso para hacerlo.' };
            return toast(t[data && data.error] || 'No se pudo borrar', 'err');
        }
        toast('Datos del cliente borrados');
        await cargarClientes();
        dibujarClientesAjustes();
        cargarReservasHoy(); cargarDeudas();
    } catch (err) { toast('No se pudo borrar: ' + (err.message || err), 'err'); } finally { setBusy(btn, false); }
}
$('cliBuscar').addEventListener('input', dibujarClientesAjustes);
$('cliBody').addEventListener('click', e => {
    const b = e.target.closest('button[data-cli]');
    if (!b || b.disabled) return;
    const c = cliFiltrados[parseInt(b.dataset.i, 10)];
    if (!c) return;
    if (b.dataset.cli === 'reset') cliResetearCodigo(c, b);
    else if (b.dataset.cli === 'habilitar') cliHabilitarAcceso(c, b);
    else if (b.dataset.cli === 'borrar') cliBorrarDatos(c, b);
});