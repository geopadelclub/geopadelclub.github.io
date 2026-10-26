/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function cargarDatosGlobales() {
  await Promise.all([
    cargarProductos(),
    cargarTarifas(),
    cargarMesasBar(),
    cargarReservasHoy(),
    cargarCajaHoy(),
    cargarDeudas(),
  ]);
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
