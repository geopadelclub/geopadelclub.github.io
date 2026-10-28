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
const FONDO_CAJA = 100;
function calcularCierre(bil, mon, efSistema) {
  const efContado = redondear2(bil + mon);
  const dejarBilletes = Math.max(0, redondear2(FONDO_CAJA - mon));
  const sobreBruto = redondear2(bil - dejarBilletes);
  const esperado = redondear2(efSistema + FONDO_CAJA);
  return {
    efContado,
    dejarBilletes,
    sobre: Math.max(0, sobreBruto),
    faltaFondo: sobreBruto < 0 ? redondear2(-sobreBruto) : 0,
    esperado,
    dE: redondear2(efContado - esperado),
  };
}
function calcCierre() {
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
  $("cjResumen").innerHTML =
    `<span>Efectivo esperado (sistema ${eur(c.totalEfectivo)} + fondo ${eur(FONDO_CAJA)}) ${eur(r.esperado)} · ${f(r.dE)}</span>` +
    `<span>Datáfono en sistema ${eur(c.totalTarjeta)} · ${f(dD)}</span>` +
    (r.faltaFondo > 0
      ? `<span class="dif-ko">No hay billetes suficientes para dejar ${eur(FONDO_CAJA)}: faltan ${eur(r.faltaFondo)}</span>`
      : `<span><b>Guardar en el sobre: ${eur(r.sobre)}</b> (se quedan en caja ${eur(FONDO_CAJA)}: ${eur(parseFloat($("cjMonedas").value) || 0)} en monedas + ${eur(r.dejarBilletes)} en billetes)</span>`);
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
    const r = calcularCierre(bil, mon, c.totalEfectivo);
    const dE = r.dE,
      dD = redondear2(dat - c.totalTarjeta);
    if (
      r.faltaFondo > 0 &&
      !(await customConfirm(
        `No hay billetes suficientes para dejar ${FONDO_CAJA} € en caja (faltan ${r.faltaFondo.toFixed(2)} €). ¿Cerrar igualmente?`,
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
    msg.innerText = `Caja cerrada. Guarda ${eur(r.sobre)} en el sobre y deja ${eur(FONDO_CAJA)} en caja.`;
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
  const { data, error } = await supabaseClient
    .from("cierres")
    .select(
      "fecha, efectivo_sistema, tarjeta, total, dif_efectivo, dif_datafono, cerrado_por",
    )
    .order("fecha", { ascending: false })
    .limit(60);
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
      .join("") || '<tr><td colspan="8" class="tabla-empty">—</td></tr>';
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
  cargarCajaHoy();
  cargarHistorialCaja();
}
$("histCajaBody").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-reabrir]");
  if (b) reabrirCierre(b.dataset.reabrir, b);
});
