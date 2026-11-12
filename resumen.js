/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function entrarResumen() {
  if (!usuarioSesion) return;
  if (!esJefa() && typeof cargarMisFichajes === "function") {
    try {
      await cargarMisFichajes();
    } catch (e) {
      console.error(e);
    }
  }
  dibujarResumen();
  try {
    if (!limpiezas.length) await cargarLimpiezas(false);
  } catch (e) {
    console.error(e);
  }
  dibujarResumen();
  if (typeof cargarHeatmap === "function") {
    cargarHeatmap();
  }
}
function resumenSaludo() {
  const h = ahoraMadrid().h;
  if (h >= 6 && h < 12) return "Buenos días";
  if (h >= 12 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}
function resumenReservasProximas() {
  const e = new Date(),
    t = e.getHours() * 60 + e.getMinutes();
  return (datosLocales.reservas || [])
    .filter((e) => {
      const [n, r] = String(e.horaInicio || "00:00")
        .split(":")
        .map(Number);
      return n * 60 + r + (parseInt(e.duracionMin, 10) || 90) >= t;
    })
    .sort((e, t) => String(e.horaInicio).localeCompare(String(t.horaInicio)));
}
function dibujarResumen() {
  const e = $("resumenContenido");
  if (!e) return;
  const t = usuarioSesion ? usuarioSesion.nombre || usuarioSesion.user : "",
    n = t.split(" ")[0] || t,
    r = datosLocales.caja || {
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalGeneral: 0,
    },
    i = datosLocales.reservas || [],
    a = resumenReservasProximas(),
    s = (typeof deudas !== "undefined" ? deudas : []).filter(
      (e) => e.estado === "Pendiente",
    ),
    l = s.reduce((e, t) => e + (Number(t.importe) || 0), 0),
    c = typeof limpiezasVencidas === "function" ? limpiezasVencidas() : [],
    d = c.reduce((e, t) => e + t.items.length, 0),
    u = fechaBonita(fechaLocalISO(), !0);

  const elTitulo = $("resSaludoTitulo");
  const elSub = $("resSaludoSub");
  if (elTitulo) elTitulo.textContent = `${resumenSaludo()}, ${n}`;
  if (elSub) elSub.textContent = `${u} · Aquí tienes el resumen del día.`;

  let p = "";
  if (d > 0)
    p += `<div class="res-alerta res-alerta-warn"><i class="ri-brush-line" aria-hidden="true"></i><div><b>${d} ${d === 1 ? "limpieza pendiente" : "limpiezas pendientes"}</b><p>Hay pistas sin limpiar en las últimas 2 semanas.</p></div><button type="button" class="btn-add" data-ir="limpieza">Ir a Limpieza</button></div>`;
  if (l > 0)
    p += `<div class="res-alerta"><i class="ri-wallet-3-line" aria-hidden="true"></i><div><b>${eur(l)} en deudas pendientes</b><p>${s.length} ${s.length === 1 ? "cliente" : "clientes"} con pagos pendientes.</p></div><button type="button" class="btn-add" data-ir="deudas">Ir a Deudas</button></div>`;
  let m;
  if (a.length)
    m = a
      .slice(0, 6)
      .map((e) => {
        const t = parseInt(e.duracionMin, 10) || 90,
          n = timeToMin(e.horaInicio),
          r = minToTimeStr(n + t),
          a =
            '<span class="badge-confirmada"><i class="ri-check-line" aria-hidden="true"></i>Confirmada</span>';
        return `<li class="res-agenda-item"><div class="res-agenda-hora"><b>${esc(e.horaInicio)}</b><small>${esc(r)}</small></div><div class="res-agenda-info"><b>${esc(e.pista)}</b><span>${esc(e.cliente)}</span></div><div class="res-agenda-estado">${a}</div></li>`;
      })
      .join("");
  else m = '<li class="res-agenda-vacia">No hay más reservas para hoy.</li>';

  const esT = typeof esTrabajador === "function" && esTrabajador();
  const kpiIngresos = `<div class="res-kpi res-kpi-green"><span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>Ingresos hoy</span><h3>${eur(r.totalGeneral)}</h3><small>${eur(r.totalEfectivo)} efectivo · ${eur(r.totalTarjeta)} tarjeta</small></div>`;

  let kpis;
  if (esT) {
    let kpiFichaje;
    if (ultimoFichaje && ultimoFichaje.created_at) {
      const ff = new Date(ultimoFichaje.created_at);
      const hora = isNaN(ff.getTime())
        ? "—"
        : ff.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          });
      const fechaTxt = isNaN(ff.getTime())
        ? ""
        : ff.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
          });
      kpiFichaje = `<div class="res-kpi res-kpi-amber"><span><i class="ri-time-line" aria-hidden="true"></i>Último fichaje</span><h3>${esc(ultimoFichaje.tipo)} ${esc(hora)}</h3><small>${esc(fechaTxt)}</small></div>`;
    } else {
      kpiFichaje = `<div class="res-kpi res-kpi-amber"><span><i class="ri-time-line" aria-hidden="true"></i>Último fichaje</span><h3>—</h3><small>Sin fichajes registrados</small></div>`;
    }
    kpis = kpiFichaje + kpiIngresos;
  } else {
    kpis = kpiIngresos;
  }

  const btnFicharOCaja = esT
    ? '<button type="button" class="res-accion" data-ir="fichajes"><i class="ri-time-line" aria-hidden="true"></i><span>Fichar</span></button>'
    : '<button type="button" class="res-accion" data-ir="caja"><i class="ri-lock-line" aria-hidden="true"></i><span>Cerrar caja</span></button>';

  e.innerHTML = `<div class="res-kpis">${kpis}<div class="res-kpi res-kpi-red"><span><i class="ri-wallet-3-line" aria-hidden="true"></i>Deudas pendientes</span><h3>${eur(l)}</h3><small>${s.length} ${s.length === 1 ? "cliente" : "clientes"}</small></div><div class="res-kpi res-kpi-amber"><span><i class="ri-brush-line" aria-hidden="true"></i>Limpiezas</span><h3>${c.length}</h3><small>${d === 0 ? "Todo al día" : `${d} ${d === 1 ? "tarea pendiente" : "tareas pendientes"}`}</small></div></div>${p ? `<div class="res-alertas">${p}</div>` : ""}<div class="res-acciones"><h3><i class="ri-flashlight-line" aria-hidden="true"></i>Acciones rápidas</h3><div class="res-acciones-grid"><button type="button" class="res-accion" data-ir="nueva-reserva"><i class="ri-add-line" aria-hidden="true"></i><span>Nueva reserva</span></button><button type="button" class="res-accion" data-ir="tienda"><i class="ri-goblet-line" aria-hidden="true"></i><span>Abrir bar</span></button>${btnFicharOCaja}<a href="guia.html" target="_blank" rel="noopener" class="res-accion"><i class="ri-book-open-line" aria-hidden="true"></i><span>Ver guía</span></a></div></div><div class="res-agenda"><h3><i class="ri-list-ordered" aria-hidden="true"></i>Próximas reservas</h3><ul class="res-agenda-lista">${m}</ul></div>`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-ir]");
  if (!t) return;
  const n = t.dataset.ir;
  if (n === "nueva-reserva") {
    if (typeof abrirModalNuevaReserva === "function") abrirModalNuevaReserva();
    return;
  }
  if (typeof cambiarPestana === "function") cambiarPestana(n);
});
async function recargarResumen() {
  const btn = $("btnRecargarResumen");
  if (!btn || btn.disabled) return;
  const htmlOrig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML =
    '<i class="ri-refresh-line ri-spin" aria-hidden="true"></i>Recargando...';
  try {
    await cargarDatosGlobales();
    await entrarResumen();
    toast("Resumen actualizado", "ok");
  } catch (e) {
    console.error(e);
    toast("No se pudo recargar el resumen", "err");
  } finally {
    const b = $("btnRecargarResumen");
    if (b) {
      b.disabled = false;
      b.innerHTML = htmlOrig;
    }
  }
}

if (typeof window.accion === "function") {
  window.accion("recargar-resumen", recargarResumen);
}
async function cargarHeatmap() {
  const cont = $("heatmapContenido");
  if (!cont) return;

  const dias = parseInt($("hmRango").value, 10) || 90;
  const hasta = fechaLocalISO();
  const desde = fechaLocalISO(new Date(Date.now() - dias * 86400000));

  cont.innerHTML = '<p class="limp-leyenda">Cargando datos...</p>';

  try {
    const { data, error } = await supabaseClient.rpc("gp_heatmap_ocupacion", {
      p_desde: desde,
      p_hasta: hasta,
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error("Error de permisos");

    dibujarHeatmap(data.data);
  } catch (e) {
    console.error(e);
    cont.innerHTML =
      '<p class="limp-leyenda" style="color:var(--red)">No se pudieron cargar los datos.</p>';
  }
}

function dibujarHeatmap(datos) {
  const cont = $("heatmapContenido");
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const horas = [9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 22];

  const mapa = {};
  datos.forEach((d) => {
    mapa[`${d.dia}-${d.hora}`] = d.ocupacion;
  });

  let html = '<table class="hm-table"><thead><tr><th></th>';
  dias.forEach((d) => {
    html += `<th>${d}</th>`;
  });
  html += "</tr></thead><tbody>";

  horas.forEach((h) => {
    html += `<tr><th>${String(h).padStart(2, "0")}:00</th>`;
    for (let i = 0; i < 7; i++) {
      const pgDow = (i + 1) % 7;
      const ocup = mapa[`${pgDow}-${h}`] || 0;

      let color = "var(--surface-3)";
      let txtColor = "var(--muted)";
      if (ocup > 0) {
        const alpha = Math.max(0.15, ocup / 100);
        color = `rgba(74, 120, 174, ${alpha})`;
        txtColor = alpha > 0.5 ? "#fff" : "var(--text)";
      }

      const clase = ocup === 0 ? " hm-empty" : "";
      const bgStyle =
        ocup === 0
          ? "background: transparent; border: 1px dashed var(--border-strong);"
          : `background:${color};`;

      html += `<td><div class="hm-cell${clase}" style="${bgStyle} color:${txtColor}" title="${dias[i]} a las ${h}:00 - Ocupación: ${ocup}%">${ocup > 0 ? ocup + "%" : "—"}</div></td>`;
    }
    html += "</tr>";
  });

  html += "</tbody></table>";
  cont.innerHTML = html;
}
if ($("btnActualizarHeatmap")) {
  $("btnActualizarHeatmap").addEventListener("click", cargarHeatmap);
}
