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
  const tiposBody = $("informeTiposBody");
  const desdeInput = $("histCajaDesde");
  const hastaInput = $("histCajaHasta");
  if (!tb || !desdeInput || !hastaInput) return;

  const hoy = new Date();
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  if (!desdeInput.value) desdeInput.value = primerDiaMes;
  if (!hastaInput.value) hastaInput.value = fechaLocalISO();

  const desde = desdeInput.value;
  const hasta = hastaInput.value;

  if (desde > hasta) {
    tb.innerHTML =
      '<tr><td colspan="8" class="tabla-empty" style="color:var(--red)">La fecha "Desde" no puede ser posterior a la fecha "Hasta"</td></tr>';
    if (tiposBody)
      tiposBody.innerHTML =
        '<tr><td colspan="4" class="tabla-empty" style="color:var(--red)">Revisa el rango de fechas</td></tr>';
    return;
  }

  tb.innerHTML = '<tr><td colspan="8" class="tabla-empty">Cargando…</td></tr>';
  if (tiposBody)
    tiposBody.innerHTML =
      '<tr><td colspan="4" class="tabla-empty">Cargando…</td></tr>';

  const { data, error } = await supabaseClient.rpc("informe_caja", {
    p_desde: desde,
    p_hasta: hasta,
  });

  if (error) {
    console.error(error);
    tb.innerHTML = `<tr><td colspan="8" class="tabla-empty" style="color:var(--red)">Error: ${esc(error.message)}</td></tr>`;
    if (tiposBody)
      tiposBody.innerHTML = `<tr><td colspan="4" class="tabla-empty" style="color:var(--red)">Error al cargar</td></tr>`;
    return;
  }
  if (!data || !data.ok) {
    tb.innerHTML =
      '<tr><td colspan="8" class="tabla-empty" style="color:var(--red)">No se pudo cargar el informe</td></tr>';
    if (tiposBody)
      tiposBody.innerHTML =
        '<tr><td colspan="4" class="tabla-empty" style="color:var(--red)">No se pudo cargar el desglose</td></tr>';
    return;
  }

  const adm = esJefa();
  const dif = (n) => {
    const x = Number(n) || 0;
    return `<b class="${Math.abs(x) < 0.005 ? "dif-ok" : "dif-ko"}">${x > 0 ? "+" : ""}${eur(x)}</b>`;
  };
  tb.innerHTML =
    (data.cierres || [])
      .map(
        (d) => `<tr>
<td><b>${esc(d.fecha)}</b></td>
<td>${eur(d.efectivo_sistema)}</td>
<td>${eur(d.tarjeta)}</td>
<td><b>${eur(d.total)}</b></td>
<td>${dif(d.dif_efectivo)}</td>
<td>${dif(d.dif_datafono)}</td>
<td><i class="ri-lock-line" aria-hidden="true"></i>${esc(d.cerrado_por)}</td>
<td>${adm ? `<button type="button" class="btn-add gray" data-reabrir="${esc(d.fecha)}"><i class="ri-lock-unlock-line" aria-hidden="true"></i>Reabrir</button>` : ""}</td>
</tr>`,
      )
      .join("") ||
    '<tr><td colspan="8" class="tabla-empty">Sin cierres en este rango</td></tr>';

  const TIPO_LABELS = {
    Bebidas: "Bebidas",
    Comida: "Comida",
    Tienda: "Tienda",
    Pistas: "Pistas",
    "Devolución Pistas": "Devoluciones de pistas",
    Bar: "Bar (histórico)",
  };
  const agrupado = {};
  (data.ventas || []).forEach((v) => {
    const label = TIPO_LABELS[v.tipo] || v.tipo || "Otros";
    if (!agrupado[label]) agrupado[label] = { efectivo: 0, tarjeta: 0 };
    agrupado[label].efectivo += Number(v.efectivo) || 0;
    agrupado[label].tarjeta += Number(v.tarjeta) || 0;
  });
  const totales = data.totales || { efectivo: 0, tarjeta: 0, total: 0 };

  const elEf = $("informeTotalEfectivo");
  const elTa = $("informeTotalTarjeta");
  const elTo = $("informeTotalGeneral");
  if (elEf) elEf.innerText = eur(totales.efectivo);
  if (elTa) elTa.innerText = eur(totales.tarjeta);
  if (elTo) elTo.innerText = eur(totales.total);

  if (tiposBody) {
    const filas = Object.entries(agrupado)
      .filter(([, v]) => v.efectivo !== 0 || v.tarjeta !== 0)
      .sort(
        (a, b) => b[1].efectivo + b[1].tarjeta - (a[1].efectivo + a[1].tarjeta),
      );
    tiposBody.innerHTML = filas.length
      ? filas
          .map(
            ([label, v]) => `<tr>
<td><b>${esc(label)}</b></td>
<td>${eur(v.efectivo)}</td>
<td>${eur(v.tarjeta)}</td>
<td><b>${eur(v.efectivo + v.tarjeta)}</b></td>
</tr>`,
          )
          .join("") +
        `<tr class="fila-total">
<td><b>TOTAL</b></td>
<td><b>${eur(totales.efectivo)}</b></td>
<td><b>${eur(totales.tarjeta)}</b></td>
<td><b>${eur(totales.total)}</b></td>
</tr>`
      : '<tr><td colspan="4" class="tabla-empty">Sin ventas en este rango</td></tr>';
  }
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
  const desde = $("histCajaDesde");
  const hasta = $("histCajaHasta");
  const hoy = new Date();
  if (desde && !desde.value)
    desde.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  if (hasta && !hasta.value) hasta.value = fechaLocalISO();
  cargarCajaHoy();
  cargarHistorialCaja();
}
$("histCajaBody").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-reabrir]");
  if (b) reabrirCierre(b.dataset.reabrir, b);
});
if (typeof window.accion === "function") {
  window.accion("cargar-historial-caja", () => cargarHistorialCaja());
}

async function imprimirInformeCaja() {
  const desde = $("histCajaDesde")?.value;
  const hasta = $("histCajaHasta")?.value;
  if (!desde || !hasta) return toast("Selecciona un rango de fechas", "warn");
  if (desde > hasta) return toast("El rango de fechas no es válido", "warn");

  const btn = $("btnImprimirInformeCaja");
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Preparando...',
  );

  try {
    const { data, error } = await supabaseClient.rpc("informe_caja", {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error("No se pudo cargar el informe");

    const TIPO_LABELS = {
      Bebidas: "Bebidas",
      Comida: "Comida",
      Tienda: "Tienda",
      Pistas: "Pistas",
      "Devolución Pistas": "Devoluciones pistas",
      Bar: "Bar (histórico)",
    };

    const agrupado = {};
    (data.ventas || []).forEach((v) => {
      const label = TIPO_LABELS[v.tipo] || v.tipo || "Otros";
      if (!agrupado[label]) agrupado[label] = { ef: 0, ta: 0 };
      agrupado[label].ef += Number(v.efectivo) || 0;
      agrupado[label].ta += Number(v.tarjeta) || 0;
    });
    const filasVentas = Object.entries(agrupado)
      .filter(([, v]) => v.ef !== 0 || v.ta !== 0)
      .sort((a, b) => b[1].ef + b[1].ta - (a[1].ef + a[1].ta));

    const totales = data.totales || { efectivo: 0, tarjeta: 0, total: 0 };
    const fechaGen = new Date().toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const htmlVentas =
      filasVentas
        .map(
          ([label, v]) =>
            `<tr>
        <td><b>${esc(label)}</b></td>
        <td class="r">${eur(v.ef)}</td>
        <td class="r">${eur(v.ta)}</td>
        <td class="r b">${eur(v.ef + v.ta)}</td>
      </tr>`,
        )
        .join("") ||
      '<tr><td colspan="4" class="tabla-empty">Sin ventas en este rango</td></tr>';

    const htmlVentasTotal = `
      <tr style="background:#f6f9f7;font-weight:bold;border-top:2px solid #444;">
        <td>TOTAL</td>
        <td class="r">${eur(totales.efectivo)}</td>
        <td class="r">${eur(totales.tarjeta)}</td>
        <td class="r">${eur(totales.total)}</td>
      </tr>`;

    const htmlCierres =
      (data.cierres || [])
        .map(
          (c) =>
            `<tr>
        <td><b>${esc(c.fecha)}</b></td>
        <td class="r">${eur(c.efectivo_sistema)}</td>
        <td class="r">${eur(c.tarjeta)}</td>
        <td class="r b">${eur(c.total)}</td>
        <td class="r ${Math.abs(c.dif_efectivo) > 0.005 ? "limp-ko" : ""}">${c.dif_efectivo > 0 ? "+" : ""}${eur(c.dif_efectivo)}</td>
        <td class="r ${Math.abs(c.dif_datafono) > 0.005 ? "limp-ko" : ""}">${c.dif_datafono > 0 ? "+" : ""}${eur(c.dif_datafono)}</td>
        <td>${esc(c.cerrado_por)}</td>
      </tr>`,
        )
        .join("") ||
      '<tr><td colspan="7" class="tabla-empty">Sin cierres en este rango</td></tr>';

    const html = `
      <section class="fx-page">
        <div class="fx-head">
          <img src="./geopadel.webp" alt="Geopadel" width="150" height="150">
          <div>
            <h1>Informe de Caja</h1>
            <p>Del ${esc(desde)} al ${esc(hasta)}</p>
          </div>
          <div class="fx-meta">
            Geopadel<br>Impreso: ${esc(fechaGen)}
          </div>
        </div>

        <h2>1. Desglose de ventas por tipo</h2>
        <table class="fx-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th class="r">Efectivo</th>
              <th class="r">Tarjeta</th>
              <th class="r">Total</th>
            </tr>
          </thead>
          <tbody>
            ${htmlVentas}
            ${htmlVentasTotal}
          </tbody>
        </table>

        <h2 style="margin-top:8mm;">2. Cierres de caja diarios</h2>
        <table class="fx-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th class="r">Efectivo sis.</th>
              <th class="r">Datáfono sis.</th>
              <th class="r">Total</th>
              <th class="r">Dif. efectivo</th>
              <th class="r">Dif. datáfono</th>
              <th>Cerrado por</th>
            </tr>
          </thead>
          <tbody>
            ${htmlCierres}
          </tbody>
        </table>

        <p class="fx-nota">
          * Los descuadres en rojo indican una diferencia entre lo contado y lo registrado en el sistema.
          Los totales de "Desglose de ventas" y "Cierres de caja" pueden variar si hay ventas de días sin cerrar o ajustes manuales.
        </p>
      </section>`;

    const area = $("printArea");
    area.innerHTML = html;

    await Promise.all(
      Array.from(area.querySelectorAll("img")).map((im) =>
        im.complete
          ? null
          : new Promise((res) => {
              im.onload = im.onerror = res;
            }),
      ),
    );

    window.print();
  } catch (err) {
    console.error(err);
    toast("No se pudo preparar la impresión: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

if ($("btnImprimirInformeCaja")) {
  $("btnImprimirInformeCaja").addEventListener("click", imprimirInformeCaja);
}
window.addEventListener("afterprint", () => {
  setTimeout(() => {
    const a = $("printArea");
    if (a) a.innerHTML = "";
  }, 1000);
});
