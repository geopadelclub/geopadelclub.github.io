/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
window.$ = (e) => document.getElementById(e);
const esc = (e) =>
    String(e ?? "").replace(
      /[&<>"']/g,
      (e) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[e],
    ),
  eur = (e) =>
    (Number(e) || 0).toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
    }),
  redondear2 = (e) => Math.round((Number(e) || 0) * 100) / 100;
function toast(e, t = "ok", n = 3500) {
  const r = $("toasts");
  if (!r) return;
  const i = document.createElement("div");
  i.className = "toast " + (t === "ok" ? "" : t);
  i.textContent = e;
  i.setAttribute("role", t === "err" ? "alert" : "status");
  i.setAttribute("aria-live", t === "err" ? "assertive" : "polite");
  r.appendChild(i);
  const a = t === "err" ? Math.max(n, 6e3) : n;
  setTimeout(() => {
    i.classList.add("out");
    setTimeout(() => i.remove(), 260);
  }, a);
}
function setBusy(e, t, n) {
  if (!e) return;
  if (t) {
    e.dataset.txt = e.innerHTML;
    e.disabled = !0;
    if (n) e.innerHTML = n;
  } else {
    e.disabled = !1;
    if (e.dataset.txt) e.innerHTML = e.dataset.txt;
  }
}
function ahoraMadrid() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => partes.find((p) => p.type === t)?.value ?? "00";
  const y = +get("year");
  const m = +get("month");
  const d = +get("day");
  const h = +get("hour");
  const mi = +get("minute");
  const s = +get("second");
  return {
    y,
    m,
    d,
    h,
    mi,
    s,
    fecha: `${get("year")}-${get("month")}-${get("day")}`,
    minutos: h * 60 + mi,
    msUTC: Date.UTC(y, m - 1, d, h, mi, s),
  };
}
function fechaLocalISO(e) {
  if (!(e instanceof Date)) return ahoraMadrid().fecha;
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}
function sumarDiasISO(e, t) {
  const [n, r, i] = e.split("-").map(Number);
  return new Date(Date.UTC(n, r - 1, i + t, 12, 0, 0))
    .toISOString()
    .split("T")[0];
}
function estadoRed() {
  const e = $("bannerOffline");
  if (e) e.classList.toggle("show", !navigator.onLine);
}
function descargarBlob(e, t) {
  const n = URL.createObjectURL(e),
    r = document.createElement("a");
  r.href = n;
  r.download = t;
  document.body.appendChild(r);
  r.click();
  r.remove();
  setTimeout(() => URL.revokeObjectURL(n), 1e4);
}
async function leerTodo(e, t = 1e3, n = 2e5) {
  const r = [];
  for (let i = 0; i < n; i += t) {
    const { data: a, error: o } = await e().range(i, i + t - 1);
    if (o) return { data: null, error: o };
    if (a && a.length) r.push(...a);
    if (!a || a.length < t) break;
  }
  return { data: r, error: null };
}
function fechaBonita(e, t) {
  const [n, r, i] = e.split("-").map(Number),
    a = typeof _idioma !== "undefined" && _idioma === "en" ? "en-GB" : "es-ES",
    o = new Date(n, r - 1, i, 12).toLocaleDateString(a, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  return t ? o.charAt(0).toUpperCase() + o.slice(1) : o;
}
function aplicarTema(e, t = !0) {
  document.documentElement.setAttribute("data-theme", e);
  if (t)
    try {
      localStorage.setItem("gp-theme", e);
    } catch (e) {}
  const n = $("metaTheme");
  if (n) n.setAttribute("content", e === "dark" ? "#364650" : "#fcfdfc");
  document
    .querySelectorAll('[data-action="alternar-tema"], #btnTema')
    .forEach((t) => {
      t.innerHTML =
        e === "dark"
          ? '<i class="ri-sun-line" aria-hidden="true"></i>'
          : '<i class="ri-moon-line" aria-hidden="true"></i>';
      t.setAttribute(
        "aria-label",
        e === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      );
      t.title = e === "dark" ? "Modo claro" : "Modo oscuro";
    });
}
function alternarTema() {
  aplicarTema(
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark",
  );
}
function iniciarTema() {
  aplicarTema(
    document.documentElement.getAttribute("data-theme") || "light",
    !1,
  );
  try {
    const e = window.matchMedia("(prefers-color-scheme: dark)"),
      t = (e) => {
        let t = null;
        try {
          t = localStorage.getItem("gp-theme");
        } catch (e) {}
        if (!t) aplicarTema(e.matches ? "dark" : "light", !1);
      };
    if (e.addEventListener) e.addEventListener("change", t);
  } catch (e) {}
}
function normalizarTelefono(e) {
  let t = String(e || "").replace(/\D/g, "");
  if (t.startsWith("00")) t = t.slice(2);
  if (t.startsWith("34") && t.length === 11) t = t.slice(2);
  return t;
}
function telefonoValido(e) {
  const t = String(e || "").trim(),
    n = normalizarTelefono(t).length;
  return /^[+\d][\d\s().-]*$/.test(t) && n >= 9 && n <= 15;
}
function esErrorRed(e) {
  if (!e || e.code) return !1;
  return /failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i.test(
    String(e.message || ""),
  );
}
async function conReintento(e, t = 2, n = 700) {
  let r = null;
  for (let i = 0; i <= t; i++) {
    let a = !1;
    try {
      const t = await e();
      if (t && t.error && esErrorRed(t.error)) {
        r = { r: t };
        a = !0;
      } else return t;
    } catch (e) {
      if (!esErrorRed(e)) throw e;
      r = { e };
      a = !0;
    }
    if (a && (i === t || !navigator.onLine)) break;
    await new Promise((e) => setTimeout(e, n * (i + 1)));
  }
  if (r.e) throw r.e;
  return r.r;
}
function enlazarBuscadorCliente(e, t, n) {
  if (!e || !t) return;
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const soloDig = (s) => String(s || "").replace(/\D/g, "");
  const cache = new Map();

  async function buscar(q, qTel) {
    const key = q + "|" + qTel;
    if (cache.has(key)) return cache.get(key);

    let query = supabaseClient
      .from("clientes")
      .select("id, nombre, telefono, tipo_cliente, nombre_entidad")
      .limit(20);

    if (q) query = query.ilike("nombre", "%" + q + "%");
    if (qTel) query = query.ilike("telefono", "%" + qTel + "%");

    const { data, error } = await query;
    if (error) {
      console.error("Error buscando clientes:", error);
      return [];
    }
    cache.set(key, data || []);
    return data || [];
  }

  function s(i) {
    if (i.dataset.cliBound) return;
    i.dataset.cliBound = "1";
    const wrap = document.createElement("div");
    wrap.className = "cli-wrap";
    i.parentNode.insertBefore(wrap, i);
    wrap.appendChild(i);
    const sug = document.createElement("div");
    sug.className = "cli-sug";
    sug.setAttribute("role", "listbox");
    sug.hidden = !0;
    wrap.appendChild(sug);
    i.setAttribute("role", "combobox");
    i.setAttribute("aria-autocomplete", "list");
    i.setAttribute("aria-expanded", "false");
    let lista = [],
      idx = -1,
      tmr = null;

    const cerrar = () => {
      sug.hidden = !0;
      idx = -1;
      i.setAttribute("aria-expanded", "false");
    };
    const pintar = () =>
      sug
        .querySelectorAll(".cli-op")
        .forEach((el, k) => el.classList.toggle("on", k === idx));

    function elegir(c) {
      e.value = c.nombre_entidad ? c.nombre_entidad : c.nombre;
      t.value = c.telefono || "";
      e.dataset.tipo = c.tipo_cliente || "Particular";
      cerrar();
      if (n) n(c);
    }

    async function ejecutar() {
      const q = norm(e.value);
      const qTel = soloDig(t.value);
      const hasQ = q.length >= 2;
      const hasTel = qTel.length >= 3;
      if (!hasQ && !hasTel) {
        cerrar();
        return;
      }
      lista = await buscar(hasQ ? q : "", hasTel ? qTel : "");
      if (!lista.length) {
        cerrar();
        return;
      }
      sug.innerHTML = lista
        .map((c, k) => {
          const esPena = c.tipo_cliente === "Peña" || c.nombre_entidad;
          const badge = esPena ? '<span class="badge-pena">PEÑA</span>' : "";
          return `<div class="cli-op" role="option" data-i="${k}"><b>${esc(c.nombre_entidad || c.nombre)} ${badge}</b><small>${c.telefono ? esc(c.telefono) : "Sin teléfono"}</small></div>`;
        })
        .join("");
      idx = -1;
      sug.hidden = !1;
      i.setAttribute("aria-expanded", "true");
    }

    i.addEventListener("input", () => {
      clearTimeout(tmr);
      tmr = setTimeout(ejecutar, 300);
    });
    i.addEventListener("focus", () => {
      if (i.value.trim()) ejecutar();
    });
    i.addEventListener("blur", () => setTimeout(cerrar, 150));
    i.addEventListener("keydown", (ev) => {
      if (sug.hidden) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        idx = (idx + 1) % lista.length;
        pintar();
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        idx = (idx - 1 + lista.length) % lista.length;
        pintar();
      } else if (ev.key === "Enter" && idx >= 0) {
        ev.preventDefault();
        elegir(lista[idx]);
      } else if (ev.key === "Escape") {
        ev.stopPropagation();
        cerrar();
      }
    });
    sug.addEventListener("mousedown", (ev) => ev.preventDefault());
    sug.addEventListener("click", (ev) => {
      const op = ev.target.closest(".cli-op");
      if (op && lista[+op.dataset.i]) elegir(lista[+op.dataset.i]);
    });
  }
  s(e);
  s(t);
}
function customConfirm(e, t = "Confirmación") {
  return new Promise((n) => {
    const r = $("modalConfirmDialog");
    if (!r || typeof r.showModal !== "function") {
      n(window.confirm(e));
      return;
    }
    r.returnValue = "";
    $("confirmDialogTitle").innerText = t;
    $("confirmDialogMessage").innerText = e;
    $("confirmDialogInputBox").style.display = "none";
    const i = $("confirmDialogOk"),
      a = $("confirmDialogCancel"),
      o = () => {
        a.removeEventListener("click", s);
        r.removeEventListener("close", l);
      },
      s = () => r.close("cancel"),
      l = () => {
        const e = r.returnValue === "ok";
        o();
        n(e);
      };
    a.addEventListener("click", s);
    r.addEventListener("close", l);
    i.onclick = (e) => {
      e.preventDefault();
      r.close("ok");
    };
    r.showModal();
  });
}
function customPrompt(e, t = "", n = "Entrada requerida") {
  return new Promise((r) => {
    const i = $("modalConfirmDialog");
    if (!i || typeof i.showModal !== "function") {
      r(window.prompt(e, t));
      return;
    }
    i.returnValue = "";
    $("confirmDialogTitle").innerText = n;
    $("confirmDialogMessage").innerText = e;
    $("confirmDialogInputBox").style.display = "block";
    const a = $("confirmDialogInput");
    a.value = t;
    const o = $("confirmDialogOk"),
      s = $("confirmDialogCancel"),
      l = () => {
        s.removeEventListener("click", c);
        i.removeEventListener("close", d);
        a.removeEventListener("keydown", u);
      },
      c = () => i.close("cancel"),
      u = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          i.close("ok");
        }
      },
      d = () => {
        const e = i.returnValue === "ok" ? a.value : null;
        l();
        r(e);
      };
    s.addEventListener("click", c);
    a.addEventListener("keydown", u);
    i.addEventListener("close", d);
    o.onclick = (e) => {
      e.preventDefault();
      i.close("ok");
    };
    i.showModal();
    setTimeout(() => a.focus(), 50);
  });
}
const ACCIONES = {};
window.accion = (e, t) => {
  if (typeof t === "function") ACCIONES[e] = t;
};
function _delegar(e, t, n = !0) {
  document.addEventListener(
    e,
    (e) => {
      const r = e.target.closest(`[${t}]`);
      if (!r) return;
      const i = r.getAttribute(t),
        a = ACCIONES[i];
      if (!a) return;
      if (n) e.preventDefault();
      a(r, e);
    },
    !1,
  );
}
_delegar("click", "data-action");
_delegar("input", "data-oninput", !1);
_delegar("change", "data-onchange", !1);
_delegar("submit", "data-onsubmit");
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
  if (document.getElementById("toasts"))
    toast("Ha ocurrido un error inesperado. Inténtalo de nuevo.", "err");
});
window.addEventListener("error", (e) => {
  if (
    e.target &&
    (e.target.tagName === "IMG" ||
      e.target.tagName === "SCRIPT" ||
      e.target.tagName === "LINK")
  )
    return;
  console.error("Uncaught error:", e.error || e.message);
  if (document.getElementById("toasts"))
    toast("Ha ocurrido un error inesperado. Inténtalo de nuevo.", "err");
});
