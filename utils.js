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
function fechaLocalISO(e = new Date()) {
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
  const r = (e) =>
      String(e || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    i = (e) => String(e || "").replace(/\D/g, ""),
    a = 8;
  function o() {
    const n = r(e.value).split(" ").filter(Boolean),
      a = r(e.value).length >= 2,
      o = i(t.value),
      s = o.length >= 3;
    if (!a && !s) return [];
    const l =
        (typeof datosLocales !== "undefined" && datosLocales.clientes) || [],
      c = [];
    for (const e of l) {
      const t = r(
        e.nombre_entidad ? `${e.nombre_entidad} ${e.nombre}` : e.nombre,
      );
      if (a && !n.every((e) => t.includes(e))) continue;
      if (s && !i(e.telefono).includes(o)) continue;
      const l = a && t.startsWith(n[0]) ? 0 : 1;
      c.push({ c: e, empieza: l });
    }
    c.sort(
      (e, t) =>
        e.empieza - t.empieza ||
        String(e.c.nombre).localeCompare(String(t.c.nombre), "es"),
    );
    return c.slice(0, a).map((e) => e.c);
  }
  function s(i) {
    if (i.dataset.cliBound) return;
    i.dataset.cliBound = "1";
    const a = document.createElement("div");
    a.className = "cli-wrap";
    i.parentNode.insertBefore(a, i);
    a.appendChild(i);
    const s = document.createElement("div");
    s.className = "cli-sug";
    s.setAttribute("role", "listbox");
    s.hidden = !0;
    a.appendChild(s);
    i.setAttribute("role", "combobox");
    i.setAttribute("aria-autocomplete", "list");
    i.setAttribute("aria-expanded", "false");
    let l = [],
      c = -1;
    const d = () => {
        s.hidden = !0;
        c = -1;
        i.setAttribute("aria-expanded", "false");
      },
      u = () =>
        s
          .querySelectorAll(".cli-op")
          .forEach((e, t) => e.classList.toggle("on", t === c));
    function p(r) {
      e.value = r.nombre_entidad ? r.nombre_entidad : r.nombre;
      t.value = r.telefono || "";
      e.dataset.tipo = r.tipo_cliente || "Particular";
      d();
      if (n) n(r);
    }
    function m() {
      l = o();
      if (!l.length) {
        d();
        return;
      }
      s.innerHTML = l
        .map((e, t) => {
          const n = e.tipo_cliente === "Peña" || e.nombre_entidad,
            r = n
              ? '<span style="background:#f6e3c0;color:#5e410e;font-size:10px;padding:2px 4px;border-radius:4px;margin-left:4px;">PEÑA</span>'
              : "";
          return `<div class="cli-op" role="option" data-i="${t}"><b>${esc(e.nombre_entidad || e.nombre)} ${r}</b><small>${e.telefono ? esc(e.telefono) : "Sin teléfono"}</small></div>`;
        })
        .join("");
      c = -1;
      s.hidden = !1;
      i.setAttribute("aria-expanded", "true");
    }
    i.addEventListener("input", m);
    i.addEventListener("focus", () => {
      if (i.value.trim()) m();
    });
    i.addEventListener("blur", () => setTimeout(d, 150));
    i.addEventListener("keydown", (e) => {
      if (s.hidden) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        c = (c + 1) % l.length;
        u();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        c = (c - 1 + l.length) % l.length;
        u();
      } else if (e.key === "Enter" && c >= 0) {
        e.preventDefault();
        p(l[c]);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        d();
      }
    });
    s.addEventListener("mousedown", (e) => e.preventDefault());
    s.addEventListener("click", (e) => {
      const t = e.target.closest(".cli-op");
      if (t && l[+t.dataset.i]) p(l[+t.dataset.i]);
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
const TRAMOS_90MIN_LUNES_JUEVES = [540, 630, 720, 1020, 1110, 1200, 1290],
  TRAMOS_90MIN_VIERNES_DOMINGO = [540, 630, 720, 1020, 1110, 1200],
  MIN_FIN_MANANA = 840;
function diaSemanaDeFecha(e) {
  const [t, n, r] = e.split("-").map(Number);
  return new Date(t, n - 1, r, 12).getDay();
}
function esFinDeSemanaFecha(e) {
  const t = diaSemanaDeFecha(e);
  return t === 0 || t === 6;
}
function tramos90Fecha(e) {
  const t = diaSemanaDeFecha(e);
  return t >= 1 && t <= 4
    ? TRAMOS_90MIN_LUNES_JUEVES
    : TRAMOS_90MIN_VIERNES_DOMINGO;
}
function duracionesPermitidasFecha(e) {
  return esFinDeSemanaFecha(e) ? [90] : [60, 90];
}
function horarioPermitidoReserva(e, t, n, r = "Normal") {
  if (r !== "Normal") return !0;
  if (!e || typeof t !== "number" || typeof n !== "number") return !0;
  if (esFinDeSemanaFecha(e)) return n === 90 && tramos90Fecha(e).includes(t);
  if (t < MIN_FIN_MANANA) return n === 60 || n === 90 || n === 120;
  return n === 90 && tramos90Fecha(e).includes(t);
}
