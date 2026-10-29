/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function cargarTarifas() {
  const { data, error } = await conReintento(() =>
    supabaseClient
      .from("tarifas")
      .select("franja, precio_60min, precio_90min, precio_120min"),
  );
  if (error) {
    console.error(error);
    return;
  }
  const tf = {};
  const num = (v) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  (data || []).forEach((t) => {
    const k = Object.keys(TARIFAS_FRANJAS).find(
      (x) => TARIFAS_FRANJAS[x] === t.franja,
    );
    if (k)
      tf[k] = {
        60: num(t.precio_60min),
        90: num(t.precio_90min),
        120: num(t.precio_120min),
      };
  });
  datosLocales.tarifas = tf;
  dibujarTarifas({ ...TARIFAS_DEFECTO, ...tf });
}
function dibujarTarifas(t) {
  if (!t) return;
  Object.entries(TARIFAS_IDS).forEach(([k, ids]) => {
    const f = t[k];
    if (!f) return;
    $(ids[0]).value = f[60] ?? "";
    $(ids[1]).value = f[90] ?? "";
    $(ids[2]).value = f[120] ?? "";
  });
  actualizarEntrenoAuto();
}
function actualizarEntrenoAuto() {
  const inp = $("tarEntreno60");
  if (!inp) return;
  const v = parseFloat(inp.value);
  if (isFinite(v) && v > 0) {
    $("tarEntreno").value = (v * 1.5).toFixed(2);
    $("tarEntreno120").value = (v * 2).toFixed(2);
  } else {
    $("tarEntreno").value = "";
    $("tarEntreno120").value = "";
  }
}
if ($("tarEntreno60")) {
  $("tarEntreno60").addEventListener("input", actualizarEntrenoAuto);
}
async function guardarTarifasUI() {
  const msg = $("msgTarifas"),
    btn = $("btnGuardarTarifas");
  const opcional = (id) => {
    const v = $(id).value.trim();
    return v === "" ? null : parseFloat(v);
  };
  const filas = [],
    nuevas = {};
  for (const [k, ids] of Object.entries(TARIFAS_IDS)) {
    let p60, p90, p120;
    if (k === "entrenamiento") {
      p60 = opcional(ids[0]);
      if (p60 === null || isNaN(p60) || p60 < 0) {
        msg.style.color = "var(--red)";
        msg.innerText =
          "El precio de entrenamiento por hora es obligatorio y no puede ser negativo";
        return;
      }
      p90 = Math.round(p60 * 1.5 * 100) / 100;
      p120 = Math.round(p60 * 2 * 100) / 100;
    } else {
      p60 = opcional(ids[0]);
      p90 = parseFloat($(ids[1]).value);
      p120 = opcional(ids[2]);
      const malo = (v) => v !== null && (isNaN(v) || v < 0);
      if (isNaN(p90) || p90 < 0 || malo(p60) || malo(p120)) {
        msg.style.color = "var(--red)";
        msg.innerText =
          "Revisa las tarifas: el precio de 90 min es obligatorio y ninguno puede ser negativo";
        return;
      }
    }
    filas.push({
      franja: TARIFAS_FRANJAS[k],
      precio_60min: p60,
      precio_90min: p90,
      precio_120min: p120,
    });
    nuevas[k] = { 60: p60, 90: p90, 120: p120 };
  }
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...',
  );
  const { error } = await supabaseClient
    .from("tarifas")
    .upsert(filas, { onConflict: "franja" });
  setBusy(btn, false);
  if (error) {
    msg.style.color = "var(--red)";
    msg.innerText = "No se pudieron guardar: " + error.message;
    return;
  }
  datosLocales.tarifas = nuevas;
  actualizarEntrenoAuto();
  msg.style.color = "var(--green)";
  msg.innerText = "Tarifas actualizadas";
  setTimeout(() => {
    msg.innerText = "";
  }, 4000);
}
