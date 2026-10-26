/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const COPIA_TABLAS = {
    reservas: { etiqueta: "Reservas", orden: ["fecha", "id"] },
    clientes: { etiqueta: "Clientes", orden: ["nombre", "id"] },
    ventas: { etiqueta: "Ventas (caja y bar)", orden: ["fecha_hora", "id"] },
    cierres: { etiqueta: "Cierres de caja", orden: ["fecha", "id"] },
    deudas: { etiqueta: "Deudas", orden: ["created_at", "id"] },
    limpiezas: { etiqueta: "Limpiezas", orden: ["created_at", "id"] },
    fichajes: { etiqueta: "Fichajes", orden: ["created_at", "id"] },
    productos: { etiqueta: "Catálogo", orden: ["nombre", "id"] },
    tarifas: { etiqueta: "Tarifas", orden: ["franja"] },
    tienda_articulos: {
      etiqueta: "Escaparate de la tienda",
      orden: ["orden", "id"],
    },
    contratos_jornada: {
      etiqueta: "Contratos de jornada",
      orden: ["created_at", "id"],
    },
    cierres_historial: {
      etiqueta: "Cierres reabiertos (historial)",
      orden: ["reabierto_at", "id"],
    },
    consentimientos: {
      etiqueta: "Consentimientos de privacidad",
      orden: ["created_at", "id"],
    },
    rgpd_log: {
      etiqueta: "Registro de borrados RGPD",
      orden: ["created_at", "id"],
    },
    facturas: { etiqueta: "Facturas", orden: ["fecha", "id"] },
    factura_lineas: {
      etiqueta: "Líneas de factura",
      orden: ["factura_id", "orden"],
    },
    facturas_config: { etiqueta: "Configuración de facturas", orden: ["id"] },
    lista_espera: { etiqueta: "Lista de espera", orden: ["created_at", "id"] },
    usuarios: { etiqueta: "Usuarios del panel", orden: ["id"] },
  },
  COL_PRIVADAS = /codigo|^hash_|pass|salt|token|secret/i,
  CLAVE_ULTIMA_COPIA = "gp-ultima-copia";
function aplicarPermisosCopia() {
  const puede = typeof esJefa === "function" && esJefa();
  const t = $("cardCopia");
  if (t) t.hidden = !puede;
  mostrarUltimaCopia();
}
async function obtenerTabla(e) {
  const t = COPIA_TABLAS[e],
    n = [t.orden, t.orden.slice(0, 1)];
  let r = null;
  for (const e of n) {
    const t = [];
    let n = 0,
      i = !1;
    while (!0) {
      let r = supabaseClient.from(e).select("*");
      e.forEach((e) => {
        r = r.order(e, { ascending: !0 });
      });
      const { data: a, error: o } = await r.range(n, n + 999);
      if (o) {
        r = o;
        i = !0;
        break;
      }
      if (!a || !a.length) break;
      t.push(...a);
      n += a.length;
    }
    if (!i) return t;
  }
  throw r;
}
function celdaCSV(e) {
  if (e === null || e === undefined) return "";
  if (typeof e === "number") return String(e).replace(".", ",");
  if (typeof e === "boolean") return e ? "Sí" : "No";
  if (typeof e === "object") e = JSON.stringify(e);
  e = String(e);
  if (
    /^[=@\t\r]/.test(e) ||
    (/^[+-]/.test(e) && !/^[+-]?[\d\s().,-]+$/.test(e))
  )
    e = "'" + e;
  return /[";\r\n]/.test(e) ? '"' + e.replace(/"/g, '""') + '"' : e;
}
function aCSV(e, t) {
  const n = (e) => {
      if (t === "facturas" && e === "hash_actual") return !1;
      return COL_PRIVADAS.test(e);
    },
    r = [];
  e.forEach((e) =>
    Object.keys(e).forEach((e) => {
      if (!n(e) && !r.includes(e)) r.push(e);
    }),
  );
  const i = [r.map(celdaCSV).join(";")];
  e.forEach((e) => i.push(r.map((t) => celdaCSV(e[t])).join(";")));
  return i.join("\r\n");
}
function sello() {
  const e = new Date(),
    t = (e) => String(e).padStart(2, "0");
  return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())}`;
}
function selloHora() {
  const e = new Date(),
    t = (e) => String(e).padStart(2, "0");
  return `${sello()}_${t(e.getHours())}${t(e.getMinutes())}`;
}
async function exportarTabla(e, t) {
  if (!COPIA_TABLAS[e]) return;
  const n = $("msgCopia");
  setBusy(
    t,
    !0,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Exportando...',
  );
  try {
    const r = await obtenerTabla(e),
      i = "\ufeff" + aCSV(r, e);
    descargarBlob(
      new Blob([i], { type: "text/csv;charset=utf-8" }),
      `geopadel_${e}_${sello()}.csv`,
    );
    toast(`${COPIA_TABLAS[e].etiqueta}: ${r.length} filas exportadas`);
  } catch (r) {
    console.error(r);
    const i =
      "No se pudo exportar " +
      COPIA_TABLAS[e].etiqueta.toLowerCase() +
      ": " +
      (r.message || r);
    toast(i, "err");
    if (n) {
      n.style.color = "var(--red)";
      n.innerText = i;
    }
  } finally {
    setBusy(t, !1);
  }
}
function crearZipAsync(e) {
  return new Promise((t, n) => {
    if (typeof Worker === "undefined") {
      try {
        t(CopiaZip.crearZip(e));
      } catch (e) {
        n(e);
      }
      return;
    }
    let r;
    try {
      r = new Worker("copia-worker.js");
    } catch (a) {
      try {
        t(CopiaZip.crearZip(e));
      } catch (e) {
        n(e);
      }
      return;
    }
    const i = setTimeout(() => {
      try {
        r.terminate();
      } catch (e) {}
      try {
        t(CopiaZip.crearZip(e));
      } catch (e) {
        n(e);
      }
    }, 9e4);
    r.onmessage = (e) => {
      clearTimeout(i);
      try {
        r.terminate();
      } catch (e) {}
      const a = e.data || {};
      if (!a.ok) return n(new Error(a.error || "worker_error"));
      t(new Blob([a.buffer], { type: "application/zip" }));
    };
    r.onerror = (e) => {
      clearTimeout(i);
      try {
        r.terminate();
      } catch (e) {}
      console.error("worker error", e);
      try {
        t(CopiaZip.crearZip(e));
      } catch (e) {
        n(e);
      }
    };
    try {
      r.postMessage({ archivos: e });
    } catch (a) {
      clearTimeout(i);
      try {
        r.terminate();
      } catch (e) {}
      try {
        t(CopiaZip.crearZip(e));
      } catch (e) {
        n(e);
      }
    }
  });
}
async function descargarCopiaCompleta() {
  const e = $("btnCopiaZip"),
    t = $("msgCopia"),
    n = new TextEncoder(),
    r = [],
    i = [];
  setBusy(
    e,
    !0,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Preparando copia...',
  );
  try {
    for (const e of Object.keys(COPIA_TABLAS)) {
      t.style.color = "var(--muted)";
      t.innerText = `Descargando ${COPIA_TABLAS[e].etiqueta.toLowerCase()}...`;
      try {
        const t = await obtenerTabla(e);
        r.push({ nombre: `${e}.csv`, datos: n.encode("\ufeff" + aCSV(t, e)) });
        i.push(`${e}.csv: ${t.length} filas`);
      } catch (t) {
        console.error(t);
        i.push(`${e}: NO incluida (${(t && t.message) || t})`);
      }
    }
    if (!r.length) throw new Error("No se pudo leer ninguna tabla");
    const a = usuarioSesion ? usuarioSesion.user || usuarioSesion.nombre : "",
      o = `Copia de seguridad de Geopadel\r\nFecha: ${new Date().toLocaleString("es-ES")}\r\nGenerada por: ${a}\r\n\r\n${i.join("\r\n")}\r\n\r\nLos CSV usan «;» como separador y codificación UTF-8 (se abren con Excel).\r\nNo se incluyen códigos ni claves de clientes.\r\n`;
    r.push({ nombre: "LEEME.txt", datos: n.encode(o) });
    t.style.color = "var(--muted)";
    t.innerText = "Comprimiendo ZIP...";
    const s = await crearZipAsync(r);
    descargarBlob(s, `geopadel_copia_${selloHora()}.zip`);
    try {
      localStorage.setItem(CLAVE_ULTIMA_COPIA, new Date().toISOString());
    } catch (e) {}
    mostrarUltimaCopia();
    const l = i.filter((e) => e.includes("NO incluida")).length;
    t.style.color = l ? "var(--amber)" : "var(--green)";
    t.innerText = l
      ? `Copia descargada, pero ${l} tabla(s) no se pudieron incluir (mira LEEME.txt).`
      : "Copia completa descargada.";
  } catch (e) {
    console.error(e);
    t.style.color = "var(--red)";
    t.innerText = "No se pudo crear la copia: " + (e.message || e);
  } finally {
    setBusy(e, !1);
  }
}
function mostrarUltimaCopia() {
  const e = $("copiaUltima");
  if (!e) return;
  let t = null;
  try {
    t = localStorage.getItem(CLAVE_ULTIMA_COPIA);
  } catch (e) {}
  if (!t) {
    e.style.color = "var(--orange-text)";
    e.innerText = "Aún no has descargado ninguna copia en este dispositivo.";
    return;
  }
  const n = Math.floor((Date.now() - new Date(t).getTime()) / 864e5);
  e.style.color = n > 7 ? "var(--red)" : "var(--green-text)";
  e.innerText = `Última copia en este dispositivo: ${new Date(t).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}${n > 7 ? ` (hace ${n} días, conviene hacer otra)` : ""}.`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-exp]");
  if (t && !t.disabled) exportarTabla(t.dataset.exp, t);
});
$("btnCopiaZip").addEventListener("click", descargarCopiaCompleta);
mostrarUltimaCopia();
