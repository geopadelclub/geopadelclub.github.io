/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const TIENDA_BUCKET = "tienda";
const TIENDA_MAX_LADO = 900;
const TIENDA_MAX_BYTES = 350 * 1024;
let articulos = [];
let articuloEdit = null;
let fotoNueva = null;
let fotoQuitada = false;
let urlPreview = "";
const urlFoto = (path) =>
  path
    ? supabaseClient.storage.from(TIENDA_BUCKET).getPublicUrl(path).data
        .publicUrl
    : "";
const MSG_FALTA_TIENDA =
  "No se pudo acceder al escaparate. Avisa al administrador.";
async function cargarArticulos() {
  const tb = $("escaparateBody");
  if (!tb || !supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("tienda_articulos")
    .select("id, titulo, descripcion, precio, foto_path, visible, orden")
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    tb.innerHTML = `<tr><td colspan="5" class="tabla-empty" style="color:var(--red)">${esc(esErrorTabla(error) ? MSG_FALTA_TIENDA : "Error al cargar el escaparate: " + error.message)}</td></tr>`;
    return;
  }
  articulos = data || [];
  dibujarArticulos();
}
function dibujarArticulos() {
  const tb = $("escaparateBody");
  const visibles = articulos.filter((a) => a.visible).length;
  $("escaparateResumen").innerText = articulos.length
    ? `${articulos.length} ${articulos.length === 1 ? "artículo" : "artículos"} · ${visibles} visibles para los clientes`
    : "";
  if (!articulos.length) {
    tb.innerHTML =
      '<tr><td colspan="5" class="tabla-empty">Aún no hay artículos. Pulsa «Nuevo artículo» para añadir el primero.</td></tr>';
    return;
  }
  tb.innerHTML = articulos
    .map((a, i) => {
      const foto = a.foto_path
        ? `<img class="esc-thumb" src="${esc(urlFoto(a.foto_path))}" alt="" loading="lazy" width="64" height="64">`
        : '<span class="esc-thumb esc-sin"><i class="ri-image-line" aria-hidden="true"></i></span>';
      const estado = a.visible
        ? '<span class="badge-deuda ok"><i class="ri-eye-line" aria-hidden="true"></i>Visible</span>'
        : '<span class="badge-deuda pend"><i class="ri-eye-off-line" aria-hidden="true"></i>Oculto</span>';
      const desc = a.descripcion
        ? `<small class="esc-desc">${esc(a.descripcion)}</small>`
        : "";
      return `<tr class="${a.visible ? "" : "deuda-resuelta"}">
<td>${foto}</td>
<td><b>${esc(a.titulo)}</b>${desc}</td>
<td><b>${eur(a.precio)}</b></td>
<td>${estado}</td>
<td class="esc-acciones">
<button type="button" class="btn-add gray" data-esc="subir" data-id="${esc(a.id)}" aria-label="Subir posición" ${i === 0 ? "disabled" : ""}><i class="ri-arrow-up-line" aria-hidden="true"></i></button>
<button type="button" class="btn-add gray" data-esc="bajar" data-id="${esc(a.id)}" aria-label="Bajar posición" ${i === articulos.length - 1 ? "disabled" : ""}><i class="ri-arrow-down-line" aria-hidden="true"></i></button>
<button type="button" class="btn-add blue" data-esc="editar" data-id="${esc(a.id)}"><i class="ri-edit-line" aria-hidden="true"></i>Editar</button>
<button type="button" class="btn-add gray" data-esc="visible" data-id="${esc(a.id)}"><i class="${a.visible ? "ri-eye-off-line" : "ri-eye-line"}" aria-hidden="true"></i>${a.visible ? "Ocultar" : "Mostrar"}</button>
<button type="button" class="btn-add danger" data-esc="eliminar" data-id="${esc(a.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>Eliminar</button>
</td></tr>`;
    })
    .join("");
}
function cargarImagen(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      res(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}
function canvasABlob(canvas, tipo, calidad) {
  return new Promise((res) => canvas.toBlob((b) => res(b), tipo, calidad));
}
async function imagenAWebP(file) {
  if (!file || !/^image\//.test(file.type))
    throw new Error("El archivo seleccionado no es una imagen válida");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("La imagen pesa demasiado (máximo 25 MB)");
  let origen, w, h;
  try {
    origen = await createImageBitmap(file, { imageOrientation: "from-image" });
    w = origen.width;
    h = origen.height;
  } catch (e) {
    origen = await cargarImagen(file);
    w = origen.naturalWidth;
    h = origen.naturalHeight;
  }
  if (!w || !h) throw new Error("La imagen no es válida");
  const k = Math.min(1, TIENDA_MAX_LADO / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k)),
    ch = Math.max(1, Math.round(h * k));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(origen, 0, 0, cw, ch);
  if (origen.close) origen.close();
  let blob = null,
    ext = "webp";
  for (const q of [0.82, 0.72, 0.62, 0.5]) {
    blob = await canvasABlob(canvas, "image/webp", q);
    if (blob && blob.type !== "image/webp") break;
    if (blob && blob.size <= TIENDA_MAX_BYTES) break;
  }
  if (!blob || blob.type !== "image/webp") {
    ext = "jpg";
    for (const q of [0.82, 0.7, 0.6, 0.5]) {
      blob = await canvasABlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= TIENDA_MAX_BYTES) break;
    }
  }
  if (!blob) throw new Error("No se pudo convertir la imagen");
  return { blob, ext, w: cw, h: ch };
}
function ponerPreview(src) {
  const box = $("artFotoPreview");
  if (src) {
    box.innerHTML = `<img src="${esc(src)}" alt="Vista previa de la foto">`;
    $("btnArtQuitarFoto").hidden = false;
  } else {
    box.innerHTML =
      '<span><i class="ri-image-add-line" aria-hidden="true"></i>Sin foto</span>';
    $("btnArtQuitarFoto").hidden = true;
  }
}
function abrirModalArticulo(id) {
  const a = id ? articulos.find((x) => String(x.id) === String(id)) : null;
  articuloEdit = a || null;
  fotoNueva = null;
  fotoQuitada = false;
  if (urlPreview) {
    URL.revokeObjectURL(urlPreview);
    urlPreview = "";
  }
  $("modalArticuloTitulo").innerText = a ? "Editar artículo" : "Nuevo artículo";
  $("artTitulo").value = a ? a.titulo : "";
  $("artDescripcion").value = a ? a.descripcion : "";
  $("artPrecio").value = a ? Number(a.precio).toFixed(2) : "";
  $("artVisible").checked = a ? !!a.visible : true;
  $("artFoto").value = "";
  $("msgArticulo").innerText = "";
  ponerPreview(a && a.foto_path ? urlFoto(a.foto_path) : "");
  abrirOverlay("modalArticulo");
}
function cerrarModalArticulo() {
  cerrarOverlay("modalArticulo");
  if (urlPreview) {
    URL.revokeObjectURL(urlPreview);
    urlPreview = "";
  }
}
async function alElegirFoto() {
  const f = $("artFoto").files && $("artFoto").files[0];
  const msg = $("msgArticulo");
  if (!f) return;
  msg.style.color = "var(--muted)";
  msg.innerText = "Preparando la foto...";
  try {
    fotoNueva = await imagenAWebP(f);
    fotoQuitada = false;
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    urlPreview = URL.createObjectURL(fotoNueva.blob);
    ponerPreview(urlPreview);
    msg.innerText = `Foto lista: ${fotoNueva.w}×${fotoNueva.h} px · ${Math.max(1, Math.round(fotoNueva.blob.size / 1024))} KB`;
  } catch (e) {
    fotoNueva = null;
    $("artFoto").value = "";
    msg.style.color = "var(--red)";
    msg.innerText = e.message || "No se pudo preparar la foto";
  }
}
function quitarFotoArticulo() {
  fotoNueva = null;
  fotoQuitada = true;
  $("artFoto").value = "";
  if (urlPreview) {
    URL.revokeObjectURL(urlPreview);
    urlPreview = "";
  }
  ponerPreview("");
}
async function borrarFotoStorage(path) {
  if (!path) return;
  const { error } = await supabaseClient.storage
    .from(TIENDA_BUCKET)
    .remove([path]);
  if (error) console.warn("No se pudo borrar la foto", error);
}
async function guardarArticulo() {
  const msg = $("msgArticulo"),
    btn = $("btnGuardarArticulo");
  const err = (t) => {
    msg.style.color = "var(--red)";
    msg.innerText = t;
  };
  const titulo = $("artTitulo").value.trim();
  const descripcion = $("artDescripcion").value.trim();
  const precio = parseFloat(String($("artPrecio").value).replace(",", "."));
  const visible = $("artVisible").checked;
  if (!titulo) return err("Escribe el título");
  if (isNaN(precio) || precio < 0) return err("Indica un precio válido");
  setBusy(
    btn,
    true,
    '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...',
  );
  let subido = null;
  try {
    const antigua = articuloEdit ? articuloEdit.foto_path : null;
    let foto_path = antigua;
    if (fotoNueva) {
      subido = `articulos/${window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)}.${fotoNueva.ext}`;
      const { error: eUp } = await supabaseClient.storage
        .from(TIENDA_BUCKET)
        .upload(subido, fotoNueva.blob, {
          contentType: fotoNueva.blob.type,
          cacheControl: "31536000",
          upsert: false,
        });
      if (eUp) {
        subido = null;
        throw eUp;
      }
      foto_path = subido;
    } else if (fotoQuitada) foto_path = null;
    const fila = {
      titulo,
      descripcion,
      precio: redondear2(precio),
      visible,
      foto_path,
    };
    let q;
    if (articuloEdit)
      q = supabaseClient
        .from("tienda_articulos")
        .update(fila)
        .eq("id", articuloEdit.id);
    else {
      const max = articulos.reduce(
        (m, a) => Math.max(m, Number(a.orden) || 0),
        0,
      );
      q = supabaseClient
        .from("tienda_articulos")
        .insert({ ...fila, orden: max + 1, creado_por: nombreUsuario() });
    }
    const { error } = await q;
    if (error) throw error;
    if (antigua && antigua !== foto_path) borrarFotoStorage(antigua);
    cerrarModalArticulo();
    toast("Artículo guardado");
    cargarArticulos();
  } catch (ex) {
    console.error(ex);
    if (subido) borrarFotoStorage(subido);
    err(
      esErrorTabla(ex)
        ? MSG_FALTA_TIENDA
        : "No se pudo guardar: " + (ex.message || ex),
    );
  } finally {
    setBusy(btn, false);
  }
}
async function alternarVisible(a) {
  const { error } = await supabaseClient
    .from("tienda_articulos")
    .update({ visible: !a.visible })
    .eq("id", a.id);
  if (error) return toast("No se pudo cambiar: " + error.message, "err");
  toast(
    a.visible
      ? "Artículo oculto para los clientes"
      : "Artículo visible para los clientes",
  );
  cargarArticulos();
}
async function eliminarArticulo(a) {
  if (
    !(await customConfirm(
      `¿Eliminar «${a.titulo}» del escaparate? Esta acción no se puede deshacer.`,
    ))
  )
    return;
  const { error } = await supabaseClient
    .from("tienda_articulos")
    .delete()
    .eq("id", a.id);
  if (error) return toast("No se pudo eliminar: " + error.message, "err");
  borrarFotoStorage(a.foto_path);
  toast("Artículo eliminado");
  cargarArticulos();
}
async function moverArticulo(id, delta) {
  const i = articulos.findIndex((x) => String(x.id) === String(id));
  const j = i + delta;
  if (i < 0 || j < 0 || j >= articulos.length) return;
  const lista = articulos.slice();
  const [m] = lista.splice(i, 1);
  lista.splice(j, 0, m);
  const cambios = lista
    .map((a, k) => ({ id: a.id, orden: k + 1 }))
    .filter((c) => articulos.find((a) => a.id === c.id).orden !== c.orden);
  const res = await Promise.all(
    cambios.map((c) =>
      supabaseClient
        .from("tienda_articulos")
        .update({ orden: c.orden })
        .eq("id", c.id),
    ),
  );
  const fallo = res.find((r) => r.error);
  if (fallo)
    toast("No se pudo cambiar el orden: " + fallo.error.message, "err");
  cargarArticulos();
}
function entrarEscaparate() {
  cargarArticulos();
}
$("btnNuevoArticulo").addEventListener("click", () => abrirModalArticulo(null));
$("btnGuardarArticulo").addEventListener("click", guardarArticulo);
$("artFoto").addEventListener("change", alElegirFoto);
$("btnArtQuitarFoto").addEventListener("click", quitarFotoArticulo);
$("escaparateBody").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-esc]");
  if (!b || b.disabled) return;
  const a = articulos.find((x) => String(x.id) === String(b.dataset.id));
  if (!a) return;
  const acc = b.dataset.esc;
  if (acc === "editar") abrirModalArticulo(a.id);
  else if (acc === "visible") alternarVisible(a);
  else if (acc === "eliminar") eliminarArticulo(a);
  else if (acc === "subir") moverArticulo(a.id, -1);
  else if (acc === "bajar") moverArticulo(a.id, 1);
});
