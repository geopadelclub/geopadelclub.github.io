/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const CLI_MAX_FILAS = 30;
const CLI_SPIN = '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>';
let cliFiltrados = [];
let cliBloqueados = new Set();
const cliNorm = (s) => String(s || "").trim();
const cliTel = (s) => String(s || "").replace(/[^\d+]/g, "");

async function cargarBloqueadosClientes() {
  try {
    const { data, error } = await supabaseClient
      .from("clientes")
      .select("telefono")
      .eq("bloqueado", true);
    if (error) throw error;
    cliBloqueados = new Set(
      (data || []).map((x) => String(x.telefono || "").replace(/\D/g, "")),
    );
  } catch (e) {
    console.warn("No se pudo cargar el estado de bloqueo:", e);
    cliBloqueados = new Set();
  }
}
async function cargarDeudasClientes(tels) {
  if (!tels || !tels.length) return new Map();
  try {
    const telsNorm = tels
      .map((t) => String(t || "").replace(/\D/g, ""))
      .filter((t) => t.length >= 9);
    if (!telsNorm.length) return new Map();

    const { data, error } = await supabaseClient
      .from("deudas")
      .select("telefono, importe, estado");
    if (error) throw error;

    const deudasPorTel = new Map();
    (data || []).forEach((d) => {
      if (d.estado === "Resuelta") return;
      const tel = String(d.telefono || "").replace(/\D/g, "");
      if (!tel || !telsNorm.includes(tel)) return;
      deudasPorTel.set(
        tel,
        (deudasPorTel.get(tel) || 0) + (Number(d.importe) || 0),
      );
    });
    return deudasPorTel;
  } catch (e) {
    console.warn("No se pudieron cargar las deudas:", e);
    return new Map();
  }
}
async function dibujarClientesAjustes() {
  const tb = $("cliBody");
  if (!tb) return;
  const raw = $("cliBuscar").value;
  const q = cliNorm(raw);
  const qt = cliTel(raw);
  const tieneLetras = /[a-z]/i.test(q);
  const tieneNumeros = qt.length >= 3;

  if (!tieneLetras && !tieneNumeros) {
    tb.innerHTML =
      '<tr><td colspan="4" class="tabla-empty">Escribe al menos 2 letras o 3 cifras para buscar.</td></tr>';
    $("cliContador").innerText = "";
    return;
  }

  await cargarBloqueadosClientes();

  const { data, error } = await supabaseClient.rpc("gp_buscar_clientes", {
    p_q: tieneLetras ? q : "",
    p_tel: tieneNumeros ? qt : "",
  });

  if (error) {
    tb.innerHTML = `<tr><td colspan="4" class="tabla-empty" style="color:var(--red)">Error al buscar: ${esc(error.message)}</td></tr>`;
    return;
  }

  cliFiltrados = data || [];
  const lista = cliFiltrados;
  $("cliContador").innerText =
    lista.length === 30
      ? "Mostrando los primeros 30. Escribe más letras para afinar."
      : `${lista.length} ${lista.length === 1 ? "cliente" : "clientes"}`;

  if (!lista.length) {
    const telDigits = qt.replace(/\D/g, "");
    const puedeCrear = telDigits.length >= 9 && /^[+\d\s().-]+$/.test(raw);
    tb.innerHTML = `<tr><td colspan="4" class="tabla-empty">
      No hay clientes con ese nombre o teléfono.
      ${
        puedeCrear
          ? `<br><button type="button" class="btn-add blue" id="btnCrearCliente" data-tel="${esc(telDigits)}" style="margin-top:12px"><i class="ri-user-add-line" aria-hidden="true"></i>Crear cliente con teléfono ${esc(telDigits)}</button>`
          : ""
      }
    </td></tr>`;
    return;
  }

  const deudasPorTel = await cargarDeudasClientes(lista.map((c) => c.telefono));

  tb.innerHTML = lista
    .map((c, i) => {
      const telNorm = String(c.telefono || "").replace(/\D/g, "");
      const estaBloqueado = telNorm && cliBloqueados.has(telNorm);
      const deuda = deudasPorTel.get(telNorm) || 0;
      const deudaMax = 20;
      const debeDemasiado = deuda > deudaMax;
      const tel = c.telefono
        ? `<a href="tel:${esc(c.telefono)}" style="color:var(--blue);font-weight:700">${esc(c.telefono)}</a>`
        : '<span style="color:var(--muted)">Sin teléfono</span>';
      const sinTel = c.telefono
        ? ""
        : ' disabled title="El cliente no tiene teléfono"';
      const soloJefa = esJefa();
      const estadoBloq = estaBloqueado
        ? '<br><span style="color:var(--red);font-weight:800;font-size:11px"><i class="ri-forbid-line" aria-hidden="true"></i> BLOQUEADO</span>'
        : "";
      const deudaHtml =
        deuda > 0
          ? `<b style="color:${debeDemasiado ? "var(--red)" : "var(--orange-text)"};font-weight:800">${eur(deuda)}</b>${debeDemasiado ? '<br><small style="color:var(--red);font-weight:700;font-size:10px">NO PUEDE RESERVAR</small>' : ""}`
          : '<span style="color:var(--muted)">—</span>';
      return `<tr><td><b>${esc(c.nombre)}</b>${estadoBloq}</td><td>${tel}</td><td>${deudaHtml}</td><td class="esc-acciones">
${soloJefa ? `<button type="button" class="btn-add gray" data-cli="reset" data-i="${i}"${sinTel}><i class="ri-key-2-line" aria-hidden="true"></i>Restablecer código</button>` : ""}
<button type="button" class="btn-add blue" data-cli="habilitar" data-i="${i}"${sinTel}><i class="ri-global-line" aria-hidden="true"></i>Habilitar acceso web</button>
${
  estaBloqueado
    ? `<button type="button" class="btn-add gray" data-cli="desbloquear" data-i="${i}"${sinTel}><i class="ri-lock-unlock-line" aria-hidden="true"></i>Desbloquear</button>`
    : `<button type="button" class="btn-add danger" data-cli="bloquear" data-i="${i}"${sinTel}><i class="ri-forbid-line" aria-hidden="true"></i>Bloquear</button>`
}
${soloJefa ? `<button type="button" class="btn-add danger" data-cli="borrar" data-i="${i}"><i class="ri-user-unfollow-line" aria-hidden="true"></i>Borrar datos (RGPD)</button>` : ""}
</td></tr>`;
    })
    .join("");
}

async function entrarAjustes() {
  $("cliBuscar").value = "";
  await dibujarClientesAjustes();
  if (typeof cargarBloqueosPersistentes === "function")
    await cargarBloqueosPersistentes();
}

if (typeof window.accion === "function") {
  window.accion("filtrar-clientes", debounce(dibujarClientesAjustes, 300));
}

async function crearClienteDesdeAjustes(tel) {
  if (!tel || tel.length < 9) return;
  const nombreRaw = await customPrompt(
    `Vas a crear un nuevo cliente con el teléfono ${tel}.\n\nIntroduce el nombre y apellidos (por ejemplo: Juan Pérez García).`,
    "",
    "Nuevo cliente",
  );
  if (nombreRaw === null) return;
  const nombre = String(nombreRaw).trim().replace(/\s+/g, " ");
  if (nombre.split(" ").length < 2)
    return toast("Escribe nombre y apellidos (al menos 2 palabras)", "warn");
  try {
    const { data, error } = await supabaseClient.rpc(
      "gp_crear_cliente_manual",
      { p_nombre: nombre, p_telefono: tel },
    );
    if (error) throw error;
    if (!data || !data.ok) {
      const t = {
        sin_permiso: "No tienes permiso para crear clientes",
        telefono_invalido: "El teléfono no es válido",
        nombre_invalido: "El nombre no es válido",
        telefono_duplicado: "Ya existe un cliente con ese teléfono",
      };
      return toast(t[data && data.error] || "No se pudo crear", "err");
    }
    toast(`Cliente «${nombre}» creado`);
    await dibujarClientesAjustes();
  } catch (err) {
    toast("No se pudo crear: " + (err.message || err), "err");
  }
}

async function cliResetearCodigo(c, btn) {
  if (!esJefa()) return toast("Solo la jefa puede restablecer códigos", "err");
  if (
    !(await customConfirm(
      `¿Restablecer el código web de «${c.nombre}» y habilitarle el acceso web?\n\nTendrá que crear uno nuevo en su próxima reserva. Hazlo solo si has comprobado que es él.`,
    ))
  )
    return;
  setBusy(btn, true, CLI_SPIN + "Restableciendo...");
  try {
    const { data, error } = await supabaseClient.rpc(
      "gp_resetear_codigo_cliente",
      { p_telefono: c.telefono },
    );
    if (error) throw error;
    if (!data || !data.ok)
      return toast("No tienes permiso para hacerlo", "err");
    const h = await supabaseClient.rpc("gp_habilitar_acceso_web", {
      p_telefono: c.telefono,
    });
    if (h.error || !h.data || !h.data.ok) {
      console.warn("No se pudo habilitar el acceso web", h.error);
      return toast(
        "Código restablecido, pero no se pudo habilitar el acceso web",
        "warn",
      );
    }
    toast("Código web restablecido y acceso web habilitado");
  } catch (err) {
    toast("No se pudo restablecer: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

async function cliHabilitarAcceso(c, btn) {
  if (
    !(await customConfirm(
      `¿Habilitar el acceso web de «${c.nombre}»?\n\nPodrá crear su código en su próxima reserva online. Hazlo solo si has comprobado que es él.`,
    ))
  )
    return;
  setBusy(btn, true, CLI_SPIN + "Habilitando...");
  try {
    const { data, error } = await supabaseClient.rpc(
      "gp_habilitar_acceso_web",
      { p_telefono: c.telefono },
    );
    if (error) throw error;
    if (!data || !data.ok)
      return toast("No tienes permiso para hacerlo", "err");
    toast("Acceso web habilitado");
  } catch (err) {
    toast("No se pudo habilitar: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

async function cliBloquearCliente(c, btn) {
  if (!c.telefono) return toast("El cliente no tiene teléfono", "warn");
  const motivo = await customPrompt(
    `Motivo para bloquear a «${c.nombre}» (mínimo 5 caracteres). El cliente no podrá hacer reservas ni por la web ni en el panel hasta que se le desbloquee.`,
    "",
    "Bloquear cliente",
  );
  if (motivo === null) return;
  const m = (motivo || "").trim();
  if (m.length < 5)
    return toast("Escribe un motivo de al menos 5 caracteres", "warn");
  setBusy(btn, true, CLI_SPIN + "Bloqueando...");
  try {
    const { data, error } = await supabaseClient.rpc("gp_bloquear_cliente", {
      p_telefono: c.telefono,
      p_motivo: m,
    });
    if (error) throw error;
    if (!data || !data.ok) {
      const t = {
        sin_permiso: "No tienes permiso para bloquear clientes",
        telefono_invalido: "El teléfono no es válido",
        motivo_corto: "El motivo es demasiado corto",
      };
      return toast(t[data && data.error] || "No se pudo bloquear", "err");
    }
    toast("Cliente bloqueado");
    await dibujarClientesAjustes();
  } catch (err) {
    toast("No se pudo bloquear: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

async function cliDesbloquearCliente(c, btn) {
  if (!c.telefono) return toast("El cliente no tiene teléfono", "warn");
  if (
    !(await customConfirm(
      `¿Desbloquear a «${c.nombre}»? Volverá a poder hacer reservas con normalidad.`,
    ))
  )
    return;
  setBusy(btn, true, CLI_SPIN + "Desbloqueando...");
  try {
    const { data, error } = await supabaseClient.rpc("gp_desbloquear_cliente", {
      p_telefono: c.telefono,
    });
    if (error) throw error;
    if (!data || !data.ok) {
      const t = {
        sin_permiso: "No tienes permiso para desbloquear clientes",
        telefono_invalido: "El teléfono no es válido",
      };
      return toast(t[data && data.error] || "No se pudo desbloquear", "err");
    }
    toast("Cliente desbloqueado");
    await dibujarClientesAjustes();
  } catch (err) {
    toast("No se pudo desbloquear: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

async function cliBorrarDatos(c, btn) {
  if (!esJefa())
    return toast("Solo la jefa puede borrar datos de clientes", "err");
  if (!c.id)
    return toast(
      "Falta el identificador del cliente. Recarga la lista e inténtalo de nuevo.",
      "err",
    );
  if (
    !(await customConfirm(
      `¿Borrar los datos personales de «${c.nombre}»?\n\nSe elimina su ficha y se quita su nombre y teléfono de reservas y de deudas (los importes se conservan sin datos personales). Se cancelan sus reservas futuras sin cobros. No se puede deshacer.`,
    ))
  )
    return;
  setBusy(btn, true, CLI_SPIN + "Borrando...");
  try {
    const { data, error } = await supabaseClient.rpc("gp_borrar_cliente", {
      p_id: c.id,
    });
    if (error) throw error;
    if (!data || !data.ok) {
      const t = {
        deuda_pendiente:
          "Tiene deudas pendientes. Resuélvelas antes de borrar sus datos.",
        reservas_pagadas:
          "Tiene reservas futuras con cobros. Devuelve o elimina esas reservas antes.",
        no_encontrado: "No hay ninguna ficha de cliente con ese nombre.",
        sin_permiso: "No tienes permiso para hacerlo.",
      };
      return toast(t[data && data.error] || "No se pudo borrar", "err");
    }
    toast("Datos del cliente borrados");
    await cargarClientes();
    dibujarClientesAjustes();
    cargarReservasHoy();
    cargarDeudas();
  } catch (err) {
    toast("No se pudo borrar: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

$("cliBody").addEventListener("click", async (e) => {
  const btnCrear = e.target.closest("#btnCrearCliente");
  if (btnCrear) {
    await crearClienteDesdeAjustes(btnCrear.dataset.tel);
    return;
  }
  const b = e.target.closest("button[data-cli]");
  if (!b || b.disabled) return;
  const c = cliFiltrados[parseInt(b.dataset.i, 10)];
  if (!c) return;
  if (b.dataset.cli === "reset") cliResetearCodigo(c, b);
  else if (b.dataset.cli === "habilitar") cliHabilitarAcceso(c, b);
  else if (b.dataset.cli === "bloquear") cliBloquearCliente(c, b);
  else if (b.dataset.cli === "desbloquear") cliDesbloquearCliente(c, b);
  else if (b.dataset.cli === "borrar") cliBorrarDatos(c, b);
});
async function cargarBloqueosPersistentes() {
  const tb = $("bloqueosPersistBody");
  if (!tb) return;
  tb.innerHTML =
    '<tr><td colspan="6" class="tabla-empty">Cargando bloqueos…</td></tr>';
  try {
    const { data, error } = await supabaseClient.rpc("gp_listar_bloqueos");
    if (error) throw error;
    if (!data || !data.ok) {
      tb.innerHTML =
        '<tr><td colspan="6" class="tabla-empty" style="color:var(--red)">No tienes permiso para ver los bloqueos</td></tr>';
      return;
    }
    dibujarBloqueosPersistentes(data.bloqueos || []);
  } catch (err) {
    console.error(err);
    tb.innerHTML = `<tr><td colspan="6" class="tabla-empty" style="color:var(--red)">Error al cargar: ${esc(err.message || err)}</td></tr>`;
  }
}

function dibujarBloqueosPersistentes(lista) {
  const tb = $("bloqueosPersistBody");
  if (!tb) return;

  if (!lista.length) {
    tb.innerHTML =
      '<tr><td colspan="6" class="tabla-empty">No hay teléfonos bloqueados</td></tr>';
    return;
  }

  const fmtFecha = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  };

  tb.innerHTML = lista
    .map((b) => {
      const sinFicha = !b.tiene_ficha;
      const fichaTxt = sinFicha
        ? '<br><span style="color:var(--orange-text);font-weight:800;font-size:10px"><i class="ri-user-unfollow-line" aria-hidden="true"></i> SIN FICHA (RGPD)</span>'
        : b.cliente_nombre
          ? `<br><small style="color:var(--muted);font-weight:600">${esc(b.cliente_nombre)}</small>`
          : "";
      return `<tr>
<td><b>${esc(b.telefono_norm)}</b>${fichaTxt}</td>
<td>${esc(b.motivo || "—")}</td>
<td>${esc(b.bloqueado_por || "—")}</td>
<td>${esc(fechaCorta(b.bloqueado_at))}</td>
<td>${esc(fechaCorta(b.expira_at))}</td>
<td><button type="button" class="btn-add gray" data-bloqueo-tel="${esc(b.telefono_norm)}"><i class="ri-lock-unlock-line" aria-hidden="true"></i>Desbloquear</button></td>
</tr>`;
    })
    .join("");
}

async function desbloquearDesdeLista(tel, btn) {
  if (
    !(await customConfirm(
      `¿Desbloquear el teléfono ${tel}?\n\nPodrá volver a hacer reservas con normalidad (si tiene ficha o si vuelve a crear una).`,
    ))
  )
    return;
  setBusy(btn, true, CLI_SPIN + "Desbloqueando...");
  try {
    const { data, error } = await supabaseClient.rpc("gp_desbloquear_cliente", {
      p_telefono: tel,
    });
    if (error) throw error;
    if (!data || !data.ok) {
      const t = {
        sin_permiso: "No tienes permiso para desbloquear clientes",
        telefono_invalido: "El teléfono no es válido",
      };
      return toast(t[data && data.error] || "No se pudo desbloquear", "err");
    }
    toast("Teléfono desbloqueado");
    await cargarBloqueosPersistentes();
    if (typeof dibujarClientesAjustes === "function") {
      await dibujarClientesAjustes();
    }
  } catch (err) {
    toast("No se pudo desbloquear: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}

if ($("btnRefrescarBloqueos")) {
  $("btnRefrescarBloqueos").addEventListener(
    "click",
    cargarBloqueosPersistentes,
  );
}

if ($("bloqueosBody")) {
  $("bloqueosBody").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-bloqueo-tel]");
    if (!b || b.disabled) return;
    await desbloquearDesdeLista(b.dataset.bloqueoTel, b);
  });
}
