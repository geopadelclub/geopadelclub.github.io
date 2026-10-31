/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
let reqReservas = 0;
let _pendingPagoUnico = null;
async function cargarReservasHoy() {
  const iso = $("fechaCuadrante").value || fechaLocalISO();
  const miReq = ++reqReservas;
  const [resR, resB] = await Promise.all([
    conReintento(() =>
      supabaseClient
        .from("reservas")
        .select(
          "id, cliente, nombre_entidad, telefono, fecha, hora_inicio, duracion_min, pista, estado, pago_estado, tipo_reserva, jugadores, pagos_jugadores, precio, empleado, serie, notas, origen, tipo_cobro",
        )
        .eq("fecha", iso)
        .or(FILTRO_NO_CANCELADA),
    ),
    conReintento(() =>
      supabaseClient
        .from("bloqueos_pistas")
        .select("id, pista, fecha, hora_inicio, hora_fin, motivo")
        .eq("fecha", iso)
        .order("hora_inicio"),
    ),
  ]);
  if (miReq !== reqReservas) return;
  if (resR.error) {
    console.error(resR.error);
    toast("No se pudieron cargar las reservas", "err");
    return;
  }
  if (resB.error) console.error(resB.error);
  datosLocales.bloqueos = resB.data || [];
  datosLocales.reservas = (resR.data || []).map(mapearReserva);
  renderizarCuadrantePlaytomic(datosLocales.reservas);
  dibujarBloqueos();
}

function actualizarLabelFecha() {
  const input = $("fechaCuadrante");
  const label = $("fechaCuadranteLabel");
  if (!input || !label) return;
  const iso = input.value;
  if (!iso) {
    label.textContent = "";
    return;
  }
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d, 12);
  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const yy = String(y).slice(-2);
  label.textContent = `${dias[fecha.getDay()]}, ${dd}/${mm}/${yy}`;
}
function inicializarFechaHoy() {
  $("fechaCuadrante").value = fechaLocalISO();
  actualizarLabelFecha();
}
function alCambiarFecha() {
  scrollAhoraPendiente = true;
  actualizarLabelFecha();
  cargarReservasHoy();
}
function irAFechaHoy() {
  inicializarFechaHoy();
  alCambiarFecha();
}
function cambiarFechaDias(offset) {
  const inputF = $("fechaCuadrante");
  inputF.value = sumarDiasISO(inputF.value || fechaLocalISO(), offset);
  alCambiarFecha();
}

function pobladorPistasModal(pistasSeleccionadas = []) {
  const container = $("modalPistasContainer");
  container.innerHTML = "";
  listaPistas.forEach((p) => {
    const label = document.createElement("label");
    label.className = "pistas-checkbox-item";
    const isChecked =
      pistasSeleccionadas.length === 0
        ? p === "1 PADEL MASTER"
        : pistasSeleccionadas.includes(p);
    label.innerHTML = `<input type="checkbox" name="chkPistasModal" value="${esc(p)}" ${isChecked ? "checked" : ""}><span>${esc(p)}</span>`;
    container.appendChild(label);
  });
}

function obtenerPistasSeleccionadasModal() {
  return Array.from(
    document.querySelectorAll('input[name="chkPistasModal"]:checked'),
  ).map((c) => c.value);
}

enlazarBuscadorCliente($("modalCliente"), $("modalTelefono"));

function puedeEditarReserva(r) {
  if (!esEntrenador()) return true;
  return (
    r.tipoReserva === "Entrenamiento" &&
    String(r.empleado || "") === String(usuarioSesion.user || "")
  );
}

const DURACIONES_NORMAL = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const DURACIONES_ENTRENO = [60, 120, 180, 240, 300];
function labelDur(d) {
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m === 0 ? `${d} minutos (${h}.0 h)` : `${d} minutos (${h}.5 h)`;
}
function actualizarDuracionesSelect(tipo) {
  const selDur = $("modalDuracion");
  const actual = parseInt(selDur.value, 10);
  const durs =
    tipo === "Entrenamiento" ? DURACIONES_ENTRENO : DURACIONES_NORMAL;
  selDur.innerHTML = durs
    .map((d) => `<option value="${d}">${labelDur(d)}</option>`)
    .join("");
  if (actual && durs.includes(actual)) selDur.value = String(actual);
  else selDur.value = String(durs[0]);
}

function renderizarCuadrantePlaytomic(reservas) {
  const tabReservas = $("tab-reservas");
  if (!tabReservas || !tabReservas.classList.contains("active")) return;
  const grid = $("playtomicGrid");
  if (!grid) return;
  const wrapper = $("gridWrapper");
  const prevScrollTop = wrapper.scrollTop,
    prevScrollLeft = wrapper.scrollLeft;
  const ppm = pxPorMin();
  const isoGrid = $("fechaCuadrante").value || fechaLocalISO();
  let rIni = APERT_MIN,
    rFin = obtenerCierreMin(isoGrid);
  reservas.forEach((r) => {
    const a = timeToMin(r.horaInicio),
      b = a + (parseInt(r.duracionMin, 10) || 90);
    if (a < rIni) rIni = a;
    if (b > rFin) rFin = b;
  });
  (datosLocales.bloqueos || []).forEach((b) => {
    const a = timeToMin(b.hora_inicio);
    if (a < rIni) rIni = a;
    const f = timeToMin(b.hora_fin);
    if (f > rFin) rFin = f;
  });
  horaInicioGrid = Math.floor(rIni / 60);
  horaFinGrid = (Math.ceil(rFin / 30) * 30 - 30) / 60;
  const frag = document.createDocumentFragment();
  const corner = document.createElement("div");
  corner.className = "grid-header-corner";
  corner.textContent = "Hora";
  frag.appendChild(corner);
  listaPistas.forEach((pista) => {
    const hp = document.createElement("div");
    hp.className = "grid-header-pista";
    hp.textContent = pista;
    hp.title = pista;
    frag.appendChild(hp);
  });
  const colTime = document.createElement("div");
  colTime.className = "col-time-axis";
  for (let min = horaInicioGrid * 60; min <= horaFinGrid * 60; min += 30) {
    const el = document.createElement("div");
    const bloqueado = esCerrado(min, isoGrid);
    el.className =
      "time-slot-label" +
      (bloqueado ? " blocked" : min % 60 === 0 ? " hour" : "");
    el.textContent = minToTimeStr(min);
    colTime.appendChild(el);
  }
  const esHoy = isoGrid === fechaLocalISO();
  let topPxAhora = -1;
  if (esHoy) {
    const ah = new Date();
    const minAhora = ah.getHours() * 60 + ah.getMinutes();
    const minGridIni = horaInicioGrid * 60,
      minGridFin = horaFinGrid * 60 + 30;
    if (minAhora >= minGridIni && minAhora <= minGridFin)
      topPxAhora = (minAhora - minGridIni) * ppm;
  }
  frag.appendChild(colTime);
  let totalReservasPista = 0;
  listaPistas.forEach((pista) => {
    const colPista = document.createElement("div");
    colPista.className = "court-column";
    colPista.dataset.pista = pista;
    for (let min = horaInicioGrid * 60; min <= horaFinGrid * 60; min += 30) {
      const slot = document.createElement("div");
      const bloqueado = esCerrado(min, isoGrid);
      slot.className =
        "slot " + (bloqueado ? "blocked" : min % 60 === 0 ? "hour" : "half");
      slot.dataset.min = min;
      slot.dataset.pista = pista;
      colPista.appendChild(slot);
    }
    if (topPxAhora >= 0) {
      const line = document.createElement("div");
      line.className = "court-line-now";
      line.style.top = `${topPxAhora}px`;
      colPista.appendChild(line);
    }
    reservas
      .filter((r) => r.pista === pista)
      .forEach((r) => {
        totalReservasPista++;
        const card = document.createElement("div");
        const iniMin = timeToMin(r.horaInicio);
        const dur = parseInt(r.duracionMin, 10) || 90;
        const topPx = (iniMin - horaInicioGrid * 60) * ppm;
        const heightPx = dur * ppm - 2;
        const nJug = parseInt(r.numJugadores, 10) || 4;
        const arrPagos = String(r.pagosJugadores || "").split(",");
        while (arrPagos.length < nJug) arrPagos.push("0");
        const esPagadoIdx = (i) => {
          const p = arrPagos[i];
          return p === "Efectivo" || p === "Tarjeta";
        };
        let pagados = 0;
        for (let i = 0; i < nJug; i++) if (esPagadoIdx(i)) pagados++;
        const totalPagado = pagados >= nJug;

        let estiloTipo = "card-normal-striped";
        if (r.tipoReserva === "Pena") estiloTipo = "card-pena-striped";
        if (r.tipoReserva === "Torneo") estiloTipo = "card-torneo-striped";
        if (r.tipoReserva === "Entrenamiento") {
          estiloTipo =
            esEntrenador() &&
            String(r.empleado || "") === String(usuarioSesion.user || "")
              ? "card-entreno-propio"
              : "card-entreno-striped";
        }
        const clasePagada = totalPagado ? " pagada" : "";

        const tieneNota = !!String(r.notas || "").trim();
        card.className = `reserva-card ${estiloTipo}${heightPx < 100 ? " compact" : ""}${tieneNota ? " has-nota" : ""}${clasePagada}`;
        card.style.top = `${topPx}px`;
        card.style.height = `${heightPx}px`;
        card.draggable = r.tipoReserva !== "Torneo";
        card.dataset.id = r.id;
        card.dataset.tipo = r.tipoReserva || "Normal";
        card.dataset.estado = r.estado || "";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute(
          "aria-label",
          `Reserva de ${r.cliente}, pista ${pista}, de ${r.horaInicio} a ${minToTimeStr(iniMin + dur)}. ${tieneNota ? "Tiene nota." : ""}`,
        );
        const badge = totalPagado
          ? `<div class="badge-pagado"><i class="ri-check-line" aria-hidden="true"></i>Pagado</div>`
          : pagados > 0
            ? `<div class="badge-parcial">Parcial ${pagados}/${nJug}</div>`
            : `<div class="badge-sin-pagar">Sin pagar</div>`;
        let dots = '<div class="pagos-dots-container">';
        for (let i = 0; i < nJug; i++) {
          const ok = esPagadoIdx(i);
          dots += `<span class="pago-dot ${ok ? "pagado" : "pendiente"}">${ok ? '<i class="ri-check-line" aria-hidden="true"></i>' : '<i class="ri-close-line" aria-hidden="true"></i>'}</span>`;
        }
        dots += "</div>";
        card.innerHTML = `
<div class="resize-handle resize-top" data-resize="top"></div>
<div class="reserva-top">${badge}${dots}</div>
<div class="reserva-title">${r.origen === "web" ? '<i class="ri-global-line" aria-hidden="true" title="Reserva hecha desde la web"></i>' : ""}${r.serie ? '<i class="ri-repeat-line" aria-hidden="true"></i>' : ""}${esc(r.nombreEntidad ? r.nombreEntidad : r.cliente)}</div>
${tieneNota && heightPx >= 150 ? `<div class="reserva-nota-txt">${esc(r.notas)}</div>` : ""}
<div class="reserva-time"><span>${esc(r.horaInicio)} - ${minToTimeStr(iniMin + dur)}</span>${tieneNota ? '<span class="nota-flag"><i class="ri-sticky-note-fill" aria-hidden="true"></i>Nota</span>' : ""}</div>
<div class="resize-handle resize-bottom" data-resize="bottom"></div>`;
        card.title = `${r.cliente} · ${r.horaInicio}-${minToTimeStr(iniMin + dur)}${tieneNota ? "\nNota: " + r.notas : ""}`;
        colPista.appendChild(card);
      });
    (datosLocales.bloqueos || [])
      .filter((b) => b.pista === pista)
      .forEach((b) => {
        const iniMin = timeToMin(b.hora_inicio);
        const finMin = timeToMin(b.hora_fin);
        const dur = finMin - iniMin;
        const topPx = (iniMin - horaInicioGrid * 60) * ppm;
        const heightPx = dur * ppm - 2;
        const card = document.createElement("div");
        card.className =
          "reserva-card card-bloqueo" + (heightPx < 100 ? " compact" : "");
        card.style.top = `${topPx}px`;
        card.style.height = `${heightPx}px`;
        card.dataset.bloqueoId = b.id;
        card.setAttribute(
          "aria-label",
          `Pista ${pista} bloqueada de ${String(b.hora_inicio).slice(0, 5)} a ${String(b.hora_fin).slice(0, 5)}${b.motivo ? ": " + b.motivo : ""}`,
        );
        card.title = b.motivo || "Pista bloqueada";
        card.innerHTML = `
<div class="reserva-top"><div class="badge-bloqueo"><i class="ri-lock-line" aria-hidden="true"></i>Bloqueada</div></div>
<div class="reserva-title">${esc(b.motivo || "No disponible")}</div>
<div class="reserva-time"><span>${esc(String(b.hora_inicio).slice(0, 5))} - ${esc(String(b.hora_fin).slice(0, 5))}</span></div>`;
        colPista.appendChild(card);
      });
    frag.appendChild(colPista);
  });
  grid.innerHTML = "";
  grid.appendChild(frag);
  const cierreGrid = obtenerCierreMin(isoGrid);
  const ventanas = [
    [9 * 60, 14 * 60],
    [17 * 60, cierreGrid],
  ];
  const minDisp =
    listaPistas.length *
    ventanas.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);
  let minOcup = 0;
  reservas.forEach((r) => {
    const a = timeToMin(r.horaInicio),
      b = a + (parseInt(r.duracionMin, 10) || 90);
    ventanas.forEach(([v1, v2]) => {
      minOcup += Math.max(0, Math.min(b, v2) - Math.max(a, v1));
    });
  });
  $("statOcupacion").innerText =
    `${Math.min(100, Math.round((minOcup / minDisp) * 100)) || 0}%`;
  $("statNumReservas").innerText = totalReservasPista;
  if (scrollAhoraPendiente && wrapper.clientHeight > 0) {
    scrollAhoraPendiente = false;
    if (topPxAhora >= 0) wrapper.scrollTop = Math.max(0, topPxAhora - 90);
    else wrapper.scrollTop = Math.max(0, (9 * 60 - horaInicioGrid * 60) * ppm);
    wrapper.scrollLeft = 0;
  } else {
    wrapper.scrollTop = prevScrollTop;
    wrapper.scrollLeft = prevScrollLeft;
  }
}

setInterval(() => {
  if (document.hidden || !usuarioSesion) return;
  if ($("fechaCuadrante").value !== fechaLocalISO()) return;
  const lines = document.querySelectorAll(".court-line-now");
  if (!lines.length) return;
  const ppm = pxPorMin();
  const minAhora = new Date().getHours() * 60 + new Date().getMinutes();
  const top = (minAhora - horaInicioGrid * 60) * ppm;
  lines.forEach((l) => {
    l.style.top = `${top}px`;
  });
}, 60000);

window.addEventListener(
  "resize",
  debounce(() => {
    if (usuarioSesion)
      renderizarCuadrantePlaytomic(datosLocales.reservas || []);
  }, 200),
);

(function iniciarInteraccionGrid() {
  const grid = $("playtomicGrid");
  grid.addEventListener("click", (e) => {
    if (suprimirClick) return;
    const card = e.target.closest(".reserva-card");
    if (card) {
      if (card.classList.contains("card-bloqueo")) return;
      const r = (datosLocales.reservas || []).find(
        (x) => String(x.id) === card.dataset.id,
      );
      if (r) {
        if (!puedeEditarReserva(r)) {
          toast("Solo puedes gestionar tus propios entrenamientos", "warn");
          return;
        }
        abrirModalEditarReserva(r);
      }
      return;
    }
    const slot = e.target.closest(".slot");
    if (slot) {
      const min = parseInt(slot.dataset.min, 10);
      abrirModalNuevaReserva(
        [slot.dataset.pista],
        minToTimeStr(min),
        esCerrado(min) ? "Torneo" : "Normal",
      );
    }
  });
  grid.addEventListener("keydown", (e) => {
    const card = e.target.closest(".reserva-card");
    if (!card || card.classList.contains("card-bloqueo")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const r = (datosLocales.reservas || []).find(
        (x) => String(x.id) === card.dataset.id,
      );
      if (r && puedeEditarReserva(r)) abrirModalEditarReserva(r);
    }
  });
  grid.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".reserva-card")) e.preventDefault();
  });
  grid.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".reserva-card");
    if (!card || card.classList.contains("card-bloqueo")) return;
    dragGrabOffsetY = e.clientY - card.getBoundingClientRect().top;
    e.dataTransfer.setData("text/plain", card.dataset.id);
    e.dataTransfer.effectAllowed = "move";
  });
  grid.addEventListener("dragover", (e) => {
    if (e.target.closest(".court-column")) e.preventDefault();
  });
  grid.addEventListener("drop", (e) => {
    const col = e.target.closest(".court-column");
    if (!col) return;
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const topEnCol =
      e.clientY - col.getBoundingClientRect().top - dragGrabOffsetY;
    moverReservaAccion(
      id,
      minToTimeStr(horaDesdeTop(topEnCol)),
      col.dataset.pista,
    );
  });
  let tdrag = null;
  grid.addEventListener(
    "touchstart",
    (e) => {
      const card = e.target.closest(".reserva-card");
      if (
        !card ||
        card.dataset.tipo === "Torneo" ||
        card.classList.contains("card-bloqueo") ||
        e.touches.length !== 1
      )
        return;
      const t = e.touches[0];
      tdrag = {
        card,
        id: card.dataset.id,
        x0: t.clientX,
        y0: t.clientY,
        activo: false,
        rect: null,
      };
      tdrag.timer = setTimeout(() => {
        if (!tdrag) return;
        tdrag.activo = true;
        tdrag.rect = card.getBoundingClientRect();
        card.classList.add("dragging-touch");
        if (navigator.vibrate) navigator.vibrate(12);
      }, 380);
    },
    { passive: true },
  );
  grid.addEventListener(
    "touchmove",
    (e) => {
      if (!tdrag) return;
      const t = e.touches[0];
      if (!tdrag.activo) {
        if (Math.hypot(t.clientX - tdrag.x0, t.clientY - tdrag.y0) > 8) {
          clearTimeout(tdrag.timer);
          tdrag = null;
        }
        return;
      }
      e.preventDefault();
      tdrag.card.style.transform = `translate(${t.clientX - tdrag.x0}px, ${t.clientY - tdrag.y0}px) scale(1.03)`;
    },
    { passive: false },
  );
  function finTouch(e) {
    if (!tdrag) return;
    clearTimeout(tdrag.timer);
    const d = tdrag;
    tdrag = null;
    if (!d.activo) return;
    d.card.classList.remove("dragging-touch");
    d.card.style.transform = "";
    suprimirClick = true;
    setTimeout(() => {
      suprimirClick = false;
    }, 400);
    if (e.type === "touchcancel") return;
    const t = e.changedTouches[0];
    const col = Array.from(grid.querySelectorAll(".court-column")).find((c) => {
      const r = c.getBoundingClientRect();
      return t.clientX >= r.left && t.clientX <= r.right;
    });
    if (!col) return;
    const nuevoTop =
      d.rect.top + (t.clientY - d.y0) - col.getBoundingClientRect().top;
    moverReservaAccion(
      d.id,
      minToTimeStr(horaDesdeTop(nuevoTop)),
      col.dataset.pista,
    );
  }
  grid.addEventListener("touchend", finTouch);
  grid.addEventListener("touchcancel", finTouch);
})();

(function iniciarResizeReservas() {
  const wrapper = $("gridWrapper");
  if (!wrapper) return;

  let resize = null;

  function onDown(ev) {
    if (suprimirClick) return;
    const handle = ev.target.closest(".resize-handle");
    if (!handle) return;
    const card = handle.closest(".reserva-card");
    if (!card || card.classList.contains("card-bloqueo")) return;
    const r = (datosLocales.reservas || []).find(
      (x) => String(x.id) === card.dataset.id,
    );
    if (!r) return;
    if (!puedeEditarReserva(r)) {
      toast("Solo puedes ajustar tus propios entrenamientos", "warn");
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const col = card.closest(".court-column");
    const colTop = col.getBoundingClientRect().top;
    const iniOriginal = timeToMin(r.horaInicio);
    const durOriginal = parseInt(r.duracionMin, 10) || 90;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const wasDraggable = card.draggable;
    card.draggable = false;
    resize = {
      card,
      tipo: handle.dataset.resize,
      id: r.id,
      fecha: r.fecha,
      pista: r.pista,
      iniOriginal,
      durOriginal,
      startY: clientY,
      wasDraggable,
      preview: { ini: iniOriginal, dur: durOriginal },
    };
    card.classList.add("resizing");
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
  }

  function onMove(ev) {
    if (!resize) return;
    ev.preventDefault();
    const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const ppm = pxPorMin();
    const deltaMin = Math.round((y - resize.startY) / ppm / 30) * 30;
    const { iniOriginal, durOriginal, tipo } = resize;
    if (tipo === "top") {
      const ini = Math.max(
        horaInicioGrid * 60,
        Math.min(iniOriginal + deltaMin, iniOriginal + durOriginal - 60),
      );
      const dur = durOriginal + (iniOriginal - ini);
      resize.preview = { ini, dur };
    } else {
      const dur = Math.max(
        60,
        Math.min(durOriginal + deltaMin, horaFinGrid * 60 + 30 - iniOriginal),
      );
      resize.preview = { ini: iniOriginal, dur };
    }
    resize.card.style.top = `${(resize.preview.ini - horaInicioGrid * 60) * ppm}px`;
    resize.card.style.height = `${resize.preview.dur * ppm - 2}px`;
  }

  async function onUp() {
    if (!resize) return;
    const r = resize;
    resize = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
    document.removeEventListener("touchcancel", onUp);
    document.body.style.cursor = "";
    r.card.classList.remove("resizing");
    r.card.draggable = r.wasDraggable;

    if (r.preview.ini === r.iniOriginal && r.preview.dur === r.durOriginal) {
      renderizarCuadrantePlaytomic(datosLocales.reservas);
      return;
    }

    const nuevaHora = minToTimeStr(r.preview.ini);
    const nuevaDur = r.preview.dur;
    const cierre = obtenerCierreMin(r.fecha);
    if (r.preview.ini + nuevaDur > cierre) {
      toast("Excede el cierre del día", "err");
      renderizarCuadrantePlaytomic(datosLocales.reservas);
      return;
    }
    const solapa = (datosLocales.reservas || []).find((x) => {
      if (String(x.id) === String(r.id)) return false;
      if (x.pista !== r.pista || x.fecha !== r.fecha) return false;
      if (x.estado === "Cancelada") return false;
      const a = timeToMin(x.horaInicio);
      const b = a + (parseInt(x.duracionMin, 10) || 90);
      return r.preview.ini < b && r.preview.ini + nuevaDur > a;
    });
    if (solapa) {
      toast(`Solapa con ${solapa.cliente} (${solapa.horaInicio})`, "err");
      renderizarCuadrantePlaytomic(datosLocales.reservas);
      return;
    }
    const bloqueo = (datosLocales.bloqueos || []).find((b) => {
      if (b.pista !== r.pista || b.fecha !== r.fecha) return false;
      const a = timeToMin(b.hora_inicio);
      const bF = timeToMin(b.hora_fin);
      return r.preview.ini < bF && r.preview.ini + nuevaDur > a;
    });
    if (bloqueo) {
      toast("La pista está bloqueada en ese tramo", "err");
      renderizarCuadrantePlaytomic(datosLocales.reservas);
      return;
    }

    const res = (datosLocales.reservas || []).find(
      (x) => String(x.id) === String(r.id),
    );
    const pagos = String(res?.pagosJugadores || "").split(",");
    const hayCobros = pagos.some((p) => p === "Efectivo" || p === "Tarjeta");
    if (hayCobros) {
      toast("Quita los pagos antes de cambiar la duración", "warn");
      renderizarCuadrantePlaytomic(datosLocales.reservas);
      return;
    }

    const nuevoPrecio = precioParaFechaHora(
      r.fecha,
      nuevaHora,
      nuevaDur,
      res?.tipoReserva,
    );
    const upd = { hora_inicio: nuevaHora, duracion_min: nuevaDur };
    if (nuevoPrecio != null) upd.precio = nuevoPrecio;

    suprimirClick = true;
    setTimeout(() => {
      suprimirClick = false;
    }, 400);

    try {
      const { error } = await supabaseClient
        .from("reservas")
        .update(upd)
        .eq("id", r.id);
      if (error) throw error;
      if (res) {
        res.horaInicio = nuevaHora;
        res.duracionMin = nuevaDur;
        if (nuevoPrecio != null) res.precio = nuevoPrecio;
      }
      const extra = nuevoPrecio != null ? ` · ${eur(nuevoPrecio)}` : "";
      toast(`Ajustada: ${nuevaHora} · ${nuevaDur} min${extra}`);
    } catch (err) {
      console.error(err);
      toast("No se pudo ajustar: " + (err.message || err), "err");
    } finally {
      renderizarCuadrantePlaytomic(datosLocales.reservas);
    }
  }

  wrapper.addEventListener("mousedown", onDown);
  wrapper.addEventListener("touchstart", onDown, { passive: false });
})();

function horaDesdeTop(topPx) {
  const ppm = pxPorMin();
  let m = horaInicioGrid * 60 + Math.round(topPx / ppm / 30) * 30;
  return Math.max(horaInicioGrid * 60, Math.min(horaFinGrid * 60, m));
}

async function buscarConflicto({ pistas, fechas, iniMin, dur, excluirId }) {
  const orden = [...fechas].sort();
  const { data, error } = await leerTodo(() =>
    supabaseClient
      .from("reservas")
      .select("id, pista, fecha, hora_inicio, duracion_min, cliente")
      .in("pista", pistas)
      .gte("fecha", orden[0])
      .lte("fecha", orden[orden.length - 1])
      .or(FILTRO_NO_CANCELADA)
      .order("id"),
  );
  if (error) throw error;
  const set = new Set(fechas),
    fin = iniMin + dur;
  return (
    (data || []).find((r) => {
      if (excluirId && String(r.id) === String(excluirId)) return false;
      if (!set.has(r.fecha)) return false;
      const a = timeToMin(r.hora_inicio),
        b = a + (parseInt(r.duracion_min, 10) || 90);
      return iniMin < b && fin > a;
    }) || null
  );
}
function precioParaFechaHora(fecha, hora, dur, tipoReserva = "Normal") {
  const t = { ...TARIFAS_DEFECTO, ...(datosLocales.tarifas || {}) };
  if (tipoReserva === "Entrenamiento") {
    const horaRate = (t.entrenamiento && t.entrenamiento[60]) || 10;
    return redondear2((dur / 60) * horaRate);
  }
  const esFestivo = (datosLocales.festivos || []).includes(fecha);
  const franja =
    esFinde(fecha) || esFestivo
      ? t.finde
      : timeToMin(hora) < bloqueDescansoInicio
        ? t.semanaManana
        : t.semanaTarde;
  if (!franja) return null;
  const exacto = franja[dur];
  if (exacto !== null && exacto !== undefined) return exacto;
  if (franja[90] != null) return redondear2((dur / 90) * franja[90]);
  return null;
}

async function moverReservaAccion(idRes, nuevaHora, nuevaPista) {
  const t = (datosLocales.reservas || []).find(
    (r) => String(r.id) === String(idRes),
  );
  if (!t) return;
  if (!puedeEditarReserva(t)) {
    toast("Solo puedes mover tus propios entrenamientos", "warn");
    return;
  }
  if (nuevaHora === t.horaInicio && nuevaPista === t.pista) return;
  const dur = parseInt(t.duracionMin, 10) || 90;
  const ini = timeToMin(nuevaHora);
  if (esFranjaBloqueada(ini, ini + dur, t.tipoReserva, t.fecha))
    return toast("Horario no permitido para este tipo de reserva", "err");
  const iniMin = ini,
    finMin = ini + dur;
  const conflictoLocal = (datosLocales.reservas || []).find((r) => {
    if (String(r.id) === String(idRes)) return false;
    if (r.pista !== nuevaPista || r.fecha !== t.fecha) return false;
    if (r.estado === "Cancelada") return false;
    const a = timeToMin(r.horaInicio),
      b = a + (parseInt(r.duracionMin, 10) || 90);
    return iniMin < b && finMin > a;
  });
  if (conflictoLocal)
    return toast(
      `No se puede mover: ${nuevaPista} está ocupada a las ${conflictoLocal.horaInicio} (${conflictoLocal.cliente})`,
      "err",
    );
  const conflictoBloqueo = (datosLocales.bloqueos || []).find((b) => {
    if (b.pista !== nuevaPista || b.fecha !== t.fecha) return false;
    const a = timeToMin(b.hora_inicio),
      bF = timeToMin(b.hora_fin);
    return iniMin < bF && finMin > a;
  });
  if (conflictoBloqueo)
    return toast(
      `No se puede mover: ${nuevaPista} está bloqueada a las ${String(conflictoBloqueo.hora_inicio).slice(0, 5)} (${conflictoBloqueo.motivo || "sin motivo"})`,
      "err",
    );

  if (t.serie) {
    const ok = await customConfirm(
      "Esta reserva forma parte de una serie (peña). Si la mueves, solo cambias esta semana; las demás siguen como estaban. ¿Continuar?",
    );
    if (!ok) return;
  }

  const tieneCobros = String(t.pagosJugadores || "")
    .split(",")
    .some((p) => p === "Efectivo" || p === "Tarjeta");
  const nuevoPrecio = tieneCobros
    ? null
    : precioParaFechaHora(t.fecha, nuevaHora, dur, t.tipoReserva);
  const upd = { hora_inicio: nuevaHora, pista: nuevaPista };
  if (
    nuevoPrecio != null &&
    Math.abs(nuevoPrecio - (Number(t.precio) || 0)) > 0.004
  )
    upd.precio = nuevoPrecio;

  try {
    const { error } = await supabaseClient
      .from("reservas")
      .update(upd)
      .eq("id", t.id);
    if (error) throw error;
    t.horaInicio = nuevaHora;
    t.pista = nuevaPista;
    if (upd.precio != null) t.precio = upd.precio;
    const extra = upd.precio != null ? ` · ${eur(upd.precio)}` : "";
    toast(`Reserva movida a ${nuevaPista} · ${nuevaHora}${extra}`);
    renderizarCuadrantePlaytomic(datosLocales.reservas);
  } catch (err) {
    console.error(err);
    if (err && err.code === "23P01") {
      toast(
        `No se puede mover: ${nuevaPista} ya está ocupada en ese horario`,
        "err",
      );
      cargarReservasHoy();
      return;
    }
    if (err && err.code === "23P02") {
      toast("La pista está bloqueada en ese horario", "err");
      cargarReservasHoy();
      return;
    }
    toast("Error al mover la reserva: " + (err.message || err), "err");
  }
}

function precioSugerido() {
  const t = { ...TARIFAS_DEFECTO, ...(datosLocales.tarifas || {}) };
  const tipoReserva = $("modalTipoReserva").value;
  const iso =
    $("modalFecha").value || $("fechaCuadrante").value || fechaLocalISO();
  const hora = $("modalHora").value || "17:00";
  if (tipoReserva === "Entrenamiento") {
    const dur = parseInt($("modalDuracion").value, 10) || 60;
    const horaRate = (t.entrenamiento && t.entrenamiento[60]) || 10;
    return redondear2((dur / 60) * horaRate);
  }
  const esFestivo = (datosLocales.festivos || []).includes(iso);
  const franja =
    esFinde(iso) || esFestivo
      ? t.finde
      : timeToMin(hora) < bloqueDescansoInicio
        ? t.semanaManana
        : t.semanaTarde;
  const tor = tipoReserva === "Torneo";
  const dur = tor
    ? (parseFloat($("modalDuracionHoras").value) || 0) * 60
    : parseInt($("modalDuracion").value, 10) || 90;
  const exacto = franja[dur];
  return exacto !== null && exacto !== undefined
    ? exacto
    : (dur / 90) * franja[90];
}

function recalcularPrecioSugerido(forzar = true) {
  if (!forzar && $("modalReservaId").value) return;
  $("modalPrecio").value = precioSugerido().toFixed(2);
  actualizarVistasJugadoresSplit();
}

function alCambiarTipo() {
  const selTipo = $("modalTipoReserva");
  if (esEntrenador()) {
    selTipo.value = "Entrenamiento";
    selTipo.disabled = true;
  }
  const t = $("modalTipoReserva").value,
    nueva = !$("modalReservaId").value,
    tor = t === "Torneo";
  $("boxTorneoDur").style.display = tor ? "block" : "none";
  const dispDur = tor ? "none" : "block";
  $("lblDur").style.display = dispDur;
  $("modalDuracion").style.display = dispDur;
  actualizarDuracionesSelect(t);
  $("boxRepetir").style.display = t === "Pena" && nueva ? "block" : "none";
  recalcularPrecioSugerido(nueva);
}

(function () {
  const sel = $("modalNumJugadores");
  for (let i = 1; i <= 16; i++)
    sel.appendChild(new Option(i === 1 ? "1 jugador" : `${i} jugadores`, i));
  sel.value = "4";
})();

function alCambiarTipoPago() {
  const radioSel = document.querySelector(
    'input[name="modalTipoPago"]:checked',
  );
  const tipo = radioSel ? radioSel.value : "unico";
  if (tipo === "unico") {
    $("boxPagoUnico").style.display = "block";
    $("boxCobroDividido").style.display = "none";
  } else {
    $("boxPagoUnico").style.display = "none";
    $("boxCobroDividido").style.display = "block";
    actualizarVistasJugadoresSplit();
  }
}

async function procesarPagoUnico(metodo) {
  if (!reservaEnEdicion) return;
  const nJug = parseInt($("modalNumJugadores").value, 10) || 4;

  if (!reservaEnEdicion.id) {
    if (metodo === "0") {
      _pendingPagoUnico = null;
      $("msgPagoUnico").innerText = "";
      $("btnUnicoEfectivo").classList.remove("active");
      $("btnUnicoTarjeta").classList.remove("active");
      $("btnUnicoReset").style.display = "none";
      return;
    }
    _pendingPagoUnico = metodo;
    $("msgPagoUnico").style.color = "var(--green)";
    $("msgPagoUnico").innerText = `Se cobrará en ${metodo} al guardar`;
    $("btnUnicoEfectivo").classList.toggle("active", metodo === "Efectivo");
    $("btnUnicoTarjeta").classList.toggle("active", metodo === "Tarjeta");
    $("btnUnicoReset").style.display = "inline-block";
    return;
  }

  const btnEf = $("btnUnicoEfectivo");
  const btnTa = $("btnUnicoTarjeta");
  const btnRe = $("btnUnicoReset");
  btnEf.disabled = true;
  btnTa.disabled = true;
  btnRe.disabled = true;
  $("msgPagoUnico").style.color = "var(--muted)";
  $("msgPagoUnico").innerText =
    metodo === "0" ? "Quitando pago..." : "Procesando pago...";

  try {
    const { data, error } = await supabaseClient.rpc(
      "cobrar_reserva_completa",
      {
        p_reserva_id: reservaEnEdicion.id,
        p_metodo: metodo,
        p_empleado: nombreUsuario(),
      },
    );
    if (error) throw error;
    if (data && data.success === false)
      throw new Error(data.message || "Error al procesar");

    if (data) {
      reservaEnEdicion.pagosJugadores = data.pagos;
      reservaEnEdicion.pagoEstado = data.pago_estado;
    }

    if (metodo === "0") {
      $("msgPagoUnico").style.color = "var(--muted)";
      $("msgPagoUnico").innerText =
        "Pago eliminado. Reserva pendiente de cobro.";
      btnEf.classList.remove("active");
      btnTa.classList.remove("active");
      btnRe.style.display = "none";
      document
        .querySelectorAll('input[name="modalTipoPago"]')
        .forEach((r) => (r.disabled = false));
    } else {
      $("msgPagoUnico").style.color = "var(--green)";
      $("msgPagoUnico").innerText =
        `✔ Cobrado ${eur(reservaEnEdicion.precio)} (${metodo})`;
      btnEf.classList.toggle("active", metodo === "Efectivo");
      btnTa.classList.toggle("active", metodo === "Tarjeta");
      btnRe.style.display = "inline-block";
    }
    actualizarVistasJugadoresSplit();
  } catch (e) {
    console.error(e);
    $("msgPagoUnico").style.color = "var(--red)";
    $("msgPagoUnico").innerText = "Error: " + (e.message || e);
  } finally {
    btnEf.disabled = false;
    btnTa.disabled = false;
    btnRe.disabled = false;
  }
}

document.querySelectorAll('input[name="modalTipoPago"]').forEach((r) => {
  r.addEventListener("change", alCambiarTipoPago);
});
$("btnUnicoEfectivo").addEventListener("click", () =>
  procesarPagoUnico("Efectivo"),
);
$("btnUnicoTarjeta").addEventListener("click", () =>
  procesarPagoUnico("Tarjeta"),
);
$("btnUnicoReset").addEventListener("click", () => procesarPagoUnico("0"));

function abrirModalNuevaReserva(
  pistas = ["1 PADEL MASTER"],
  hora = "17:00",
  tipo = "Normal",
) {
  cargarModalReserva();
  if (esEntrenador()) {
    tipo = "Entrenamiento";
    pistas = [pistas[0] || "1 PADEL MASTER"];
  }
  if (!Array.isArray(pistas)) pistas = ["1 PADEL MASTER"];
  if (typeof hora !== "string") hora = "17:00";
  if (typeof tipo !== "string") tipo = "Normal";
  reservaEnEdicion = {
    id: "",
    numJugadores: 4,
    pagosJugadores: "0,0,0,0",
    numJugadoresOrig: 4,
    notas: "",
  };
  _pendingPagoUnico = null;
  $("modalTitulo").innerText = "Nueva reserva";
  $("modalReservaId").value = "";
  $("modalCliente").value = "";
  $("modalCliente").dataset.tipo = "Particular";
  $("modalTelefono").value = "";
  $("modalNotas").value = "";
  pobladorPistasModal(pistas);
  $("modalHora").value = hora;
  $("modalDuracion").value = "90";
  $("modalDuracionHoras").value = "8";
  $("modalTipoReserva").value = tipo;
  $("modalFecha").value = $("fechaCuadrante").value || fechaLocalISO();
  $("modalRepetir").value = 12;
  $("btnEliminarSerie").style.display = "none";
  $("btnEliminarReserva").style.display = "none";
  $("btnHistorialReserva").style.display = "none";
  const btnJ = $("btnJustificanteReserva");
  if (btnJ) btnJ.style.display = "none";
  $("modalNumJugadores").value = "4";

  document.querySelector('input[name="modalTipoPago"][value="unico"]').checked =
    true;
  $("msgPagoUnico").innerText = "";
  $("btnUnicoEfectivo").classList.remove("active");
  $("btnUnicoTarjeta").classList.remove("active");
  document
    .querySelectorAll('input[name="modalTipoPago"]')
    .forEach((r) => (r.disabled = false));
  alCambiarTipoPago();

  alCambiarTipo();
  $("modalPrecio").value = precioSugerido().toFixed(2);
  actualizarVistasJugadoresSplit();
  abrirOverlay("modalReserva");
  setTimeout(() => $("modalCliente").focus(), 60);
}

function abrirModalEditarReserva(res) {
  cargarModalReserva();
  if (!puedeEditarReserva(res)) {
    toast("No puedes editar esta reserva", "warn");
    return;
  }
  reservaEnEdicion = { ...res };
  const nJug = parseInt(res.numJugadores, 10) || 4;
  reservaEnEdicion.numJugadoresOrig = nJug;
  if (!reservaEnEdicion.pagosJugadores)
    reservaEnEdicion.pagosJugadores = Array(nJug).fill("0").join(",");
  $("modalTitulo").innerText = `${res.pista} · ${res.horaInicio}`;
  $("modalReservaId").value = res.id;
  $("modalCliente").value = res.cliente;
  $("modalCliente").dataset.tipo =
    res.tipoReserva === "Pena" ? "Peña" : "Particular";
  $("modalTelefono").value = res.telefono || "";
  $("modalNotas").value = res.notas || "";
  pobladorPistasModal([res.pista]);
  $("modalHora").value = res.horaInicio;
  const durStr = String(res.duracionMin);
  if (!Array.from($("modalDuracion").options).some((o) => o.value === durStr))
    $("modalDuracion").appendChild(new Option(`${durStr} minutos`, durStr));
  $("modalDuracion").value = durStr;
  $("modalDuracionHoras").value = res.duracionMin / 60;
  $("modalTipoReserva").value = res.tipoReserva || "Normal";
  $("modalFecha").value = res.fecha;
  $("btnEliminarSerie").style.display = res.serie ? "inline-block" : "none";
  $("btnEliminarReserva").style.display = "inline-block";
  $("btnHistorialReserva").style.display = "inline-block";
  alCambiarTipo();
  $("modalNumJugadores").value = String(nJug);
  $("modalPrecio").value = parseFloat(res.precio || 0).toFixed(2);

  const pagosArr = String(res.pagosJugadores || "").split(",");
  const pagados = pagosArr.slice(0, nJug);
  const totalPagados = pagados.filter(
    (p) => p === "Efectivo" || p === "Tarjeta",
  ).length;
  const todosMismo =
    totalPagados === nJug && pagados.every((p) => p === pagados[0]);
  const hayAlgunPago = totalPagados > 0;
  const radios = document.querySelectorAll('input[name="modalTipoPago"]');

  if (hayAlgunPago) {
    radios.forEach((r) => (r.disabled = true));
    if (todosMismo) {
      radios[0].checked = true;
      $("msgPagoUnico").innerText = `✔ Pagado en ${pagados[0]}`;
      $("msgPagoUnico").style.color = "var(--green)";
      $(
        pagados[0] === "Efectivo" ? "btnUnicoEfectivo" : "btnUnicoTarjeta",
      ).classList.add("active");
      $("btnUnicoReset").style.display = "inline-block";
    } else {
      radios[1].checked = true;
      $("msgPagoUnico").innerText = "";
      $("btnUnicoReset").style.display = "none";
    }
  } else {
    radios.forEach((r) => (r.disabled = false));
    const tipoGuardado = res.tipoCobro || "unico";
    if (tipoGuardado === "dividido") {
      radios[1].checked = true;
    } else {
      radios[0].checked = true;
    }
    $("msgPagoUnico").innerText = "";
    $("btnUnicoEfectivo").classList.remove("active");
    $("btnUnicoTarjeta").classList.remove("active");
    $("btnUnicoReset").style.display = "none";
  }
  alCambiarTipoPago();
  const ocultar = esEntrenador();
  $("btnEliminarSerie").style.display = ocultar
    ? "none"
    : res.serie
      ? "inline-block"
      : "none";
  $("btnHistorialReserva").style.display = ocultar ? "none" : "inline-block";

  actualizarVistasJugadoresSplit();
  abrirOverlay("modalReserva");
}

function actualizarVistasJugadoresSplit() {
  if (!reservaEnEdicion) return;
  const nJug = parseInt($("modalNumJugadores").value, 10) || 4;
  reservaEnEdicion.numJugadores = nJug;
  const precioTotal = parseFloat($("modalPrecio").value) || 0;
  const precioUnitario = nJug ? precioTotal / nJug : 0;
  $("badgePrecioUnitario").innerText = `${eur(precioUnitario)} / pers`;
  const arrPagos = String(reservaEnEdicion.pagosJugadores || "").split(",");
  while (arrPagos.length < nJug) arrPagos.push("0");
  reservaEnEdicion.pagosJugadores = arrPagos.slice(0, nJug).join(",");
  const container = $("splitJugadoresContainer");
  container.innerHTML = "";
  let pagados = 0;
  const sinId = !reservaEnEdicion.id;
  for (let j = 1; j <= nJug; j++) {
    const metodo = arrPagos[j - 1] || "0";
    const pagado = metodo === "Efectivo" || metodo === "Tarjeta";
    if (pagado) pagados++;
    const cardJ = document.createElement("div");
    cardJ.className = `card-jugador-item ${metodo === "Efectivo" ? "estado-efectivo" : metodo === "Tarjeta" ? "estado-tarjeta" : ""}`;
    const dis = sinId ? "disabled" : "";
    cardJ.innerHTML = `
<div>
<div class="jugador-info-title">Jugador ${j}</div>
<div class="jugador-info-sub">${pagado ? `<i class="ri-check-line" aria-hidden="true"></i>Pagado (${metodo})` : '<i class="ri-time-line" aria-hidden="true"></i>Pendiente'} · ${eur(precioUnitario)}</div>
</div>
<div class="jugador-actions">
<button type="button" ${dis} data-j="${j}" data-m="Efectivo" class="btn-pay-toggle btn-pay-efectivo" aria-label="Pagar en efectivo"><i class="ri-money-euro-circle-line" aria-hidden="true"></i></button>
<button type="button" ${dis} data-j="${j}" data-m="Tarjeta" class="btn-pay-toggle btn-pay-tarjeta" aria-label="Pagar con tarjeta"><i class="ri-bank-card-line" aria-hidden="true"></i></button>
${pagado ? `<button type="button" ${dis} data-j="${j}" data-m="0" class="btn-pay-toggle btn-pay-reset" aria-label="Quitar pago"><i class="ri-close-line" aria-hidden="true"></i></button>` : ""}
</div>`;
    container.appendChild(cardJ);
  }
  if (sinId) {
    const nota = document.createElement("div");
    nota.style.cssText =
      "font-size:12px;color:var(--muted);font-weight:700;text-align:center;padding:6px";
    nota.textContent = "Guarda la reserva para poder registrar los cobros.";
    container.appendChild(nota);
  }
  const badge = $("badgeEstadoPagoGlobal");
  if (pagados >= nJug) {
    badge.className = "badge-pagado";
    badge.innerHTML =
      '<i class="ri-checkbox-circle-line" aria-hidden="true"></i>Totalmente pagado';
  } else if (pagados > 0) {
    badge.className = "badge-parcial";
    badge.innerText = `Pendiente (${pagados}/${nJug} pagados)`;
  } else {
    badge.className = "badge-sin-pagar";
    badge.innerHTML = `<i class="ri-error-warning-line" aria-hidden="true"></i>Sin pagar (0/${nJug})`;
  }
  const btnJ = $("btnJustificanteReserva");
  if (btnJ)
    btnJ.style.display =
      !esEntrenador() &&
      pagados >= nJug &&
      reservaEnEdicion &&
      reservaEnEdicion.id
        ? "inline-block"
        : "none";
}

$("splitJugadoresContainer").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-j]");
  if (b && !b.disabled)
    cambiarPagoJugador(parseInt(b.dataset.j, 10), b.dataset.m, b);
});

async function cambiarPagoJugador(numJugador, nuevoMetodo, btn) {
  if (!reservaEnEdicion || !reservaEnEdicion.id) return;
  document
    .querySelectorAll("#splitJugadoresContainer button")
    .forEach((x) => (x.disabled = true));
  try {
    const { data, error } = await supabaseClient.rpc("cobrar_jugador_atomic", {
      p_reserva_id: reservaEnEdicion.id,
      p_num_jugador: numJugador,
      p_metodo_pago: nuevoMetodo,
      p_empleado: nombreUsuario(),
    });
    if (error) toast("Error al registrar el pago: " + error.message, "err");
    else if (data && data.success === false)
      toast(
        data.message === "sin_permiso"
          ? "No tienes permiso para registrar cobros"
          : data.message || "No se pudo registrar el pago",
        "err",
      );
    else if (data && data.pagos !== undefined) {
      reservaEnEdicion.pagosJugadores = data.pagos;
      reservaEnEdicion.pagoEstado = data.pago_estado;
    }
  } finally {
    actualizarVistasJugadoresSplit();
  }
}

function cerrarModal() {
  cerrarOverlay("modalReserva");
  _pendingPagoUnico = null;
}

async function guardarClienteSilencioso(
  nombre,
  telefono,
  tipoCliente = "Particular",
) {
  const row = { nombre, tipo_cliente: tipoCliente };
  if (telefono) row.telefono = telefono;
  if (tipoCliente === "Peña") row.nombre_entidad = nombre;

  const { data: ex, error: errEx } = await supabaseClient
    .from("clientes")
    .select("id, telefono")
    .eq("nombre", nombre)
    .eq("tipo_cliente", tipoCliente)
    .maybeSingle();

  if (errEx) {
    console.error("guardarClienteSilencioso (buscar nombre):", errEx);
    return;
  }

  if (ex) {
    if (
      telefono &&
      ex.telefono &&
      normalizarTelefono(ex.telefono) !== telefono &&
      !(await customConfirm(
        `Ya existe «${nombre}» con el teléfono ${ex.telefono}. ¿Cambiarlo por ${telefono}?\nSi cancelas, su ficha no se modifica.`,
      ))
    )
      return;
    if (telefono) {
      const { error: errUpd } = await supabaseClient
        .from("clientes")
        .update({ telefono })
        .eq("id", ex.id);
      if (errUpd) {
        console.error("guardarClienteSilencioso (update tel):", errUpd);
        toast("No se pudo actualizar el teléfono del cliente", "err");
      }
    }
    return;
  }

  if (telefono && tipoCliente === "Particular") {
    const { data: exPorTel } = await supabaseClient
      .from("clientes")
      .select("id, nombre")
      .eq("telefono", telefono)
      .eq("tipo_cliente", "Particular")
      .maybeSingle();

    if (exPorTel) {
      const ok = await customConfirm(
        `El teléfono ${telefono} ya pertenece al cliente «${exPorTel.nombre}».\n¿Renombrar su ficha a «${nombre}»?\nSi cancelas, se creará una ficha nueva duplicada.`,
        "Cliente con teléfono repetido",
      );
      if (ok) {
        const { error: errRen } = await supabaseClient
          .from("clientes")
          .update({ nombre })
          .eq("id", exPorTel.id);
        if (errRen) {
          console.error("guardarClienteSilencioso (renombrar):", errRen);
          toast("No se pudo renombrar: " + errRen.message, "err");
        }
        return;
      }
    }
  }

  const { error: errIns } = await supabaseClient.from("clientes").insert(row);

  if (errIns) {
    console.error("guardarClienteSilencioso (insert):", errIns);
    if (/duplicate|unique/i.test(errIns.message || "")) {
      toast(
        `No se pudo crear la ficha de «${nombre}»: ya existe otra con el teléfono ${telefono}.\nSi es una peña, revisa que el tipo sea "Peña".`,
        "err",
        8000,
      );
    } else {
      toast(
        `No se pudo crear la ficha de «${nombre}»: ${errIns.message}`,
        "err",
        8000,
      );
    }
  }
}

async function confirmarGuardarReserva() {
  const cliente = $("modalCliente").value.trim();
  if (!cliente) return toast("Introduce el nombre del cliente", "warn");
  const pistasSel = obtenerPistasSeleccionadasModal();
  if (pistasSel.length === 0)
    return toast("Selecciona al menos una pista", "warn");
  const tipo = $("modalTipoReserva").value;
  if (esEntrenador() && tipo !== "Entrenamiento")
    return toast("Los entrenadores solo pueden crear entrenamientos", "err");
  const esTorneo = tipo === "Torneo";
  const horaInicio = $("modalHora").value;
  const iso = $("modalFecha").value;
  if (!horaInicio || !iso)
    return toast("Indica fecha y hora de inicio", "warn");
  const telefono = normalizarTelefono($("modalTelefono").value);
  if (
    $("modalTelefono").value.trim() &&
    !telefonoValido($("modalTelefono").value)
  )
    return toast("El teléfono no parece válido (mínimo 9 cifras)", "warn");
  const duracionMin = esTorneo
    ? Math.round((parseFloat($("modalDuracionHoras").value) || 0) * 2) * 30
    : parseInt($("modalDuracion").value, 10) || 90;
  if (duracionMin < 30)
    return toast("La duración mínima es de 30 minutos", "warn");
  if (tipo === "Entrenamiento" && duracionMin % 60 !== 0)
    return toast("Los entrenamientos deben ser múltiplos de 1 hora", "warn");
  const iniMin = timeToMin(horaInicio);
  if (esFranjaBloqueada(iniMin, iniMin + duracionMin, tipo, iso))
    return toast("Horario no permitido para este tipo de reserva", "err");
  const numJugadores = parseInt($("modalNumJugadores").value, 10) || 4;
  const importe = parseFloat($("modalPrecio").value);
  if (isNaN(importe) || importe < 0)
    return toast("El precio no es válido", "warn");
  const idExistente = $("modalReservaId").value;
  const repetirSemanas =
    tipo === "Pena" && !idExistente
      ? Math.min(52, Math.max(1, parseInt($("modalRepetir").value, 10) || 1))
      : 1;
  const notas = $("modalNotas").value.trim();
  const btn = $("btnGuardarReserva");
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...',
  );
  try {
    const tipoPagoSeleccionado = document.querySelector(
      'input[name="modalTipoPago"]:checked',
    ).value;
    const tipoCli = $("modalCliente").dataset.tipo || "Particular";
    const esPena = tipoCli === "Peña";

    const payloadBase = {
      cliente,
      nombre_entidad: esPena ? cliente : null,
      telefono: telefono || null,
      hora_inicio: horaInicio,
      duracion_min: duracionMin,
      tipo_reserva: tipo,
      jugadores: numJugadores,
      precio: importe,
      empleado: nombreUsuario(),
      tipo_cobro: tipoPagoSeleccionado,
    };
    if (idExistente) {
      if (esEntrenador() && !puedeEditarReserva(reservaEnEdicion))
        return toast("No puedes editar esta reserva", "err");
      if (pistasSel.length !== 1)
        return toast(
          "Al editar una reserva selecciona una única pista",
          "warn",
        );
      const hayPagos = String(reservaEnEdicion.pagosJugadores || "")
        .split(",")
        .some((p) => p === "Efectivo" || p === "Tarjeta");
      const duracionOriginal = parseInt(reservaEnEdicion.duracionMin, 10) || 90;
      const duracionCambia = duracionMin !== duracionOriginal;
      if (
        hayPagos &&
        (Math.abs(importe - (parseFloat(reservaEnEdicion.precio) || 0)) >
          0.004 ||
          numJugadores !== reservaEnEdicion.numJugadoresOrig ||
          duracionCambia)
      ) {
        return toast(
          "Esta reserva tiene cobros. Quita antes los pagos para cambiar el precio, la duración o los jugadores.",
          "err",
        );
      }
      const conf = await buscarConflicto({
        pistas: pistasSel,
        fechas: [iso],
        iniMin,
        dur: duracionMin,
        excluirId: idExistente,
      });
      if (conf)
        return toast(
          `La pista '${pistasSel[0]}' ya está ocupada a las ${String(conf.hora_inicio).slice(0, 5)} por ${conf.cliente}`,
          "err",
        );
      const upd = {
        ...payloadBase,
        fecha: iso,
        pista: pistasSel[0],
      };
      if (notas !== String(reservaEnEdicion.notas || "").trim())
        upd.notas = notas;
      if (numJugadores !== reservaEnEdicion.numJugadoresOrig) {
        const pagosOrig = String(reservaEnEdicion.pagosJugadores || "").split(
          ",",
        );
        const eliminados = pagosOrig
          .slice(numJugadores)
          .filter((p) => p === "Efectivo" || p === "Tarjeta");
        if (eliminados.length)
          return toast(
            "No puedes reducir jugadores que ya han pagado. Quita antes su pago.",
            "err",
          );
        const nuevos = pagosOrig.slice(0, numJugadores);
        while (nuevos.length < numJugadores) nuevos.push("0");
        upd.pagos_jugadores = nuevos.join(",");
        upd.pago_estado = nuevos.every(
          (p) => p === "Efectivo" || p === "Tarjeta",
        )
          ? "Pagado"
          : "Sin pagar";
      }
      upd.tipo_cobro = tipoPagoSeleccionado;
      const { error } = await supabaseClient
        .from("reservas")
        .update(upd)
        .eq("id", idExistente);
      if (error) throw error;

      if (reservaEnEdicion.serie) {
        const telNuevo = telefono || null;
        const telViejo =
          normalizarTelefono(reservaEnEdicion.telefono || "") || null;
        const entidadNueva = esPena ? cliente : null;
        const entidadVieja = reservaEnEdicion.nombreEntidad || null;
        const cambiaNombre = cliente !== reservaEnEdicion.cliente;
        const cambiaTel = telNuevo !== telViejo;
        const cambiaEntidad = entidadNueva !== entidadVieja;

        if (cambiaNombre || cambiaTel || cambiaEntidad) {
          const aplicar = await customConfirm(
            "Esta reserva forma parte de una serie (peña).\n¿Aplicar el cambio de cliente y teléfono a TODA la serie?\nSi cancelas, solo se cambia en esta reserva.",
            "Reserva recurrente",
          );
          if (aplicar) {
            const { error: errSerie } = await supabaseClient
              .from("reservas")
              .update({
                cliente,
                nombre_entidad: entidadNueva,
                telefono: telNuevo,
              })
              .eq("serie", reservaEnEdicion.serie);
            if (errSerie) throw errSerie;
          }
        }
      }

      await guardarClienteSilencioso(cliente, telefono, tipoCli);
      toast("Reserva actualizada");
      cerrarModal();
      cargarReservasHoy();
      return;
    }
    const fechas = [];
    for (let w = 0; w < repetirSemanas; w++)
      fechas.push(sumarDiasISO(iso, w * 7));
    const conf = await buscarConflicto({
      pistas: pistasSel,
      fechas,
      iniMin,
      dur: duracionMin,
    });
    if (conf) {
      return toast(
        `No se puede crear: '${conf.pista}' ya está ocupada el ${conf.fecha} (${String(conf.hora_inicio).slice(0, 5)}) por ${conf.cliente}`,
        "err",
      );
    }
    const serieId = repetirSemanas > 1 ? "S_" + Date.now().toString(36) : "";
    const filas = [];
    fechas.forEach((f) =>
      pistasSel.forEach((p) =>
        filas.push({
          ...payloadBase,
          pista: p,
          fecha: f,
          serie: serieId,
          pago_estado: "Sin pagar",
          pagos_jugadores: Array(numJugadores).fill("0").join(","),
        }),
      ),
    );
    if (notas)
      filas.forEach((fila) => {
        fila.notas = fila.fecha === fechas[0] ? notas : null;
      });

    const { data: insertData, error } = await supabaseClient
      .from("reservas")
      .insert(filas)
      .select("id, jugadores, precio");
    if (error) throw error;

    if (_pendingPagoUnico && insertData && insertData.length === 1) {
      const { data: c, error: eC } = await supabaseClient.rpc(
        "cobrar_reserva_completa",
        {
          p_reserva_id: insertData[0].id,
          p_metodo: _pendingPagoUnico,
          p_empleado: nombreUsuario(),
        },
      );
      if (eC) throw eC;
      if (c && c.success === false)
        throw new Error(c.message || "No se pudo cobrar la reserva");
    } else if (_pendingPagoUnico && insertData && insertData.length > 1) {
      toast(
        "Reservas creadas sin cobrar. Cóbralas una a una para evitar errores en series largas.",
        "warn",
        6000,
      );
    }

    await guardarClienteSilencioso(cliente, telefono, tipoCli);
    toast(
      filas.length > 1 ? `${filas.length} reservas creadas` : "Reserva creada",
    );
    cerrarModal();
    cargarReservasHoy();
  } catch (err) {
    console.error(err);
    if (err && err.code === "23P01") {
      toast(
        "Esa pista ya está ocupada en ese horario (alguien acaba de reservarla).",
        "err",
      );
      cargarReservasHoy();
      return;
    }
    if (err && err.code === "23P02") {
      toast("La pista está bloqueada en ese horario", "err");
      return;
    }
    toast("Error al guardar la reserva: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

async function eliminarReservaRPC(alcance) {
  const id = $("modalReservaId").value;
  if (!id) return;
  const msg =
    alcance === "serie"
      ? "¿Eliminar esta reserva y todas las siguientes de la serie?"
      : "¿Eliminar esta reserva? Se devolverán los pagos registrados.";
  if (!(await customConfirm(msg))) return;
  const { data, error } = await supabaseClient.rpc(
    "eliminar_reserva_con_devolucion",
    { p_reserva_id: id, p_alcance: alcance, p_empleado: nombreUsuario() },
  );
  if (error) return toast("No se pudo eliminar: " + error.message, "err");
  if (!data || data.success === false)
    return toast(
      data && data.message === "sin_permiso"
        ? "No tienes permiso para eliminar reservas"
        : (data && data.message) || "No se pudo eliminar la reserva",
      "err",
    );
  cerrarModal();
  toast(alcance === "serie" ? "Serie eliminada" : "Reserva eliminada");
  cargarReservasHoy();
  cargarCajaHoy();
}

const confirmarEliminarSerie = () => eliminarReservaRPC("serie");
const confirmarEliminarReserva = () => eliminarReservaRPC("unica");

async function emitirJustificanteReserva() {
  if (!reservaEnEdicion || !reservaEnEdicion.id)
    return toast("Guarda la reserva antes de emitir el justificante", "warn");
  const nJug = parseInt(reservaEnEdicion.numJugadores, 10) || 4;
  const pagosArr = String(reservaEnEdicion.pagosJugadores || "").split(",");
  const pagados = pagosArr
    .slice(0, nJug)
    .filter((p) => p === "Efectivo" || p === "Tarjeta").length;
  if (pagados < nJug)
    return toast("La reserva no está totalmente pagada", "warn");
  const metodos = [...new Set(pagosArr.slice(0, nJug))];
  const metodo = metodos.length === 1 ? metodos[0] : "Varios";
  const precio = parseFloat(reservaEnEdicion.precio) || 0;
  if (precio <= 0) return toast("La reserva no tiene precio", "warn");
  const ini = timeToMin(reservaEnEdicion.horaInicio);
  const fin = ini + (parseInt(reservaEnEdicion.duracionMin, 10) || 90);
  const lineas = [
    {
      concepto: `Pista ${reservaEnEdicion.pista} · ${reservaEnEdicion.horaInicio}-${minToTimeStr(fin)}`,
      cantidad: 1,
      precio_unitario_con_iva: precio,
    },
  ];
  const btn = $("btnJustificanteReserva");
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Emitiendo...',
  );
  try {
    const { data, error } = await supabaseClient.rpc("gp_emitir_documento", {
      p_tipo: "Justificante",
      p_fecha: fechaLocalISO(),
      p_cliente: {},
      p_metodo_pago: metodo,
      p_reserva_id: reservaEnEdicion.id,
      p_iva: 21,
      p_lineas: lineas,
      p_notas: `Reserva ${reservaEnEdicion.cliente}`,
      p_empleado: nombreUsuario(),
    });
    if (error) throw error;
    if (!data || !data.ok)
      throw new Error((data && data.error) || "No se pudo emitir");
    toast(`Justificante ${data.numero} emitido (${eur(data.total)})`);
    const usbReady =
      typeof usbDevice !== "undefined" &&
      usbDevice &&
      typeof usbEndpoint !== "undefined" &&
      usbEndpoint;
    if (usbReady && typeof imprimirTicketWebUSB === "function")
      await imprimirTicketWebUSB(data.id);
    else if (typeof imprimirFactura === "function")
      await imprimirFactura(data.id, "ticket");
  } catch (e) {
    console.error(e);
    toast("No se pudo emitir el justificante: " + (e.message || e), "err");
  } finally {
    setBusy(btn, false);
  }
}

const PP_TIPO_CLASE = {
  Pena: "t-pena",
  Torneo: "t-torneo",
  Entrenamiento: "t-entreno",
};

function estadoPagoReserva(r) {
  const n = parseInt(r.numJugadores, 10) || 4;
  const arr = String(r.pagosJugadores || "").split(",");
  let pagados = 0;
  for (let i = 0; i < n; i++) {
    const p = arr[i];
    if (p === "Efectivo" || p === "Tarjeta") pagados++;
  }
  return { n, pagados, total: pagados >= n };
}

const PP_PESO_CERRADO = 0.45;
const PP_ALTO_CUERPO_MM = 158;

function htmlPaginaImpresion(iso, reservas, meta) {
  let mIni = RESERVA_INI_MIN;
  let mFin = obtenerCierreMin(iso);
  reservas.forEach((r) => {
    const a = timeToMin(r.horaInicio),
      b = a + (parseInt(r.duracionMin, 10) || 90);
    if (a < mIni) mIni = Math.floor(a / 30) * 30;
    if (b > mFin) mFin = Math.ceil(b / 30) * 30;
  });
  const slots = [];
  for (let m = mIni; m < mFin; m += 30) {
    const c = esCerrado(m, iso);
    slots.push({ m, cerrado: c, w: c ? PP_PESO_CERRADO : 1 });
  }
  const total = slots.reduce((t, s) => t + s.w, 0);
  const pos = (min) => {
    let p = 0;
    slots.forEach((s) => {
      p += s.w * Math.min(1, Math.max(0, (min - s.m) / 30));
    });
    return (p / total) * 100;
  };
  const bandas = [];
  slots.forEach((s) => {
    const u = bandas[bandas.length - 1];
    if (s.cerrado && u && u.cerrado) {
      u.w += s.w;
      u.fin = s.m + 30;
    } else bandas.push({ ini: s.m, fin: s.m + 30, w: s.w, cerrado: s.cerrado });
  });
  const claseBanda = (x) => (x.cerrado ? "c" : x.ini % 60 === 0 ? "h" : "m");
  const eje = bandas
    .map(
      (x) =>
        `<div class="pp-b ${claseBanda(x)}" style="flex:${x.w} 1 0">${x.cerrado ? minToTimeStr(x.ini) + "-" + minToTimeStr(x.fin) : minToTimeStr(x.ini)}</div>`,
    )
    .join("");
  const rejilla = bandas
    .map(
      (x) =>
        `<div class="pp-b ${claseBanda(x)}" style="flex:${x.w} 1 0"></div>`,
    )
    .join("");
  const cabeceras = listaPistas
    .map((p) => `<div class="pp-th">${esc(p)}</div>`)
    .join("");
  const columnas = listaPistas
    .map((pista) => {
      const bloques = reservas
        .filter((r) => r.pista === pista)
        .map((r) => {
          const a = timeToMin(r.horaInicio),
            dur = parseInt(r.duracionMin, 10) || 90,
            b = a + dur;
          const top = pos(a),
            alto = pos(b) - top;
          const mm = (alto / 100) * PP_ALTO_CUERPO_MM;
          const pg = estadoPagoReserva(r);
          const pagoTxt = pg.total
            ? "✔ Pagado"
            : pg.pagados > 0
              ? `Pagan ${pg.pagados}/${pg.n}`
              : "Sin pagar";
          const claseTipo = PP_TIPO_CLASE[r.tipoReserva] || "";
          let cls = "pp-res " + claseTipo;
          if (pg.total && !claseTipo) cls += " pagado";
          const nota = String(r.notas || "")
            .replace(/\s+/g, " ")
            .trim();
          if (nota) cls += " nota";
          cls += mm < 8 ? " pp-xs" : mm < 14 ? " pp-s" : "";
          const tipo =
            r.tipoReserva && r.tipoReserva !== "Normal"
              ? ` · ${r.tipoReserva === "Pena" ? "Peña" : esc(r.tipoReserva)}`
              : "";
          const rango = `${minToTimeStr(a)}–${minToTimeStr(b)}`;
          const detalle =
            mm >= 14 ? `<div class="pp-sub">${pagoTxt}${tipo}</div>` : "";
          const notaHtml =
            nota && mm >= 20 ? `<div class="pp-note">✎ ${esc(nota)}</div>` : "";
          return `<div class="${cls}" style="top:${top.toFixed(3)}%;height:${alto.toFixed(3)}%">
<div class="pp-name">${r.serie ? "↻ " : ""}${esc(r.cliente)}</div>
<div class="pp-time">${rango}</div>${detalle}${notaHtml}</div>`;
        })
        .join("");
      return `<div class="pp-col">${rejilla}${bloques}</div>`;
    })
    .join("");
  const fecha = fechaBonita(iso);
  return `<section class="pp-page">
<div class="pp-head">
<img src="./geopadel.webp" alt="Geopadel" width="150" height="150">
<div class="pp-title"><h1>${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</h1><p>Cuadrante de reservas · ${minToTimeStr(mIni)} – ${minToTimeStr(mFin)}</p></div>
<div class="pp-meta">${meta}</div>
</div>
<div class="pp-grid" style="--pp-n:${listaPistas.length}">
<div class="pp-cols"><div class="pp-th">Hora</div>${cabeceras}</div>
<div class="pp-body"><div class="pp-axis">${eje}</div>${columnas}</div>
</div>
</section>`;
}

async function imprimirDia() {
  const btn = $("btnImprimir");
  setBusy(btn, true);
  try {
    await cargarReservasHoy();
    const iso = $("fechaCuadrante").value || fechaLocalISO();
    const reservas = (datosLocales.reservas || []).filter(
      (r) => r.fecha === iso,
    );
    if (!reservas.length) {
      toast("No hay reservas este día para imprimir", "warn");
      return;
    }
    const impreso = new Date().toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const meta = `Reservas del día: ${reservas.length} · Ocupación ${$("statOcupacion").innerText}<br>Impreso: ${esc(impreso)}`;
    const area = $("printArea");
    area.innerHTML = htmlPaginaImpresion(iso, reservas, meta);
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

window.addEventListener("afterprint", () => {
  setTimeout(() => {
    const a = $("printArea");
    if (a) a.innerHTML = "";
  }, 1000);
});

const CAMPOS_BONITOS = {
  fecha: "Fecha",
  hora_inicio: "Hora inicio",
  hora: "Hora",
  duracion_min: "Duración (min)",
  tipo_reserva: "Tipo",
  jugadores: "Jugadores",
  precio: "Precio",
  pago_estado: "Estado de pago",
  pagos_jugadores: "Pagos por jugador",
  estado: "Estado",
  pista: "Pista",
  cliente: "Cliente",
  telefono: "Teléfono",
  notas: "Notas",
  serie: "Serie",
  origen: "Origen",
  empleado: "Empleado",
  nombre: "Nombre",
  importe: "Importe",
  rol: "Rol",
  web_habilitado: "Acceso web",
  resuelta_por: "Resuelta por",
  resuelta_at: "Resuelta el",
  creado_por: "Creada por",
  efectivo_sistema: "Efectivo sistema",
  tarjeta: "Tarjeta",
  total: "Total",
  dif_efectivo: "Dif. efectivo",
  dif_datafono: "Dif. datáfono",
  cerrado_por: "Cerrado por",
  franja: "Franja",
  precio_60min: "Precio 60 min",
  precio_90min: "Precio 90 min",
  precio_120min: "Precio 120 min",
  horas_semanales: "Horas semanales",
  horario: "Horario",
  vigente_desde: "Vigente desde",
  declarado_por: "Declarado por",
  categoria: "Categoría",
  visible: "Visible",
};

const campoBonito = (c) => CAMPOS_BONITOS[c] || c;

function valorBonito(v) {
  if (v === null || v === undefined)
    return '<span style="color:var(--muted)">—</span>';
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return esc(s.length > 60 ? s.slice(0, 57) + "…" : s);
  }
  const s = String(v);
  if (!s) return '<span style="color:var(--muted)">—</span>';
  return esc(s.length > 60 ? s.slice(0, 57) + "…" : s);
}

function iconoAccion(a) {
  if (a === "INSERT")
    return '<i class="ri-add-circle-line" aria-hidden="true"></i>';
  if (a === "DELETE")
    return '<i class="ri-delete-bin-line" aria-hidden="true"></i>';
  return '<i class="ri-edit-line" aria-hidden="true"></i>';
}

function textoAccion(a) {
  return a === "INSERT"
    ? "Creada"
    : a === "DELETE"
      ? "Eliminada"
      : "Modificada";
}

function agruparCambios(cambios) {
  const grupos = [];
  const mapa = {};
  for (const c of cambios) {
    const k = `${c.ts}|${c.empleado || ""}|${c.accion}`;
    if (!mapa[k]) {
      mapa[k] = { ...c, campos: [] };
      grupos.push(mapa[k]);
    }
    if (c.campo)
      mapa[k].campos.push({
        campo: c.campo,
        antes: c.valor_antiguo,
        despues: c.valor_nuevo,
      });
  }
  return grupos;
}

function dibujarHistorial(cambios) {
  if (!cambios || !cambios.length) {
    return '<p style="color:var(--muted);text-align:center;padding:16px">Sin cambios registrados todavía.</p>';
  }
  const grupos = agruparCambios(cambios);
  return `<ol style="list-style:none;padding:0;margin:0">${grupos
    .map((g) => {
      const ts = new Date(g.ts);
      const fecha = isNaN(ts.getTime())
        ? "—"
        : ts.toLocaleString("es-ES", {
            dateStyle: "short",
            timeStyle: "short",
          });
      const cls = `hist-item accion-${g.accion}`;
      const camposHtml = g.campos.length
        ? `<ul class="hist-cambios">${g.campos
            .map(
              (c) =>
                `<li><b>${esc(campoBonito(c.campo))}:</b> ${valorBonito(c.antes)} → ${valorBonito(c.despues)}</li>`,
            )
            .join("")}</ul>`
        : "";
      return `<li class="${cls}">
<div class="hist-meta">
${iconoAccion(g.accion)}
<b>${textoAccion(g.accion)}</b>
<span style="color:var(--muted)">${esc(fecha)} · ${esc(g.empleado || "sistema")}</span>
</div>
${camposHtml}
</li>`;
    })
    .join("")}</ol>`;
}

async function verHistorialReserva() {
  cargarModalHistorial();
  const id = $("modalReservaId").value;
  if (!id) return;
  $("histTitulo").innerText = "Historial de la reserva";
  $("histCuerpo").innerHTML = '<p style="color:var(--muted)">Cargando...</p>';
  abrirOverlay("modalHistorial");
  try {
    const { data, error } = await supabaseClient.rpc("gp_historial_reserva", {
      p_reserva_id: Number(id),
    });
    if (error) throw error;
    if (!data || !data.ok) {
      $("histCuerpo").innerHTML =
        `<p style="color:var(--red);text-align:center;padding:16px">No tienes permiso para ver el historial.</p>`;
      return;
    }
    $("histCuerpo").innerHTML = dibujarHistorial(data.cambios);
  } catch (e) {
    console.error(e);
    $("histCuerpo").innerHTML =
      `<p style="color:var(--red);text-align:center;padding:16px">No se pudo cargar el historial: ${esc(e.message || e)}</p>`;
  }
}

function cerrarHistorial() {
  cerrarOverlay("modalHistorial");
}

async function cargarListaEspera() {
  const tb = $("listaEsperaBody");
  if (!tb) return;
  const hoy = fechaLocalISO();
  const { data, error } = await supabaseClient
    .from("lista_espera")
    .select("*")
    .eq("estado", "pendiente")
    .gte("fecha", hoy)
    .order("fecha", { ascending: true });

  if (error) {
    tb.innerHTML =
      '<tr><td colspan="4" class="tabla-empty" style="color:var(--red)">Error al cargar</td></tr>';
    return;
  }

  if (!data || data.length === 0) {
    tb.innerHTML =
      '<tr><td colspan="4" class="tabla-empty">Nadie en lista de espera</td></tr>';
    return;
  }

  const fmtF = (iso) => {
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  };

  tb.innerHTML = data
    .map(
      (x) => `
        <tr>
            <td><b>${esc(fmtF(x.fecha))}</b></td>
            <td>${x.duracion} min</td>
            <td><a href="tel:${esc(x.telefono)}" style="color:var(--blue);font-weight:700">${esc(x.telefono)}</a></td>
            <td>
                <button type="button" class="btn-add gray" data-espera-avisar="${esc(x.id)}"><i class="ri-notification-3-line" aria-hidden="true"></i>Avisar manual</button>
                <button type="button" class="btn-add danger" data-espera-borrar="${esc(x.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>Quitar</button>
            </td>
        </tr>
    `,
    )
    .join("");
}

document.addEventListener("click", async (e) => {
  const btnAvisar = e.target.closest("[data-espera-avisar]");
  if (btnAvisar) {
    if (
      !(await customConfirm(
        "¿Marcar como avisado? (El cliente deberá reservar por su cuenta)",
      ))
    )
      return;
    const { error } = await supabaseClient
      .from("lista_espera")
      .update({ estado: "avisado" })
      .eq("id", btnAvisar.dataset.esperaAvisar);
    if (error) return toast("No se pudo marcar: " + error.message, "err");
    toast("Marcado como avisado");
    cargarListaEspera();
  }

  const btnBorrar = e.target.closest("[data-espera-borrar]");
  if (btnBorrar) {
    if (!(await customConfirm("¿Eliminar de la lista de espera?"))) return;
    const { error } = await supabaseClient
      .from("lista_espera")
      .delete()
      .eq("id", btnBorrar.dataset.esperaBorrar);
    if (error) return toast("No se pudo eliminar: " + error.message, "err");
    toast("Eliminado de la lista");
    cargarListaEspera();
  }
});

if ($("btnRefrescarEspera")) {
  $("btnRefrescarEspera").addEventListener("click", cargarListaEspera);
}

const navReservasBtn = $("nav-reservas");
if (navReservasBtn) {
  navReservasBtn.addEventListener("click", () => {
    setTimeout(() => {
      if ($("tab-reservas").classList.contains("active")) cargarListaEspera();
    }, 50);
  });
}

function dibujarBloqueos() {
  const tb = $("bloqueosBody");
  const ftxt = $("bloqueosFechaTxt");
  const iso = $("fechaCuadrante").value || fechaLocalISO();
  if (ftxt) ftxt.innerText = fechaBonita(iso);
  if (!tb) return;
  const lista = (datosLocales.bloqueos || [])
    .slice()
    .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  if (!lista.length) {
    tb.innerHTML =
      '<tr><td colspan="4" class="tabla-empty">Sin bloqueos para este día</td></tr>';
    return;
  }
  tb.innerHTML = lista
    .map(
      (b) => `<tr>
<td><b>${esc(b.pista)}</b></td>
<td>${esc(String(b.hora_inicio).slice(0, 5))} – ${esc(String(b.hora_fin).slice(0, 5))}</td>
<td>${esc(b.motivo || "—")}</td>
<td><button type="button" class="btn-del-prod" data-bloqueo-del="${esc(b.id)}" aria-label="Desbloquear"><i class="ri-lock-unlock-line" aria-hidden="true"></i></button></td>
</tr>`,
    )
    .join("");
}

async function crearBloqueo() {
  const pista = $("bloqueoPista").value;
  const fecha = $("fechaCuadrante").value || fechaLocalISO();
  const ini = $("bloqueoIni").value;
  const fin = $("bloqueoFin").value;
  const motivo = $("bloqueoMotivo").value.trim();
  if (!ini || !fin) return toast("Indica el horario del bloqueo", "warn");
  const iniMin = timeToMin(ini);
  const finMin = timeToMin(fin);
  if (finMin <= iniMin)
    return toast("La hora fin debe ser mayor que la de inicio", "warn");
  const pistas = pista ? [pista] : listaPistas;
  const btn = $("btnBloquear");
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...',
  );
  let ok = 0;
  let solape = 0;
  let conReserva = 0;
  let errores = 0;
  for (const p of pistas) {
    const { error } = await supabaseClient.from("bloqueos_pistas").insert({
      pista: p,
      fecha,
      hora_inicio: ini,
      hora_fin: fin,
      motivo: motivo || null,
    });
    if (!error) ok++;
    else if (error.code === "23P03") solape++;
    else if (error.code === "23P04") conReserva++;
    else {
      errores++;
      console.error(error);
    }
  }
  setBusy(btn, false);
  const partes = [];
  if (ok)
    partes.push(`${ok} ${ok === 1 ? "pista bloqueada" : "pistas bloqueadas"}`);
  if (solape) partes.push(`${solape} ya tenían bloqueo`);
  if (conReserva) partes.push(`${conReserva} tenían reservas`);
  if (errores) partes.push(`${errores} fallos`);
  if (partes.length)
    toast(
      partes.join(" · "),
      errores || solape || conReserva ? "warn" : "ok",
      6000,
    );
  if (ok) {
    $("bloqueoIni").value = "";
    $("bloqueoFin").value = "";
    $("bloqueoMotivo").value = "";
    cargarReservasHoy();
  }
}

async function eliminarBloqueo(id) {
  if (!(await customConfirm("¿Desbloquear esta pista en ese tramo?"))) return;
  const { error } = await supabaseClient
    .from("bloqueos_pistas")
    .delete()
    .eq("id", id);
  if (error) return toast("No se pudo eliminar: " + error.message, "err");
  toast("Bloqueo eliminado");
  cargarReservasHoy();
}

(function initBloqueos() {
  const sel = $("bloqueoPista");
  if (!sel) return;
  listaPistas.forEach((p) => {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    sel.appendChild(o);
  });
  $("btnBloquear").addEventListener("click", crearBloqueo);
  $("bloqueosBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-bloqueo-del]");
    if (b) eliminarBloqueo(b.dataset.bloqueoDel);
  });
})();
