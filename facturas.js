/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
let facConfig = null;
let facLista = [];
let facCargando = false;

const facFecha = iso => {
    const [y, m, d] = String(iso || '').slice(0, 10).split('-');
    return d ? `${d}/${m}/${y}` : '';
};
const facTipoTxt = t => t === 'Factura' ? 'Factura' : 'Justificante de pago';
function facSet(id, v) { const e = $(id); if (e) e.value = v ?? ''; }
function facVal(id) { const e = $(id); return e ? e.value.trim() : ''; }
function facNum(id) { const e = $(id); return e ? parseFloat(String(e.value).replace(',', '.')) : NaN; }
function facConfigIds() { return ['facCfgNombre', 'facCfgNif', 'facCfgDireccion', 'facCfgCp', 'facCfgCiudad', 'facCfgProvincia', 'facCfgEmail', 'facCfgTelefono', 'facCfgWeb', 'facCfgIva', 'facCfgTextoLegal', 'facCfgPie']; }

function facAplicarPermisosConfig() {
    facConfigIds().forEach(id => { const e = $(id); if (e) e.disabled = false; });
    const b = $('facCfgGuardar'); if (b) b.disabled = false;
}

async function cargarConfigFacturas() {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient.from('facturas_config').select('*').eq('id', 1).maybeSingle();
    if (error) { console.error(error); return null; }
    facConfig = data || null;
    if (facConfig) {
        facSet('facCfgNombre', facConfig.nombre);
        facSet('facCfgNif', facConfig.nif);
        facSet('facCfgDireccion', facConfig.direccion);
        facSet('facCfgCp', facConfig.cp);
        facSet('facCfgCiudad', facConfig.ciudad);
        facSet('facCfgProvincia', facConfig.provincia);
        facSet('facCfgEmail', facConfig.email);
        facSet('facCfgTelefono', facConfig.telefono);
        facSet('facCfgWeb', facConfig.web);
        facSet('facCfgIva', facConfig.iva_default ?? 21);
        facSet('facCfgTextoLegal', facConfig.texto_legal);
        facSet('facCfgPie', facConfig.pie_factura);
    }
    facAplicarPermisosConfig();
    return facConfig;
}

async function guardarConfigFacturas() {
    const iva = facNum('facCfgIva');
    const row = {
        id: 1,
        nombre: facVal('facCfgNombre'),
        nif: facVal('facCfgNif'),
        direccion: facVal('facCfgDireccion'),
        cp: facVal('facCfgCp'),
        ciudad: facVal('facCfgCiudad'),
        provincia: facVal('facCfgProvincia'),
        email: facVal('facCfgEmail'),
        telefono: facVal('facCfgTelefono'),
        web: facVal('facCfgWeb'),
        iva_default: isNaN(iva) ? 21 : iva,
        texto_legal: facVal('facCfgTextoLegal'),
        pie_factura: facVal('facCfgPie'),
        updated_at: new Date().toISOString()
    };
    const btn = $('facCfgGuardar');
    setBusy(btn, true, 'Guardando...');
    try {
        const { error } = await supabaseClient.from('facturas_config').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        toast('Datos fiscales guardados');
        await cargarConfigFacturas();
    } catch (e) {
        toast('No se pudo guardar: ' + (e.message || e), 'err');
    } finally {
        setBusy(btn, false);
    }
}

function facActualizarCamposPorTipo() {
    const esFactura = $('facTipo').value === 'Factura';
    const bc = $('facBloqueCliente');
    const be = $('facBloqueEmpleado');
    if (bc) bc.style.display = esFactura ? '' : 'none';
    if (be) be.style.display = esFactura ? 'none' : '';
}

function nombreEmpleadoActual() {
    if (!usuarioSesion) return '';
    return usuarioSesion.nombre || usuarioSesion.user || '';
}

function iniciarFormFactura() {
    const f = $('facFecha');
    if (f && !f.value) f.value = fechaLocalISO();
    const iva = $('facIva');
    if (iva && !iva.value) iva.value = facConfig && facConfig.iva_default ? facConfig.iva_default : 21;
    const emp = $('facEmpleado');
    if (emp && !emp.value) emp.value = nombreEmpleadoActual();
    facActualizarCamposPorTipo();
    const box = $('facLineas');
    if (box && !box.children.length) agregarLineaFactura();
    actualizarTotalesFactura();
}

function agregarLineaFactura(concepto = '', cantidad = 1, precio = 0) {
    const box = $('facLineas');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'fac-linea';
    div.dataset.linea = '1';
    div.innerHTML = `<label>Concepto<input class="fac-concepto" type="text" maxlength="160" value="${esc(concepto)}"></label><label>Cantidad<input class="fac-cantidad" type="number" min="0.01" step="0.01" value="${esc(cantidad)}"></label><label>Precio IVA inc.<input class="fac-precio" type="number" min="0" step="0.01" value="${esc(precio)}"></label><div class="fac-linea-total"><span>Total</span><b>0,00 €</b></div><button type="button" class="btn-add danger" data-fac-quitar aria-label="Quitar línea"><i class="ri-close-line" aria-hidden="true"></i></button>`;
    box.appendChild(div);
    actualizarTotalesFactura();
}

function leerLineasFactura() {
    const out = [];
    document.querySelectorAll('#facLineas [data-linea]').forEach(row => {
        const concepto = row.querySelector('.fac-concepto').value.trim();
        const cantidad = parseFloat(String(row.querySelector('.fac-cantidad').value).replace(',', '.'));
        const precio = parseFloat(String(row.querySelector('.fac-precio').value).replace(',', '.'));
        if (!concepto && (!cantidad || isNaN(cantidad)) && (!precio || isNaN(precio))) return;
        out.push({ concepto, cantidad, precio_unitario_con_iva: precio });
    });
    return out;
}

function actualizarTotalesFactura() {
    let total = 0;
    document.querySelectorAll('#facLineas [data-linea]').forEach(row => {
        const cantidad = parseFloat(String(row.querySelector('.fac-cantidad').value).replace(',', '.')) || 0;
        const precio = parseFloat(String(row.querySelector('.fac-precio').value).replace(',', '.')) || 0;
        const t = redondear2(cantidad * precio);
        total += t;
        const b = row.querySelector('.fac-linea-total b');
        if (b) b.innerText = eur(t);
    });
    total = redondear2(total);
    const ivaRaw = facNum('facIva');
    const iva = !isNaN(ivaRaw) && ivaRaw >= 0 ? ivaRaw : 21;
    const base = redondear2(total / (1 + iva / 100));
    const cuota = redondear2(total - base);
    const box = $('facTotales');
    if (box) box.innerHTML = `<span>Base imponible <b>${eur(base)}</b></span><span>IVA (${iva}%) <b>${eur(cuota)}</b></span><span>Total <b>${eur(total)}</b></span>`;
}

function limpiarFormFactura() {
    ['facClienteNombre', 'facClienteNif', 'facClienteDireccion', 'facClienteEmail', 'facClienteTelefono', 'facReservaId', 'facNotas'].forEach(id => facSet(id, ''));
    facSet('facEmpleado', nombreEmpleadoActual());
    const box = $('facLineas');
    if (box) box.innerHTML = '';
    agregarLineaFactura();
}

async function emitirDocumentoFactura() {
    const tipo = $('facTipo').value;
    const esFactura = tipo === 'Factura';
    const fecha = $('facFecha').value;
    const metodo = $('facMetodo').value;
    const reservaId = facVal('facReservaId') || null;
    const empleado = facVal('facEmpleado');
    const cliente = esFactura ? {
        nombre: facVal('facClienteNombre'),
        nif: facVal('facClienteNif'),
        direccion: facVal('facClienteDireccion'),
        email: facVal('facClienteEmail'),
        telefono: facVal('facClienteTelefono')
    } : {};
    const notas = facVal('facNotas');
    const iva = facNum('facIva');
    if (!fecha) return toast('Indica la fecha', 'warn');
    if (esFactura) {
        if (!cliente.nombre) return toast('Indica el cliente', 'warn');
        if (!cliente.nif) return toast('Para una factura legal hace falta el NIF', 'warn');
        if (!cliente.direccion) return toast('Para una factura legal hace falta la dirección', 'warn');
    } else {
        if (!empleado) return toast('Indica el empleado que cobra', 'warn');
    }
    if (isNaN(iva) || iva < 0 || iva > 100) return toast('IVA no válido', 'warn');
    const lineas = leerLineasFactura();
    if (!lineas.length) return toast('Añade al menos una línea', 'warn');
    for (const l of lineas) {
        if (!l.concepto) return toast('Cada línea necesita concepto', 'warn');
        if (!isFinite(l.cantidad) || l.cantidad <= 0) return toast('Cantidad no válida', 'warn');
        if (!isFinite(l.precio_unitario_con_iva) || l.precio_unitario_con_iva < 0) return toast('Precio no válido', 'warn');
    }
    const btn = $('facEmitir');
    setBusy(btn, true, 'Emitiendo...');
    try {
        const { data, error } = await supabaseClient.rpc('gp_emitir_documento', {
            p_tipo: tipo,
            p_fecha: fecha,
            p_cliente: cliente,
            p_metodo_pago: metodo,
            p_reserva_id: reservaId,
            p_iva: iva,
            p_lineas: lineas,
            p_notas: notas || null,
            p_empleado: esFactura ? null : empleado
        });
        if (error) throw error;
        if (!data || !data.ok) throw new Error(data && data.error ? data.error : 'No se pudo emitir');
        toast(`Documento ${data.numero} emitido`);
        limpiarFormFactura();
        facActualizarCamposPorTipo();
        await cargarFacturas();
    } catch (e) {
        console.error(e);
        toast('No se pudo emitir: ' + (e.message || e), 'err');
    } finally {
        setBusy(btn, false);
    }
}

async function cargarFacturas() {
    if (!supabaseClient || facCargando) return;
    facCargando = true;
    try {
        const { data, error } = await supabaseClient.from('facturas')
            .select('id,tipo,numero,fecha,cliente_nombre,cliente_nif,metodo_pago,total,estado,empleado,created_at')
            .order('fecha', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(300);
        if (error) throw error;
        facLista = data || [];
        dibujarFacturas();
    } catch (e) {
        console.error(e);
        toast('No se pudieron cargar las facturas: ' + (e.message || e), 'err');
    } finally {
        facCargando = false;
    }
}

function dibujarFacturas() {
    const tb = $('facBody');
    if (!tb) return;
    const q = facVal('facBuscar').toLowerCase();
    const tipo = $('facFiltroTipo') ? $('facFiltroTipo').value : 'Todos';
    const lista = facLista.filter(f =>
        (tipo === 'Todos' || f.tipo === tipo) &&
        (!q || String(f.numero).toLowerCase().includes(q) || String(f.cliente_nombre).toLowerCase().includes(q) || String(f.cliente_nif || '').toLowerCase().includes(q) || String(f.empleado || '').toLowerCase().includes(q))
    );
    if (!lista.length) {
        tb.innerHTML = '<tr><td colspan="8" class="tabla-empty">No hay documentos</td></tr>';
        return;
    }
    tb.innerHTML = lista.map(f => {
        const puede = typeof esJefa === 'function' && esJefa() && f.estado === 'Emitida';
        const esFactura = f.tipo === 'Factura';
        const persona = esFactura
            ? `<b>${esc(f.cliente_nombre || '—')}</b><small class="esc-desc">${esc(f.cliente_nif || '')}</small>`
            : `<b>${esc(f.empleado || '—')}</b><small class="esc-desc">Atendido por</small>`;
        const btnA4 = esFactura ? `<button type="button" class="btn-add blue" data-fac="a4" data-id="${esc(f.id)}">A4</button>` : '';
        return `<tr><td><b>${esc(f.numero)}</b></td><td>${esc(facFecha(f.fecha))}</td><td>${esc(facTipoTxt(f.tipo))}</td><td>${persona}</td><td>${esc(f.metodo_pago || '—')}</td><td><b>${eur(f.total)}</b></td><td><span class="fac-estado ${f.estado === 'Anulada' ? 'no' : 'ok'}">${esc(f.estado)}</span></td><td><div class="fac-acciones"><button type="button" class="btn-add gray" data-fac="ticket" data-id="${esc(f.id)}">80 mm</button>${btnA4}${puede ? `<button type="button" class="btn-add danger" data-fac="anular" data-id="${esc(f.id)}">Anular</button>` : ''}</div></td></tr>`;
    }).join('');
}

async function obtenerFactura(id) {
    const { data, error } = await supabaseClient.from('facturas').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: lineas, error: e2 } = await supabaseClient.from('factura_lineas').select('*').eq('factura_id', id).order('orden', { ascending: true });
    if (e2) throw e2;
    return { ...data, lineas: lineas || [] };
}

async function imprimirFactura(id, formato) {
    try {
        if (!facConfig) await cargarConfigFacturas();
        const f = await obtenerFactura(id);
        if (!f) return toast('No se encontró el documento', 'err');
        if (f.tipo === 'Justificante' && formato === 'a4') formato = 'ticket';
        imprimirHTML(formato === 'ticket' ? htmlTicketFactura(f) : htmlA4Factura(f));
    } catch (e) {
        console.error(e);
        toast('No se pudo imprimir: ' + (e.message || e), 'err');
    }
}

async function anularFactura(id) {
    if (!(typeof esJefa === 'function' && esJefa())) return toast('Solo la jefa puede anular documentos', 'err');
    const motivo = await customPrompt('Motivo de anulación:', '', 'Anular documento');
    if (!motivo || motivo.trim().length < 5) return toast('Escribe un motivo de al menos 5 caracteres', 'warn');
    if (!(await customConfirm('¿Anular este documento? No se puede deshacer.'))) return;
    try {
        const { data, error } = await supabaseClient.rpc('gp_anular_factura', { p_id: id, p_motivo: motivo.trim() });
        if (error) throw error;
        if (!data || !data.ok) throw new Error(data && data.error ? data.error : 'No se pudo anular');
        toast('Documento anulado');
        await cargarFacturas();
    } catch (e) {
        toast('No se pudo anular: ' + (e.message || e), 'err');
    }
}

function htmlTicketFactura(f) {
    const c = facConfig || {};
    const dir = [c.direccion, c.cp, c.ciudad, c.provincia].filter(Boolean).join(', ');
    const esFac = f.tipo === 'Factura';
    const lineas = (f.lineas || []).map(l => `<div class="r"><span>${esc(l.concepto)}</span><span>${eur(l.total)}</span></div><div class="r s"><span>${esc(l.cantidad)} x ${eur(l.precio_unitario)} · IVA ${esc(l.iva_porcentaje)}%</span><span>${eur(l.base)} + ${eur(l.cuota)}</span></div>`).join('');
    const legal = esFac ? esc(c.texto_legal || 'Factura emitida conforme al RD 1619/2012.') : 'Documento no válido como factura. Justificante de pago.';
    const persona = esFac
        ? `<div class="r"><span>Cliente</span><span>${esc(f.cliente_nombre)}</span></div>${f.cliente_nif ? `<div class="r"><span>NIF</span><span>${esc(f.cliente_nif)}</span></div>` : ''}${f.cliente_direccion ? `<div class="r"><span>Dirección</span><span>${esc(f.cliente_direccion)}</span></div>` : ''}`
        : `<div class="r"><span>Atendido por</span><span>${esc(f.empleado || '—')}</span></div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:0}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:"Courier New",monospace;font-size:12px;line-height:1.25}.t{width:72mm;margin:0 auto;padding:3mm 0}.c{text-align:center}.b{font-weight:700}.r{display:flex;justify-content:space-between;gap:4mm}.hr{border-top:1px dashed #000;margin:2mm 0}.s{font-size:10px}.big{font-size:16px;font-weight:800}.m{text-transform:uppercase}</style></head><body><div class="t"><div class="c b big">${esc(c.nombre || 'GEOPADEL')}</div><div class="c s">${esc(c.nif || '')}</div><div class="c s">${esc(dir)}</div><div class="c s">${esc(c.telefono || '')} · ${esc(c.email || '')}</div><div class="hr"></div><div class="c b m">${esFac ? 'FACTURA' : 'JUSTIFICANTE DE PAGO'}</div><div class="r"><span>Nº ${esc(f.numero)}</span><span>${esc(facFecha(f.fecha))}</span></div>${persona}<div class="r"><span>Pago</span><span>${esc(f.metodo_pago || '')}</span></div><div class="hr"></div>${lineas}<div class="hr"></div><div class="r"><span>Base</span><span>${eur(f.base_imponible)}</span></div><div class="r"><span>IVA ${esc(f.iva_porcentaje)}%</span><span>${eur(f.cuota_iva)}</span></div><div class="r b big"><span>TOTAL</span><span>${eur(f.total)}</span></div>${f.notas ? `<div class="hr"></div><div class="s">${esc(f.notas)}</div>` : ''}<div class="hr"></div><div class="c s">${legal}</div><div class="c s">${esc(c.pie_factura || '')}</div><div class="c s">${esc(c.web || '')}</div></div></body></html>`;
}

function htmlA4Factura(f) {
    const c = facConfig || {};
    const logo = new URL('Geopadel.webp', location.href).href;
    const dir = [c.direccion, c.cp, c.ciudad, c.provincia].filter(Boolean).join(' · ');
    const esFac = f.tipo === 'Factura';
    const lineas = (f.lineas || []).map(l => `<tr><td>${esc(l.concepto)}</td><td class="r">${esc(l.cantidad)}</td><td class="r">${eur(l.precio_unitario)}</td><td class="r">${esc(l.iva_porcentaje)}%</td><td class="r">${eur(l.base)}</td><td class="r">${eur(l.cuota)}</td><td class="r b">${eur(l.total)}</td></tr>`).join('');
    const legal = esFac ? esc(c.texto_legal || 'Factura emitida conforme al Real Decreto 1619/2012.') : 'Documento no válido como factura. Justificante de pago.';
    const boxPersona = esFac
        ? `<div class="box"><h3>Cliente</h3><p><b>${esc(f.cliente_nombre)}</b></p>${f.cliente_nif ? `<p>NIF: ${esc(f.cliente_nif)}</p>` : ''}${f.cliente_direccion ? `<p>${esc(f.cliente_direccion)}</p>` : ''}${f.cliente_email ? `<p>${esc(f.cliente_email)}</p>` : ''}${f.cliente_telefono ? `<p>${esc(f.cliente_telefono)}</p>` : ''}</div>`
        : `<div class="box"><h3>Atendido por</h3><p><b>${esc(f.empleado || '—')}</b></p><p>Empleado del club</p></div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:14mm}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.35}.page{width:100%;max-width:186mm;margin:0 auto}.head{display:flex;justify-content:space-between;gap:10mm;border-bottom:2px solid #111;padding-bottom:5mm}.logo{height:18mm;width:auto;border-radius:3mm}.issuer h1{font-size:18pt;margin:0 0 2mm}.issuer p{margin:0 0 1mm;font-size:9.5pt}.doc{text-align:right;min-width:65mm}.doc h2{font-size:18pt;margin:0 0 3mm;text-transform:uppercase}.doc p{margin:0 0 1.5mm;font-size:10pt}.boxes{display:grid;grid-template-columns:1.2fr 1fr;gap:6mm;margin-top:7mm}.box{border:1px solid #bbb;border-radius:2mm;padding:4mm}.box h3{font-size:10pt;margin:0 0 2.5mm;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:1.5mm}.box p{margin:0 0 1.5mm;font-size:10pt}table{width:100%;border-collapse:collapse;margin-top:7mm}th,td{border-bottom:1px solid #ccc;padding:2.5mm 2mm;text-align:left;vertical-align:top}th{background:#eef3ef;font-size:9pt;text-transform:uppercase}.r{text-align:right}.b{font-weight:700}.totals{display:flex;justify-content:flex-end;margin-top:5mm}.totals table{width:80mm;margin:0}.totals td{border:0;padding:1.5mm 2mm}.totals tr:last-child td{border-top:2px solid #111;font-size:13pt;font-weight:800}.legal{margin-top:8mm;padding-top:4mm;border-top:1px solid #bbb;font-size:8.5pt;color:#333}.foot{margin-top:5mm;font-size:8.5pt;color:#555;text-align:center}</style></head><body><div class="page"><div class="head"><div><img class="logo" src="${logo}" alt="Geopadel"><div class="issuer"><h1>${esc(c.nombre || 'Geopadel')}</h1><p>${esc(c.nif || '')}</p><p>${esc(dir)}</p><p>${esc(c.telefono || '')} · ${esc(c.email || '')}</p></div></div><div class="doc"><h2>${esFac ? 'Factura' : 'Justificante de pago'}</h2><p><b>Nº:</b> ${esc(f.numero)}</p><p><b>Fecha:</b> ${esc(facFecha(f.fecha))}</p><p><b>Pago:</b> ${esc(f.metodo_pago || '')}</p></div></div><div class="boxes">${boxPersona}<div class="box"><h3>Documento</h3><p>${esFactura ? 'Factura legal' : 'Justificante de pago'}</p><p>${esFactura ? 'Válido fiscalmente' : 'No válido como factura'}</p>${f.notas ? `<p><b>Notas:</b> ${esc(f.notas)}</p>` : ''}</div></div><table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio unit.</th><th class="r">IVA</th><th class="r">Base</th><th class="r">Cuota</th><th class="r">Total</th></tr></thead><tbody>${lineas}</tbody></table><div class="totals"><table><tr><td>Base imponible</td><td class="r">${eur(f.base_imponible)}</td></tr><tr><td>IVA ${esc(f.iva_porcentaje)}%</td><td class="r">${eur(f.cuota_iva)}</td></tr><tr><td>TOTAL</td><td class="r">${eur(f.total)}</td></tr></table></div><div class="legal">${legal}</div><div class="foot">${esc(c.pie_factura || '')}<br>${esc(c.web || '')}</div></div></body></html>`;
}

function imprimirHTML(html) {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    iframe.onload = () => {
        const win = iframe.contentWindow;
        const doc = win.document;
        const imgs = Array.from(doc.images);
        Promise.all(imgs.map(im => im.complete ? Promise.resolve() : new Promise(r => { im.onload = im.onerror = r; }))).then(() => {
            setTimeout(() => {
                try {
                    win.focus();
                    win.print();
                } finally {
                    setTimeout(() => iframe.remove(), 3000);
                }
            }, 100);
        });
    };
    iframe.srcdoc = html;
}

async function entrarFacturas() {
    if (!supabaseClient) return;
    if (!facConfig) await cargarConfigFacturas();
    iniciarFormFactura();
    await cargarFacturas();
}

async function entrarFacturasConfig() {
    if (!supabaseClient) return;
    await cargarConfigFacturas();
}

if ($('facAddLinea')) $('facAddLinea').addEventListener('click', () => agregarLineaFactura());
if ($('facLineas')) {
    $('facLineas').addEventListener('input', actualizarTotalesFactura);
    $('facLineas').addEventListener('click', e => {
        const b = e.target.closest('[data-fac-quitar]');
        if (!b) return;
        const row = b.closest('[data-linea]');
        if (row) row.remove();
        if (!$('facLineas').children.length) agregarLineaFactura();
        actualizarTotalesFactura();
    });
}
if ($('facIva')) $('facIva').addEventListener('input', actualizarTotalesFactura);
if ($('facTipo')) $('facTipo').addEventListener('change', facActualizarCamposPorTipo);
if ($('facEmitir')) $('facEmitir').addEventListener('click', emitirDocumentoFactura);
if ($('facCfgGuardar')) $('facCfgGuardar').addEventListener('click', guardarConfigFacturas);
if ($('facRefrescar')) $('facRefrescar').addEventListener('click', cargarFacturas);
if ($('facBuscar')) $('facBuscar').addEventListener('input', dibujarFacturas);
if ($('facFiltroTipo')) $('facFiltroTipo').addEventListener('change', dibujarFacturas);
if ($('facBody')) $('facBody').addEventListener('click', async e => {
    const b = e.target.closest('button[data-fac]');
    if (!b) return;
    const id = b.dataset.id;
    const acc = b.dataset.fac;
    if (acc === 'ticket' || acc === 'a4') await imprimirFactura(id, acc);
    else if (acc === 'anular') await anularFactura(id);
});