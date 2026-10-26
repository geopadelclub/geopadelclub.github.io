/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const CT_DIAS = [
    ["lun", "Lunes"],
    ["mar", "Martes"],
    ["mie", "Miércoles"],
    ["jue", "Jueves"],
    ["vie", "Viernes"],
    ["sab", "Sábado"],
    ["dom", "Domingo"],
  ],
  CT_HORAS_MAX = 48;
let ctCache = { usuario: null, data: undefined },
  ctResolver = null;
const ctMin = (e) => {
    const [t, n] = String(e || "")
      .split(":")
      .map(Number);
    return (isNaN(t) ? 0 : t) * 60 + (isNaN(n) ? 0 : n);
  },
  ctHoras = (e) => {
    const t = Math.floor(e / 60),
      n = Math.round(e % 60);
    return n ? `${t} h ${String(n).padStart(2, "0")} min` : `${t} h`;
  },
  ctNum = (e) => String(Number(e)).replace(".", ",");
function ctUsuario() {
  return usuarioSesion ? usuarioSesion.user : null;
}
function ctMinutosDia(e) {
  if (!e || !e.on) return 0;
  let t = 0;
  if (e.ini && e.fin && ctMin(e.fin) > ctMin(e.ini))
    t += ctMin(e.fin) - ctMin(e.ini);
  if (e.ini2 && e.fin2 && ctMin(e.fin2) > ctMin(e.ini2))
    t += ctMin(e.fin2) - ctMin(e.ini2);
  return t;
}
function ctMinutosSemana(e) {
  return CT_DIAS.reduce((t, [n]) => t + ctMinutosDia(e && e[n]), 0);
}
async function cargarContrato(e) {
  const t = ctUsuario();
  if (!t || !supabaseClient) return null;
  if (!e && ctCache.usuario === t && ctCache.data !== undefined)
    return ctCache.data;
  const { data: n, error: r } = await supabaseClient
    .from("contratos_jornada")
    .select("usuario,horas_semanales,horario,notas,vigente_desde,created_at")
    .eq("usuario", t)
    .order("created_at", { ascending: !1 })
    .order("id", { ascending: !1 })
    .limit(1);
  if (r) {
    console.error(r);
    throw r;
  }
  ctCache = { usuario: t, data: (n && n[0]) || null };
  return ctCache.data;
}
function ctJornadaDeContrato(e, t) {
  if (!e) return null;
  const n = e.horario || {},
    r = CT_DIAS.filter(([e]) => n[e] && n[e].on).length;
  if (!r) return null;
  const [i, a, o] = t.split("-").map(Number),
    s = CT_DIAS[(new Date(i, a - 1, o, 12).getDay() + 6) % 7][0];
  if (!(n[s] && n[s].on)) return 0;
  return ctMinutosDia(n[s]);
}
function ctResumenHtml(e) {
  if (!e)
    return '<p class="limp-leyenda" style="color:var(--orange-text);font-weight:700"><i class="ri-error-warning-line" aria-hidden="true"></i>Aún no has indicado tu contrato. Se te pedirá al fichar por primera vez.</p>';
  const t = CT_DIAS.map(([t, n]) => {
      const r = (e.horario || {})[t];
      if (!r || !r.on)
        return `<tr><td><b>${esc(n)}</b></td><td class="tabla-empty" style="text-align:left !important">Libranza</td></tr>`;
      const i = [
        r.ini && r.fin ? `${r.ini}–${r.fin}` : "",
        r.ini2 && r.fin2 ? `${r.ini2}–${r.fin2}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr><td><b>${esc(n)}</b></td><td>${esc(i)}</td></tr>`;
    }).join(""),
    n = new Date(e.created_at);
  return `<p style="font-size:15px;font-weight:700;color:var(--heading);margin-bottom:6px">${esc(ctNum(e.horas_semanales))} h semanales</p>\n<p class="limp-leyenda">Declarado el ${esc(isNaN(n.getTime()) ? "" : n.toLocaleDateString("es-ES"))}${e.vigente_desde ? " · vigente desde " + esc(fmtFecha(e.vigente_desde)) : ""}</p>\n${e.notas ? `<p class="limp-leyenda">Nota: ${esc(e.notas)}</p>` : ""}\n<div class="table-wrap"><table class="tabla-productos" style="min-width:260px"><tbody>${t}</tbody></table></div>`;
}
async function dibujarContratoResumen() {
  const e = $("contratoResumen");
  if (!e || !usuarioSesion) return;
  try {
    e.innerHTML = ctResumenHtml(await cargarContrato(!0));
  } catch (t) {
    e.innerHTML = `<p class="limp-leyenda" style="color:var(--red)">${esc(esErrorTabla(t) ? "Falta crear la tabla «contratos_jornada». Ejecuta migracion_tienda_contratos.sql en Supabase." : "No se pudo cargar tu contrato: " + (t.message || t))}</p>`;
  }
}
function ctDibujarFilas(e) {
  const t = (e && e.horario) || {};
  $("ctFilas").innerHTML = CT_DIAS.map(([n, r]) => {
    const i = t[n] || {},
      a = e ? !!i.on : n !== "sab" && n !== "dom";
    return `<div class="ct-fila" data-dia="${n}">\n<label class="ct-dia"><input type="checkbox" class="ct-on" ${a ? "checked" : ""}><span>${esc(r)}</span></label>\n<div class="ct-horas">\n<input type="time" class="ct-ini" value="${esc(i.ini || (a ? "09:00" : ""))}" aria-label="${esc(r)}: entrada">\n<span>–</span>\n<input type="time" class="ct-fin" value="${esc(i.fin || (a ? "14:00" : ""))}" aria-label="${esc(r)}: salida">\n</div>\n<div class="ct-horas">\n<input type="time" class="ct-ini2" value="${esc(i.ini2 || "")}" aria-label="${esc(r)}: segunda entrada (opcional)">\n<span>–</span>\n<input type="time" class="ct-fin2" value="${esc(i.fin2 || "")}" aria-label="${esc(r)}: segunda salida (opcional)">\n</div></div>`;
  }).join("");
  ctActualizar();
}
function ctLeerHorario() {
  const e = {};
  document.querySelectorAll("#ctFilas .ct-fila").forEach((t) => {
    e[t.dataset.dia] = {
      on: t.querySelector(".ct-on").checked,
      ini: t.querySelector(".ct-ini").value,
      fin: t.querySelector(".ct-fin").value,
      ini2: t.querySelector(".ct-ini2").value,
      fin2: t.querySelector(".ct-fin2").value,
    };
  });
  return e;
}
function ctActualizar() {
  document.querySelectorAll("#ctFilas .ct-fila").forEach((e) => {
    const t = e.querySelector(".ct-on").checked;
    e.classList.toggle("off", !t);
    e.querySelectorAll('input[type="time"]').forEach((e) => {
      e.disabled = !t;
    });
  });
  const e = ctMinutosSemana(ctLeerHorario());
  $("ctCalculo").innerText = e
    ? `Según el horario: ${ctHoras(e)} a la semana`
    : "Marca los días y las horas que trabajas";
}
async function abrirContrato(e) {
  let t = null;
  try {
    t = await cargarContrato(!1);
  } catch (e) {
    toast("No se pudo cargar tu contrato: " + (e.message || e), "err");
    return !1;
  }
  $("ctObligatorio").hidden = !e;
  $("ctTitulo").innerText = t ? "Modificar mi contrato" : "Tu contrato";
  $("ctHoras").value = t ? t.horas_semanales : "";
  $("ctNotas").value = t && t.notas ? t.notas : "";
  $("ctDesde").value = fechaLocalISO();
  $("msgContrato").innerText = "";
  ctDibujarFilas(t);
  abrirOverlay("modalContrato");
  return !0;
}
function cerrarContrato(e) {
  cerrarOverlay("modalContrato");
  if (ctResolver) {
    const t = ctResolver;
    ctResolver = null;
    t(!!e);
  }
}
async function guardarContrato() {
  const msg = $("msgContrato"),
    btn = $("btnGuardarContrato"),
    mostrarError = (texto) => {
      msg.style.color = "var(--red)";
      msg.innerText = texto;
    },
    horas = parseFloat(String($("ctHoras").value).replace(",", ".")),
    horario = ctLeerHorario(),
    notas = $("ctNotas").value.trim(),
    desde = $("ctDesde").value;
  if (isNaN(horas) || horas <= 0 || horas > CT_HORAS_MAX)
    return mostrarError(
      `Indica las horas semanales de tu contrato (entre 0,5 y ${CT_HORAS_MAX})`,
    );
  if (!desde) return mostrarError("Indica desde cuándo rige este horario");
  const diasActivos = CT_DIAS.filter(([k]) => horario[k].on);
  if (!diasActivos.length)
    return mostrarError("Marca al menos un día de trabajo");
  for (const [k, nombreDia] of diasActivos) {
    const slot = horario[k];
    if (!slot.ini || !slot.fin || ctMin(slot.fin) <= ctMin(slot.ini))
      return mostrarError(
        `${nombreDia}: revisa la hora de entrada y de salida`,
      );
    const tiene2 = !!slot.ini2,
      tieneFin2 = !!slot.fin2;
    if (tiene2 !== tieneFin2)
      return mostrarError(
        `${nombreDia}: completa el segundo tramo o déjalo vacío`,
      );
    if (tiene2 && ctMin(slot.fin2) <= ctMin(slot.ini2))
      return mostrarError(`${nombreDia}: revisa el segundo tramo`);
    if (tiene2 && ctMin(slot.ini2) < ctMin(slot.fin))
      return mostrarError(
        `${nombreDia}: el segundo tramo debe empezar después del primero`,
      );
  }
  const horarioLimpio = {};
  CT_DIAS.forEach(([k]) => {
    const slot = horario[k];
    horarioLimpio[k] = slot.on
      ? {
          on: !0,
          ini: slot.ini,
          fin: slot.fin,
          ini2: slot.ini2 || "",
          fin2: slot.fin2 || "",
        }
      : { on: !1 };
  });
  const horasHorario = ctMinutosSemana(horarioLimpio) / 60;
  if (
    Math.abs(horasHorario - horas) > 0.5 &&
    !(await customConfirm(
      `Las horas que has escrito (${ctNum(horas)} h) no coinciden con las del horario (${ctNum(Math.round(horasHorario * 10) / 10)} h). ¿Guardar igualmente?`,
    ))
  )
    return;
  setBusy(
    btn,
    !0,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...',
  );
  try {
    const usuarioActual = ctUsuario(),
      { error: errInsert } = await supabaseClient
        .from("contratos_jornada")
        .insert({
          usuario: usuarioActual,
          horas_semanales: Math.round(horas * 10) / 10,
          horario: horarioLimpio,
          notas: notas || null,
          vigente_desde: desde,
          declarado_por: usuarioActual,
        });
    if (errInsert) throw errInsert;
    ctCache = { usuario: null, data: undefined };
    toast("Contrato guardado");
    cerrarContrato(!0);
    dibujarContratoResumen();
    if (typeof fxAplicarContrato === "function") fxAplicarContrato();
  } catch (err) {
    console.error(err);
    mostrarError(
      esErrorTabla(err)
        ? "Falta crear la tabla «contratos_jornada». Ejecuta migracion_tienda_contratos.sql en Supabase."
        : "No se pudo guardar: " + (err.message || err),
    );
  } finally {
    setBusy(btn, !1);
  }
}
async function asegurarContrato() {
  if (typeof esJefa === "function" && esJefa()) return !0;
  let e;
  try {
    e = await cargarContrato(!1);
  } catch (e) {
    console.error(e);
    return !0;
  }
  if (e) return !0;
  if (!(await abrirContrato(!0))) return !1;
  return new Promise((e) => {
    ctResolver = e;
  });
}
function entrarContrato() {
  if (typeof esJefa === "function" && esJefa()) return;
  dibujarContratoResumen();
}
$("btnEditarContrato").addEventListener("click", () => abrirContrato(!1));
$("btnGuardarContrato").addEventListener("click", guardarContrato);
$("btnCancelarContrato").addEventListener("click", () => cerrarContrato(!1));
$("btnCerrarContrato").addEventListener("click", () => cerrarContrato(!1));
$("ctFilas").addEventListener("input", ctActualizar);
$("ctFilas").addEventListener("change", ctActualizar);
