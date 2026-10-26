/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const sb =
  window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: !1,
          autoRefreshToken: !1,
          detectSessionInUrl: !1,
        },
      })
    : null;
const SPIN = '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>';
let cfg = {
  dias_max: 30,
  cancelar_horas: 24,
  max_futuras: 4,
  duraciones: [60, 90, 120],
  anticipacion_min: 120,
};
const sel = { fecha: null, dur: 90, hora: null, precio: 0 },
  flujo = { fase: "tel", tel: "", codigo: "", nombre: "" };
let cuenta = null,
  slotsDia = [],
  reqHuecos = 0,
  cacheHuecos = { fecha: null, t: 0, data: null };
const TTL_HUECOS = 3e4;
function fechaDesdeISO(e) {
  const [t, n, r] = e.split("-").map(Number);
  return new Date(t, n - 1, r, 12);
}
const fechaWeb = (e) => fechaBonita(e, !0),
  idioma = () =>
    typeof _idioma !== "undefined" && _idioma === "en" ? "en-GB" : "es-ES";
function minutos(e) {
  const [t, n] = String(e).split(":").map(Number);
  return (t || 0) * 60 + (n || 0);
}
function horaStr(e) {
  return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
}
function duracionTxt(e) {
  const t = Math.floor(e / 60),
    n = e % 60;
  return t ? (n ? `${t} h ${n} min` : `${t} h`) : `${n} min`;
}
async function llamarEdge(e, t) {
  const n = await fetch(SUPABASE_URL + "/functions/v1/reservar-web", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ accion: e, ...t }),
  });
  let r = null;
  try {
    r = await n.json();
  } catch (e) {}
  if (!r) throw new Error("Respuesta no válida (" + n.status + ")");
  if (r.error === "db") {
    const e = new Error(r.message || "Error de base de datos");
    e.code = r.code;
    throw e;
  }
  return r;
}
let tsId = null,
  tsToken = "";
function iniciarTurnstile() {
  if (!TURNSTILE_SITEKEY || tsId !== null) return;
  const e = $("cfTurnstile");
  e.hidden = !1;
  const t = () => {
    if (tsId !== null || !window.turnstile) return;
    tsId = window.turnstile.render("#cfTurnstile", {
      sitekey: TURNSTILE_SITEKEY,
      callback: (e) => {
        tsToken = e;
      },
      "expired-callback": () => {
        tsToken = "";
      },
      "error-callback": () => {
        tsToken = "";
      },
    });
  };
  if (window.turnstile) t();
  else {
    const e = document.createElement("script");
    e.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    e.async = !0;
    e.onload = t;
    document.head.appendChild(e);
  }
}
function reiniciarTurnstile() {
  tsToken = "";
  if (window.turnstile && tsId !== null)
    try {
      window.turnstile.reset(tsId);
    } catch (e) {}
}
const RPC_LECTURA = ["web_config", "web_disponibilidad"];
async function rpc(e, t) {
  if (!sb) throw new Error("Sin conexión");
  const n = () => sb.rpc(e, t || {}),
    { data: r, error: i } = RPC_LECTURA.includes(e)
      ? await conReintento(n)
      : await n();
  if (i) throw i;
  return r;
}
function errorRed(e) {
  console.error(e);
  toast(t("reservar.toast.connection"), "err");
}
function motivoTexto(e) {
  if (_idioma === "en") {
    if (e === "plazo")
      return `Can only be cancelled ${cfg.cancelar_horas} h in advance. Call the club.`;
    if (e === "tipo")
      return "This booking can only be changed by calling the club.";
    if (e === "pagada")
      return "It has registered payments. Call the club to change it.";
    return "Call the club to change it.";
  }
  if (e === "plazo")
    return `Solo se puede cancelar con ${cfg.cancelar_horas} h de antelación. Llama al club.`;
  if (e === "tipo")
    return "Esta reserva solo se puede cambiar llamando al club.";
  if (e === "pagada")
    return "Tiene pagos registrados. Llama al club para cambiarla.";
  return "Llama al club para cambiarla.";
}
function textoError(e) {
  const n = e && e.error;
  switch (n) {
    case "fecha_invalida":
      return _idioma === "en"
        ? "That day is not available."
        : "Ese día no está disponible.";
    case "hora_invalida":
      return _idioma === "en"
        ? "That time is not available."
        : "Esa hora no está disponible.";
    case "hora_pasada":
      return _idioma === "en"
        ? "That time can no longer be booked."
        : "Esa hora ya no se puede reservar.";
    case "duracion_invalida":
      return _idioma === "en"
        ? "Invalid duration."
        : "La duración no es válida.";
    case "telefono_invalido":
      return _idioma === "en"
        ? "Check the phone number."
        : "Revisa el teléfono.";
    case "nombre_invalido":
      return _idioma === "en"
        ? "Enter your full name."
        : "Escribe tu nombre y apellidos.";
    case "codigo_formato":
      return _idioma === "en"
        ? "The code must be 4-30 characters."
        : "El código debe tener entre 4 y 30 caracteres.";
    case "codigo_incorrecto":
      return _idioma === "en"
        ? e.restantes === 1
          ? "Incorrect code. 1 attempt left."
          : `Incorrect code. ${e.restantes} attempts left.`
        : e.restantes === 1
          ? "Código incorrecto. Te queda 1 intento."
          : `Código incorrecto. Te quedan ${e.restantes} intentos.`;
    case "bloqueado": {
      const t = Math.max(1, Math.ceil((e.segundos || 0) / 60));
      return _idioma === "en"
        ? `Too many attempts. Try again in ${t} min.`
        : `Demasiados intentos. Inténtalo en ${t} min.`;
    }
    case "sin_disponibilidad":
      return _idioma === "en"
        ? "That slot was just taken."
        : "Ese hueco se acaba de ocupar.";
    case "limite_reservas":
      return _idioma === "en"
        ? `You already have ${e.max} pending bookings.`
        : `Ya tienes ${e.max} reservas pendientes.`;
    case "no_encontrada":
      return _idioma === "en"
        ? "Booking not found."
        : "No se ha encontrado la reserva.";
    case "ambiguo":
      return _idioma === "en"
        ? "Several clients share that name."
        : "Hay varios clientes con ese nombre.";
    case "faltan_datos":
      return _idioma === "en"
        ? "Fill in all fields."
        : "Rellena todos los campos.";
    case "captcha":
      return _idioma === "en"
        ? "Verify you are human."
        : "Verifica que eres humano.";
    case "demasiadas_solicitudes":
      return _idioma === "en" ? "Too many attempts." : "Demasiados intentos.";
    case "consentimiento":
      return _idioma === "en"
        ? "Accept privacy policy."
        : "Acepta la privacidad.";
    case "cliente_existente":
      return _idioma === "en"
        ? "Client already exists. Call club."
        : "Ya hay un cliente con esos datos. Llama al club.";
    case "deuda_pendiente":
      return _idioma === "en"
        ? "Pending payment. Call club."
        : "Tienes un pago pendiente. Llama al club.";
    case "no_cancelable":
      return motivoTexto(e.motivo);
    default:
      return _idioma === "en" ? "Action failed." : "No se pudo completar.";
  }
}
function cambiarPestana(e) {
  document
    .querySelectorAll(".tab-content")
    .forEach((e) => e.classList.remove("active"));
  document.querySelectorAll(".app-nav .nav-tab").forEach((e) => {
    e.classList.remove("active");
    e.removeAttribute("aria-current");
  });
  $("tab-" + e).classList.add("active");
  const t = $("nav-" + e);
  if (t) {
    t.classList.add("active");
    t.setAttribute("aria-current", "page");
  }
  document.title =
    "Geopadel · " + (e === "mis" ? "Mis reservas" : "Reserva tu pista");
  window.scrollTo({ top: 0 });
  if (e === "reservar" && sel.fecha) cargarHuecos();
  if (e === "mis" && cuenta) cargarMisReservas(cuenta.ident, cuenta.codigo);
}
document.querySelectorAll(".app-nav .nav-tab").forEach((e) =>
  e.addEventListener("click", () => {
    if (e.dataset.tab) cambiarPestana(e.dataset.tab);
  }),
);
function dibujarDias() {
  const e = fechaLocalISO();
  let n = "";
  for (let r = 0; r <= cfg.dias_max; r++) {
    const i = sumarDiasISO(e, r),
      a = fechaDesdeISO(i),
      o =
        r === 0
          ? t("reservar.hoy") ||
            a
              .toLocaleDateString(idioma(), { weekday: "short" })
              .replace(".", "")
          : a
              .toLocaleDateString(idioma(), { weekday: "short" })
              .replace(".", ""),
      s = a.toLocaleDateString(idioma(), { month: "short" }).replace(".", "");
    n += `<button type="button" class="cl-day" data-fecha="${i}" aria-pressed="false"><small>${esc(o)}</small><b>${a.getDate()}</b><small>${esc(s)}</small></button>`;
  }
  $("clDias").innerHTML = n;
}
function durationsViableForDay() {
  const e = duracionesPermitidasFecha(sel.fecha);
  if (!slotsDia || !slotsDia.length) return e;
  const t = e.filter((e) =>
    slotsDia.some(
      (t) =>
        (t.opciones || []).some((t) => t.dur === e) &&
        horarioPermitidoReserva(sel.fecha, minutos(t.hora), e),
    ),
  );
  return t.length ? t : e;
}
function dibujarDuraciones() {
  const e = sel.fecha || fechaLocalISO(),
    n = durationsViableForDay();
  if (!n.includes(sel.dur)) {
    sel.dur = n[0];
    sel.hora = null;
    $("cardDatos").hidden = !0;
  }
  $("clDur").innerHTML = n
    .map(
      (e) =>
        `<button type="button" class="cl-dur${e === sel.dur ? " active" : ""}" data-dur="${e}" aria-pressed="${e === sel.dur}">${esc(duracionTxt(e))}</button>`,
    )
    .join("");
  let r = $("clDurHint");
  if (!r) {
    r = document.createElement("p");
    r.id = "clDurHint";
    r.className = "cl-hint";
    $("clDur").after(r);
  }
  r.innerHTML = t("reservar.two-hours");
}
async function seleccionarDia(e, t = !1) {
  if (!t) resetFlujo();
  $("cardOk").hidden = !0;
  if (sel.fecha !== e) slotsDia = [];
  sel.fecha = e;
  sel.hora = null;
  dibujarDuraciones();
  document.querySelectorAll(".cl-day").forEach((t) => {
    const n = t.dataset.fecha === e;
    t.classList.toggle("active", n);
    t.setAttribute("aria-pressed", n);
    if (n)
      t.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
  });
  $("cardDatos").hidden = !0;
  const n = sel.dur,
    r = await cargarHuecos();
  dibujarDuraciones();
  if (sel.dur !== n) dibujarHuecos();
  return r;
}
$("clDias").addEventListener("click", (e) => {
  const t = e.target.closest(".cl-day");
  if (t) seleccionarDia(t.dataset.fecha);
});
$("clDur").addEventListener("click", (e) => {
  const n = e.target.closest(".cl-dur");
  if (!n) return;
  const r = parseInt(n.dataset.dur, 10);
  if (sel.hora && sel.dur !== r) toast(t("reservar.toast.dur-updated"), "warn");
  sel.dur = r;
  sel.hora = null;
  $("cardDatos").hidden = !0;
  dibujarDuraciones();
  dibujarHuecos();
});
const antMin = () =>
  Number.isFinite(Number(cfg.anticipacion_min))
    ? Number(cfg.anticipacion_min)
    : 120;
function horaReservable(e, t) {
  const [n, r, i] = e.split("-").map(Number),
    a = minutos(t),
    o = new Date(n, r - 1, i, Math.floor(a / 60), a % 60);
  return o.getTime() - Date.now() >= antMin() * 6e4;
}
function textoAntelacion() {
  return t("reservar.antelacion", { min: duracionTxt(antMin()) });
}
async function cargarHuecos() {
  const e = $("clSlots"),
    n = sel.fecha,
    r = ++reqHuecos;
  if (cacheHuecos.fecha === n && Date.now() - cacheHuecos.t < TTL_HUECOS) {
    slotsDia = cacheHuecos.data;
    dibujarHuecos();
    return slotsDia;
  }
  e.innerHTML = `<p class="cl-empty">${t("reservar.searching")}</p>`;
  try {
    const i = await rpc("web_disponibilidad", { p_fecha: n });
    if (r !== reqHuecos) return slotsDia;
    if (!i || !i.ok) {
      slotsDia = [];
      e.innerHTML = `<p class="cl-empty">${t("reservar.error")} <button type="button" class="cl-link" id="btnReintentar">${t("reservar.reintentar")}</button></p>`;
      return slotsDia;
    }
    slotsDia = i.slots || [];
    cacheHuecos = { fecha: n, t: Date.now(), data: slotsDia };
    dibujarHuecos();
    return slotsDia;
  } catch (i) {
    if (r !== reqHuecos) return slotsDia;
    console.error(i);
    e.innerHTML = `<p class="cl-empty">${t("reservar.error")} <button type="button" class="cl-link" id="btnReintentar">${t("reservar.reintentar")}</button></p>`;
    return slotsDia;
  }
}
function dibujarHuecos() {
  const e = $("clSlots"),
    n = slotsDia
      .map((e) => ({
        hora: e.hora,
        iniMin: minutos(e.hora),
        op: (e.opciones || []).find((t) => t.dur === sel.dur),
      }))
      .filter(
        (e) => e.op && horarioPermitidoReserva(sel.fecha, e.iniMin, sel.dur),
      ),
    r = n.filter((e) => horaReservable(sel.fecha, e.hora));
  if (sel.hora && !r.some((e) => e.hora === sel.hora)) {
    sel.hora = null;
    $("cardDatos").hidden = !0;
  }
  if (!r.length) {
    e.innerHTML = n.length
      ? `<p class="cl-empty">${t("reservar.antelacion", { min: duracionTxt(antMin()) })}${t("reservar.antelacion-llama")}</p>`
      : `<p class="cl-empty">${t("reservar.no-huecos", { dur: duracionTxt(sel.dur) })}</p><button type="button" class="cl-link" id="btnEspera" style="margin-top:8px">${t("reservar.waitlist.cta")}</button>`;
    return;
  }
  e.innerHTML = r
    .map(
      (e) =>
        `<button type="button" class="cl-slot${e.hora === sel.hora ? " active" : ""}" data-hora="${esc(e.hora)}" data-precio="${esc(e.op.precio)}" aria-pressed="${e.hora === sel.hora}">${esc(e.hora)}<span>${eur(e.op.precio)}</span></button>`,
    )
    .join("");
}
$("clSlots").addEventListener("click", async (ev) => {
  if (ev.target.closest("#btnReintentar")) {
    cacheHuecos.t = 0;
    cargarHuecos();
    return;
  }
  if (ev.target.closest("#btnEspera")) {
    const telInput = await customPrompt(
      t("reservar.waitlist.prompt"),
      "",
      t("reservar.waitlist.title"),
    );
    if (telInput === null) return;
    if (!telInput || !telefonoValido(telInput))
      return toast(t("reservar.waitlist.invalid"), "warn");
    try {
      const res = await llamarEdge("lista_espera", {
        p_fecha: sel.fecha,
        p_duracion: sel.dur,
        p_telefono: normalizarTelefono(telInput),
      });
      if (!res || !res.ok)
        return toast(t("reservar.waitlist.error") + textoError(res), "err");
      toast(t("reservar.waitlist.saved"));
    } catch (err) {
      errorRed(err);
    }
    return;
  }
  const slot = ev.target.closest(".cl-slot");
  if (!slot) return;
  sel.hora = slot.dataset.hora;
  sel.precio = Number(slot.dataset.precio) || 0;
  dibujarHuecos();
  mostrarDatos();
});
function mostrarDatos() {
  if (flujo.fase === "listo") resetFlujo();
  $("cardOk").hidden = !0;
  $("clResumen").innerHTML =
    `<span><i class="ri-calendar-event-line" aria-hidden="true"></i>${esc(fechaWeb(sel.fecha))}</span><span><i class="ri-time-line" aria-hidden="true"></i>${esc(sel.hora)} – ${horaStr(minutos(sel.hora) + sel.dur)}</span><span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(sel.precio)}</span>`;
  mostrarBloques();
  const e = $("cardDatos");
  e.hidden = !1;
  e.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => {
    if (flujo.fase === "tel") $("clTel").focus();
    else if (flujo.fase === "existente") $("clCodigoEx").focus();
    else if (flujo.fase === "nuevo") $("clNombre").focus();
  }, 100);
}
function mostrarBloques() {
  const e = flujo.fase;
  $("bloqueTel").hidden = e !== "tel";
  $("bloqueExistente").hidden = e !== "existente";
  $("bloqueNuevo").hidden = e !== "nuevo";
  $("bloqueConfirmar").hidden = !(e === "nuevo" || e === "listo");
  $("clHola").hidden = e !== "listo";
  if (!$("bloqueConfirmar").hidden) iniciarTurnstile();
  if (e === "listo")
    $("clHola").innerHTML =
      `<i class="ri-user-line" aria-hidden="true"></i>${t("mis-reservas.hola", { nombre: `<b>${esc(flujo.nombre)}</b>` })}`;
}
function resetFlujo() {
  flujo.fase = "tel";
  flujo.codigo = "";
  flujo.nombre = "";
  ["clCodigoEx", "clNombre", "clCodigoNew", "clCodigoNew2"].forEach((e) => {
    $(e).value = "";
  });
  $("clConsent").checked = !1;
  mostrarBloques();
}
$("clTel").addEventListener("input", () => {
  if (flujo.fase !== "tel") resetFlujo();
  const e = $("clTel").value.trim(),
    n = $("btnTel"),
    r = $("telHint");
  if (!e) {
    n.disabled = !1;
    $("clTel").removeAttribute("aria-invalid");
    if (r) r.textContent = "";
    return;
  }
  const i = telefonoValido(e);
  n.disabled = !i;
  $("clTel").setAttribute("aria-invalid", i ? "false" : "true");
  if (r) {
    r.textContent = i ? t("reservar.valid-phone") : t("reservar.invalid-phone");
    r.style.color = i ? "var(--green)" : "var(--red)";
  }
});
async function continuarTelefono() {
  if (!telefonoValido($("clTel").value))
    return toast(t("reservar.toast.phone-invalid"), "warn");
  const e = normalizarTelefono($("clTel").value),
    n = $("btnTel");
  setBusy(n, !0, SPIN + "Comprobando...");
  try {
    const t = await conReintento(() => llamarEdge("estado", { p_telefono: e }));
    if (!t || !t.ok) return toast(textoError(t), "warn");
    flujo.tel = e;
    flujo.fase = t.con_codigo ? "existente" : "nuevo";
    mostrarBloques();
    setTimeout(() => $(t.con_codigo ? "clCodigoEx" : "clNombre").focus(), 60);
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(n, !1);
  }
}
async function entrarExistente() {
  const e = $("clCodigoEx").value.trim();
  if (!e) return toast(t("reservar.toast.code-empty"), "warn");
  const n = $("btnEntrar");
  setBusy(n, !0, SPIN + "Entrando...");
  try {
    const t = await conReintento(() =>
      llamarEdge("identificar", { p_ident: flujo.tel, p_codigo: e }),
    );
    if (!t || !t.ok)
      return toast(
        textoError(t),
        t && t.error === "bloqueado" ? "err" : "warn",
      );
    flujo.codigo = e;
    flujo.nombre = t.nombre;
    flujo.fase = "listo";
    $("clCodigoEx").value = "";
    mostrarBloques();
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(n, !1);
  }
}
async function confirmarReserva() {
  if (!sel.hora) return toast(t("reservar.toast.choose-hour"), "warn");
  if (!horarioPermitidoReserva(sel.fecha, minutos(sel.hora), sel.dur)) {
    toast(t("reservar.toast.no-schedule"), "err");
    sel.hora = null;
    $("cardDatos").hidden = !0;
    dibujarHuecos();
    return;
  }
  if (!horaReservable(sel.fecha, sel.hora)) {
    toast(textoAntelacion() + t("reservar.antelacion-llama"), "err");
    sel.hora = null;
    $("cardDatos").hidden = !0;
    dibujarHuecos();
    return;
  }
  let nombre = flujo.nombre,
    codigo = flujo.codigo;
  if (flujo.fase === "nuevo") {
    nombre = $("clNombre").value.trim().replace(/\s+/g, " ");
    const cod1 = $("clCodigoNew").value.trim(),
      cod2 = $("clCodigoNew2").value.trim();
    if (nombre.split(" ").length < 2)
      return toast(t("reservar.toast.name-required"), "warn");
    if (cod1.length < 4) return toast(t("reservar.toast.code-short"), "warn");
    if (cod1 !== cod2) return toast(t("reservar.toast.code-mismatch"), "warn");
    if (!$("clConsent").checked)
      return toast(t("reservar.toast.privacy-required"), "warn");
    codigo = cod1;
  }
  if (TURNSTILE_SITEKEY && !tsToken)
    return toast(t("reservar.toast.captcha"), "warn");
  const btn = $("btnConfirmar");
  setBusy(btn, !0, SPIN + "Reservando...");
  try {
    const res = await llamarEdge("reservar", {
      p_telefono: flujo.tel,
      p_nombre: nombre,
      p_codigo: codigo,
      p_fecha: sel.fecha,
      p_hora: sel.hora,
      p_duracion: sel.dur,
      turnstile: tsToken,
      consentimiento: flujo.fase === "nuevo" && $("clConsent").checked,
    });
    if (!res || !res.ok) {
      toast(textoError(res), "err");
      if (
        res &&
        (res.error === "sin_disponibilidad" || res.error === "hora_pasada")
      ) {
        sel.hora = null;
        $("cardDatos").hidden = !0;
        cargarHuecos();
      }
      if (
        res &&
        (res.error === "codigo_incorrecto" ||
          res.error === "bloqueado" ||
          res.error === "cliente_existente")
      )
        resetFlujo();
      return;
    }
    flujo.fase = "listo";
    flujo.nombre = res.reserva.nombre;
    flujo.codigo = codigo;
    cuenta = { ident: flujo.tel, codigo: codigo, nombre: res.reserva.nombre };
    mostrarExito(res.reserva);
  } catch (err) {
    const errMsg = String((err && err.message) || "");
    if (/antelacion_insuficiente/i.test(errMsg)) {
      toast(textoAntelacion() + t("reservar.antelacion-llama"), "err");
      sel.hora = null;
      $("cardDatos").hidden = !0;
      cargarHuecos();
    } else if (err && err.code === "23P01") {
      toast(textoError({ error: "sin_disponibilidad" }), "err");
      sel.hora = null;
      $("cardDatos").hidden = !0;
      cargarHuecos();
    } else errorRed(err);
  } finally {
    setBusy(btn, !1);
    reiniciarTurnstile();
  }
}
let ultimaReserva = null;
function mostrarExito(e) {
  ultimaReserva = e;
  $("cardDatos").hidden = !0;
  $("okDetalle").innerHTML =
    `<div><i class="ri-calendar-event-line" aria-hidden="true"></i>${esc(fechaWeb(e.fecha))}</div><div><i class="ri-time-line" aria-hidden="true"></i>${esc(e.hora)} – ${horaStr(minutos(e.hora) + e.duracion)} (${esc(duracionTxt(e.duracion))})</div><div><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(e.pista)}</div><div><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(e.precio)} · ${t("reservar.pago")}</div><div><i class="ri-hourglass-line" aria-hidden="true"></i>${t("reservar.pendiente")}</div>`;
  const n = $("cardOk");
  n.hidden = !1;
  n.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => $("btnICS").focus(), 100);
  sel.hora = null;
  cacheHuecos.t = 0;
  cargarHuecos();
}
$("btnTel").addEventListener("click", continuarTelefono);
$("btnEntrar").addEventListener("click", entrarExistente);
$("btnConfirmar").addEventListener("click", confirmarReserva);
$("cardDatos").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  e.preventDefault();
  const t = [$("btnTel"), $("btnEntrar"), $("btnConfirmar")].find(
    (e) => e.offsetParent !== null,
  );
  if (t) t.click();
});
function icsTexto(e) {
  return String(e)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
function icsFecha(e, t) {
  const [n, r, i] = e.split("-");
  return `${n}${r}${i}T${String(Math.floor(t / 60)).padStart(2, "0")}${String(t % 60).padStart(2, "0")}00`;
}
function descargarICS(e) {
  const t = minutos(e.hora),
    n = t + e.duracion,
    r = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, ""),
    i = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Geopadel//Reservas//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${e.id || Date.now()}-${e.fecha}-${e.hora}@geopadel`,
      `DTSTAMP:${r}`,
      `DTSTART:${icsFecha(e.fecha, t)}`,
      `DTEND:${icsFecha(e.fecha, n)}`,
      `SUMMARY:${icsTexto("Pádel en Geopadel · " + e.pista)}`,
      `LOCATION:${icsTexto("Geopadel · " + e.pista)}`,
      `DESCRIPTION:${icsTexto("Reserva pendiente de confirmación del club. Se paga en el club.")}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT60M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Pádel en 1 hora",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];
  descargarBlob(
    new Blob([i.join("\r\n")], { type: "text/calendar;charset=utf-8" }),
    "reserva-geopadel.ics",
  );
}
$("btnICS").addEventListener("click", () => {
  if (ultimaReserva) descargarICS(ultimaReserva);
});
$("btnOtra").addEventListener("click", () => {
  $("cardOk").hidden = !0;
  resetFlujo();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
$("btnVerMis").addEventListener("click", () => {
  resetFlujo();
  cambiarPestana("mis");
});
function mostrarMis(e) {
  $("cardMisLogin").hidden = e;
  $("cardMisLista").hidden = !e;
}
function agruparReservas(e) {
  const t = [],
    n = {};
  e.forEach((e) => {
    if (e.serie) {
      if (!n[e.serie]) {
        n[e.serie] = { ...e, ids: [e.id], fechas: [e.fecha], repeticion: !0 };
        t.push(n[e.serie]);
      } else {
        n[e.serie].ids.push(e.id);
        n[e.serie].fechas.push(e.fecha);
      }
    } else t.push({ ...e, ids: [e.id], fechas: [e.fecha], repeticion: !1 });
  });
  return t;
}
function dibujarMisReservas(e) {
  $("misHola").innerHTML = t("mis-reservas.hola", {
    nombre: `<b>${esc(e.nombre)}</b>`,
  });
  const n = e.reservas || [],
    r = agruparReservas(n);
  $("misLista").innerHTML = r.length
    ? r
        .map((n) => {
          const r = horaStr(minutos(n.hora) + n.duracion),
            i =
              n.tipo && n.tipo !== "Normal"
                ? `<span class="chip">${esc(n.tipo === "Pena" ? "Peña" : n.tipo)}</span>`
                : "",
            a = n.nombre_entidad || (n.cliente && n.cliente !== e.nombre),
            o = a
              ? `<span class="chip" style="background:var(--amber-soft);color:var(--orange-text);border-color:var(--amber)"><i class="ri-group-line" aria-hidden="true"></i>${esc(n.nombre_entidad || n.cliente)}</span>`
              : "",
            s =
              n.estado === "Pendiente"
                ? `<span class="badge-pendiente"><i class="ri-hourglass-line" aria-hidden="true"></i>${t("mis-reservas.pendiente")}</span>`
                : `<span class="badge-confirmada"><i class="ri-check-line" aria-hidden="true"></i>${t("mis-reservas.confirmada")}</span>`;
          let l = esc(fechaWeb(n.fecha)),
            c = "";
          if (n.repeticion) {
            const e = [
                ...new Set(
                  n.fechas.map((e) =>
                    new Date(e + "T12:00:00").toLocaleDateString(idioma(), {
                      weekday: "long",
                    }),
                  ),
                ),
              ],
              r = e
                .map((e) => e.charAt(0).toUpperCase() + e.slice(1))
                .join(_idioma === "en" ? " and " : " y ");
            l = `<span style="display:inline-flex;align-items:center;gap:4px"><i class="ri-repeat-line" style="color:var(--primary)"></i> ${t("mis-reservas.todos")} ${r}</span>`;
            c = `<div class="cl-res-acciones"><p class="cl-hint">${t("mis-reservas.recurrente", { n: n.fechas.length })}</p></div>`;
          } else {
            const e = `<button type="button" class="btn-add gray" data-repetir="${esc(n.id)}" data-fecha="${esc(n.fecha)}" data-hora="${esc(n.hora)}" data-dur="${esc(n.duracion)}"><i class="ri-repeat-line" aria-hidden="true"></i>${t("mis-reservas.repetir")}</button>`;
            c = n.motivo
              ? `<div class="cl-res-acciones"><p class="cl-hint">${esc(motivoTexto(n.motivo))}</p>${e}</div>`
              : `<div class="cl-res-acciones"><button type="button" class="btn-add danger" data-cancelar="${esc(n.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>${t("mis-reservas.cancelar")}</button>${e}</div>`;
          }
          return `<article class="cl-res"><div class="cl-res-top"><b>${l}</b><div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${o} ${i} ${s}</div></div><div class="cl-res-info"><span><i class="ri-time-line" aria-hidden="true"></i>${esc(n.hora)} – ${r}</span><span><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(n.pista)}</span><span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(n.precio)}</span></div>${c}</article>`;
        })
        .join("")
    : `<p class="cl-empty">${t("mis-reservas.vacio")}</p>`;
}
async function cargarMisReservas(e, n) {
  const r = $("btnMis"),
    i = $("msgMis");
  setBusy(r, !0, SPIN + "Buscando...");
  i.innerText = "";
  try {
    const t = await conReintento(() =>
      llamarEdge("mis_reservas", { p_ident: e, p_codigo: n }),
    );
    if (!t || !t.ok) {
      cuenta = null;
      mostrarMis(!1);
      i.className = "msg-inline msg-error";
      i.innerText = textoError(t);
      return;
    }
    cuenta = { ident: e, codigo: n, nombre: t.nombre };
    $("misCodigo").value = "";
    dibujarMisReservas(t);
    mostrarMis(!0);
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(r, !1);
  }
}
$("formMis").addEventListener("submit", (e) => {
  e.preventDefault();
  let ident = $("misIdent").value.trim();
  const codigo = $("misCodigo").value.trim();
  if (ident && /^[+\d\s().-]+$/.test(ident)) ident = normalizarTelefono(ident);
  if (!ident || !codigo)
    return toast(t("reservar.toast.ident-required"), "warn");
  cargarMisReservas(ident, codigo);
});
$("btnSalirMis").addEventListener("click", () => {
  cuenta = null;
  $("misIdent").value = "";
  $("misCodigo").value = "";
  $("msgMis").innerText = "";
  mostrarMis(!1);
});
$("btnBorrarDatos").addEventListener("click", async () => {
  if (!cuenta) return;
  if (!(await customConfirm(t("mis-reservas.borrar-confirm")))) return;
  const e = $("btnBorrarDatos");
  setBusy(e, !0, "Borrando...");
  try {
    const e = await llamarEdge("borrar", {
      p_ident: cuenta.ident,
      p_codigo: cuenta.codigo,
    });
    if (!e || !e.ok) {
      toast(textoError(e), "err");
      return;
    }
    cuenta = null;
    $("misIdent").value = "";
    $("misCodigo").value = "";
    $("msgMis").innerText = "";
    mostrarMis(!1);
    toast(t("mis-reservas.toast.deleted"));
  } catch (e) {
    errorRed(e);
  } finally {
    setBusy(e, !1);
  }
});
$("misLista").addEventListener("click", async (e) => {
  const n = e.target.closest("button[data-repetir]");
  if (n && cuenta) {
    repetirReserva(n);
    return;
  }
  const r = e.target.closest("button[data-cancelar]");
  if (!r || !cuenta) return;
  if (!(await customConfirm(t("mis-reservas.cancel-confirm")))) return;
  setBusy(r, !0, SPIN + "Cancelando...");
  try {
    const e = await llamarEdge("cancelar", {
      p_ident: cuenta.ident,
      p_codigo: cuenta.codigo,
      p_reserva_id: r.dataset.cancelar,
    });
    if (!e || !e.ok) {
      toast(textoError(e), "err");
      setBusy(r, !1);
      return;
    }
    toast(t("mis-reservas.toast.cancelled"));
    await cargarMisReservas(cuenta.ident, cuenta.codigo);
  } catch (e) {
    errorRed(e);
    setBusy(r, !1);
  }
});
async function repetirReserva(e) {
  if (!cuenta) return;
  flujo.tel = cuenta.ident;
  flujo.codigo = cuenta.codigo;
  flujo.nombre = cuenta.nombre;
  flujo.fase = "listo";
  sel.dur = parseInt(e.dataset.dur, 10) || 90;
  if (!cfg.duraciones.includes(sel.dur)) sel.dur = cfg.duraciones[0];
  dibujarDuraciones();
  cambiarPestana("reservar");
  const t = fechaLocalISO();
  let n = sumarDiasISO(e.dataset.fecha, 7);
  while (n < t) n = sumarDiasISO(n, 7);
  const r = await seleccionarDia(n, !0),
    i = e.dataset.hora,
    a = (r || []).some(
      (e) => e.hora === i && (e.opciones || []).some((e) => e.dur === sel.dur),
    );
  if (a) {
    sel.hora = i;
    const e = (r.find((e) => e.hora === i).opciones || []).find(
      (e) => e.dur === sel.dur,
    );
    sel.precio = Number(e && e.precio) || 0;
    dibujarHuecos();
    mostrarDatos();
  } else {
    toast(
      _idioma === "en"
        ? "That time isn't free next week. Pick another slot."
        : "Ese hueco no está libre la próxima semana. Elige otra hora.",
      "warn",
    );
    dibujarHuecos();
  }
}
setInterval(() => {
  if (
    !document.hidden &&
    sel.fecha &&
    $("tab-reservar").classList.contains("active")
  )
    dibujarHuecos();
}, 6e4);
window.addEventListener("online", estadoRed);
window.addEventListener("offline", estadoRed);
document.addEventListener("visibilitychange", () => {
  if (
    !document.hidden &&
    navigator.onLine &&
    sel.fecha &&
    $("tab-reservar").classList.contains("active")
  )
    cargarHuecos();
});
function urlGoogleCalendar(e) {
  const t = minutos(e.hora),
    n = t + e.duracion,
    r = (e, t) => {
      const [n, r, i] = e.split("-");
      return `${n}${r}${i}T${String(Math.floor(t / 60)).padStart(2, "0")}${String(t % 60).padStart(2, "0")}00`;
    },
    i = `${r(e.fecha, t)}/${r(e.fecha, n)}`,
    a = encodeURIComponent(`Pádel en Geopadel · ${e.pista}`),
    o = encodeURIComponent(`Geopadel, ${e.pista}`),
    s = encodeURIComponent(
      "Reserva pendiente de confirmación. Se paga en el club.",
    );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${a}&dates=${i}&location=${o}&details=${s}`;
}
$("btnGCal").addEventListener("click", () => {
  if (ultimaReserva) window.open(urlGoogleCalendar(ultimaReserva), "_blank");
});
$("btnShare").addEventListener("click", async () => {
  if (!ultimaReserva) return;
  const e = ultimaReserva,
    t = `¡He reservado pista en Geopadel! ${fechaWeb(e.fecha)} a las ${e.hora} en ${e.pista}. ¿Te apuntas?`;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Geopadel",
        text: t,
        url: location.origin,
      });
    } catch (e) {}
  } else
    try {
      await navigator.clipboard.writeText(t);
      toast("Copiado al portapapeles");
    } catch (e) {
      toast("No se pudo copiar", "err");
    }
});
async function suscribirPush() {
  if (!ultimaReserva) return;
  if (!VAPID_PUBLIC_KEY) return;
  const ahora = new Date(),
    [t, n, r] = ultimaReserva.fecha.split("-").map(Number),
    [i, a] = ultimaReserva.hora.split(":").map(Number),
    inicioPartido = new Date(t, n - 1, r, i, a);
  if (inicioPartido.getTime() - ahora.getTime() < 2 * 60 * 60 * 1e3)
    return toast("El partido es en menos de 2 horas.", "warn");
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return toast("Tu navegador no soporta notificaciones", "warn");
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return toast("Permiso denegado", "warn");
    const reg = await navigator.serviceWorker.ready,
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: !0,
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
    toast("Recordatorio activado.");
  } catch (err) {
    console.error(err);
    toast("No se pudo activar el recordatorio: " + (err.message || err), "err");
  }
}
$("btnPush").addEventListener("click", suscribirPush);
window.addEventListener("DOMContentLoaded", async () => {
  iniciarTema();
  $("btnTema").addEventListener("click", alternarTema);
  estadoRed();
  if (!VAPID_PUBLIC_KEY) {
    const e = $("btnPush");
    if (e) e.hidden = !0;
  }
  if (!sb) {
    $("clSlots").innerHTML =
      '<p class="cl-empty">No se pudo cargar el sistema. Revisa tu conexión.</p>';
    return;
  }
  let e = null;
  try {
    e = JSON.parse(localStorage.getItem("gp_web_config"));
  } catch (e) {}
  if (e && Date.now() - e.t < 36e5) cfg = { ...cfg, ...e.data };
  else
    try {
      const e = await rpc("web_config");
      if (e && Array.isArray(e.duraciones)) {
        cfg = { ...cfg, ...e };
        localStorage.setItem(
          "gp_web_config",
          JSON.stringify({ t: Date.now(), data: e }),
        );
      }
    } catch (e) {
      console.error(e);
    }
  if (!cfg.duraciones.includes(sel.dur)) sel.dur = cfg.duraciones[0];
  actualizarIntroReserva();
  dibujarDias();
  seleccionarDia(fechaLocalISO());
});
function actualizarIntroReserva() {
  const e = $("txtIntroReserva");
  if (e)
    e.textContent = t("reservar.subtitulo-completo", {
      min: duracionTxt(antMin()),
    });
}
document.addEventListener("idioma-cambiado", actualizarIntroReserva);
let promptInstalacion = null;
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent),
  yaInstalada = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === !0,
  mostrarInstalar = (e) => $("btnInstalar").classList.toggle("visible", e);
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  promptInstalacion = e;
  mostrarInstalar(!0);
});
window.addEventListener("appinstalled", () => {
  promptInstalacion = null;
  mostrarInstalar(!1);
});
$("btnInstalar").addEventListener("click", async () => {
  if (!promptInstalacion) {
    toast(
      "En Safari pulsa Compartir y elige «Añadir a pantalla de inicio»",
      "ok",
      7e3,
    );
    return;
  }
  promptInstalacion.prompt();
  await promptInstalacion.userChoice;
  promptInstalacion = null;
  mostrarInstalar(!1);
});
if (esIOS && !yaInstalada()) mostrarInstalar(!0);
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {}),
  );
