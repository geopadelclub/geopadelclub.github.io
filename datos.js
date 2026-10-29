/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function cargarDatosGlobales() {
  await cargarConfigPanel();
  const fechaReservas = $("fechaCuadrante")?.value || fechaLocalISO();
  const fechaCaja = $("cajaFecha")?.value || fechaLocalISO();
  const { data, error } = await supabaseClient.rpc("get_panel_data", {
    p_fecha: fechaReservas,
    p_fecha_caja: fechaCaja,
  });
  if (error) {
    console.error("Error cargando datos globales:", error);
    toast("No se pudieron cargar los datos", "err");
    return;
  }
  datosLocales.productos = data.productos || [];
  dibujarCatalogo(datosLocales.productos);
  if (typeof filtrarGestionCatalogo === "function") filtrarGestionCatalogo();
  const tf = {};
  const num = (v) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  (data.tarifas || []).forEach((t) => {
    const k = Object.keys(TARIFAS_FRANJAS).find(
      (x) => TARIFAS_FRANJAS[x] === t.franja,
    );
    if (k)
      tf[k] = {
        60: num(t.precio_60min),
        90: Number(t.precio_90min),
        120: num(t.precio_120min),
      };
  });
  datosLocales.tarifas = tf;
  if (typeof dibujarTarifas === "function")
    dibujarTarifas({ ...TARIFAS_DEFECTO, ...tf });
  (data.mesas || []).forEach((row) => {
    cuentasMesas[row.mesa] = Array.isArray(row.items) ? row.items : [];
  });
  if (typeof renderSelectorMesas === "function") renderSelectorMesas();
  datosLocales.bloqueos = data.bloqueos || [];
  datosLocales.reservas = (data.reservas || []).map(mapearReserva);
  if (typeof renderizarCuadrantePlaytomic === "function")
    renderizarCuadrantePlaytomic(datosLocales.reservas);
  if (typeof dibujarBloqueos === "function") dibujarBloqueos();
  datosLocales.caja = {
    totalEfectivo: redondear2(data.caja?.efectivo || 0),
    totalTarjeta: redondear2(data.caja?.tarjeta || 0),
    totalGeneral: redondear2(
      (data.caja?.efectivo || 0) + (data.caja?.tarjeta || 0),
    ),
  };
  if (typeof dibujarCaja === "function") dibujarCaja(datosLocales.caja);
  if (typeof calcCierre === "function") calcCierre();
  if (typeof dibujarDeudas === "function") {
    deudas = data.deudas || [];
    const total = redondear2(
      deudas
        .filter((d) => d.estado !== "Resuelta")
        .reduce((s, d) => s + (Number(d.importe) || 0), 0),
    );
    $("deudaTotal").innerText = eur(total);
    dibujarDeudas();
  }
  _ultimaCargaDatos = Date.now();
}
async function cargarClientes() {
  const { data, error } = await conReintento(() =>
    supabaseClient
      .from("clientes")
      .select("id, nombre, telefono, tipo_cliente, nombre_entidad")
      .order("nombre"),
  );
  if (error) {
    console.error(error);
    return;
  }
  datosLocales.clientes = data || [];
}
async function cargarProductos() {
  const { data, error } = await conReintento(() =>
    supabaseClient
      .from("productos")
      .select("id, nombre, precio, categoria, estado")
      .neq("estado", "Eliminado")
      .order("nombre"),
  );
  if (error) {
    console.error(error);
    toast("No se pudo cargar el catálogo", "err");
    return;
  }
  datosLocales.productos = data || [];
  dibujarCatalogo(datosLocales.productos);
  if (typeof filtrarGestionCatalogo === "function") filtrarGestionCatalogo();
}
async function cargarMesasBar() {
  const { data, error } = await conReintento(() =>
    supabaseClient.from("mesas_bar").select("mesa, items"),
  );
  if (error) {
    console.error(error);
    return;
  }
  (data || []).forEach((row) => {
    cuentasMesas[row.mesa] = Array.isArray(row.items) ? row.items : [];
  });
  renderSelectorMesas();
}
