/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
let supabaseClient = null,
  _sbLoadPromise = null,
  _authListenerRegistrado = !1;
function _cargarScriptSupabase() {
  if (_sbLoadPromise) return _sbLoadPromise;
  _sbLoadPromise = new Promise((e, t) => {
    if (window.supabase && window.supabase.createClient) return e();
    const n = document.createElement("script");
    n.src = "assets/supabase.min.js";
    n.async = !0;
    n.onload = e;
    n.onerror = () => t(new Error("No se pudo cargar la librería de Supabase"));
    document.head.appendChild(n);
  });
  return _sbLoadPromise;
}
function _registrarAuthListener() {
  if (_authListenerRegistrado || !supabaseClient) return;
  _authListenerRegistrado = !0;
  supabaseClient.auth.onAuthStateChange((e) => {
    e === "SIGNED_OUT" &&
      usuarioSesion &&
      ((usuarioSesion = null), mostrarLogin());
  });
}
async function inicializarSupabase() {
  if (supabaseClient) return supabaseClient;
  await _cargarScriptSupabase();
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        storage: window.localStorage,
        persistSession: !0,
        autoRefreshToken: !0,
      },
    },
  );
  _registrarAuthListener();
  return supabaseClient;
}
let intentosFallidos = 0,
  bloqueoHasta = 0,
  tsLoginId = null,
  tsLoginToken = "";
function iniciarTurnstileLogin() {
  if (!TURNSTILE_SITEKEY || tsLoginId !== null) return;
  const e = $("cfLogin");
  if (!e) return;
  const t = () => {
    if (tsLoginId !== null || !window.turnstile) return;
    try {
      tsLoginId = window.turnstile.render("#cfLogin", {
        sitekey: TURNSTILE_SITEKEY,
        callback: (e) => {
          tsLoginToken = e;
        },
        "expired-callback": () => {
          tsLoginToken = "";
        },
        "error-callback": () => {
          tsLoginToken = "";
        },
      });
    } catch (e) {
      console.error("Error al renderizar Turnstile:", e);
    }
  };
  if (window.turnstile) {
    t();
    return;
  }
  const n = document.createElement("script");
  n.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  n.async = !0;
  n.onload = t;
  document.head.appendChild(n);
}
function reiniciarTurnstileLogin() {
  tsLoginToken = "";
  if (window.turnstile && tsLoginId !== null)
    try {
      window.turnstile.reset(tsLoginId);
    } catch (e) {}
}
async function cargarPerfil(e) {
  if (!supabaseClient) return null;
  const { data: t, error: n } = await supabaseClient
    .from("usuarios")
    .select("id,usuario,nombre,rol")
    .eq("auth_id", e.id)
    .eq("estado", "Activo")
    .maybeSingle();
  if (n || !t) return null;
  return { id: t.id, user: t.usuario, nombre: t.nombre, rol: t.rol };
}
async function comprobarSesion() {
  let e = !1;
  try {
    e = !!localStorage.getItem(CLAVE_SESION_INI);
  } catch (e) {}
  if (!e) {
    mostrarLogin();
    return;
  }
  try {
    await inicializarSupabase();
  } catch (e) {
    console.error(e);
    mostrarLogin();
    return;
  }
  const { data: t } = await supabaseClient.auth.getSession();
  if (t && t.session) {
    if (sesionCaducada()) {
      await supabaseClient.auth.signOut();
      try {
        localStorage.removeItem(CLAVE_SESION_INI);
      } catch (e) {}
      mostrarLogin();
      toast("La sesión ha caducado. Vuelve a entrar.", "warn");
      return;
    }
    const n = await cargarPerfil(t.session.user);
    if (n) {
      usuarioSesion = n;
      if (!localStorage.getItem(CLAVE_SESION_INI)) marcarInicioSesion();
      mostrarPanelAdmin();
      return;
    }
    await supabaseClient.auth.signOut();
  }
  mostrarLogin();
}
async function cerrarSesion() {
  detenerVigilanciaSesion();
  if (canalRealtime && supabaseClient) {
    supabaseClient.removeChannel(canalRealtime);
    canalRealtime = null;
  }
  if (supabaseClient) await supabaseClient.auth.signOut();
  try {
    localStorage.removeItem(CLAVE_SESION_INI);
    localStorage.removeItem(CLAVE_ULT_ACT);
  } catch (e) {}
  usuarioSesion = null;
  $("password").value = "";
  $("msgLogin").innerText = "";
  cambiarPestana("reservas");
  mostrarLogin();
}
function mostrarLogin() {
  $("loginView").style.display = "flex";
  $("adminView").style.display = "none";
  iniciarTurnstileLogin();
  reiniciarTurnstileLogin();
}
function mostrarPanelAdmin() {
  if (!supabaseClient) {
    mostrarLogin();
    $("msgLogin").className = "msg-error";
    $("msgLogin").innerText =
      "No se pudo cargar la librería de base de datos. Revisa tu conexión y recarga.";
    return;
  }
  $("loginView").style.display = "none";
  $("adminView").style.display = "block";
  $("nombreEmpleado").innerText = usuarioSesion.nombre;
  $("rolEmpleado").innerText = usuarioSesion.rol || "Trabajador";
  inicializarFechaHoy();
  if (typeof aplicarPermisosCopia === "function") aplicarPermisosCopia();
  if (typeof aplicarPermisosFichajes === "function") aplicarPermisosFichajes();
  renderSelectorMesas();
  iniciarSuscripcionRealtime();
  iniciarVigilanciaSesion();
  const e = document.getElementById("btnNotif");
  e &&
    "Notification" in window &&
    Notification.permission === "granted" &&
    (e.style.display = "none");
  if (!esJefa()) cargarMisFichajes();
  if (typeof entrarResumen === "function") entrarResumen();
}
let loginEnCurso = !1;
$("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (loginEnCurso) return;
  const t = $("msgLogin"),
    n = $("btnEntrar");
  if (Date.now() < bloqueoHasta) {
    t.className = "msg-error";
    t.innerText = `Demasiados intentos. Espera ${Math.ceil((bloqueoHasta - Date.now()) / 1e3)} s.`;
    return;
  }
  const r = $("usuario").value.trim().toLowerCase().replace(/\s+/g, ""),
    i = $("password").value;
  if (!r || !i) {
    t.className = "msg-error";
    t.innerText = "Introduce usuario y contraseña";
    return;
  }
  if (TURNSTILE_SITEKEY && !tsLoginToken) {
    t.className = "msg-error";
    t.innerText = "Completa la verificación anti-spam";
    return;
  }
  loginEnCurso = !0;
  n.disabled = !0;
  n.innerText = "Verificando...";
  t.className = "";
  t.innerText = "Conectando...";
  try {
    await inicializarSupabase();
  } catch (e) {
    console.error(e);
    t.className = "msg-error";
    t.innerText =
      "No se pudo cargar la librería de base de datos. Revisa tu conexión y recarga.";
    loginEnCurso = !1;
    n.disabled = !1;
    n.innerText = "Entrar al Panel";
    return;
  }
  try {
    const { data: e, error: a } = await supabaseClient.auth.signInWithPassword({
      email: r + DOMINIO_LOGIN,
      password: i,
      options: { captchaToken: tsLoginToken },
    });
    if (a) {
      if (a.code === "captcha_failed" || /captcha/i.test(a.message || "")) {
        t.className = "msg-error";
        t.innerText = "No se pudo verificar el anti-spam. Inténtalo de nuevo.";
      } else if (a.status === 400 || /invalid login/i.test(a.message || "")) {
        intentosFallidos++;
        if (intentosFallidos >= 5) {
          bloqueoHasta = Date.now() + 3e4;
          intentosFallidos = 0;
        }
        t.className = "msg-error";
        t.innerText = /not confirmed/i.test(a.message || "")
          ? "Este usuario no está confirmado. Contacta con el administrador."
          : "Credenciales incorrectas";
      } else throw a;
    } else {
      const a = await cargarPerfil(e.user);
      if (!a) {
        await supabaseClient.auth.signOut();
        t.className = "msg-error";
        t.innerText =
          "Usuario inactivo o sin perfil. Contacta con el administrador.";
      } else {
        intentosFallidos = 0;
        usuarioSesion = a;
        marcarInicioSesion();
        reiniciarTurnstileLogin();
        t.className = "msg-success";
        t.innerText = "¡Bienvenido!";
        setTimeout(() => {
          n.disabled = !1;
          n.innerText = "Entrar al Panel";
          try {
            mostrarPanelAdmin();
          } catch (e) {
            console.error(e);
            t.className = "msg-error";
            t.innerText = "Error al cargar el panel. Recarga la página.";
          } finally {
            loginEnCurso = !1;
          }
        }, 250);
        return;
      }
    }
  } catch (e) {
    console.error(e);
    t.className = "msg-error";
    t.innerText = "Error de conexión. Inténtalo de nuevo.";
  }
  reiniciarTurnstileLogin();
  n.disabled = !1;
  n.innerText = "Entrar al Panel";
  loginEnCurso = !1;
});
const refrescar = {
  reservas: debounce(() => cargarReservasHoy(), 500),
  mesas: debounce(() => cargarMesasBar(), 400),
  ventas: debounce(() => cargarCajaHoy(), 600),
  productos: debounce(() => cargarProductos(), 500),
  tarifas: debounce(() => cargarTarifas(), 500),
  deudas: debounce(() => cargarDeudas(), 500),
  limpiezas: debounce(() => cargarLimpiezas(!1), 500),
  clientes: debounce(() => cargarClientes(), 800),
};
function iniciarSuscripcionRealtime() {
  if (!supabaseClient) return;
  if (canalRealtime) {
    supabaseClient.removeChannel(canalRealtime);
    canalRealtime = null;
  }
  canalRealtime = supabaseClient
    .channel("geopadel-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reservas" },
      refrescar.reservas,
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "reservas" },
      avisarNuevaReservaWeb,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "mesas_bar" },
      refrescar.mesas,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ventas" },
      refrescar.ventas,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "productos" },
      refrescar.productos,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tarifas" },
      refrescar.tarifas,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "deudas" },
      refrescar.deudas,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "limpiezas" },
      refrescar.limpiezas,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clientes" },
      refrescar.clientes,
    )
    .subscribe((e) => {
      if (e === "SUBSCRIBED") {
        mostrarFlashSync();
        if (canalConError) {
          canalConError = !1;
          cargarDatosGlobales();
        }
      } else if (e === "CHANNEL_ERROR" || e === "TIMED_OUT") canalConError = !0;
    });
}
let audioCtx = null;
function pitar() {
  try {
    const e = window.AudioContext || window.webkitAudioContext;
    if (!e) return;
    audioCtx = audioCtx || new e();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.createOscillator(),
      n = audioCtx.createGain();
    t.connect(n);
    n.connect(audioCtx.destination);
    t.frequency.value = 880;
    n.gain.setValueAtTime(0.15, audioCtx.currentTime);
    n.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    t.start();
    t.stop(audioCtx.currentTime + 0.6);
  } catch (e) {}
}
function avisarNuevaReservaWeb(e) {
  const t = e && e.new;
  if (!t || t.origen !== "web" || t.estado !== "Pendiente") return;
  const n = `Nueva reserva web: ${t.cliente || ""} · ${fechaBonita(t.fecha)} ${String(t.hora_inicio || "").slice(0, 5)}`,
    r = `${t.pista || ""}${t.precio ? " · " + eur(t.precio) : ""}`;
  let i = !1;
  if (document.hidden && typeof mostrarNotificacion === "function")
    i = mostrarNotificacion(n, { body: r });
  if (!i) toast(n, "warn", 9e3);
  pitar();
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) {}
}
function mostrarFlashSync() {
  const e = $("gpSync");
  if (!e) return;
  e.style.opacity = 1;
  setTimeout(() => {
    e.style.opacity = 0;
  }, 1500);
}
window.addEventListener("online", () => {
  estadoRed();
  if (usuarioSesion) cargarDatosGlobales();
});
window.addEventListener("offline", estadoRed);
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !usuarioSesion) return;
  if (sesionCaducada()) {
    cerrarSesion();
    toast("La sesión ha caducado. Vuelve a entrar.", "warn");
    return;
  }
  if (navigator.onLine) cargarDatosGlobales();
});
const SUB_DEFAULT = { ventas: "tienda", equipo: "fichajes" },
  SUB_TABS = {
    tienda: "ventas",
    caja: "ventas",
    deudas: "ventas",
    facturas: "ventas",
    fichajes: "equipo",
    limpieza: "equipo",
  };
function cambiarPestana(e) {
  if ((SUB_DEFAULT[e] && (e = SUB_DEFAULT[e]), SUB_TABS[e])) e = SUB_TABS[e];
  document
    .querySelectorAll(".tab-content")
    .forEach((e) => e.classList.remove("active"));
  document
    .querySelectorAll(".subtab-content")
    .forEach((e) => e.classList.remove("active"));
  const t = $(`tab-${e}`);
  t && t.classList.add("active");
  if (SUB_TABS[e]) {
    const t = $(`sub-${e}`);
    t && t.classList.add("active");
  }
  document.querySelectorAll(".nav-tab").forEach((e) => {
    e.classList.remove("active");
    e.removeAttribute("aria-current");
  });
  const n = $(`nav-${e}`);
  n && (n.classList.add("active"), n.setAttribute("aria-current", "page"));
  document.querySelectorAll(".subnav-btn").forEach((t) => {
    const n = t.dataset.tab === e;
    t.classList.toggle("active", n);
    t.setAttribute("aria-selected", n ? "true" : "false");
  });
  const r = {
    resumen: "Resumen",
    reservas: "Reservas",
    tienda: "Tienda",
    caja: "Caja",
    deudas: "Deudas",
    facturas: "Facturas",
    fichajes: "Fichaje",
    limpieza: "Limpieza",
    ajustes: "Ajustes",
  };
  document.title = "Geopadel · " + (r[e] || "Panel");
  if (usuarioSesion) {
    if (e === "resumen" && typeof entrarResumen === "function") entrarResumen();
    if (e === "deudas") {
      if (!_formDeudaInit) {
        iniciarFormDeuda();
        _formDeudaInit = !0;
      }
      cargarDeudas();
    }
    if (e === "facturas" && typeof entrarFacturas === "function")
      entrarFacturas();
    if (e === "tienda") {
      cargarMesasBar();
      if (typeof entrarEscaparate === "function") entrarEscaparate();
    }
    if (e === "ajustes") {
      if (typeof entrarAjustes === "function") entrarAjustes();
      if (typeof entrarFacturasConfig === "function") entrarFacturasConfig();
    }
    if (e === "limpieza") entrarPestanaLimpieza();
    if (e === "caja") {
      cargarHistorialCaja();
      cargarCajaHoy();
    }
    if (e === "fichajes") {
      if (!esJefa()) {
        cargarMisFichajes();
        if (typeof entrarContrato === "function") entrarContrato();
      }
      if (typeof entrarFichajes === "function") entrarFichajes();
    }
    if (e === "reservas") {
      scrollAhoraPendiente = !0;
      renderizarCuadrantePlaytomic(datosLocales.reservas || []);
    }
  }
}
document
  .querySelectorAll(".nav-tab")
  .forEach((e) =>
    e.addEventListener("click", () => cambiarPestana(e.dataset.tab)),
  );
document
  .querySelectorAll(".subnav-btn")
  .forEach((e) =>
    e.addEventListener("click", () => cambiarPestana(e.dataset.tab)),
  );
async function fichar(e, t) {
  const n = $("msgFichaje");
  if (esJefa()) return;
  if (typeof asegurarContrato === "function" && !(await asegurarContrato())) {
    n.style.color = "var(--orange-text)";
    n.innerText = "Para fichar necesitas indicar tu contrato.";
    return;
  }
  if (ultimoFichaje && ultimoFichaje.tipo === e) {
    if (
      !(await customConfirm(
        `Tu último fichaje ya fue de ${e}. ¿Registrar otra ${e} igualmente?`,
      ))
    )
      return;
  }
  setBusy(t, !0);
  try {
    const { error: n } = await supabaseClient
      .from("fichajes")
      .insert({ empleado: usuarioSesion.user, tipo: e });
    if (n) throw n;
    n.style.color = "var(--green)";
    n.innerText = `Fichaje de ${e} registrado correctamente`;
    await cargarMisFichajes();
  } catch (e) {
    n.style.color = "var(--red)";
    n.innerText = "Error: " + (e.message || e);
  } finally {
    setBusy(t, !1);
  }
}
async function cargarMisFichajes() {
  const e = $("tablaFichajesBody");
  if (!e || !usuarioSesion || !supabaseClient) return;
  const { data: t, error: n } = await supabaseClient
    .from("fichajes")
    .select("*")
    .eq("empleado", usuarioSesion.user)
    .order("created_at", { ascending: !1 })
    .limit(30);
  if (n) {
    e.innerHTML = `<tr><td colspan="3" class="tabla-empty" style="color:var(--red)">Error al cargar fichajes: ${esc(n.message)}</td></tr>`;
    return;
  }
  if (!t || !t.length) {
    ultimoFichaje = null;
    $("estadoFichaje").innerText = "";
    e.innerHTML = `<tr><td colspan="3" class="tabla-empty">No hay registros de fichajes aún</td></tr>`;
    return;
  }
  const r = (e) => {
    const t = new Date(e);
    return isNaN(t.getTime())
      ? e || "-"
      : t.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "medium" });
  };
  ultimoFichaje = { tipo: t[0].tipo };
  $("estadoFichaje").innerText = `Último fichaje: ${t[0].tipo} · ${r(t[0])}`;
  e.innerHTML = t
    .map((e) => {
      const t = e.tipo === "Entrada";
      return `<tr>\n<td><b>${esc(r(e))}</b></td>\n<td><span class="badge-fichaje ${t ? "in" : "out"}">${t ? '<i class="ri-login-box-line" aria-hidden="true"></i>Entrada' : '<i class="ri-logout-box-line" aria-hidden="true"></i>Salida'}</span></td>\n<td><b>${esc(e.empleado)}</b></td></tr>`;
    })
    .join("");
}
window.addEventListener("DOMContentLoaded", () => {
  iniciarTema();
  estadoRed();
  comprobarSesion();
});
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("sw.js").catch(() => {}),
  );
