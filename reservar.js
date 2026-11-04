/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const SPIN = '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>';

let cfg = {
  dias_max: 30,
  cancelar_horas: 24,
  max_futuras: 9,
  duraciones: [60, 90],
  anticipacion_min: 30,
};
let sel = {
  fecha: null,
  dur: 90,
  hora: null,
  precio: 0,
  numPistas: 1,
  numPistasDisponibles: 1,
};
let flujo = { fase: "tel", tel: "", codigo: "", nombre: "", email: "" };
let mis = { tel: "", codigo: "", nombre: "" };
let cuenta = null;
let slotsDia = [];
let reqHuecos = 0;
let cacheHuecos = { fecha: null, t: 0, data: null };
let waitlistHora = null;
let ultimaReserva = null;
let ts = { id: null, token: "", hostId: null };
const TTL_HUECOS = 3e4;

function fechaDesdeISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
const fechaWeb = (iso) => fechaBonita(iso, true);
const idioma = () =>
  typeof _idioma !== "undefined" && _idioma === "en" ? "en-GB" : "es-ES";
const antMin = () =>
  Number.isFinite(Number(cfg.anticipacion_min))
    ? Number(cfg.anticipacion_min)
    : 30;
function horaReservable(fecha, hora) {
  const [y, m, d] = fecha.split("-").map(Number);
  const min = timeToMin(hora);
  const objetivo = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60);
  return objetivo - ahoraMadrid().msUTC >= antMin() * 60000;
}
function textoAntelacion() {
  return t("reservar.antelacion", { min: duracionTxt(antMin()) });
}

function iniciarTurnstile(hostId) {
  if (!TURNSTILE_SITEKEY) return;
  if (ts.id !== null && ts.hostId === hostId) return;
  if (ts.id !== null) {
    try {
      window.turnstile.remove(ts.id);
    } catch (e) {}
    ts.id = null;
    ts.token = "";
  }
  ts.hostId = hostId;
  const host = document.getElementById(hostId);
  if (!host) return;
  host.hidden = false;
  const render = () => {
    if (ts.id !== null || !window.turnstile) return;
    try {
      ts.id = window.turnstile.render("#" + hostId, {
        sitekey: TURNSTILE_SITEKEY,
        callback: (token) => {
          ts.token = token;
        },
        "expired-callback": () => {
          ts.token = "";
        },
        "error-callback": () => {
          ts.token = "";
        },
      });
    } catch (e) {
      console.error(e);
    }
  };
  if (window.turnstile) render();
  else {
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }
}
function reiniciarTurnstile() {
  ts.token = "";
  if (window.turnstile && ts.id !== null) {
    try {
      window.turnstile.reset(ts.id);
    } catch (e) {}
  }
}
async function esperarTokenTurnstile(timeoutMs = 15000) {
  if (ts.token) return ts.token;
  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (ts.token) {
        clearInterval(iv);
        resolve(ts.token);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        resolve("");
      }
    }, 200);
  });
}

async function llamarEdge(accion, args, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(SUPABASE_URL + "/functions/v1/reservar-web", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ accion, ...args }),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(tid);
    if (err && err.name === "AbortError") {
      const e = new Error("timeout");
      e.name = "TimeoutError";
      throw e;
    }
    throw err;
  }
  clearTimeout(tid);
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}
  if (!data) throw new Error("Respuesta no válida (" + res.status + ")");
  if (data.error === "db") {
    const e = new Error(data.message || "Error de base de datos");
    e.code = data.code;
    throw e;
  }
  return data;
}
const RPC_LECTURA = ["web_config", "web_disponibilidad"];
async function rpcFetch(nombre, args) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(args || {}),
  });
  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = j.message || j.error || "";
    } catch (e) {}
    const err = new Error(msg || "HTTP " + res.status);
    err.code = res.status;
    return { data: null, error: err };
  }
  return { data: await res.json(), error: null };
}
async function rpc(nombre, args) {
  const fn = () => rpcFetch(nombre, args || {});
  const { data, error } = RPC_LECTURA.includes(nombre)
    ? await conReintento(fn)
    : await fn();
  if (error) throw error;
  return data;
}
function errorRed(err) {
  console.error(err);
  toast(t("reservar.toast.connection"), "err");
}

function motivoTexto(motivo) {
  if (_idioma === "en") {
    if (motivo === "plazo")
      return `Can only be cancelled ${cfg.cancelar_horas} h in advance. Call the club.`;
    if (motivo === "tipo")
      return "This booking can only be changed by calling the club.";
    if (motivo === "pagada")
      return "It has registered payments. Call the club to change it.";
    return "Call the club to change it.";
  }
  if (motivo === "plazo")
    return `Solo se puede cancelar con ${cfg.cancelar_horas} h de antelación. Llama al club.`;
  if (motivo === "tipo")
    return "Esta reserva solo se puede cambiar llamando al club.";
  if (motivo === "pagada")
    return "Tiene pagos registrados. Llama al club para cambiarla.";
  return "Llama al club para cambiarla.";
}
function textoError(e) {
  const err = e && e.error;
  const en = _idioma === "en";
  switch (err) {
    case "fecha_invalida":
      return en ? "That day is not available." : "Ese día no está disponible.";
    case "hora_invalida":
      return en
        ? "That time is not available."
        : "Esa hora no está disponible.";
    case "hora_pasada":
      return en
        ? "That time can no longer be booked."
        : "Esa hora ya no se puede reservar.";
    case "duracion_invalida":
      return en ? "Invalid duration." : "La duración no es válida.";
    case "num_pistas_invalido":
      return en
        ? "Invalid number of courts."
        : "El número de pistas no es válido.";
    case "telefono_invalido":
      return en ? "Check the phone number." : "Revisa el teléfono.";
    case "nombre_invalido":
      return en ? "Enter your full name." : "Escribe tu nombre y apellidos.";
    case "codigo_formato":
      return en
        ? "The code must be 4-30 characters."
        : "El código debe tener entre 4 y 30 caracteres.";
    case "codigo_incorrecto":
      if (en)
        return e.restantes === 1
          ? "Incorrect code. 1 attempt left."
          : `Incorrect code. ${e.restantes} attempts left.`;
      return e.restantes === 1
        ? "Código incorrecto. Te queda 1 intento."
        : `Código incorrecto. Te quedan ${e.restantes} intentos.`;
    case "bloqueado": {
      const min = Math.max(1, Math.ceil((e.segundos || 0) / 60));
      return en
        ? `Too many attempts. Try again in ${min} min.`
        : `Demasiados intentos. Inténtalo en ${min} min.`;
    }
    case "ya_existe":
      return en
        ? "An account already exists with this phone."
        : "Ya existe una cuenta con este teléfono. Llama al club si tienes problemas.";
    case "cliente_bloqueado":
      return en
        ? "You can't book. Call the club."
        : "No puedes reservar. Llama al club.";
    case "deuda_excesiva":
      return en
        ? `You have ${eur(e.deuda)} in pending debts (max ${eur(e.max)}). Call the club.`
        : `Tienes ${eur(e.deuda)} en deudas pendientes (máximo ${eur(e.max)}). Llama al club para resolverlas.`;
    case "sin_disponibilidad":
      return en ? "That slot was just taken." : "Ese hueco se acaba de ocupar.";
    case "limite_reservas":
      return en
        ? `You already have ${e.max} pending bookings.`
        : `Ya tienes ${e.max} reservas pendientes.`;
    case "no_encontrada":
      return en ? "Booking not found." : "No se ha encontrado la reserva.";
    case "ambiguo":
      return en
        ? "Several clients share that name."
        : "Hay varios clientes con ese nombre.";
    case "faltan_datos":
      return en ? "Fill in all fields." : "Rellena todos los campos.";
    case "captcha":
      return en ? "Verify you are human." : "Verifica que eres humano.";
    case "demasiadas_solicitudes":
      return en ? "Too many attempts." : "Demasiados intentos.";
    case "consentimiento":
      return en ? "Accept privacy policy." : "Acepta la privacidad.";
    case "cliente_existente":
      return en
        ? "Client already exists. Call club."
        : "Ya hay un cliente con esos datos. Llama al club.";
    case "deuda_pendiente":
      return en
        ? "Pending payment. Call club."
        : "Tienes un pago pendiente. Llama al club.";
    case "no_cancelable":
      return motivoTexto(e.motivo);
    case "error_servidor":
      return en
        ? "Server error. Please try again or call the club."
        : "Error interno del servidor. Inténtalo de nuevo o llámanos al 646 05 99 62.";
    case "method_not_allowed":
    case "accion_invalida":
    case "no_autorizado":
      return en
        ? "Unexpected error. Please call the club."
        : "Error inesperado. Llámanos al 646 05 99 62.";
    default:
      return en
        ? "Something went wrong."
        : "Algo ha fallado. Llámanos al 646 05 99 62.";
  }
}

function setStep(n) {
  document.querySelectorAll(".cl-step").forEach((el) => {
    const step = parseInt(el.dataset.step, 10);
    el.classList.toggle("cl-step-active", step === n);
    el.classList.toggle("cl-step-done", step < n);
    if (step === n) el.setAttribute("aria-current", "step");
    else el.removeAttribute("aria-current");
  });
}

function renderDiasScroll() {
  const cont = document.getElementById("clDias");
  if (!cont) return;
  const hoy = fechaLocalISO();
  const limite = sumarDiasISO(hoy, cfg.dias_max || 30);
  const fechas = [];
  let f = hoy;
  while (f <= limite) {
    fechas.push(f);
    f = sumarDiasISO(f, 1);
  }
  cont.innerHTML = fechas
    .map((iso) => {
      const d = fechaDesdeISO(iso);
      const ds = d
        .toLocaleDateString(idioma(), { weekday: "short" })
        .replace(".", "");
      const mes = d
        .toLocaleDateString(idioma(), { month: "short" })
        .replace(".", "");
      const esHoy = iso === hoy;
      const activo = iso === sel.fecha;
      const fechaLarga = d.toLocaleDateString(idioma(), {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const aria = `${fechaLarga}${esHoy ? ", " + t("reservar.hoy") : ""}`;
      const badge = esHoy
        ? `<span class="cl-day-hoy-badge">${esc(t("reservar.hoy"))}</span>`
        : "";
      return `<button type="button" class="cl-day${activo ? " active" : ""}" data-fecha="${iso}" aria-pressed="${activo}" aria-label="${esc(aria)}">
        ${badge}
        <small>${esc(ds)}</small>
        <b>${d.getDate()}</b>
        <small>${esc(mes)}</small>
      </button>`;
    })
    .join("");
}
function marcarDiaActivo() {
  document.querySelectorAll(".cl-day").forEach((btn) => {
    const activo = btn.dataset.fecha === sel.fecha;
    btn.classList.toggle("active", activo);
    btn.setAttribute("aria-pressed", activo ? "true" : "false");
    if (activo)
      btn.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
  });
}

function renderDuraciones() {
  const durs = cfg.duraciones || [60, 90];
  if (!durs.includes(sel.dur)) {
    sel.dur = durs[0];
    sel.hora = null;
    document.getElementById("cardStep2").hidden = true;
    setStep(1);
  }
  document.getElementById("clDur").innerHTML = durs
    .map(
      (d) =>
        `<button type="button" class="cl-dur${d === sel.dur ? " active" : ""}" data-dur="${d}" aria-pressed="${d === sel.dur}">${esc(duracionTxt(d))}</button>`,
    )
    .join("");
  let hint = document.getElementById("clDurHint");
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "clDurHint";
    hint.className = "cl-hint-box";
    document.getElementById("clDur").after(hint);
  }
  hint.innerHTML = `<p class="cl-hint-info">${t("reservar.two-hours")}</p><p class="cl-hint-info">${t("reservar.penas-torneos")}</p>`;
}

async function seleccionarDia(fecha, silent = false) {
  if (!silent) resetFlujo();
  document.getElementById("cardOk").hidden = true;
  if (sel.fecha !== fecha) slotsDia = [];
  sel.fecha = fecha;
  sel.hora = null;
  document.getElementById("cardDatos").hidden = false;
  document.getElementById("cardStep2").hidden = true;
  setStep(1);
  cerrarWaitlist();
  renderDuraciones();
  marcarDiaActivo();
  const dur = sel.dur;
  const slots = await cargarHuecos();
  if (sel.dur !== dur) renderHuecos();
  return slots;
}

async function cargarHuecos() {
  const cont = document.getElementById("clSlots");
  const fecha = sel.fecha;
  const req = ++reqHuecos;
  if (cacheHuecos.fecha === fecha && Date.now() - cacheHuecos.t < TTL_HUECOS) {
    slotsDia = cacheHuecos.data;
    renderHuecos();
    return slotsDia;
  }
  cont.innerHTML = `<p class="cl-empty">${t("reservar.searching")}</p>`;
  try {
    const data = await rpc("web_disponibilidad", { p_fecha: fecha });
    if (req !== reqHuecos) return slotsDia;
    if (!data || !data.ok) {
      slotsDia = [];
      cont.innerHTML = `<p class="cl-empty">${t("reservar.error")} <button type="button" class="cl-link" data-reintentar>${t("reservar.reintentar")}</button></p>`;
      return slotsDia;
    }
    slotsDia = data.slots || [];
    cacheHuecos = { fecha, t: Date.now(), data: slotsDia };
    renderHuecos();
    return slotsDia;
  } catch (e) {
    if (req !== reqHuecos) return slotsDia;
    console.error(e);
    cont.innerHTML = `<p class="cl-empty">${t("reservar.error")} <button type="button" class="cl-link" data-reintentar>${t("reservar.reintentar")}</button></p>`;
    return slotsDia;
  }
}
function renderHuecos() {
  const cont = document.getElementById("clSlots");
  const todos = slotsDia
    .filter((s) => !s.durs_validas || s.durs_validas.includes(sel.dur))
    .map((s) => ({
      hora: s.hora,
      op: (s.opciones || []).find((o) => o.dur === sel.dur),
    }))
    .filter((s) => horaReservable(sel.fecha, s.hora));

  if (sel.hora && !todos.some((s) => s.hora === sel.hora && s.op)) {
    sel.hora = null;
    document.getElementById("cardStep2").hidden = true;
    setStep(1);
  }

  if (!todos.length) {
    cont.innerHTML = `<p class="cl-empty">${t("reservar.antelacion", { min: duracionTxt(antMin()) })}${t("reservar.antelacion-llama")}</p>`;
    return;
  }

  cont.innerHTML = todos
    .map((s) => {
      if (s.op) {
        const libres = s.op.libres || 1;
        const libresTxt =
          libres > 1
            ? ` · ${libres} ${t("reservar.numPistas.disponibles")}`
            : "";
        return `<button type="button" class="cl-slot${s.hora === sel.hora ? " active" : ""}" data-hora="${esc(s.hora)}" data-precio="${esc(s.op.precio)}" data-libres="${libres}" aria-pressed="${s.hora === sel.hora}">${esc(s.hora)}<span>${eur(s.op.precio)}${libresTxt}</span></button>`;
      }
      return `<button type="button" class="cl-slot cl-slot-ocupado" data-espera-hora="${esc(s.hora)}" aria-label="${esc(t("reservar.waitlist.cta"))} ${esc(s.hora)}">${esc(s.hora)}<span>${t("reservar.waitlist.cta")}</span></button>`;
    })
    .join("");
}

function abrirWaitlist(hora) {
  waitlistHora = hora;
  if (ts.hostId === "cfTurnstileWaitlist") {
    if (ts.id !== null) {
      try {
        window.turnstile.remove(ts.id);
      } catch (e) {}
    }
    ts.id = null;
    ts.token = "";
    ts.hostId = null;
  }
  const form = document.getElementById("clWaitlistForm");
  form.innerHTML = `
    <p class="cl-waitlist-info">
      <i class="ri-information-line" aria-hidden="true"></i>
      <span>${t("reservar.waitlist.promptShort", { hora, dur: duracionTxt(sel.dur), fecha: fechaWeb(sel.fecha) })}</span>
    </p>
    <div class="form-group">
      <label for="clWaitlistTel">${t("reservar.telefono")}</label>
      <input type="tel" id="clWaitlistTel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="600 123 456" />
    </div>
    <div id="cfTurnstileWaitlist" class="cl-waitlist-turnstile" hidden></div>
    <div class="cl-waitlist-actions">
      <button type="button" class="btn-add blue" id="clWaitlistEnviar">${t("reservar.waitlist.enviar")}</button>
      <button type="button" class="btn-add gray" id="clWaitlistCancelar">${t("modal.cancel")}</button>
    </div>
    <p id="clWaitlistMsg" class="cl-hint" aria-live="polite"></p>
  `;
  form.hidden = false;
  document
    .getElementById("clWaitlistCancelar")
    .addEventListener("click", cerrarWaitlist);
  document
    .getElementById("clWaitlistEnviar")
    .addEventListener("click", enviarWaitlist);
  document.getElementById("clWaitlistTel").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      enviarWaitlist();
    }
  });
  form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  iniciarTurnstile("cfTurnstileWaitlist");
  setTimeout(() => {
    const inp = document.getElementById("clWaitlistTel");
    if (inp) inp.focus();
  }, 100);
}
function cerrarWaitlist() {
  waitlistHora = null;
  const form = document.getElementById("clWaitlistForm");
  if (form) form.hidden = true;
}
async function enviarWaitlist() {
  const telInput = document.getElementById("clWaitlistTel");
  const msg = document.getElementById("clWaitlistMsg");
  const btn = document.getElementById("clWaitlistEnviar");
  if (!telInput || !msg || !btn) return;
  const raw = telInput.value.trim();
  if (!telefonoValido(raw)) {
    msg.style.color = "var(--red)";
    msg.textContent = t("reservar.waitlist.invalid");
    return;
  }
  if (!waitlistHora) return;
  const token = await esperarTokenTurnstile();
  if (!token) {
    msg.style.color = "var(--red)";
    msg.textContent = t("reservar.toast.captcha");
    return;
  }
  setBusy(btn, true, SPIN + t("reservar.waitlist.enviando"));
  try {
    const res = await llamarEdge("lista_espera", {
      p_fecha: sel.fecha,
      p_hora: waitlistHora,
      p_duracion: sel.dur,
      p_telefono: normalizarTelefono(raw),
      turnstile: token,
    });
    if (!res || !res.ok) {
      msg.style.color = "var(--red)";
      msg.textContent = t("reservar.waitlist.error") + textoError(res);
      reiniciarTurnstile();
      return;
    }
    toast(t("reservar.waitlist.saved"));
    cerrarWaitlist();
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(btn, false);
    reiniciarTurnstile();
  }
}

function mostrarPaso2() {
  document.getElementById("cardDatos").hidden = true;
  document.getElementById("cardStep2").hidden = false;
  document.getElementById("cardOk").hidden = true;
  setStep(2);
  const libres = sel.numPistasDisponibles || 1;
  let selectorHtml = "";
  if (libres > 1) {
    const ops = Array.from({ length: libres }, (_, i) => i + 1)
      .map(
        (n) =>
          `<option value="${n}"${n === (sel.numPistas || 1) ? " selected" : ""}>${n}</option>`,
      )
      .join("");
    selectorHtml = `<div class="cl-numpistas">
      <span>${t("reservar.numPistas.label")}</span>
      <select id="clNumPistas">${ops}</select>
    </div>`;
  }
  const total = sel.precio * (sel.numPistas || 1);
  const totalTxt =
    sel.numPistas > 1
      ? `${eur(total)} <small>(${sel.numPistas} × ${eur(sel.precio)})</small>`
      : eur(total);
  document.getElementById("clResumen").innerHTML = `
    <span><i class="ri-calendar-event-line" aria-hidden="true"></i>${esc(fechaWeb(sel.fecha))}</span>
    <span><i class="ri-time-line" aria-hidden="true"></i>${esc(sel.hora)} – ${minToTimeStr(timeToMin(sel.hora) + sel.dur)}</span>
    <span id="clPrecioTotal"><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${totalTxt}</span>
    ${selectorHtml}
  `;
  if (libres > 1) {
    const selEl = document.getElementById("clNumPistas");
    if (selEl)
      selEl.addEventListener("change", () => {
        const n = parseInt(selEl.value, 10) || 1;
        sel.numPistas = n;
        const t2 = sel.precio * n;
        const txt =
          n > 1
            ? `${eur(t2)} <small>(${n} × ${eur(sel.precio)})</small>`
            : eur(t2);
        document.getElementById("clPrecioTotal").innerHTML =
          `<i class="ri-money-euro-circle-line" aria-hidden="true"></i>${txt}`;
      });
  }
  renderBloques();
  document
    .getElementById("cardStep2")
    .scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => {
    if (flujo.fase === "tel") document.getElementById("clTel").focus();
    else if (flujo.fase === "existente")
      document.getElementById("clCodigoEx").focus();
    else if (flujo.fase === "nuevo")
      document.getElementById("clNombre").focus();
  }, 100);
}
function renderBloques() {
  document.getElementById("bloqueTel").hidden = flujo.fase !== "tel";
  document.getElementById("bloqueExistente").hidden =
    flujo.fase !== "existente";
  document.getElementById("bloqueNuevo").hidden = flujo.fase !== "nuevo";
  document.getElementById("bloqueConfirmar").hidden = !(
    flujo.fase === "nuevo" || flujo.fase === "listo"
  );
  document.getElementById("clHola").hidden = flujo.fase !== "listo";
  if (!document.getElementById("bloqueConfirmar").hidden)
    iniciarTurnstile("cfTurnstile");
  if (flujo.fase === "listo") {
    document.getElementById("clHola").innerHTML =
      `<i class="ri-user-line" aria-hidden="true"></i>${t("mis-reservas.hola", { nombre: `<b>${esc(flujo.nombre)}</b>` })}`;
  }
}
function volverPaso1() {
  document.getElementById("cardStep2").hidden = true;
  document.getElementById("cardDatos").hidden = false;
  setStep(1);
  document
    .getElementById("cardDatos")
    .scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => {
    const a = document.querySelector(".cl-day.active");
    if (a) a.focus();
  }, 350);
}
function resetFlujo() {
  flujo.fase = "tel";
  flujo.codigo = "";
  flujo.nombre = "";
  ["clCodigoEx", "clNombre", "clCodigoNew", "clCodigoNew2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const chk = document.getElementById("clConsent");
  if (chk) chk.checked = false;
  renderBloques();
}

async function continuarTelefono() {
  if (!telefonoValido(document.getElementById("clTel").value))
    return toast(t("reservar.toast.phone-invalid"), "warn");
  const tel = normalizarTelefono(document.getElementById("clTel").value);
  const btn = document.getElementById("btnTel");
  setBusy(btn, true, SPIN + t("reservar.checking"));
  try {
    const res = await conReintento(() =>
      llamarEdge("estado", { p_telefono: tel }),
    );
    if (!res || !res.ok) return toast(textoError(res), "warn");
    flujo.tel = tel;
    let emailLocal = "";
    try {
      emailLocal = localStorage.getItem("gp-email-" + tel) || "";
    } catch (e) {}
    flujo.email = emailLocal || "";
    flujo.fase = res.con_codigo ? "existente" : "nuevo";
    renderBloques();
    setTimeout(
      () =>
        document
          .getElementById(res.con_codigo ? "clCodigoEx" : "clNombre")
          .focus(),
      60,
    );
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(btn, false);
  }
}
async function entrarExistente() {
  const cod = document.getElementById("clCodigoEx").value.trim();
  if (!cod) return toast(t("reservar.toast.code-empty"), "warn");
  const btn = document.getElementById("btnEntrar");
  setBusy(btn, true, SPIN + t("reservar.entering"));
  try {
    const res = await conReintento(() =>
      llamarEdge("identificar", { p_ident: flujo.tel, p_codigo: cod }),
    );
    if (!res || !res.ok) {
      toast(textoError(res), res && res.error === "bloqueado" ? "err" : "warn");
      return;
    }
    flujo.codigo = cod;
    flujo.nombre = res.nombre;
    flujo.fase = "listo";
    document.getElementById("clCodigoEx").value = "";
    renderBloques();
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(btn, false);
  }
}
async function confirmarReserva() {
  if (!sel.hora) return toast(t("reservar.toast.choose-hour"), "warn");
  if (!horaReservable(sel.fecha, sel.hora)) {
    toast(textoAntelacion() + t("reservar.antelacion-llama"), "err");
    sel.hora = null;
    document.getElementById("cardStep2").hidden = true;
    setStep(1);
    renderHuecos();
    return;
  }
  let nombre = flujo.nombre;
  let codigo = flujo.codigo;
  if (flujo.fase === "nuevo") {
    nombre = document
      .getElementById("clNombre")
      .value.trim()
      .replace(/\s+/g, " ");
    const c1 = document.getElementById("clCodigoNew").value.trim();
    const c2 = document.getElementById("clCodigoNew2").value.trim();
    if (nombre.split(" ").length < 2)
      return toast(t("reservar.toast.name-required"), "warn");
    if (c1.length < 6) return toast(t("reservar.toast.code-short"), "warn");
    if (c1 !== c2) return toast(t("reservar.toast.code-mismatch"), "warn");
    if (!document.getElementById("clConsent").checked)
      return toast(t("reservar.toast.privacy-required"), "warn");
    codigo = c1;
  }
  if (TURNSTILE_SITEKEY && !ts.token)
    return toast(t("reservar.toast.captcha"), "warn");
  const btn = document.getElementById("btnConfirmar");
  setBusy(btn, true, SPIN + t("reservar.booking"));
  try {
    const res = await llamarEdge("reservar", {
      p_telefono: flujo.tel,
      p_nombre: nombre,
      p_codigo: codigo,
      p_fecha: sel.fecha,
      p_hora: sel.hora,
      p_duracion: sel.dur,
      p_num_pistas: sel.numPistas || 1,
      turnstile: ts.token,
      consentimiento:
        flujo.fase === "nuevo" && document.getElementById("clConsent").checked,
    });
    if (!res || !res.ok) {
      console.error("[reservar] respuesta fallida:", res);
      toast(textoError(res), "err");
      if (
        res &&
        (res.error === "sin_disponibilidad" || res.error === "hora_pasada")
      ) {
        sel.hora = null;
        document.getElementById("cardStep2").hidden = true;
        setStep(1);
        cargarHuecos();
      }
      if (
        res &&
        (res.error === "codigo_incorrecto" ||
          res.error === "bloqueado" ||
          res.error === "cliente_existente")
      ) {
        resetFlujo();
      }
      return;
    }
    const arr =
      res.reservas && res.reservas.length ? res.reservas : [res.reserva];
    flujo.fase = "listo";
    flujo.nombre = arr[0].nombre;
    flujo.codigo = codigo;
    cuenta = { ident: flujo.tel, codigo, nombre: arr[0].nombre };
    if (res.email) flujo.email = res.email;
    mostrarExito(arr);
  } catch (err) {
    const msg = String((err && err.message) || "");
    if (/antelacion_insuficiente/i.test(msg)) {
      toast(textoAntelacion() + t("reservar.antelacion-llama"), "err");
      sel.hora = null;
      document.getElementById("cardStep2").hidden = true;
      setStep(1);
      cargarHuecos();
    } else if (err && err.code === "23P01") {
      toast(textoError({ error: "sin_disponibilidad" }), "err");
      sel.hora = null;
      document.getElementById("cardStep2").hidden = true;
      setStep(1);
      cargarHuecos();
    } else {
      errorRed(err);
    }
  } finally {
    setBusy(btn, false);
    reiniciarTurnstile();
  }
}

function mostrarExito(reservas) {
  const lista = Array.isArray(reservas) ? reservas : [reservas];
  ultimaReserva = lista[0];
  document.getElementById("cardDatos").hidden = true;
  document.getElementById("cardStep2").hidden = true;
  const total = lista.reduce((s, r) => s + (Number(r.precio) || 0), 0);
  const pistasHtml = lista
    .map(
      (r) =>
        `<div><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(r.pista)}</div>`,
    )
    .join("");
  const precioHtml =
    lista.length > 1
      ? `${eur(total)} · ${t("reservar.pago")} <small>(${lista.length} × ${eur(lista[0].precio)})</small>`
      : `${eur(total)} · ${t("reservar.pago")}`;
  document.getElementById("okDetalle").innerHTML = `
    <div><i class="ri-calendar-event-line" aria-hidden="true"></i>${esc(fechaWeb(lista[0].fecha))}</div>
    <div><i class="ri-time-line" aria-hidden="true"></i>${esc(lista[0].hora)} – ${minToTimeStr(timeToMin(lista[0].hora) + lista[0].duracion)} (${esc(duracionTxt(lista[0].duracion))})</div>
    ${pistasHtml}
    <div><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${precioHtml}</div>
    <div><i class="ri-checkbox-circle-line" aria-hidden="true"></i>${t("mis-reservas.confirmada")}</div>
  `;
  const msgEmail = document.getElementById("msgEmail");
  const btnMail = document.getElementById("btnEnviarEmail");
  if (msgEmail) {
    msgEmail.innerText = "";
    msgEmail.style.color = "";
  }
  if (btnMail) {
    btnMail.disabled = false;
    btnMail.innerHTML = `<i class="ri-mail-send-line" aria-hidden="true"></i><span>${t("reservar.enviarEmail")}</span>`;
    btnMail.dataset.enviado = "";
  }
  let emailLocal = "";
  try {
    emailLocal = flujo.tel
      ? localStorage.getItem("gp-email-" + flujo.tel) || ""
      : "";
  } catch (e) {}
  const emailGuardado = (flujo && flujo.email) || emailLocal || "";
  const inputEmail = document.getElementById("clEmail");
  if (inputEmail) {
    inputEmail.value = emailGuardado;
    inputEmail.disabled = false;
  }
  const n = document.getElementById("cardOk");
  n.hidden = false;
  setStep(3);
  n.scrollIntoView({ behavior: "smooth", block: "nearest" });
  sel.hora = null;
  cacheHuecos.t = 0;
  cargarHuecos();
  mostrarResena();
}
function mostrarResena() {
  const bloque = document.getElementById("bloqueResena");
  if (!bloque) return;
  const url =
    typeof GOOGLE_REVIEW_URL !== "undefined" ? String(GOOGLE_REVIEW_URL) : "";
  if (!url || url.includes("REEMPLAZA")) {
    bloque.hidden = true;
    return;
  }
  if (localStorage.getItem("gp-review-dismissed")) {
    bloque.hidden = true;
    return;
  }
  const btn = document.getElementById("btnResenaGoogle");
  if (btn) btn.href = url;
  bloque.hidden = false;
}

async function guardarEmail() {
  const input = document.getElementById("clEmail");
  const msg = document.getElementById("msgEmail");
  const btn = document.getElementById("btnEnviarEmail");
  const email = input.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.style.color = "var(--red)";
    msg.innerText = t("reservar.emailInvalido");
    return;
  }
  if (!flujo.tel || !flujo.codigo) return;
  setBusy(btn, true, SPIN + t("reservar.guardando"));
  try {
    const r = await rpc("gp_guardar_email_cliente", {
      p_ident: flujo.tel,
      p_codigo: flujo.codigo,
      p_email: email,
    });
    if (!r || !r.ok) throw new Error("no_guardado");
    flujo.email = email;
    try {
      localStorage.setItem("gp-email-" + flujo.tel, email);
    } catch (e) {}
    msg.style.color = "var(--green)";
    msg.innerText = t("reservar.emailGuardado");
    btn.dataset.enviado = "1";
    btn.disabled = true;
    btn.innerHTML = `<i class="ri-check-line" aria-hidden="true"></i><span>${t("reservar.emailGuardadoBtn")}</span>`;
    input.disabled = true;
  } catch (err) {
    console.error(err);
    msg.style.color = "var(--red)";
    msg.innerText = t("reservar.emailError");
  } finally {
    if (btn.dataset.enviado !== "1") setBusy(btn, false);
  }
}

async function compartir() {
  if (!ultimaReserva) return;
  const r = ultimaReserva;
  const texto = t("reservar.shareTexto", {
    fecha: fechaWeb(r.fecha),
    hora: r.hora,
    pista: r.pista,
  });
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Geopadel",
        text: texto,
        url: location.origin,
      });
    } catch (e) {}
  } else {
    try {
      await navigator.clipboard.writeText(texto);
      toast(t("reservar.toast.copied"));
    } catch (e) {
      toast(t("reservar.toast.copy-error"), "err");
    }
  }
}
async function suscribirPush() {
  if (!ultimaReserva) return;
  if (!VAPID_PUBLIC_KEY) return;
  const ahora = new Date();
  const [a, m, d] = ultimaReserva.fecha.split("-").map(Number);
  const [hh, mm] = ultimaReserva.hora.split(":").map(Number);
  const inicio = new Date(a, m - 1, d, hh, mm);
  if (inicio.getTime() - ahora.getTime() < 2 * 60 * 60 * 1000)
    return toast(t("reservar.toast.push-soon"), "warn");
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return toast(t("reservar.toast.push-unsupported"), "warn");
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted")
      return toast(t("reservar.toast.push-denied"), "warn");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });
    const res = await llamarEdge("push_suscribir", {
      p_telefono: flujo.tel,
      p_codigo: flujo.codigo,
      endpoint: sub.endpoint,
      auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")))),
      p256dh: btoa(
        String.fromCharCode(...new Uint8Array(sub.getKey("p256dh"))),
      ),
    });
    if (!res || !res.ok) throw new Error((res && res.error) || "no_autorizado");
    toast(t("reservar.toast.push-ok"));
  } catch (err) {
    console.error(err);
    toast(t("reservar.toast.push-error") + (err.message || err), "err");
  }
}

function cambiarPestana(tab) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".app-nav .nav-tab").forEach((el) => {
    el.classList.remove("active");
    el.removeAttribute("aria-current");
  });
  document.getElementById("tab-" + tab).classList.add("active");
  const nav = document.getElementById("nav-" + tab);
  if (nav) {
    nav.classList.add("active");
    nav.setAttribute("aria-current", "page");
  }
  document.title =
    "Geopadel · " +
    (tab === "mis" ? t("mis-reservas.titulo") : t("reservar.titulo"));
  window.scrollTo({ top: 0 });
  if (tab === "reservar" && sel.fecha) cargarHuecos();
  if (tab === "mis" && cuenta) cargarMisReservas(cuenta.ident, cuenta.codigo);
}

function mostrarMis(logged) {
  document.getElementById("cardMisLogin").hidden = logged;
  document.getElementById("cardMisLista").hidden = !logged;
}
function resetMisLogin() {
  mis.tel = "";
  mis.codigo = "";
  mis.nombre = "";
  ["misTel", "misCodigo", "misNombre", "misCodigoNew", "misCodigoNew2"].forEach(
    (id) => {
      const e = document.getElementById(id);
      if (e) e.value = "";
    },
  );
  if (document.getElementById("misConsent"))
    document.getElementById("misConsent").checked = false;
  document.getElementById("misBloqueTel").hidden = false;
  document.getElementById("misBloqueExistente").hidden = true;
  document.getElementById("misBloqueNuevo").hidden = true;
  const msg = document.getElementById("msgMis");
  msg.innerText = "";
  msg.className = "msg-inline";
  setTimeout(() => document.getElementById("misTel").focus(), 100);
}
function mostrarBloqueMis(bloque) {
  document.getElementById("misBloqueTel").hidden = bloque !== "tel";
  document.getElementById("misBloqueExistente").hidden = bloque !== "existente";
  document.getElementById("misBloqueNuevo").hidden = bloque !== "nuevo";
  setTimeout(() => {
    if (bloque === "tel") document.getElementById("misTel").focus();
    else if (bloque === "existente")
      document.getElementById("misCodigo").focus();
    else if (bloque === "nuevo") document.getElementById("misNombre").focus();
  }, 80);
}
async function misContinuarTelefono() {
  if (!telefonoValido(document.getElementById("misTel").value))
    return toast(t("reservar.toast.phone-invalid"), "warn");
  const tel = normalizarTelefono(document.getElementById("misTel").value);
  const btn = document.getElementById("misBtnTel");
  setBusy(btn, true, SPIN + t("reservar.checking"));
  try {
    const r = await conReintento(() =>
      llamarEdge("estado", { p_telefono: tel }),
    );
    if (!r || !r.ok) return toast(textoError(r), "warn");
    mis.tel = tel;
    mostrarBloqueMis(r.con_codigo ? "existente" : "nuevo");
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(btn, false);
  }
}
async function misEntrarExistente() {
  const cod = document.getElementById("misCodigo").value.trim();
  if (!cod) return toast(t("reservar.toast.code-empty"), "warn");
  await cargarMisReservas(mis.tel, cod);
}
async function misCrearCuenta() {
  const nombre = document
    .getElementById("misNombre")
    .value.trim()
    .replace(/\s+/g, " ");
  const c1 = document.getElementById("misCodigoNew").value.trim();
  const c2 = document.getElementById("misCodigoNew2").value.trim();
  if (nombre.split(" ").length < 2)
    return toast(t("reservar.toast.name-required"), "warn");
  if (c1.length < 6) return toast(t("reservar.toast.code-short"), "warn");
  if (c1 !== c2) return toast(t("reservar.toast.code-mismatch"), "warn");
  if (!document.getElementById("misConsent").checked)
    return toast(t("reservar.toast.privacy-required"), "warn");
  const btn = document.getElementById("misBtnCrear");
  setBusy(btn, true, SPIN + t("reservar.creandoCuenta"));
  try {
    const r = await llamarEdge("crear_cuenta", {
      p_telefono: mis.tel,
      p_nombre: nombre,
      p_codigo: c1,
    });
    if (!r || !r.ok) {
      toast(textoError(r), "err");
      return;
    }
    toast(t("reservar.cuentaCreada"));
    await cargarMisReservas(mis.tel, c1);
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(btn, false);
  }
}
function agruparReservas(lista) {
  const out = [];
  const seen = {};
  lista.forEach((r) => {
    if (r.serie) {
      if (!seen[r.serie]) {
        seen[r.serie] = {
          ...r,
          ids: [r.id],
          fechas: [r.fecha],
          repeticion: true,
        };
        out.push(seen[r.serie]);
      } else {
        seen[r.serie].ids.push(r.id);
        seen[r.serie].fechas.push(r.fecha);
      }
    } else {
      out.push({ ...r, ids: [r.id], fechas: [r.fecha], repeticion: false });
    }
  });
  return out;
}
function dibujarMisReservas(data) {
  document.getElementById("misHola").innerHTML = t("mis-reservas.hola", {
    nombre: `<b>${esc(data.nombre)}</b>`,
  });
  const lista = data.reservas || [];
  const grupos = agruparReservas(lista);
  document.getElementById("misLista").innerHTML = grupos.length
    ? grupos
        .map((g) => {
          const fin = minToTimeStr(timeToMin(g.hora) + g.duracion);
          const tipoChip =
            g.tipo && g.tipo !== "Normal"
              ? `<span class="chip">${esc(g.tipo === "Pena" ? "Peña" : g.tipo)}</span>`
              : "";
          const entidad =
            g.nombre_entidad || (g.cliente && g.cliente !== data.nombre);
          const entidadChip = entidad
            ? `<span class="chip" style="background:var(--amber-soft);color:var(--orange-text);border-color:var(--amber)"><i class="ri-group-line" aria-hidden="true"></i>${esc(g.nombre_entidad || g.cliente)}</span>`
            : "";
          const confirmada = `<span class="badge-confirmada"><i class="ri-check-line" aria-hidden="true"></i>${t("mis-reservas.confirmada")}</span>`;
          let fechaTxt = esc(fechaWeb(g.fecha));
          let acciones = "";
          if (g.repeticion) {
            const fechas = g.fechas || [];
            const ids = g.ids || [];
            const hoy = fechaLocalISO();
            let idx = -1;
            for (let i = 0; i < fechas.length; i++) {
              if (fechas[i] >= hoy && (idx < 0 || fechas[i] < fechas[idx]))
                idx = i;
            }
            const repetir = `<button type="button" class="btn-add gray" data-repetir="${esc(g.id)}" data-fecha="${esc(g.fecha)}" data-hora="${esc(g.hora)}" data-dur="${esc(g.duracion)}"><i class="ri-repeat-line" aria-hidden="true"></i>${t("mis-reservas.repetir")}</button>`;
            fechaTxt = `<span style="display:inline-flex;align-items:center;gap:4px"><i class="ri-repeat-line" style="color:var(--primary)"></i> ${t("mis-reservas.todos")} ${fechas.length} semanas</span>`;
            acciones =
              idx >= 0
                ? `<div class="cl-res-acciones"><button type="button" class="btn-add danger" data-cancelar="${esc(ids[idx])}"><i class="ri-delete-bin-line" aria-hidden="true"></i>${t("mis-reservas.cancelar")} (${esc(fechaWeb(fechas[idx]))})</button>${repetir}</div><p class="cl-hint">${t("mis-reservas.recurrente", { n: fechas.length })}</p>`
                : `<div class="cl-res-acciones">${repetir}</div><p class="cl-hint">${t("mis-reservas.recurrente", { n: fechas.length })}</p>`;
          } else {
            const repetir = `<button type="button" class="btn-add gray" data-repetir="${esc(g.id)}" data-fecha="${esc(g.fecha)}" data-hora="${esc(g.hora)}" data-dur="${esc(g.duracion)}"><i class="ri-repeat-line" aria-hidden="true"></i>${t("mis-reservas.repetir")}</button>`;
            acciones = g.motivo
              ? `<div class="cl-res-acciones"><p class="cl-hint">${esc(motivoTexto(g.motivo))}</p>${repetir}</div>`
              : `<div class="cl-res-acciones"><button type="button" class="btn-add danger" data-cancelar="${esc(g.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>${t("mis-reservas.cancelar")}</button>${repetir}</div>`;
          }
          return `<article class="cl-res"><div class="cl-res-top"><b>${fechaTxt}</b><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${entidadChip} ${tipoChip} ${confirmada}</div></div><div class="cl-res-info"><span><i class="ri-time-line" aria-hidden="true"></i>${esc(g.hora)} – ${fin}</span><span><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(g.pista)}</span><span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(g.precio)}</span></div>${acciones}</article>`;
        })
        .join("")
    : `<p class="cl-empty">${t("mis-reservas.vacio")}</p>`;
}
async function cargarMisReservas(ident, codigo) {
  const btn = document.getElementById("misBtnEntrar");
  const msg = document.getElementById("msgMis");
  setBusy(btn, true, SPIN + t("mis-reservas.cargando"));
  msg.innerText = "";
  msg.className = "msg-inline";
  try {
    const res = await conReintento(() =>
      llamarEdge("mis_reservas", { p_ident: ident, p_codigo: codigo }),
    );
    if (!res || !res.ok) {
      cuenta = null;
      msg.className = "msg-inline msg-error";
      msg.innerText = textoError(res);
      return;
    }
    cuenta = { ident, codigo, nombre: res.nombre };
    document.getElementById("misCodigo").value = "";
    dibujarMisReservas(res);
    mostrarMis(true);
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(btn, false);
  }
}
async function repetirReserva(btn) {
  if (!cuenta) return;
  flujo.tel = cuenta.ident;
  flujo.codigo = cuenta.codigo;
  flujo.nombre = cuenta.nombre;
  flujo.fase = "listo";
  sel.dur = parseInt(btn.dataset.dur, 10) || 90;
  if (!cfg.duraciones.includes(sel.dur)) sel.dur = cfg.duraciones[0];
  renderDuraciones();
  cambiarPestana("reservar");
  const hoy = fechaLocalISO();
  let f = sumarDiasISO(btn.dataset.fecha, 7);
  while (f < hoy) f = sumarDiasISO(f, 7);
  const r = await seleccionarDia(f, true);
  const hora = btn.dataset.hora;
  const existe = (r || []).some(
    (s) => s.hora === hora && (s.opciones || []).some((o) => o.dur === sel.dur),
  );
  if (existe) {
    sel.hora = hora;
    const op = (r.find((s) => s.hora === hora).opciones || []).find(
      (o) => o.dur === sel.dur,
    );
    sel.precio = Number((op && op.precio) || 0);
    renderHuecos();
    mostrarPaso2();
  } else {
    toast(t("reservar.toast.noSlotNextWeek"), "warn");
    renderHuecos();
  }
}

function refrescarHuecosSiToca() {
  if (document.hidden) return;
  if (!sel.fecha) return;
  if (!document.getElementById("tab-reservar").classList.contains("active"))
    return;
  const caducada =
    cacheHuecos.fecha !== sel.fecha || Date.now() - cacheHuecos.t >= TTL_HUECOS;
  if (caducada) cargarHuecos();
  else renderHuecos();
}

document.querySelectorAll(".app-nav .nav-tab").forEach((el) =>
  el.addEventListener("click", () => {
    if (el.dataset.tab) cambiarPestana(el.dataset.tab);
  }),
);

document.getElementById("clDias").addEventListener("click", (e) => {
  const btn = e.target.closest(".cl-day");
  if (btn) seleccionarDia(btn.dataset.fecha);
});
document.getElementById("clDur").addEventListener("click", (e) => {
  const btn = e.target.closest(".cl-dur");
  if (!btn) return;
  const dur = parseInt(btn.dataset.dur, 10);
  if (sel.hora && sel.dur !== dur)
    toast(t("reservar.toast.dur-updated"), "warn");
  sel.dur = dur;
  sel.hora = null;
  document.getElementById("cardStep2").hidden = true;
  setStep(1);
  renderDuraciones();
  renderHuecos();
});
document.getElementById("btnRefrescarHuecos").addEventListener("click", () => {
  cacheHuecos.t = 0;
  cargarHuecos();
});
document.getElementById("clSlots").addEventListener("click", (e) => {
  if (e.target.closest("[data-reintentar]")) {
    cacheHuecos.t = 0;
    cargarHuecos();
    return;
  }
  const espera = e.target.closest("[data-espera-hora]");
  if (espera) {
    abrirWaitlist(espera.dataset.esperaHora);
    return;
  }
  const slot = e.target.closest(".cl-slot[data-hora]");
  if (!slot) return;
  sel.hora = slot.dataset.hora;
  sel.precio = Number(slot.dataset.precio) || 0;
  sel.numPistasDisponibles = Number(slot.dataset.libres) || 1;
  sel.numPistas = 1;
  renderHuecos();
  mostrarPaso2();
});

document
  .getElementById("btnVolverPaso1")
  .addEventListener("click", volverPaso1);
document.getElementById("btnTel").addEventListener("click", continuarTelefono);
document.getElementById("btnEntrar").addEventListener("click", entrarExistente);
document
  .getElementById("btnConfirmar")
  .addEventListener("click", confirmarReserva);
document.getElementById("cardStep2").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  e.preventDefault();
  const btn = ["btnTel", "btnEntrar", "btnConfirmar"]
    .map((id) => document.getElementById(id))
    .find((el) => el && el.offsetParent !== null);
  if (btn) btn.click();
});

document.getElementById("clTel").addEventListener("input", () => {
  if (flujo.fase !== "tel") resetFlujo();
  const raw = document.getElementById("clTel").value.trim();
  const btn = document.getElementById("btnTel");
  const hint = document.getElementById("telHint");
  if (!raw) {
    btn.disabled = false;
    document.getElementById("clTel").removeAttribute("aria-invalid");
    if (hint) hint.textContent = "";
    return;
  }
  const ok = telefonoValido(raw);
  btn.disabled = !ok;
  document
    .getElementById("clTel")
    .setAttribute("aria-invalid", ok ? "false" : "true");
  if (hint) {
    hint.textContent = ok
      ? t("reservar.valid-phone")
      : t("reservar.invalid-phone");
    hint.style.color = ok ? "var(--green)" : "var(--red)";
  }
});
document.getElementById("clNombre").addEventListener("blur", () => {
  const v = document.getElementById("clNombre").value;
  if (v.trim()) document.getElementById("clNombre").value = normalizarNombre(v);
});

document.getElementById("btnShare").addEventListener("click", compartir);
document.getElementById("btnOtra").addEventListener("click", () => {
  document.getElementById("cardOk").hidden = true;
  resetFlujo();
  seleccionarDia(sel.fecha || fechaLocalISO());
  window.scrollTo({ top: 0, behavior: "smooth" });
});
document.getElementById("btnVerMis").addEventListener("click", () => {
  resetFlujo();
  cambiarPestana("mis");
});
document
  .getElementById("btnEnviarEmail")
  .addEventListener("click", guardarEmail);
document.getElementById("btnPush").addEventListener("click", suscribirPush);
if (document.getElementById("btnResenaGoogle")) {
  document.getElementById("btnResenaGoogle").addEventListener("click", () => {
    try {
      localStorage.setItem("gp-review-dismissed", "1");
    } catch (e) {}
    const b = document.getElementById("bloqueResena");
    if (b) b.hidden = true;
  });
}
if (document.getElementById("btnResenaCerrar")) {
  document.getElementById("btnResenaCerrar").addEventListener("click", () => {
    try {
      localStorage.setItem("gp-review-dismissed", "1");
    } catch (e) {}
    const b = document.getElementById("bloqueResena");
    if (b) b.hidden = true;
  });
}

document
  .getElementById("misBtnTel")
  .addEventListener("click", misContinuarTelefono);
document.getElementById("misTel").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    misContinuarTelefono();
  }
});
document
  .getElementById("misBtnEntrar")
  .addEventListener("click", misEntrarExistente);
document.getElementById("misCodigo").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    misEntrarExistente();
  }
});
document
  .getElementById("misBtnCrear")
  .addEventListener("click", misCrearCuenta);
document
  .getElementById("misBtnCambiarTel")
  .addEventListener("click", resetMisLogin);
document
  .getElementById("misBtnCambiarTel2")
  .addEventListener("click", resetMisLogin);
document.getElementById("btnSalirMis").addEventListener("click", () => {
  cuenta = null;
  resetMisLogin();
  mostrarMis(false);
});
document
  .getElementById("btnBorrarDatos")
  .addEventListener("click", async () => {
    if (!cuenta) return;
    if (!(await customConfirm(t("mis-reservas.borrar-confirm")))) return;
    const btn = document.getElementById("btnBorrarDatos");
    setBusy(btn, true, SPIN + t("mis-reservas.borrando"));
    try {
      const res = await llamarEdge("borrar", {
        p_ident: cuenta.ident,
        p_codigo: cuenta.codigo,
      });
      if (!res || !res.ok) {
        toast(textoError(res), "err");
        return;
      }
      cuenta = null;
      resetMisLogin();
      mostrarMis(false);
      toast(t("mis-reservas.toast.deleted"));
    } catch (e) {
      errorRed(e);
    } finally {
      setBusy(btn, false);
    }
  });
document.getElementById("misLista").addEventListener("click", async (e) => {
  const rep = e.target.closest("button[data-repetir]");
  if (rep && cuenta) {
    repetirReserva(rep);
    return;
  }
  const canc = e.target.closest("button[data-cancelar]");
  if (!canc || !cuenta) return;
  if (!(await customConfirm(t("mis-reservas.cancel-confirm")))) return;
  setBusy(canc, true, SPIN + t("mis-reservas.cancelando"));
  try {
    const res = await llamarEdge("cancelar", {
      p_ident: cuenta.ident,
      p_codigo: cuenta.codigo,
      p_reserva_id: canc.dataset.cancelar,
    });
    if (!res || !res.ok) {
      toast(textoError(res), "err");
      setBusy(canc, false);
      return;
    }
    toast(t("mis-reservas.toast.cancelled"));
    await cargarMisReservas(cuenta.ident, cuenta.codigo);
  } catch (err) {
    errorRed(err);
    setBusy(canc, false);
  }
});

setInterval(refrescarHuecosSiToca, 6e4);
window.addEventListener("online", () => {
  estadoRed();
  refrescarHuecosSiToca();
});
window.addEventListener("offline", estadoRed);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && navigator.onLine) refrescarHuecosSiToca();
});

function actualizarIntroReserva() {
  const el = document.getElementById("txtIntroReserva");
  if (el)
    el.textContent = t("reservar.subtitulo-completo", {
      min: duracionTxt(antMin()),
    });
}
document.addEventListener("idioma-cambiado", () => {
  actualizarIntroReserva();
  renderDiasScroll();
  marcarDiaActivo();
  renderDuraciones();
  renderHuecos();
  if (waitlistHora) {
    const telPrev = document.getElementById("clWaitlistTel");
    const valorTel = telPrev ? telPrev.value : "";
    abrirWaitlist(waitlistHora);
    const telNuevo = document.getElementById("clWaitlistTel");
    if (telNuevo && valorTel) telNuevo.value = valorTel;
  }
  if (cuenta) cargarMisReservas(cuenta.ident, cuenta.codigo);
});
let promptInstalacion = null;
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const yaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
const mostrarInstalar = (v) =>
  document.getElementById("btnInstalar").classList.toggle("visible", v);
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  promptInstalacion = e;
  mostrarInstalar(true);
});
window.addEventListener("appinstalled", () => {
  promptInstalacion = null;
  mostrarInstalar(false);
});
document.getElementById("btnInstalar").addEventListener("click", async () => {
  if (!promptInstalacion) {
    toast(t("app.install-ios"), "ok", 7000);
    return;
  }
  promptInstalacion.prompt();
  await promptInstalacion.userChoice;
  promptInstalacion = null;
  mostrarInstalar(false);
});
if (esIOS && !yaInstalada()) mostrarInstalar(true);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .catch(() => {}),
  );

window.addEventListener("DOMContentLoaded", async () => {
  iniciarTema();
  document.getElementById("btnTema").addEventListener("click", alternarTema);
  estadoRed();
  if (!VAPID_PUBLIC_KEY) {
    const b = document.getElementById("btnPush");
    if (b) b.hidden = true;
  }
  let cache = null;
  try {
    cache = JSON.parse(localStorage.getItem("gp_web_config"));
  } catch (e) {}
  if (cache && Date.now() - cache.t < 36e5) {
    cfg = { ...cfg, ...cache.data };
  } else {
    try {
      const data = await rpc("web_config");
      if (data && Array.isArray(data.duraciones)) {
        cfg = { ...cfg, ...data };
        localStorage.setItem(
          "gp_web_config",
          JSON.stringify({ t: Date.now(), data }),
        );
      }
    } catch (e) {
      console.error(e);
    }
  }
  if (!cfg.duraciones.includes(sel.dur)) sel.dur = cfg.duraciones[0];
  actualizarIntroReserva();
  const params = new URLSearchParams(window.location.search);
  const paramFecha = params.get("fecha");
  const paramHora = params.get("hora");
  const paramDur = parseInt(params.get("dur"), 10);
  if (Number.isFinite(paramDur) && cfg.duraciones.includes(paramDur))
    sel.dur = paramDur;
  let fechaIni = fechaLocalISO();
  if (
    paramFecha &&
    paramFecha >= fechaLocalISO() &&
    paramFecha <= sumarDiasISO(fechaLocalISO(), cfg.dias_max)
  ) {
    fechaIni = paramFecha;
  }
  sel.fecha = fechaIni;
  renderDiasScroll();
  marcarDiaActivo();
  renderDuraciones();
  await seleccionarDia(fechaIni, true);
  if (paramHora) {
    const slot = Array.from(document.querySelectorAll(".cl-slot")).find(
      (b) => b.dataset.hora === paramHora,
    );
    if (slot) slot.click();
  }
  if (!cuenta) resetMisLogin();
});
