/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const FX_MAX_TRAMO_MIN = 16 * 60;
let fxEmpleados = {},
  fxEmpleadosListos = !1,
  fxJefas = new Set();
const fxPad = (e) => String(e).padStart(2, "0"),
  fxHM = (e) => `${Math.floor(e / 60)}:${fxPad(e % 60)}`,
  fxDec = (e) => (e / 60).toFixed(2).replace(".", ","),
  fxHora = (e) => `${fxPad(e.getHours())}:${fxPad(e.getMinutes())}`,
  fxTs = (e) => e.created_at,
  fxNombre = (e) => fxEmpleados[e] || e,
  fxFecha = (e) => {
    const [t, n, r] = String(e).split("-");
    return `${r}/${n}/${t}`;
  },
  fxDiaSemana = (e) => {
    const [t, n, r] = e.split("-").map(Number);
    return new Date(t, n - 1, r, 12)
      .toLocaleDateString("es-ES", { weekday: "short" })
      .replace(".", "");
  },
  fxMesTxt = (e) => {
    const [t, n] = e.split("-").map(Number),
      r = new Date(t, n - 1, 1, 12).toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });
    return r.charAt(0).toUpperCase() + r.slice(1);
  };
function fxRango(e) {
  const t = fechaLocalISO(),
    [n, r] = t.split("-").map(Number);
  if (e === "hoy") return [t, t];
  if (e === "mes") return [`${n}-${fxPad(r)}-01`, t];
  return [
    fechaLocalISO(new Date(n, r - 2, 1)),
    fechaLocalISO(new Date(n, r - 1, 0)),
  ];
}
function aplicarPermisosFichajes() {
  const e = typeof esJefa === "function" && esJefa(),
    t = $("fxEmpleadoBox");
  if (t) t.style.display = e ? "" : "none";
  [
    ["cardFichar", e],
    ["cardContrato", e],
  ].forEach(([e, t]) => {
    const n = $(e);
    if (n) n.style.display = t ? "none" : "";
  });
}
async function fxCargarEmpleados() {
  const e = $("fxEmpleado");
  try {
    const { data: t, error: n } = await supabaseClient
      .from("usuarios")
      .select("usuario,nombre,estado,rol")
      .order("nombre");
    if (n) throw n;
    fxEmpleados = {};
    fxJefas = new Set();
    (t || []).forEach((e) => {
      if (e.usuario) {
        fxEmpleados[e.usuario] = e.nombre || e.usuario;
        if (
          String(e.rol || "")
            .trim()
            .toLowerCase() === "jefa"
        )
          fxJefas.add(e.usuario);
      }
    });
    const r = e.value;
    e.innerHTML =
      '<option value="">Todos los empleados</option>' +
      (t || [])
        .filter((e) => e.usuario && !fxJefas.has(e.usuario))
        .map(
          (e) =>
            `<option value="${esc(e.usuario)}">${esc(e.nombre || e.usuario)}${e.estado && e.estado !== "Activo" ? " (inactivo)" : ""}</option>`,
        )
        .join("");
    e.value = r;
    fxEmpleadosListos = !0;
  } catch (e) {
    console.error(e);
  }
}
function fxCalcular(e, t, n, r) {
  const i = {},
    a = {},
    o = Date.now();
  e.forEach((e) => {
    (i[e.empleado] = i[e.empleado] || []).push(e);
  });
  const s = (e, t) => {
    const n = fechaLocalISO(t),
      r = e + "|" + n;
    return (
      a[r] || (a[r] = { emp: e, fecha: n, tramos: [], incid: [], enCurso: !1 })
    );
  };
  Object.keys(i).forEach((e) => {
    const t = i[e]
      .map((e) => ({ tipo: e.tipo, t: new Date(fxTs(e)) }))
      .filter((e) => !isNaN(e.t.getTime()))
      .sort((e, t) => e.t - t.t);
    let n = null;
    t.forEach((t) => {
      if (t.tipo === "Entrada") {
        if (n) s(e, n).incid.push(`Entrada ${fxHora(n)} sin salida`);
        n = t.t;
      } else if (t.tipo === "Salida") {
        if (n && t.t - n <= FX_MAX_TRAMO_MIN * 6e4)
          s(e, n).tramos.push({
            ini: n,
            fin: t.t,
            min: Math.round((t.t - n) / 6e4),
          });
        else {
          if (n) s(e, n).incid.push(`Entrada ${fxHora(n)} sin salida`);
          s(e, t.t).incid.push(`Salida ${fxHora(t.t)} sin entrada`);
        }
        n = null;
      }
    });
    if (n) {
      const t = s(e, n);
      if (o - n.getTime() <= FX_MAX_TRAMO_MIN * 6e4) t.enCurso = !0;
      else t.incid.push(`Entrada ${fxHora(n)} sin salida`);
    }
  });
  const l = Object.values(a).filter((e) => e.fecha >= t && e.fecha <= n);
  l.forEach((e) => {
    e.tramos.sort((e, t) => e.ini - t.ini);
    e.total = e.tramos.reduce((e, t) => e + t.min, 0);
    e.pausa = 0;
    for (let t = 1; t < e.tramos.length; t++) {
      const n = e.tramos[t - 1],
        r = e.tramos[t];
      if (fechaLocalISO(n.fin) === fechaLocalISO(r.ini))
        e.pausa += Math.max(0, Math.round((r.ini - n.fin) / 6e4));
    }
    const t = r(e.emp, e.fecha);
    e.jorn = isFinite(t.min) ? t.min : 0;
    e.sinContrato = !t.contrato;
    e.ord = Math.min(e.total, t.min);
    e.extra = Math.max(0, e.total - t.min);
  });
  l.sort(
    (e, t) =>
      fxNombre(e.emp).localeCompare(fxNombre(t.emp), "es") ||
      e.fecha.localeCompare(t.fecha),
  );
  const c = {};
  l.forEach((e) => {
    const t = e.emp + "|" + e.fecha.slice(0, 7),
      n =
        c[t] ||
        (c[t] = {
          emp: e.emp,
          mes: e.fecha.slice(0, 7),
          dias: 0,
          total: 0,
          ord: 0,
          extra: 0,
          pausa: 0,
          incid: 0,
          sinContrato: !1,
        });
    if (e.sinContrato) n.sinContrato = !0;
    if (e.tramos.length) n.dias++;
    n.total += e.total;
    n.ord += e.ord;
    n.extra += e.extra;
    n.pausa += e.pausa;
    n.incid += e.incid.length;
  });
  const d = Object.values(c).sort(
    (e, t) =>
      fxNombre(e.emp).localeCompare(fxNombre(t.emp), "es") ||
      e.mes.localeCompare(t.mes),
  );
  return { dias: l, meses: d };
}
const fxTramosTxt = (e) =>
    e.tramos
      .map(
        (e) =>
          `${fxHora(e.ini)}–${fxHora(e.fin)}${fechaLocalISO(e.fin) !== fechaLocalISO(e.ini) ? " (+1 día)" : ""}`,
      )
      .join(" · ") +
    (e.enCurso ? (e.tramos.length ? " · " : "") + "en curso" : ""),
  fxMin = (e) => (e ? fxHM(e) + " h" : "—"),
  fxJornadaTxt = (e) =>
    e.jorn
      ? fxHM(e.jorn) + " h" + (e.sinContrato ? " *" : "")
      : e.sinContrato
        ? "— *"
        : "Libranza";
function fxTabla(e, t, n, r) {
  const i = `<table class="${n}"><thead><tr>${e.map((e) => `<th>${esc(e)}</th>`).join("")}</tr></thead><tbody>${t.length ? t.join("") : `<tr><td colspan="${e.length}" class="tabla-empty">${esc(r)}</td></tr>`}</tbody></table>`;
  return n === "fx-table" ? i : `<div class="table-wrap">${i}</div>`;
}
function fxFilasDia(e, t) {
  return e.map((e) => {
    const n = e.incid.length
      ? t
        ? `<span class="limp-ko">${esc(e.incid.join(" · "))}</span>`
        : esc(e.incid.join(" · "))
      : e.enCurso
        ? "En curso"
        : "";
    return `<tr><td><b>${esc(fxNombre(e.emp))}</b></td><td>${esc(fxDiaSemana(e.fecha))} ${esc(fxFecha(e.fecha))}</td><td>${esc(fxTramosTxt(e))}</td><td>${esc(fxMin(e.pausa))}</td><td>${esc(fxJornadaTxt(e))}</td><td><b>${esc(fxMin(e.total))}</b></td><td>${esc(fxMin(e.ord))}</td><td>${esc(fxMin(e.extra))}</td><td>${n || "—"}</td></tr>`;
  });
}
function fxFilasMes(e) {
  return e.map(
    (e) =>
      `<tr><td><b>${esc(fxNombre(e.emp))}</b>${e.sinContrato ? " *" : ""}</td><td>${esc(fxMesTxt(e.mes))}</td><td>${e.dias}</td><td><b>${esc(fxMin(e.total))}</b></td><td>${esc(fxMin(e.ord))}</td><td>${esc(fxMin(e.extra))}</td><td>${e.incid || "—"}</td></tr>`,
  );
}
const FX_CAB_DIA = [
    "Empleado",
    "Fecha",
    "Tramos (entrada–salida)",
    "Pausas",
    "Jornada del día",
    "Horas trabajadas",
    "Ordinarias",
    "Exceso s/ jornada",
    "Incidencias",
  ],
  FX_CAB_MES = [
    "Empleado",
    "Mes",
    "Días trabajados",
    "Horas trabajadas",
    "Ordinarias",
    "Exceso s/ jornada",
    "Incidencias",
  ];
function fxDibujar(e) {
  const t = e.dias.reduce(
    (e, t) => ({
      t: e.t + t.total,
      o: e.o + t.ord,
      e: e.e + t.extra,
      i: e.i + t.incid.length,
      n: e.n + (t.tramos.length ? 1 : 0),
    }),
    { t: 0, o: 0, e: 0, i: 0, n: 0 },
  );
  $("fxContenido").innerHTML =
    `<div class="card"><div class="kpi-row"><div class="kpi ef"><span>Horas trabajadas</span><h2>${esc(fxHM(t.t))} h</h2></div><div class="kpi"><span>Ordinarias</span><h2>${esc(fxHM(t.o))} h</h2></div><div class="kpi ta"><span>Exceso sobre jornada</span><h2>${esc(fxHM(t.e))} h</h2></div><div class="kpi"><span>Días trabajados</span><h2>${t.n}</h2></div><div class="kpi"><span>Incidencias</span><h2 class="${t.i ? "limp-ko" : ""}">${t.i}</h2></div></div></div><div class="card"><h3><i class="ri-calendar-2-line" aria-hidden="true"></i>Resumen por mes</h3>${fxTabla(FX_CAB_MES, fxFilasMes(e.meses), "tabla-productos", "Sin fichajes en este periodo")}<p class="limp-leyenda" style="margin-top:12px">Los meses solo suman los días incluidos en el periodo elegido.</p></div><div class="card"><h3><i class="ri-list-check-2" aria-hidden="true"></i>Detalle por día</h3>${fxTabla(FX_CAB_DIA, fxFilasDia(e.dias, !0), "tabla-productos", "Sin fichajes en este periodo")}<p class="limp-leyenda" style="margin-top:12px">Horas netas = suma de cada tramo Entrada→Salida. Las pausas son el tiempo entre una Salida y la siguiente Entrada del mismo día y no se cuentan como trabajadas. «Jornada del día» sale del contrato de cada trabajador (minutos reales del horario de cada día según el contrato; los días de libranza tienen jornada 0). «Exceso s/ jornada» = horas que superan esa jornada; que sean horas extraordinarias legalmente depende del convenio y del contrato. ${e.sinContrato.length ? `<b>*</b> Sin contrato indicado (${esc(e.sinContrato.map(fxNombre).join(", "))}): no se puede calcular el exceso hasta que lo indiquen.` : ""} Una incidencia es una Entrada sin Salida (o al revés): conviene revisarla.</p></div>`;
}
async function fxCargarContratos(e) {
  const t = {};
  if (!e.length) return t;
  try {
    const { data: n, error: r } = await leerTodo(() =>
      supabaseClient
        .from("contratos_jornada")
        .select(
          "usuario,horas_semanales,horario,notas,vigente_desde,created_at",
        )
        .in("usuario", e)
        .order("vigente_desde", { ascending: !1 })
        .order("created_at", { ascending: !1 })
        .order("id", { ascending: !1 }),
    );
    if (r) throw r;
    (n || []).forEach((e) => {
      (t[e.usuario] = t[e.usuario] || []).push(e);
    });
  } catch (e) {
    console.error("contratos", e);
  }
  return t;
}
let fxUltimoState = null;
async function fxGenerar() {
  const e = $("fxMsg"),
    t = $("fxVer"),
    n = (texto) => {
      e.style.color = "var(--red)";
      e.innerText = texto;
      return !1;
    },
    r = $("fxDesde").value,
    i = $("fxHasta").value;
  if (!r || !i || i < r) return n("Revisa las fechas");
  if (sumarDiasISO(r, 366) < i) return n("El rango máximo es de un año");
  const a = esJefa(),
    o = a ? $("fxEmpleado").value : usuarioSesion && usuarioSesion.user;
  if (!a && !o) return n("No se pudo identificar al empleado");
  setBusy(
    t,
    !0,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Calculando...',
  );
  e.innerText = "";
  try {
    const desdeDate = new Date(sumarDiasISO(r, -1) + "T00:00:00"),
      hastaDate = new Date(sumarDiasISO(i, 2) + "T00:00:00"),
      { data: filas, error: errLeer } = await leerTodo(() => {
        let q = supabaseClient
          .from("fichajes")
          .select("empleado,tipo,created_at")
          .gte("created_at", desdeDate.toISOString())
          .lt("created_at", hastaDate.toISOString())
          .order("created_at", { ascending: !0 });
        if (o) q = q.eq("empleado", o);
        return q;
      });
    if (errLeer) throw errLeer;
    const l = (filas || []).filter((f) => !fxJefas.has(f.empleado)),
      c = await fxCargarContratos(
        Array.from(new Set(l.map((f) => f.empleado))),
      ),
      d = new Set(),
      u = (emp, fecha) => {
        const contratos = c[emp] || [];
        let elegido = null;
        for (const contrato of contratos) {
          if ((contrato.vigente_desde || "0000-00-00") <= fecha) {
            elegido = contrato;
            break;
          }
        }
        if (!elegido && contratos.length)
          elegido = contratos[contratos.length - 1];
        const minutosJornada =
          elegido && typeof ctJornadaDeContrato === "function"
            ? ctJornadaDeContrato(elegido, fecha)
            : null;
        if (minutosJornada === null) {
          d.add(emp);
          return { min: Infinity, contrato: !1 };
        }
        return { min: minutosJornada, contrato: !0 };
      },
      p = fxCalcular(l, r, i, u);
    p.sinContrato = Array.from(d).filter((emp) =>
      p.dias.some((dia) => dia.emp === emp),
    );
    fxUltimoState = {
      res: p,
      desde: r,
      hasta: i,
      emp: o,
      generado: new Date(),
    };
    fxDibujar(p);
    e.style.color = "var(--muted)";
    e.innerText = `Generado ${new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`;
    return !0;
  } catch (err) {
    console.error(err);
    return n("No se pudo generar el registro: " + (err.message || err));
  } finally {
    setBusy(t, !1);
  }
}
function fxCelda(e) {
  e = String(e ?? "");
  return /[";\r\n]/.test(e) ? '"' + e.replace(/"/g, '""') + '"' : e;
}
async function fxExportarCSV() {
  const e = $("fxCsv");
  setBusy(e, !0);
  try {
    if (!(await fxGenerar())) return;
    const e = fxUltimoState;
    if (!e) return toast("Genera el registro antes de exportar", "warn");
    const t = e.res;
    if (!t.dias.length) return toast("No hay fichajes en este periodo", "warn");
    const n = (e) => e.map(fxCelda).join(";"),
      r = [
        n(["REGISTRO DE JORNADA · GEOPADEL"]),
        n(["Periodo", `${fxFecha(e.desde)} a ${fxFecha(e.hasta)}`]),
        n([
          "Criterio",
          "Jornada del día según el contrato de cada trabajador (minutos reales del horario de cada día; libranza = 0). * = sin contrato",
        ]),
        n(["Generado", e.generado.toLocaleString("es-ES")]),
        "",
        n(["DETALLE POR DÍA"]),
        n([
          "Empleado",
          "Fecha",
          "Tramos",
          "Pausas (h:mm)",
          "Jornada del día (h:mm)",
          "Horas trabajadas (h:mm)",
          "Horas trabajadas (decimal)",
          "Ordinarias (h:mm)",
          "Exceso s/ jornada (h:mm)",
          "Incidencias",
        ]),
      ];
    t.dias.forEach((e) =>
      r.push(
        n([
          fxNombre(e.emp),
          fxFecha(e.fecha),
          fxTramosTxt(e),
          fxHM(e.pausa),
          fxHM(e.jorn) + (e.sinContrato ? " *" : ""),
          fxHM(e.total),
          fxDec(e.total),
          fxHM(e.ord),
          fxHM(e.extra),
          e.incid.join(" | "),
        ]),
      ),
    );
    r.push(
      "",
      n(["RESUMEN POR MES"]),
      n([
        "Empleado",
        "Mes",
        "Días trabajados",
        "Horas trabajadas (h:mm)",
        "Horas trabajadas (decimal)",
        "Ordinarias (h:mm)",
        "Exceso s/ jornada (h:mm)",
        "Incidencias",
      ]),
    );
    t.meses.forEach((e) =>
      r.push(
        n([
          fxNombre(e.emp),
          fxMesTxt(e.mes),
          e.dias,
          fxHM(e.total),
          fxDec(e.total),
          fxHM(e.ord),
          fxHM(e.extra),
          e.incid,
        ]),
      ),
    );
    const i = e.emp ? e.emp : "todos";
    descargarBlob(
      new Blob(["﻿" + r.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `geopadel_jornada_${i}_${e.desde}_${e.hasta}.csv`,
    );
    toast("Registro de jornada exportado");
  } finally {
    setBusy(e, !1);
  }
}
function fxHtmlEmpleado(e, t) {
  const n = t.res.dias.filter((t) => t.emp === e),
    r = t.res.meses.filter((t) => t.emp === e),
    i = FX_CAB_DIA.slice(1),
    a = FX_CAB_MES.slice(1),
    o = (e) => e.replace(/<tr><td>.*?<\/td>/, "<tr>");
  return `<section class="fx-page"><div class="fx-head"><img src="./geopadel.webp" alt="Geopadel" width="150" height="150"><div><h1>Registro de jornada</h1><p>${esc(fxNombre(e))} · ${esc(fxFecha(t.desde))} – ${esc(fxFecha(t.hasta))}</p></div><div class="fx-meta">Geopadel<br>Impreso: ${esc(t.generado.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }))}</div></div><h2>Resumen por mes</h2>${fxTabla(a, fxFilasMes(r).map(o), "fx-table", "Sin fichajes")}<h2>Detalle por día</h2>${fxTabla(i, fxFilasDia(n, !1).map(o), "fx-table", "Sin fichajes")}<p class="fx-nota">Horas netas = suma de tramos Entrada→Salida; las pausas no se cuentan. Exceso sobre la jornada del día según el contrato del trabajador (minutos reales del horario de cada día)${t.res.sinContrato.includes(e) ? ` (* sin contrato indicado: no se calcula exceso)` : ""}. Registro diario de jornada (art. 34.9 del Estatuto de los Trabajadores); los registros se conservan 4 años.</p><div class="fx-firmas"><div>Firma del trabajador</div><div>Firma de la empresa</div></div></section>`;
}
async function fxImprimir() {
  const e = $("fxImprimir");
  setBusy(e, !0);
  try {
    if (!(await fxGenerar())) return;
    const e = fxUltimoState;
    if (!e) return;
    const t = Array.from(new Set(e.res.dias.map((e) => e.emp)));
    if (!t.length)
      return toast("No hay fichajes en este periodo para imprimir", "warn");
    const n = $("printArea");
    n.innerHTML = t.map((t) => fxHtmlEmpleado(t, e)).join("");
    await Promise.all(
      Array.from(n.querySelectorAll("img")).map((e) =>
        e.complete
          ? null
          : new Promise((t) => {
              e.onload = e.onerror = t;
            }),
      ),
    );
    window.print();
  } catch (e) {
    console.error(e);
    toast("No se pudo preparar la impresión: " + (e.message || e), "err");
  } finally {
    setBusy(e, !1);
  }
}
function fxAplicarContrato() {
  if (!esJefa() && $("fxDesde").value) fxGenerar();
}
async function entrarFichajes() {
  aplicarPermisosFichajes();
  if (!$("fxDesde").value) {
    const [e, t] = fxRango("mes");
    $("fxDesde").value = e;
    $("fxHasta").value = t;
  }
  if (esPersonal() && !fxEmpleadosListos) await fxCargarEmpleados();
  fxGenerar();
}
$("fxVer").addEventListener("click", fxGenerar);
$("fxCsv").addEventListener("click", fxExportarCSV);
$("fxImprimir").addEventListener("click", fxImprimir);
$("fxAtajos").addEventListener("click", (e) => {
  const t = e.target.closest("button[data-fx]");
  if (!t) return;
  const [n, r] = fxRango(t.dataset.fx);
  $("fxDesde").value = n;
  $("fxHasta").value = r;
  fxGenerar();
});
