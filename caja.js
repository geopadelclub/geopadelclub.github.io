/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
let reqCaja = 0;
async function cargarCajaHoy() {
  const iso = $("cajaFecha").value || fechaLocalISO();
  const miReq = ++reqCaja;
  let ef = 0,
    ta = 0;
  const r = await supabaseClient.rpc("caja_dia", { p_fecha: iso });
  if (miReq !== reqCaja) return;
  if (r.error) {
    console.error(r.error);
    toast("No se pudo cargar la caja", "err");
    return;
  }
  if (r.data && r.data.ok) {
    ef = Number(r.data.efectivo) || 0;
    ta = Number(r.data.tarjeta) || 0;
  }
  ef = redondear2(ef);
  ta = redondear2(ta);
  datosLocales.caja = {
    totalEfectivo: ef,
    totalTarjeta: ta,
    totalGeneral: redondear2(ef + ta),
  };
  dibujarCaja(datosLocales.caja);
  calcCierre();
}
function dibujarCaja(caja) {
  $("cajaEfectivo").innerText = eur(caja.totalEfectivo);
  $("cajaTarjeta").innerText = eur(caja.totalTarjeta);
  $("cajaTotal").innerText = eur(caja.totalGeneral);
  const iso = $("cajaFecha").value || fechaLocalISO();
  $("cajaFechaTxt").innerText = fechaBonita(iso);
}
function getFondoCaja() {
  return Number.isFinite(FONDO_CAJA_DEF) ? FONDO_CAJA_DEF : 100;
}
function calcularCierre(bil, mon, efSistema) {
  const FONDO_CAJA = getFondoCaja();
  const efContado = redondear2(bil + mon);
  const dejarBilletes = redondear2(
    Math.max(0, Math.min(bil, FONDO_CAJA - mon)),
  );
  const sobre = redondear2(bil - dejarBilletes);
  const cajaFinal = redondear2(mon + dejarBilletes);
  const esperado = redondear2(efSistema + FONDO_CAJA);
  return {
    efContado,
    dejarBilletes,
    sobre,
    cajaFinal,
    faltaFondo: cajaFinal < FONDO_CAJA ? redondear2(FONDO_CAJA - cajaFinal) : 0,
    excesoFondo:
      cajaFinal > FONDO_CAJA ? redondear2(cajaFinal - FONDO_CAJA) : 0,
    esperado,
    dE: redondear2(efContado - esperado),
  };
}
function calcCierre() {
  const FONDO_CAJA = getFondoCaja();
  const v = (id) => parseFloat($(id).value) || 0,
    c = datosLocales.caja || {};
  const r = calcularCierre(
    v("cjBilletes"),
    v("cjMonedas"),
    c.totalEfectivo || 0,
  );
  const dD = redondear2(v("cjDatafono") - (c.totalTarjeta || 0));
  const f = (n) =>
    `<b class="${Math.abs(n) < 0.005 ? "dif-ok" : "dif-ko"}">${n > 0 ? "+" : ""}${eur(n)}</b>`;
  $("cjEfectivo").value = eur(r.efContado);
  const partes = [
    `<span>Efectivo esperado (sistema ${eur(c.totalEfectivo)} + fondo ${eur(FONDO_CAJA)}) ${eur(r.esperado)} · ${f(r.dE)}</span>`,
    `<span>Datáfono en sistema ${eur(c.totalTarjeta)} · ${f(dD)}</span>`,
    `<span><b>Guardar en el sobre: ${eur(r.sobre)}</b> (solo billetes; las monedas se quedan)</span>`,
    `<span>Quedan en caja: <b>${eur(r.cajaFinal)}</b> (${eur(v("cjMonedas"))} en monedas + ${eur(r.dejarBilletes)} en billetes)</span>`,
  ];
  if (r.faltaFondo > 0)
    partes.push(
      `<span class="dif-ko">La caja queda ${eur(r.faltaFondo)} por debajo del fondo objetivo (${eur(FONDO_CAJA)}) porque no hay billetes suficientes.</span>`,
    );
  else if (r.excesoFondo > 0)
    partes.push(
      `<span class="dif-ko">La caja queda ${eur(r.excesoFondo)} por encima del fondo objetivo (${eur(FONDO_CAJA)}) porque las monedas superan el fondo.</span>`,
    );
  $("cjResumen").innerHTML = partes.join("");
}
async function cerrarCajaHoy() {
  const btn = $("btnCerrarCaja"),
    msg = $("msgCierre");
  const bil = parseFloat($("cjBilletes").value) || 0;
  const mon = parseFloat($("cjMonedas").value) || 0;
  const dat = parseFloat($("cjDatafono").value) || 0;
  if (bil < 0 || mon < 0 || dat < 0) {
    msg.style.color = "var(--red)";
    msg.innerText = "Los importes no pueden ser negativos";
    return;
  }
  const fecha = $("cajaFecha").value || fechaLocalISO();
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Cerrando...',
  );
  try {
    await cargarCajaHoy();
    const c = datosLocales.caja;
    const FONDO_CAJA = getFondoCaja();
    const r = calcularCierre(bil, mon, c.totalEfectivo);
    const dE = r.dE,
      dD = redondear2(dat - c.totalTarjeta);
    if (
      r.faltaFondo > 0 &&
      !(await customConfirm(
        `La caja quedará ${r.faltaFondo.toFixed(2)} € por debajo del fondo objetivo de ${FONDO_CAJA} € porque no hay billetes suficientes. ¿Cerrar igualmente?`,
      ))
    )
      return;
    if (
      r.excesoFondo > 0 &&
      !(await customConfirm(
        `La caja quedará ${r.excesoFondo.toFixed(2)} € por encima del fondo objetivo de ${FONDO_CAJA} € porque las monedas superan el fondo. ¿Cerrar igualmente?`,
      ))
    )
      return;
    if (
      (Math.abs(dE) >= 0.005 || Math.abs(dD) >= 0.005) &&
      !(await customConfirm(
        `Hay descuadre (efectivo ${dE.toFixed(2)} €, datáfono ${dD.toFixed(2)} €). ¿Cerrar caja de todos modos?`,
      ))
    )
      return;
    const { data, error } = await supabaseClient.rpc("cerrar_caja", {
      p_fecha: fecha,
      p_billetes: bil,
      p_monedas: mon,
      p_datafono: dat,
    });
    if (error) throw error;
    if (!data || !data.ok) {
      const t = {
        ya_cerrada: `La caja del ${fecha} ya está cerrada. Solo un administrador puede reabrirla desde el historial.`,
        fecha_futura: "No se puede cerrar la caja de un día futuro.",
        importe_negativo: "Los importes no pueden ser negativos.",
        sin_permiso: "No tienes permiso para cerrar la caja.",
      };
      msg.style.color = "var(--red)";
      msg.innerText = t[data && data.error] || "No se pudo cerrar la caja.";
      return;
    }
    msg.style.color = "var(--green)";
    msg.innerText = `Caja cerrada. Guarda ${eur(r.sobre)} en el sobre. En caja quedan ${eur(r.cajaFinal)} (${eur(mon)} en monedas + ${eur(r.dejarBilletes)} en billetes).`;
    cargarHistorialCaja();
  } catch (err) {
    msg.style.color = "var(--red)";
    msg.innerText = "No se pudo cerrar la caja: " + (err.message || err);
  } finally {
    setBusy(btn, false);
  }
}
async function cargarHistorialCaja() {
  const tb = $("histCajaBody");
  const mesInput = $("histCajaMes");
  const hoy = new Date();
  const mesPorDefecto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const mes = (mesInput && mesInput.value) || mesPorDefecto;
  const [y, m] = mes.split("-").map(Number);
  const desde = `${y}-${String(m).padStart(2, "0")}-01`;
  const ultimoDia = new Date(y, m, 0).getDate();
  const hasta = `${y}-${String(m).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  const { data, error } = await supabaseClient
    .from("cierres")
    .select(
      "fecha, efectivo_sistema, tarjeta, total, dif_efectivo, dif_datafono, cerrado_por",
    )
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false });
  if (error) {
    tb.innerHTML = `<tr><td colspan="8" class="tabla-empty" style="color:var(--red)">Error: ${esc(error.message)}</td></tr>`;
    return;
  }
  const dif = (n) => {
    const x = Number(n) || 0;
    return `<b class="${Math.abs(x) < 0.005 ? "dif-ok" : "dif-ko"}">${x > 0 ? "+" : ""}${eur(x)}</b>`;
  };
  const adm = esJefa();
  tb.innerHTML =
    (data || [])
      .map(
        (d) => `<tr>
<td><b>${esc(d.fecha)}</b></td><td>${eur(d.efectivo_sistema)}</td><td>${eur(d.tarjeta)}</td>
<td><b>${eur(d.total)}</b></td><td>${dif(d.dif_efectivo)}</td><td>${dif(d.dif_datafono)}</td>
<td><i class="ri-lock-line" aria-hidden="true"></i>${esc(d.cerrado_por)}</td>
<td>${adm ? `<button type="button" class="btn-add gray" data-reabrir="${esc(d.fecha)}"><i class="ri-lock-unlock-line" aria-hidden="true"></i>Reabrir</button>` : ""}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="8" class="tabla-empty">Sin cierres este mes</td></tr>';
}
async function reabrirCierre(fecha, btn) {
  if (!esJefa()) return toast("Solo la jefa puede reabrir una caja", "err");
  const motivoRaw = await customPrompt(
    `Motivo para reabrir la caja del ${fecha} (queda registrado):`,
    "",
    "Reabrir caja",
  );
  const motivo = (motivoRaw || "").trim();
  if (motivo.length < 5)
    return toast("Escribe un motivo de al menos 5 caracteres", "warn");
  setBusy(btn, true);
  try {
    const { data, error } = await supabaseClient.rpc("reabrir_cierre", {
      p_fecha: fecha,
      p_motivo: motivo,
    });
    if (error) throw error;
    if (!data || !data.ok)
      return toast(
        data && data.error === "sin_permiso"
          ? "No tienes permiso para reabrir cajas"
          : "No se pudo reabrir la caja",
        "err",
      );
    toast("Caja reabierta. Ya se puede volver a cerrar.");
    cargarHistorialCaja();
  } catch (err) {
    toast("No se pudo reabrir: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}
function alCambiarFechaCaja() {
  cargarCajaHoy();
}
function entrarCaja() {
  const inp = $("cajaFecha");
  if (inp && !inp.value) inp.value = fechaLocalISO();
  const mesInput = $("histCajaMes");
  if (mesInput && !mesInput.value) {
    const d = new Date();
    mesInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  cargarCajaHoy();
  cargarHistorialCaja();
}
$("histCajaBody").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-reabrir]");
  if (b) reabrirCierre(b.dataset.reabrir, b);
});
if ($("histCajaMes")) {
  $("histCajaMes").addEventListener("change", cargarHistorialCaja);
}
