/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const totalItems = (items) =>
  redondear2((items || []).reduce((s, i) => s + (Number(i.precio) || 0), 0));
let historialMesa = {};
let _ocultarDeshacerTimer = null;
function guardarHistorialMesa(mesa) {
  historialMesa[mesa] = {
    items: (cuentasMesas[mesa] || []).slice(),
    ts: Date.now(),
  };
  clearTimeout(_ocultarDeshacerTimer);
  _ocultarDeshacerTimer = setTimeout(mostrarBotonDeshacer, 8200);
}
function mostrarBotonDeshacer() {
  const b = $("btnDeshacerTicket");
  if (!b) return;
  const h = historialMesa[mesaSeleccionada];
  const visible = !!(h && Date.now() - h.ts < 8000);
  if (!visible && h) delete historialMesa[mesaSeleccionada];
  b.hidden = !visible;
}
function crearBotonDeshacer() {
  if ($("btnDeshacerTicket")) return;
  const box = document.querySelector(".ticket-box");
  if (!box) return;
  const b = document.createElement("button");
  b.type = "button";
  b.id = "btnDeshacerTicket";
  b.className = "btn-add gray btn-deshacer-ticket";
  b.hidden = true;
  b.innerHTML =
    '<i class="ri-arrow-go-back-line" aria-hidden="true"></i>Deshacer último cambio';

  const target = box.querySelector(".ticket-total");
  if (target) target.after(b);
  else box.appendChild(b);

  b.addEventListener("click", deshacerUltimoCambio);
}
async function deshacerUltimoCambio() {
  const mesa = mesaSeleccionada;
  const h = historialMesa[mesa];
  if (!h) return;
  const items = h.items.slice();
  delete historialMesa[mesa];
  mostrarBotonDeshacer();
  cuentasMesas[mesa] = items;
  renderSelectorMesas();
  colaMesas = colaMesas.then(async () => {
    try {
      const r = await supabaseClient.rpc("mesa_set_items", {
        p_mesa: mesa,
        p_items: items,
      });
      if (r.error) throw r.error;
      if (Array.isArray(r.data)) cuentasMesas[mesa] = r.data;
      renderSelectorMesas();
    } catch (e) {
      console.error(e);
      toast("No se pudo deshacer: " + (e.message || e), "err");
      cargarMesasBar();
    }
  });
}
$("buscarTPV").addEventListener(
  "input",
  debounce(() => dibujarCatalogo(datosLocales.productos), 150),
);
function renderSelectorMesas() {
  const nav = $("selectorMesas");
  if (!nav) return;
  nav.innerHTML = "";
  listaMesas.forEach((m) => {
    const total = totalItems(cuentasMesas[m]);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn-mesa ${m === mesaSeleccionada ? "activa" : ""}`;
    btn.dataset.mesa = m;
    btn.innerHTML = `${esc(m)} ${total > 0 ? `<span class="badge-total">${eur(total)}</span>` : ""}`;
    nav.appendChild(btn);
  });
  renderTicketMesaActiva();
}
$("selectorMesas").addEventListener("click", (e) => {
  const b = e.target.closest(".btn-mesa");
  if (b) {
    mesaSeleccionada = b.dataset.mesa;
    renderSelectorMesas();
  }
});
function renderTicketMesaActiva() {
  const list = $("ticketItems");
  $("tituloTicketMesa").innerText = mesaSeleccionada;
  list.innerHTML = "";
  const items = cuentasMesas[mesaSeleccionada] || [];
  if (!items.length) {
    list.innerHTML =
      '<li class="ticket-empty">Sin artículos · toca un producto para añadirlo</li>';
    $("ticketTotal").innerText = eur(0);
    mostrarBotonDeshacer();
    return;
  }
  const grupos = [];
  const porKey = new Map();
  items.forEach((it, i) => {
    const k =
      it.id != null ? "id:" + it.id : "n:" + it.nombre + "|" + it.precio;
    if (!porKey.has(k)) {
      porKey.set(k, grupos.length);
      grupos.push({ item: it, indices: [i] });
    } else {
      grupos[porKey.get(k)].indices.push(i);
    }
  });
  grupos.forEach((g) => {
    const cant = g.indices.length;
    const precioUnit = Number(g.item.precio) || 0;
    const li = document.createElement("li");
    li.dataset.index = g.indices[0];
    li.dataset.cant = cant;
    li.title =
      cant > 1
        ? `Toca para quitar una unidad (quedan ${cant})`
        : "Toca para quitar";
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.setAttribute(
      "aria-label",
      `Quitar ${cant > 1 ? "una unidad de " : ""}${g.item.nombre} (${eur(precioUnit)})`,
    );
    li.innerHTML = `<span>${esc(g.item.nombre)}${cant > 1 ? ` <small class="ticket-cant">×${cant}</small>` : ""}</span> <span>${eur(precioUnit * cant)} <i class="ri-close-line" aria-hidden="true"></i></span>`;
    list.appendChild(li);
  });
  $("ticketTotal").innerText = eur(totalItems(items));
  mostrarBotonDeshacer();
}
$("ticketItems").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-index]");
  if (li) quitarDelTicket(parseInt(li.dataset.index, 10));
});
$("ticketItems").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const li = e.target.closest("li[data-index]");
  if (!li) return;
  e.preventDefault();
  quitarDelTicket(parseInt(li.dataset.index, 10));
});
$("catTPVBotones").addEventListener("click", (e) => {
  const b = e.target.closest(".btn-cat-filter");
  if (!b) return;
  categoriaTPVFiltro = b.dataset.cat;
  document
    .querySelectorAll("#catTPVBotones .btn-cat-filter")
    .forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  dibujarCatalogo(datosLocales.productos);
});
const faltaFuncion = (err) =>
  !!err &&
  (err.code === "PGRST202" ||
    err.code === "42883" ||
    /could not find the function|does not exist/i.test(
      String(err.message || ""),
    ));
function mutarMesa(mesa, fn, rpcNombre, rpcArgs) {
  colaMesas = colaMesas.then(async () => {
    try {
      if (rpcNombre) {
        const r = await supabaseClient.rpc(rpcNombre, rpcArgs);
        if (!r.error) {
          cuentasMesas[mesa] = Array.isArray(r.data) ? r.data : [];
          renderSelectorMesas();
          return;
        }
        if (!faltaFuncion(r.error)) throw r.error;
      }
      const { data, error } = await supabaseClient
        .from("mesas_bar")
        .select("items")
        .eq("mesa", mesa)
        .maybeSingle();
      if (error) throw error;
      const items = fn(Array.isArray(data?.items) ? [...data.items] : []);
      const { error: e2 } = await supabaseClient
        .from("mesas_bar")
        .upsert({ mesa, items }, { onConflict: "mesa" });
      if (e2) throw e2;
      cuentasMesas[mesa] = items;
      renderSelectorMesas();
    } catch (err) {
      console.error(err);
      toast("No se pudo actualizar la cuenta: " + (err.message || err), "err");
      cargarMesasBar();
    }
  });
  return colaMesas;
}
function agregarAlTicket(prod) {
  const mesa = mesaSeleccionada;
  guardarHistorialMesa(mesa);
  cuentasMesas[mesa] = [...(cuentasMesas[mesa] || []), prod];
  renderSelectorMesas();
  return mutarMesa(
    mesa,
    (items) => {
      items.push(prod);
      return items;
    },
    "mesa_agregar",
    { p_mesa: mesa, p_producto_id: prod.id },
  );
}
function quitarDelTicket(index) {
  const mesa = mesaSeleccionada;
  const item = (cuentasMesas[mesa] || [])[index];
  if (!item) return;
  guardarHistorialMesa(mesa);
  cuentasMesas[mesa] = cuentasMesas[mesa].filter((_, i) => i !== index);
  renderSelectorMesas();
  return mutarMesa(
    mesa,
    (items) => {
      let i =
        items[index] && items[index].nombre === item.nombre
          ? index
          : items.findIndex(
              (x) => x.nombre === item.nombre && x.precio === item.precio,
            );
      if (i >= 0) items.splice(i, 1);
      return items;
    },
    "mesa_quitar",
    {
      p_mesa: mesa,
      p_index: index,
      p_nombre: item.nombre,
      p_precio: Number(item.precio) || 0,
    },
  );
}
async function cobrarMesaActiva(metodoPago) {
  if (cobrando) return;
  cobrando = true;
  const botones = [$("btnCobrarEfectivo"), $("btnCobrarTarjeta")];
  botones.forEach((b) => (b.disabled = true));
  const msg = $("msgVenta");
  const mesa = mesaSeleccionada;
  try {
    await colaMesas;
    const rc = await supabaseClient.rpc("cobrar_mesa", {
      p_mesa: mesa,
      p_metodo: metodoPago,
    });
    if (rc.error) throw rc.error;
    if (!rc.data || !rc.data.ok) {
      msg.style.color = "var(--muted)";
      msg.innerText = "La cuenta está vacía";
      return;
    }
    cuentasMesas[mesa] = [];
    renderSelectorMesas();
    msg.style.color = "var(--green)";
    msg.innerText = `Cobrado ${eur(rc.data.total)} (${metodoPago})`;
    setTimeout(() => {
      if (msg.innerText.startsWith("Cobrado")) msg.innerText = "";
    }, 5000);
    cargarCajaHoy();
  } catch (err) {
    console.error(err);
    msg.style.color = "var(--red)";
    msg.innerText = "No se pudo cobrar: " + (err.message || err);
  } finally {
    cobrando = false;
    botones.forEach((b) => (b.disabled = false));
  }
}
function dibujarCatalogo(productos) {
  const grid = $("catalogGrid");
  if (grid) {
    const q = ($("buscarTPV")?.value || "").toLowerCase().trim();
    const lista = (productos || []).filter(
      (p) =>
        p.estado !== "Eliminado" &&
        p.estado !== "Inactivo" &&
        (categoriaTPVFiltro === "Todos" ||
          p.categoria === categoriaTPVFiltro) &&
        (!q || String(p.nombre).toLowerCase().includes(q)),
    );
    grid.innerHTML = lista.length
      ? lista
          .map(
            (p) =>
              `<button type="button" class="btn-product" data-id="${esc(p.id)}">${esc(p.nombre)} <span>${eur(p.precio)}</span></button>`,
          )
          .join("")
      : '<p style="color:var(--muted);font-weight:600">No hay productos en esta categoría.</p>';
  }
}
$("catalogGrid").addEventListener("click", (e) => {
  const b = e.target.closest(".btn-product");
  if (!b) return;
  const p = (datosLocales.productos || []).find(
    (x) => String(x.id) === b.dataset.id,
  );
  if (p)
    agregarAlTicket({
      id: p.id,
      nombre: p.nombre,
      precio: parseFloat(p.precio),
    });
});
function filtrarGestionCatalogo() {
  const tbody = $("tablaProductosBody");
  if (!tbody) return;
  const q = ($("buscarProdGestion")?.value || "").toLowerCase().trim();
  const cat = $("catFilterGestion")?.value || "Todos";
  const prods = (datosLocales.productos || []).filter(
    (p) =>
      p.estado !== "Eliminado" &&
      (cat === "Todos" || p.categoria === cat) &&
      (!q || String(p.nombre).toLowerCase().includes(q)),
  );
  if (!prods.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="tabla-empty">No se encontraron artículos</td></tr>`;
    return;
  }
  tbody.innerHTML = prods
    .map(
      (p) => `
<tr>
<td><b>${esc(p.nombre)}</b></td>
<td><b>${eur(p.precio)}</b></td>
<td>${esc(p.categoria)}</td>
<td><span style="color:${p.estado === "Activo" ? "var(--green)" : "var(--orange-text)"};font-weight:800">${p.estado === "Activo" ? '<i class="ri-checkbox-circle-line" aria-hidden="true"></i>Activo' : '<i class="ri-pause-circle-line" aria-hidden="true"></i>Inactivo'}</span></td><td>
<button type="button" class="btn-edit-prod" data-act="edit" data-id="${esc(p.id)}"><i class="ri-edit-line" aria-hidden="true"></i>Editar</button>
<button type="button" class="btn-del-prod" data-act="del" data-id="${esc(p.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>Eliminar</button>
</td>
</tr>`,
    )
    .join("");
}
$("tablaProductosBody").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  if (b.dataset.act === "edit") abrirModalEditarProducto(b.dataset.id);
  else eliminarProductoCat(b.dataset.id);
});
function abrirModalNuevoProducto() {
  $("modalProductoTitulo").innerText = "Nuevo artículo";
  $("modalProdId").value = "";
  $("modalProdNombre").value = "";
  $("modalProdPrecio").value = "";
  $("modalProdCat").value = "Bebidas";
  $("modalProdEstado").value = "Activo";
  abrirOverlay("modalProducto");
  setTimeout(() => $("modalProdNombre").focus(), 60);
}
function abrirModalEditarProducto(id) {
  const p = (datosLocales.productos || []).find(
    (x) => String(x.id) === String(id),
  );
  if (!p) return;
  $("modalProductoTitulo").innerText = "Editar artículo";
  $("modalProdId").value = p.id;
  $("modalProdNombre").value = p.nombre;
  $("modalProdPrecio").value = p.precio;
  $("modalProdCat").value = p.categoria;
  $("modalProdEstado").value = p.estado || "Activo";
  abrirOverlay("modalProducto");
}
function cerrarModalProducto() {
  cerrarOverlay("modalProducto");
}
async function guardarProductoModal() {
  const id = $("modalProdId").value;
  const nombre = $("modalProdNombre").value.trim();
  const precio = parseFloat($("modalProdPrecio").value);
  const categoria = $("modalProdCat").value;
  const estado = $("modalProdEstado").value;
  if (!nombre || isNaN(precio) || precio < 0)
    return toast("Revisa el nombre y el precio del artículo", "warn");
  const btn = $("btnGuardarProducto");
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...',
  );
  try {
    const q = id
      ? supabaseClient
          .from("productos")
          .update({ nombre, precio, categoria, estado })
          .eq("id", id)
      : supabaseClient
          .from("productos")
          .insert({ nombre, precio, categoria, estado });
    const { error } = await q;
    if (error) throw error;
    cerrarModalProducto();
    toast("Artículo guardado");
    cargarProductos();
  } catch (err) {
    toast("No se pudo guardar el artículo: " + (err.message || err), "err");
  } finally {
    setBusy(btn, false);
  }
}
async function eliminarProductoCat(idProd) {
  if (!(await customConfirm("¿Deseas eliminar este artículo del catálogo?")))
    return;
  const { error } = await supabaseClient
    .from("productos")
    .update({ estado: "Eliminado" })
    .eq("id", idProd);
  if (error) return toast("No se pudo eliminar: " + error.message, "err");
  toast("Artículo eliminado");
  cargarProductos();
}

async function emitirJustificanteTPV() {
  const mesa = mesaSeleccionada;
  const items = cuentasMesas[mesa] || [];
  if (!items.length) return toast("La cuenta está vacía", "warn");

  const metodoRaw = await customPrompt(
    "¿Método de pago? (Efectivo o Tarjeta)",
    "Efectivo",
    "Emitir justificante",
  );
  if (metodoRaw === null) return;
  const metodo = String(metodoRaw).trim();
  if (metodo !== "Efectivo" && metodo !== "Tarjeta")
    return toast("Método no válido. Escribe Efectivo o Tarjeta", "warn");

  const grupos = new Map();
  items.forEach((it) => {
    const k =
      (it.id != null ? "id:" + it.id : "n:" + it.nombre) + "|" + it.precio;
    if (!grupos.has(k))
      grupos.set(k, {
        nombre: it.nombre,
        precio: Number(it.precio) || 0,
        cant: 1,
      });
    else grupos.get(k).cant += 1;
  });
  const lineas = Array.from(grupos.values()).map((g) => ({
    concepto: g.nombre,
    cantidad: g.cant,
    precio_unitario_con_iva: g.precio,
  }));

  const btn = $("btnJustificante");
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
      p_reserva_id: null,
      p_iva: 21,
      p_lineas: lineas,
      p_notas: mesa,
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

crearBotonDeshacer();
