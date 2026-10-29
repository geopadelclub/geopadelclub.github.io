/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
let facConfig = null,
  facLista = [],
  facCargando = !1,
  facRectificando = null;
const facFecha = (e) => {
    const [t, n, r] = String(e || "")
      .slice(0, 10)
      .split("-");
    return r ? `${r}/${n}/${t}` : "";
  },
  facTipoTxt = (e) => (e === "Factura" ? "Factura" : "Justificante de pago");
function facSet(e, t) {
  const n = $(e);
  if (n) n.value = t ?? "";
}
function facVal(e) {
  const t = $(e);
  return t ? t.value.trim() : "";
}
function facNum(e) {
  const t = $(e);
  return t ? parseFloat(String(t.value).replace(",", ".")) : NaN;
}
function facConfigIds() {
  return [
    "facCfgNombreClub",
    "facCfgNombre",
    "facCfgNif",
    "facCfgDireccion",
    "facCfgCp",
    "facCfgCiudad",
    "facCfgProvincia",
    "facCfgEmail",
    "facCfgTelefono",
    "facCfgWeb",
    "facCfgIva",
    "facCfgTextoLegal",
    "facCfgPie",
  ];
}
function facAplicarPermisosConfig() {
  facConfigIds().forEach((e) => {
    const t = $(e);
    if (t) t.disabled = !1;
  });
  const e = $("facCfgGuardar");
  if (e) e.disabled = !1;
}
async function cargarConfigFacturas() {
  if (!supabaseClient) return null;
  const { data: e, error: t } = await supabaseClient
    .from("facturas_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (t) {
    console.error(t);
    return null;
  }
  facConfig = e || null;
  if (facConfig) {
    facSet("facCfgNombre", facConfig.nombre);
    facSet("facCfgNombreClub", facConfig.nombre_club || facConfig.nombre);
    facSet("facCfgNif", facConfig.nif);
    facSet("facCfgDireccion", facConfig.direccion);
    facSet("facCfgCp", facConfig.cp);
    facSet("facCfgCiudad", facConfig.ciudad);
    facSet("facCfgProvincia", facConfig.provincia);
    facSet("facCfgEmail", facConfig.email);
    facSet("facCfgTelefono", facConfig.telefono);
    facSet("facCfgWeb", facConfig.web);
    facSet("facCfgIva", facConfig.iva_default ?? 21);
    facSet("facCfgTextoLegal", facConfig.texto_legal);
    facSet("facCfgPie", facConfig.pie_factura);
  }
  facAplicarPermisosConfig();
  return facConfig;
}
async function guardarConfigFacturas() {
  const e = facNum("facCfgIva"),
    t = {
      id: 1,
      nombre_club: facVal("facCfgNombreClub"),
      nombre: facVal("facCfgNombre"),
      nif: facVal("facCfgNif"),
      direccion: facVal("facCfgDireccion"),
      cp: facVal("facCfgCp"),
      ciudad: facVal("facCfgCiudad"),
      provincia: facVal("facCfgProvincia"),
      email: facVal("facCfgEmail"),
      telefono: facVal("facCfgTelefono"),
      web: facVal("facCfgWeb"),
      iva_default: isNaN(e) ? 21 : e,
      texto_legal: facVal("facCfgTextoLegal"),
      pie_factura: facVal("facCfgPie"),
      updated_at: new Date().toISOString(),
    },
    n = $("facCfgGuardar");
  setBusy(n, !0, "Guardando...");
  try {
    const { error: e } = await supabaseClient
      .from("facturas_config")
      .upsert(t, { onConflict: "id" });
    if (e) throw e;
    toast("Datos fiscales guardados");
    await cargarConfigFacturas();
  } catch (e) {
    toast("No se pudo guardar: " + (e.message || e), "err");
  } finally {
    setBusy(n, !1);
  }
}
function nombreEmpleadoActual() {
  if (!usuarioSesion) return "";
  return usuarioSesion.nombre || usuarioSesion.user || "";
}
function facActualizarCamposPorTipo() {
  const e = $("facTipo").value === "Factura",
    t = $("facBloqueCliente"),
    n = $("facBloqueEmpleado");
  if (t) t.style.display = e ? "" : "none";
  if (n) n.style.display = e ? "none" : "";
}
function iniciarFormFactura() {
  const e = $("facFecha");
  if (e && !e.value) e.value = fechaLocalISO();
  const t = $("facIva");
  if (t && !t.value)
    t.value = facConfig && facConfig.iva_default ? facConfig.iva_default : 21;
  const n = $("facEmpleado");
  if (n) n.value = nombreEmpleadoActual();
  facActualizarCamposPorTipo();
  const r = $("facLineas");
  if (r && !r.children.length) agregarLineaFactura();
  actualizarTotalesFactura();
}
function agregarLineaFactura(e = "", t = 1, n = 0) {
  const r = $("facLineas");
  if (!r) return;
  const i = document.createElement("div");
  i.className = "fac-linea";
  i.dataset.linea = "1";
  i.innerHTML = `<label>Concepto<input class="fac-concepto" type="text" maxlength="160" value="${esc(e)}"></label><label>Cantidad<input class="fac-cantidad" type="number" min="0.01" step="0.01" value="${esc(t)}"></label><label>Precio IVA inc.<input class="fac-precio" type="number" min="0" step="0.01" value="${esc(n)}"></label><div class="fac-linea-total"><span>Total</span><b>0,00 €</b></div><button type="button" class="btn-add danger" data-fac-quitar aria-label="Quitar línea"><i class="ri-close-line" aria-hidden="true"></i></button>`;
  r.appendChild(i);
  actualizarTotalesFactura();
}
function leerLineasFactura() {
  const e = [];
  document.querySelectorAll("#facLineas [data-linea]").forEach((t) => {
    const n = t.querySelector(".fac-concepto").value.trim(),
      r = parseFloat(
        String(t.querySelector(".fac-cantidad").value).replace(",", "."),
      ),
      i = parseFloat(
        String(t.querySelector(".fac-precio").value).replace(",", "."),
      );
    if (!n && (!r || isNaN(r)) && (!i || isNaN(i))) return;
    e.push({ concepto: n, cantidad: r, precio_unitario_con_iva: i });
  });
  return e;
}
function actualizarTotalesFactura() {
  let e = 0;
  document.querySelectorAll("#facLineas [data-linea]").forEach((t) => {
    const n =
        parseFloat(
          String(t.querySelector(".fac-cantidad").value).replace(",", "."),
        ) || 0,
      r =
        parseFloat(
          String(t.querySelector(".fac-precio").value).replace(",", "."),
        ) || 0,
      i = redondear2(n * r);
    e += i;
    const a = t.querySelector(".fac-linea-total b");
    if (a) a.innerText = eur(i);
  });
  e = redondear2(e);
  const t = facNum("facIva"),
    n = !isNaN(t) && t >= 0 ? t : 21,
    r = redondear2(e / (1 + n / 100)),
    i = redondear2(e - r),
    a = $("facTotales");
  if (a)
    a.innerHTML = `<span>Base imponible <b>${eur(r)}</b></span><span>IVA (${n}%) <b>${eur(i)}</b></span><span>Total <b>${eur(e)}</b></span>`;
}
function limpiarFormFactura() {
  [
    "facClienteNombre",
    "facClienteNif",
    "facClienteDireccion",
    "facClienteEmail",
    "facClienteTelefono",
    "facReservaId",
    "facNotas",
    "facFacturaOriginal",
    "facMotivoRectificacion",
  ].forEach((e) => facSet(e, ""));
  facSet("facEmpleado", nombreEmpleadoActual());
  const e = $("facLineas");
  if (e) e.innerHTML = "";
  agregarLineaFactura();
  facRectificando = null;
  facActualizarModoRectificativa();
}
function facActualizarModoRectificativa() {
  const e = $("facBoxRectificativa");
  if (!e) return;
  e.style.display = facRectificando ? "" : "none";
}
function prepararRectificativa(e) {
  const t = facLista.find((t) => String(t.id) === String(e));
  if (!t) return;
  facRectificando = t;
  facSet("facTipo", "Factura");
  facSet("facClienteNombre", t.cliente_nombre || "");
  facSet("facClienteNif", t.cliente_nif || "");
  facSet("facFecha", fechaLocalISO());
  facActualizarCamposPorTipo();
  facSet("facFacturaOriginal", t.numero);
  facSet("facMotivoRectificacion", "");
  facActualizarModoRectificativa();
  $("facTipo").disabled = !0;
  toast(`Rectificando factura ${t.numero}`);
}
function cancelarRectificacion() {
  facRectificando = null;
  $("facTipo").disabled = !1;
  facSet("facFacturaOriginal", "");
  facSet("facMotivoRectificacion", "");
  facActualizarModoRectificativa();
  facActualizarCamposPorTipo();
  toast("Rectificación cancelada");
}
async function anularFactura(id) {
  const f = facLista.find((x) => String(x.id) === String(id));
  if (!f || f.estado !== "Emitida") return;
  const motivo = await customPrompt(
    `Motivo de anulación de la factura ${f.numero}:`,
    "",
    "Anular factura",
  );
  if (motivo === null) return;
  const m = (motivo || "").trim();
  if (m.length < 5)
    return toast("Escribe un motivo de al menos 5 caracteres", "warn");
  try {
    const { data, error } = await supabaseClient.rpc("gp_anular_factura", {
      p_id: id,
      p_motivo: m,
    });
    if (error) throw error;
    if (!data || !data.ok)
      throw new Error((data && data.error) || "No se pudo anular");
    toast(`Factura ${f.numero} anulada`);
    await cargarFacturas();
  } catch (e) {
    console.error(e);
    toast("No se pudo anular: " + (e.message || e), "err");
  }
}
async function emitirDocumentoFactura() {
  const e = facRectificando ? "Factura" : $("facTipo").value,
    t = e === "Factura",
    n = $("facFecha").value,
    r = $("facMetodo").value,
    i = facVal("facReservaId") || null,
    a = facVal("facEmpleado"),
    o = t
      ? {
          nombre: facVal("facClienteNombre"),
          nif: facVal("facClienteNif"),
          direccion: facVal("facClienteDireccion"),
          email: facVal("facClienteEmail"),
          telefono: facVal("facClienteTelefono"),
        }
      : {},
    s = facVal("facNotas"),
    l = facNum("facIva");
  if (!n) return toast("Indica la fecha", "warn");
  if (t) {
    if (!o.nombre) return toast("Indica el cliente", "warn");
    if (!o.nif)
      return toast("Para una factura legal hace falta el NIF", "warn");
    if (!o.direccion)
      return toast("Para una factura legal hace falta la dirección", "warn");
    if (facRectificando && !facVal("facMotivoRectificacion"))
      return toast("Indica el motivo de la rectificación", "warn");
  } else if (!a) return toast("No se pudo identificar al empleado", "err");
  if (isNaN(l) || l < 0 || l > 100) return toast("IVA no válido", "warn");
  const c = leerLineasFactura();
  if (!c.length) return toast("Añade al menos una línea", "warn");
  for (const e of c) {
    if (!e.concepto) return toast("Cada línea necesita concepto", "warn");
    if (!isFinite(e.cantidad) || e.cantidad <= 0)
      return toast("Cantidad no válida", "warn");
    if (!isFinite(e.precio_unitario_con_iva) || e.precio_unitario_con_iva < 0)
      return toast("Precio no válido", "warn");
  }
  const d = $("facEmitir");
  setBusy(d, !0, "Emitiendo...");
  try {
    const { data: res, error: err } = await supabaseClient.rpc(
      "gp_emitir_documento",
      {
        p_tipo: e,
        p_fecha: n,
        p_cliente: o,
        p_metodo_pago: r,
        p_reserva_id: i,
        p_iva: l,
        p_lineas: c,
        p_notas: s || null,
        p_empleado: t ? null : a,
        p_factura_original_id: facRectificando ? facRectificando.id : null,
        p_motivo_rectificacion: facRectificando
          ? facVal("facMotivoRectificacion")
          : null,
        p_tipo_rectificativa: facRectificando ? "S" : null,
      },
    );
    if (err) throw err;
    if (!res || !res.ok)
      throw new Error(res && res.error ? res.error : "No se pudo emitir");
    toast(`Documento ${res.numero} emitido`);
    limpiarFormFactura();
    $("facTipo").disabled = !1;
    facActualizarCamposPorTipo();
    await cargarFacturas();
  } catch (err) {
    console.error(err);
    toast("No se pudo emitir: " + (err.message || err), "err");
  } finally {
    setBusy(d, !1);
  }
}
async function cargarFacturas() {
  if (!supabaseClient || facCargando) return;
  facCargando = !0;
  try {
    const { data: e, error: t } = await supabaseClient
      .from("facturas")
      .select(
        "id,tipo,numero,fecha,cliente_nombre,cliente_nif,metodo_pago,total,estado,empleado,tipo_rectificativa,factura_original_id,created_at,anulada_por,anulada_at,motivo_anulacion",
      )
      .order("fecha", { ascending: !1 })
      .order("created_at", { ascending: !1 })
      .limit(300);
    if (t) throw t;
    facLista = e || [];
    dibujarFacturas();
  } catch (e) {
    console.error(e);
    toast("No se pudieron cargar las facturas: " + (e.message || e), "err");
  } finally {
    facCargando = !1;
  }
}
function dibujarFacturas() {
  const e = $("facBody");
  if (!e) return;
  const t = facVal("facBuscar").toLowerCase(),
    n = $("facFiltroTipo") ? $("facFiltroTipo").value : "Todos",
    r = facLista.filter(
      (e) =>
        (n === "Todos" || e.tipo === n) &&
        (!t ||
          String(e.numero).toLowerCase().includes(t) ||
          String(e.cliente_nombre).toLowerCase().includes(t) ||
          String(e.cliente_nif || "")
            .toLowerCase()
            .includes(t) ||
          String(e.empleado || "")
            .toLowerCase()
            .includes(t)),
    );
  if (!r.length) {
    e.innerHTML =
      '<tr><td colspan="8" class="tabla-empty">No hay documentos</td></tr>';
    return;
  }
  e.innerHTML = r
    .map((e) => {
      const t =
          typeof esJefa === "function" && esJefa() && e.estado === "Emitida",
        n = e.tipo === "Factura",
        r = !!e.factura_original_id,
        i = n
          ? `<b>${esc(e.cliente_nombre || "—")}</b><small class="esc-desc">${esc(e.cliente_nif || "")}</small>`
          : `<b>${esc(e.empleado || "—")}</b><small class="esc-desc">Atendido por</small>`,
        a = n
          ? `<button type="button" class="btn-add blue" data-fac="a4" data-id="${esc(e.id)}">A4</button>`
          : "",
        o =
          t && n && !r
            ? `<button type="button" class="btn-add gray" data-fac="rectificar" data-id="${esc(e.id)}">Rectificar</button>`
            : "",
        s = r
          ? '<span class="fac-estado ok" style="margin-left:4px">R</span>'
          : "",
        anul =
          t && !r
            ? `<button type="button" class="btn-add danger" data-fac="anular" data-id="${esc(e.id)}">Anular</button>`
            : "",
        estadoTxt =
          e.estado === "Anulada"
            ? `Anulada${e.anulada_por ? ` por ${esc(e.anulada_por)}` : ""}${e.motivo_anulacion ? `<small class="esc-desc">${esc(e.motivo_anulacion)}</small>` : ""}`
            : esc(e.estado);
      return `<tr><td><b>${esc(e.numero)}</b>${s}</td><td>${esc(facFecha(e.fecha))}</td><td>${esc(facTipoTxt(e.tipo))}</td><td>${i}</td><td>${esc(e.metodo_pago || "—")}</td><td><b>${eur(e.total)}</b></td><td><span class="fac-estado ${e.estado === "Anulada" ? "no" : "ok"}">${estadoTxt}</span></td><td><div class="fac-acciones"><button type="button" class="btn-add blue" data-fac="webusb" data-id="${esc(e.id)}">80 mm (USB)</button>${a}${o}${anul}</div></td></tr>`;
    })
    .join("");
}
async function obtenerFactura(e) {
  const { data: t, error: n } = await supabaseClient
    .from("facturas")
    .select("*")
    .eq("id", e)
    .maybeSingle();
  if (n) throw n;
  if (!t) return null;
  const { data: r, error: i } = await supabaseClient
    .from("factura_lineas")
    .select("*")
    .eq("factura_id", e)
    .order("orden", { ascending: !0 });
  if (i) throw i;
  return { ...t, lineas: r || [] };
}
async function imprimirFactura(e, t) {
  try {
    if (!facConfig) await cargarConfigFacturas();
    const n = await obtenerFactura(e);
    if (!n) return toast("No se encontró el documento", "err");
    if (n.factura_original_id) {
      const { data: e } = await supabaseClient
        .from("facturas")
        .select("numero")
        .eq("id", n.factura_original_id)
        .maybeSingle();
      n.numero_original = e ? e.numero : null;
    }
    if (n.tipo === "Justificante" && t === "a4") t = "ticket";
    imprimirHTML(t === "ticket" ? htmlTicketFactura(n) : htmlA4Factura(n));
  } catch (e) {
    console.error(e);
    toast("No se pudo imprimir: " + (e.message || e), "err");
  }
}
function htmlTicketFactura(e) {
  const t = facConfig || {},
    n = [t.direccion, t.cp, t.ciudad, t.provincia].filter(Boolean).join(", "),
    r = e.tipo === "Factura",
    i = !!e.factura_original_id,
    a = t.nombre_club || t.nombre || "GEOPADEL",
    o = t.nombre && t.nombre !== a ? t.nombre : null,
    s = (e) =>
      (Number(e) || 0)
        .toLocaleString("es-ES", { style: "currency", currency: "EUR" })
        .replace("€", "EUR"),
    l = (e.lineas || [])
      .map(
        (e) =>
          `<div class="r"><span>${esc(e.concepto)}</span><span>${s(e.total)}</span></div><div class="r s"><span>${esc(e.cantidad)} x ${s(e.precio_unitario)} · IVA ${esc(e.iva_porcentaje)}%</span><span>${s(e.base)} + ${s(e.cuota)}</span></div>`,
      )
      .join(""),
    c = r
      ? esc(t.texto_legal || "Factura emitida conforme al RD 1619/2012.")
      : "Documento no válido como factura. Justificante de pago.",
    d = r
      ? `<div class="r"><span>Cliente</span><span>${esc(e.cliente_nombre)}</span></div>${e.cliente_nif ? `<div class="r"><span>NIF</span><span>${esc(e.cliente_nif)}</span></div>` : ""}${e.cliente_direccion ? `<div class="r"><span>Dirección</span><span>${esc(e.cliente_direccion)}</span></div>` : ""}`
      : `<div class="r"><span>Atendido por</span><span>${esc(e.empleado || "—")}</span></div>`,
    m = r ? `<div class="c s">${esc(t.pie_factura || "")}</div>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:0}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:"Courier New",monospace;font-size:12px;line-height:1.25}.t{width:72mm;margin:0 auto;padding:3mm 0}.c{text-align:center}.b{font-weight:700}.r{display:flex;justify-content:space-between;gap:4mm}.hr{border-top:1px dashed #000;margin:2mm 0}.s{font-size:10px}.big{font-size:16px;font-weight:800}.m{text-transform:uppercase}</style></head><body><div class="t"><div class="c b big">${esc(a)}</div>${o ? `<div class="c b" style="font-size:11px">${esc(o)}</div>` : ""}<div class="c s">${esc(t.nif || "")}</div><div class="c s">${esc(n)}</div><div class="c s">${esc(t.telefono || "")} · ${esc(t.email || "")}</div><div class="hr"></div><div class="c b m">${r ? (i ? "FACTURA RECTIFICATIVA" : "FACTURA") : "JUSTIFICANTE DE PAGO"}</div><div class="r"><span>Nº ${esc(e.numero)}</span><span>${esc(facFecha(e.fecha))}</span></div>${d}<div class="r"><span>Pago</span><span>${esc(e.metodo_pago || "")}</span></div><div class="hr"></div>${l}<div class="hr"></div><div class="r"><span>Base</span><span>${s(e.base_imponible)}</span></div><div class="r"><span>IVA ${esc(e.iva_porcentaje)}%</span><span>${s(e.cuota_iva)}</span></div><div class="r b big"><span>TOTAL</span><span>${s(e.total)}</span></div>${e.notas ? `<div class="hr"></div><div class="s">${esc(e.notas)}</div>` : ""}<div class="hr"></div><div class="c s">${c}</div>${m}<div class="c s">${esc(t.web || "")}</div></div></body></html>`;
}
function htmlA4Factura(e) {
  const t = facConfig || {},
    n = new URL("geopadel.webp", location.href).href,
    r = [t.direccion, t.cp, t.ciudad, t.provincia].filter(Boolean).join(" · "),
    i = e.tipo === "Factura",
    a = !!e.factura_original_id,
    o = t.nombre_club || t.nombre || "Geopadel",
    s = t.nombre && t.nombre !== o ? t.nombre : null,
    l = (e) =>
      (Number(e) || 0)
        .toLocaleString("es-ES", { style: "currency", currency: "EUR" })
        .replace("€", "EUR"),
    c = (e.lineas || [])
      .map(
        (e) =>
          `<tr><td>${esc(e.concepto)}</td><td class="r">${esc(e.cantidad)}</td><td class="r">${l(e.precio_unitario)}</td><td class="r">${esc(e.iva_porcentaje)}%</td><td class="r">${l(e.base)}</td><td class="r">${l(e.cuota)}</td><td class="r b">${l(e.total)}</td></tr>`,
      )
      .join(""),
    d = i
      ? esc(
          t.texto_legal ||
            "Factura emitida conforme al Real Decreto 1619/2012.",
        )
      : "Documento no válido como factura. Justificante de pago.",
    u = i
      ? `<div class="box"><h3>Cliente</h3><p><b>${esc(e.cliente_nombre)}</b></p>${e.cliente_nif ? `<p>NIF: ${esc(e.cliente_nif)}</p>` : ""}${e.cliente_direccion ? `<p>${esc(e.cliente_direccion)}</p>` : ""}${e.cliente_email ? `<p>${esc(e.cliente_email)}</p>` : ""}${e.cliente_telefono ? `<p>${esc(e.cliente_telefono)}</p>` : ""}</div>`
      : `<div class="box"><h3>Atendido por</h3><p><b>${esc(e.empleado || "—")}</b></p><p>Empleado del club</p></div>`,
    m =
      a && e.factura_original_id
        ? `<div class="box" style="margin-top:5mm"><h3>Rectifica a</h3><p>Factura original: ${esc(e.numero_original || "—")}</p>${e.motivo_rectificacion ? `<p>Motivo: ${esc(e.motivo_rectificacion)}</p>` : ""}</div>`
        : "",
    h = i && t.pie_factura ? `${esc(t.pie_factura)}<br>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:14mm}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.35}.page{width:100%;max-width:186mm;margin:0 auto}.head{display:flex;justify-content:space-between;gap:10mm;border-bottom:2px solid #111;padding-bottom:5mm}.logo{height:18mm;width:auto;border-radius:3mm}.issuer h1{font-size:18pt;margin:0 0 1mm}.issuer h2{font-size:12pt;margin:0 0 2mm;color:#444;font-weight:700}.issuer p{margin:0 0 1mm;font-size:9.5pt}.doc{text-align:right;min-width:65mm}.doc h2{font-size:18pt;margin:0 0 3mm;text-transform:uppercase}.doc p{margin:0 0 1.5mm;font-size:10pt}.boxes{display:grid;grid-template-columns:1.2fr 1fr;gap:6mm;margin-top:7mm}.box{border:1px solid #bbb;border-radius:2mm;padding:4mm}.box h3{font-size:10pt;margin:0 0 2.5mm;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:1.5mm}.box p{margin:0 0 1.5mm;font-size:10pt}table{width:100%;border-collapse:collapse;margin-top:7mm}th,td{border-bottom:1px solid #ccc;padding:2.5mm 2mm;text-align:left;vertical-align:top}th{background:#eef3ef;font-size:9pt;text-transform:uppercase}.r{text-align:right}.b{font-weight:700}.totals{display:flex;justify-content:flex-end;margin-top:5mm}.totals table{width:80mm;margin:0}.totals td{border:0;padding:1.5mm 2mm}.totals tr:last-child td{border-top:2px solid #111;font-size:13pt;font-weight:800}.legal{margin-top:8mm;padding-top:4mm;border-top:1px solid #bbb;font-size:8.5pt;color:#333}.foot{margin-top:5mm;font-size:8.5pt;color:#555;text-align:center}</style></head><body><div class="page"><div class="head"><div><img class="logo" src="${n}" alt="Geopadel"><div class="issuer"><h1>${esc(o)}</h1>${s ? `<h2>${esc(s)}</h2>` : ""}<p>${esc(t.nif || "")}</p><p>${esc(r)}</p><p>${esc(t.telefono || "")} · ${esc(t.email || "")}</p></div></div><div class="doc"><h2>${i ? (a ? "Factura rectificativa" : "Factura") : "Justificante de pago"}</h2><p><b>Nº:</b> ${esc(e.numero)}</p><p><b>Fecha:</b> ${esc(facFecha(e.fecha))}</p><p><b>Pago:</b> ${esc(e.metodo_pago || "")}</p></div></div><div class="boxes">${u}<div class="box"><h3>Documento</h3><p>${i ? (a ? "Factura rectificativa" : "Factura legal") : "Justificante de pago"}</p><p>${i ? "Válido fiscalmente" : "No válido como factura"}</p>${e.notas ? `<p><b>Notas:</b> ${esc(e.notas)}</p>` : ""}</div></div>${m}<table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio unit.</th><th class="r">IVA</th><th class="r">Base</th><th class="r">Cuota</th><th class="r">Total</th></tr></thead><tbody>${c}</tbody></table><div class="totals"><table><tr><td>Base imponible</td><td class="r">${l(e.base_imponible)}</td></tr><tr><td>IVA ${esc(e.iva_porcentaje)}%</td><td class="r">${l(e.cuota_iva)}</td></tr><tr><td>TOTAL</td><td class="r">${l(e.total)}</td></tr></table></div><div class="legal">${d}</div><div class="foot">${h}${esc(t.web || "")}</div></div></body></html>`;
}
function imprimirHTML(e) {
  const t = document.createElement("iframe");
  t.style.cssText =
    "position:absolute;left:-9999px;top:0;width:1px;height:1px;border:0;";
  t.setAttribute("aria-hidden", "true");
  document.body.appendChild(t);
  t.onload = () => {
    const e = t.contentWindow,
      n = e.document,
      r = Array.from(n.images);
    Promise.all(
      r.map((e) =>
        e.complete
          ? Promise.resolve()
          : new Promise((t) => {
              e.onload = e.onerror = t;
            }),
      ),
    ).then(() => {
      setTimeout(() => {
        try {
          e.focus();
          e.print();
        } finally {
          setTimeout(() => t.remove(), 3e3);
        }
      }, 100);
    });
  };
  t.srcdoc = e;
}
async function entrarFacturas() {
  if (!supabaseClient) return;
  if (!facConfig) await cargarConfigFacturas();
  iniciarFormFactura();
  facActualizarModoRectificativa();
  await cargarFacturas();
  if (navigator.usb && !usbDevice) await conectarImpresoraUSB(!0);
}
async function entrarFacturasConfig() {
  if (!supabaseClient) return;
  await cargarConfigFacturas();
}
if ($("facAddLinea"))
  $("facAddLinea").addEventListener("click", () => agregarLineaFactura());
if ($("facLineas")) {
  $("facLineas").addEventListener("input", actualizarTotalesFactura);
  $("facLineas").addEventListener("click", (e) => {
    const t = e.target.closest("[data-fac-quitar]");
    if (!t) return;
    const n = t.closest("[data-linea]");
    if (n) n.remove();
    if (!$("facLineas").children.length) agregarLineaFactura();
    actualizarTotalesFactura();
  });
}
if ($("facIva"))
  $("facIva").addEventListener("input", actualizarTotalesFactura);
if ($("facTipo"))
  $("facTipo").addEventListener("change", facActualizarCamposPorTipo);
if ($("facEmitir"))
  $("facEmitir").addEventListener("click", emitirDocumentoFactura);
if ($("facCfgGuardar"))
  $("facCfgGuardar").addEventListener("click", guardarConfigFacturas);
if ($("facRefrescar"))
  $("facRefrescar").addEventListener("click", cargarFacturas);
if ($("facBuscar")) $("facBuscar").addEventListener("input", dibujarFacturas);
if ($("facFiltroTipo"))
  $("facFiltroTipo").addEventListener("change", dibujarFacturas);
if ($("facCancelarRect"))
  $("facCancelarRect").addEventListener("click", cancelarRectificacion);
if ($("facBody"))
  $("facBody").addEventListener("click", async (e) => {
    const t = e.target.closest("button[data-fac]");
    if (!t) return;
    const n = t.dataset.id,
      r = t.dataset.fac;
    if (r === "ticket" || r === "a4") await imprimirFactura(n, r);
    else if (r === "webusb") await imprimirTicketWebUSB(n);
    else if (r === "rectificar") prepararRectificativa(n);
    else if (r === "anular") await anularFactura(n);
  });
let usbDevice = null,
  usbEndpoint = null;
async function conectarImpresoraUSB(e = !1) {
  try {
    let t = null;
    const n = await navigator.usb.getDevices();
    if (n.length > 0) t = n[0];
    else {
      if (e) return;
      t = await navigator.usb.requestDevice({ filters: [] });
    }
    usbDevice = t;
    await usbDevice.open();
    if (usbDevice.configuration === null)
      await usbDevice.selectConfiguration(1);
    for (const e of usbDevice.configuration.interfaces)
      for (const t of e.alternates) {
        const n = t.endpoints.find((e) => e.direction === "out");
        if (n) {
          await usbDevice.claimInterface(e.interfaceNumber);
          usbEndpoint = n.endpointNumber;
          break;
        }
      }
    if (!usbEndpoint) throw new Error("No se encontró el puerto de salida");
    if (!e) toast("Impresora conectada correctamente", "ok");
  } catch (t) {
    console.error("Error al conectar la impresora:", t);
    if (!e) toast("No se pudo conectar: " + (t.message || t), "err");
  }
}
async function enviarBytesAImpresora(e) {
  if (!usbDevice || !usbEndpoint) {
    toast("Primero debes conectar la impresora", "warn");
    return !1;
  }
  const t = 64;
  for (let n = 0; n < e.length; n += t) {
    const r = e.slice(n, n + t);
    await usbDevice.transferOut(usbEndpoint, r);
  }
  return !0;
}
function textoABytes(e) {
  const t = {
      8364: 213,
      225: 160,
      233: 130,
      237: 161,
      243: 162,
      250: 163,
      241: 164,
      193: 181,
      201: 144,
      205: 214,
      211: 224,
      218: 233,
      209: 165,
      252: 129,
      220: 154,
      186: 167,
      170: 166,
      183: 250,
      160: 255,
    },
    n = new Uint8Array(e.length);
  for (let r = 0; r < e.length; r++) {
    const i = e.charCodeAt(r);
    n[r] = t[i] !== undefined ? t[i] : i < 256 ? i : 63;
  }
  return n;
}
function formatearTicketTexto(e) {
  const t = facConfig || {},
    n = 42,
    r = e.tipo === "Factura",
    i = !!e.factura_original_id,
    a = t.nombre_club || t.nombre || "GEOPADEL",
    o = t.nombre && t.nombre !== a ? t.nombre : null,
    s = (e) =>
      (Number(e) || 0)
        .toLocaleString("es-ES", { style: "currency", currency: "EUR" })
        .replace("€", "EUR"),
    l = " ".repeat,
    c = Math.max,
    l2 = "-".repeat(n),
    c2 = "=".repeat(n);
  let d = "";
  d += "\x1B\x40";
  d += "\x1B\x74\x00";
  d += "\x1B\x61\x01";
  d += "\x1D\x21\x11";
  d += a.toUpperCase() + "\n";
  d += "\x1D\x21\x00";
  if (o) d += o + "\n";
  if (t.nif) d += "NIF: " + t.nif + "\n";
  if (t.direccion) d += t.direccion + "\n";
  if (t.telefono) d += "Tel: " + t.telefono + "\n";
  d += "\x1B\x61\x00";
  d += l2 + "\n";
  const u = r
    ? i
      ? "FACTURA RECTIFICATIVA"
      : "FACTURA"
    : "JUSTIFICANTE DE PAGO";
  d += "\x1B\x61\x01";
  d += u + "\n";
  d += `Nº: ${e.numero}` + "\n";
  d += `Fecha: ${facFecha(e.fecha)}` + "\n";
  d += "\x1B\x61\x00";
  d += l2 + "\n";
  if (r) {
    d += `Cliente: ${e.cliente_nombre}\n`;
    if (e.cliente_nif) d += `NIF: ${e.cliente_nif}\n`;
    if (e.cliente_direccion) d += `Dirección: ${e.cliente_direccion}\n`;
  } else d += `Atendido por: ${e.empleado || "—"}\n`;
  d += `Pago: ${e.metodo_pago || "—"}\n`;
  d += l2 + "\n";
  d += "CANT  CONCEPTO                TOTAL\n";
  d += l2 + "\n";
  (e.lineas || []).forEach((e) => {
    const t =
        e.concepto.length > 20
          ? e.concepto.substring(0, 20) + "..."
          : e.concepto,
      n = String(e.cantidad).padEnd(5),
      r = s(e.total).padStart(10);
    d += `${n} ${t.padEnd(20)} ${r}\n`;
  });
  d += l2 + "\n";
  d += `Base Imponible: ${s(e.base_imponible).padStart(15)}\n`;
  d += `IVA (${e.iva_porcentaje}%):   ${s(e.cuota_iva).padStart(15)}\n`;
  d += c2 + "\n";
  d += `TOTAL:          ${s(e.total).padStart(15)}\n`;
  d += c2 + "\n";
  if (e.notas) {
    d += `Notas: ${e.notas}\n`;
    d += l2 + "\n";
  }
  const p = r
    ? "Factura emitida conforme al RD 1619/2012."
    : "Documento no válido como factura.";
  d += "\x1B\x61\x01";
  d += p + "\n";
  if (r && t.pie_factura) d += t.pie_factura + "\n";
  d += "\n\n\n";
  d += "\x1D\x56\x41\x10";
  return d;
}
async function imprimirTicketWebUSB(e) {
  try {
    const t = await obtenerFactura(e);
    if (!t) return toast("No se encontró el documento", "err");
    const n = formatearTicketTexto(t),
      r = textoABytes(n),
      i = await enviarBytesAImpresora(r);
    if (i) toast("Ticket enviado a la impresora", "ok");
  } catch (e) {
    console.error("Error al imprimir:", e);
    toast("No se pudo imprimir: " + (e.message || e), "err");
  }
}
if (typeof window.accion === "function")
  window.accion(
    "conectar-impresora",
    () => typeof conectarImpresoraUSB === "function" && conectarImpresoraUSB(),
  );
