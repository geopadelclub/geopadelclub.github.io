/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const HTML_MODAL_RESERVA = `
<dialog id="modalReserva" class="modal-overlay" aria-labelledby="modalTitulo">
  <div class="modal-card-double">
    <div class="modal-header-bar">
      <h4>
        <span class="gp-modal-brand">GEOPADEL</span> ·
        <span id="modalTitulo">Gestionar reserva</span>
      </h4>
      <button type="button" class="modal-close" data-action="cerrar-modal" aria-label="Cerrar">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-double-body">
      <div class="modal-section-box">
        <h5>Reserva</h5>
        <input type="hidden" id="modalReservaId" /><label for="modalCliente">Cliente</label
        ><input type="text" id="modalCliente" maxlength="80" placeholder="Escribe el nombre para buscar..." autocomplete="off" /><label for="modalTelefono">Teléfono</label
        ><input type="tel" id="modalTelefono" maxlength="20" placeholder="Escribe el teléfono para buscar..." autocomplete="off" /><label>Pistas</label>
        <div id="modalPistasContainer" class="pistas-checkbox-grid"></div>
        <label for="modalTipoReserva">Tipo de reserva</label
        ><select id="modalTipoReserva" data-onchange="al-cambiar-tipo">
          <option value="Normal">Normal</option>
          <option value="Pena">Peña (recurrente)</option>
          <option value="Entrenamiento">Entrenamiento</option>
          <option value="Torneo">Torneo (horario ampliado)</option></select
        ><label for="modalFecha">Fecha</label
        ><input type="date" id="modalFecha" data-onchange="recalcular-precio" data-forzar="false" /><label for="modalHora">Hora inicio</label
        ><input type="time" id="modalHora" step="1800" value="17:00" data-onchange="recalcular-precio" data-forzar="false" /><label id="lblDur" for="modalDuracion">Duración</label
        ><select id="modalDuracion" data-onchange="recalcular-precio">
          <option value="30">30 minutos (0.5 h)</option>
          <option value="60">60 minutos (1.0 h)</option>
          <option value="90" selected>90 minutos (1.5 h)</option>
          <option value="120">120 minutos (2.0 h)</option>
          <option value="150">150 minutos (2.5 h)</option>
          <option value="180">180 minutos (3.0 h)</option>
          <option value="210">210 minutos (3.5 h)</option>
          <option value="240">240 minutos (4.0 h)</option>
          <option value="270">270 minutos (4.5 h)</option>
          <option value="300">300 minutos (5.0 h)</option>
        </select>
        <div id="boxTorneoDur" style="display: none">
          <label for="modalDuracionHoras">Duración torneo (horas)</label
          ><input type="number" inputmode="decimal" id="modalDuracionHoras" min="0.5" max="16" step="0.5" value="8" data-oninput="recalcular-precio" />
        </div>
        <div id="boxRepetir" style="display: none">
          <label for="modalRepetir"
            ><i class="ri-repeat-line" aria-hidden="true"></i>Repetir peña
            (semanas consecutivas)</label
          ><input type="number" inputmode="numeric" id="modalRepetir" min="1" max="52" value="12" />
        </div>
        <label for="modalNumJugadores">Número de jugadores</label
        ><select id="modalNumJugadores" data-onchange="actualizar-split"></select
        ><label for="modalPrecio">Precio total pista (€)</label
        ><input type="number" inputmode="decimal" id="modalPrecio" value="26.00" step="0.50" min="0" data-oninput="actualizar-split" />
      </div>
      <div class="modal-col">
        <div class="modal-section-box">
          <h5 style="margin-bottom: 8px">Método de cobro</h5>
          <div style="display: flex; gap: 16px; margin-bottom: 12px">
            <label class="cl-check" style="font-size: 14px"
              ><input type="radio" name="modalTipoPago" value="unico" checked />
              Pago único</label
            ><label class="cl-check" style="font-size: 14px"
              ><input type="radio" name="modalTipoPago" value="dividido" />
              Pago dividido</label
            >
          </div>
          <div id="boxPagoUnico">
            <div style="display: flex; gap: 8px">
              <button type="button" class="btn-pay btn-cash" id="btnUnicoEfectivo" style="flex: 1; padding: 12px">
                Efectivo</button
              ><button type="button" class="btn-pay btn-card" id="btnUnicoTarjeta" style="flex: 1; padding: 12px">
                Tarjeta</button
              ><button type="button" class="btn-pay btn-pay-reset" id="btnUnicoReset" style="flex: 0 0 auto; padding: 12px; display: none" aria-label="Quitar pago">
                <i class="ri-close-line"></i>
              </button>
            </div>
            <p id="msgPagoUnico" class="msg-inline" style="text-align: center; margin-top: 8px; font-size: 12px"></p>
          </div>
          <div id="boxCobroDividido" style="display: none">
            <h5>
              Cobro dividido
              <span id="badgePrecioUnitario" style="font-size: 13px; color: var(--blue); font-weight: 800;"></span>
            </h5>
            <div id="splitJugadoresContainer" class="jugadores-split-grid"></div>
            <div class="estado-global">
              Estado global:
              <span id="badgeEstadoPagoGlobal" style="margin-left: 6px" class="badge-sin-pagar"
                ><i class="ri-error-warning-line" aria-hidden="true"></i>Sin pagar</span
              >
            </div>
          </div>
        </div>
        <div class="modal-section-box nota-box">
          <h5>
            <span><i class="ri-sticky-note-line" aria-hidden="true"></i>Bloc de notas</span
            ><span class="nota-hint">Se marca en el cuadrante</span>
          </h5>
          <textarea id="modalNotas" rows="4" maxlength="1000" placeholder="Apuntes de esta reserva: debe dinero, trae pala prestada, avisar si llega tarde..." aria-label="Notas de la reserva"></textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer-bar">
      <button type="button" id="btnConfirmarPendiente" data-action="confirmar-pendiente" class="btn-add blue" style="display: none">
        <i class="ri-check-double-line" aria-hidden="true"></i>Confirmar reserva</button
      ><button type="button" id="btnGuardarReserva" data-action="guardar-reserva" class="btn-add">
        <i class="ri-save-line" aria-hidden="true"></i>Guardar reserva</button
      ><button type="button" id="btnJustificanteReserva" data-action="emitir-justificante-reserva" class="btn-add blue" style="display: none">
        <i class="ri-receipt-line" aria-hidden="true"></i>Justificante 80mm</button
      ><button type="button" id="btnEliminarSerie" data-action="eliminar-serie" class="btn-add danger-dark" style="display: none">
        <i class="ri-delete-bin-line" aria-hidden="true"></i>Eliminar serie</button
      ><button type="button" id="btnHistorialReserva" data-action="ver-historial" class="btn-add gray" style="display: none">
        <i class="ri-history-line" aria-hidden="true"></i>Historial</button
      ><button type="button" id="btnEliminarReserva" data-action="eliminar-reserva" class="btn-add danger" style="display: none">
        <i class="ri-delete-bin-line" aria-hidden="true"></i>Eliminar</button
      ><button type="button" data-action="cerrar-modal" class="btn-add gray">
        Cancelar
      </button>
    </div>
  </div>
</dialog>
`;

const HTML_MODAL_PRODUCTO = `
<dialog id="modalProducto" class="modal-overlay" aria-labelledby="modalProductoTitulo">
  <div class="modal-card-double small">
    <div class="modal-header-bar">
      <h4>
        <span class="gp-modal-brand">GEOPADEL</span> ·
        <span id="modalProductoTitulo">Editar artículo</span>
      </h4>
      <button type="button" class="modal-close" data-action="cerrar-modal-producto" aria-label="Cerrar">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-single-body">
      <input type="hidden" id="modalProdId" />
      <div class="form-group">
        <label for="modalProdNombre">Nombre del artículo</label
        ><input type="text" id="modalProdNombre" placeholder="Ej. Bote de bolas" maxlength="80" required />
      </div>
      <div class="form-group">
        <label for="modalProdPrecio">Precio (€)</label
        ><input type="number" inputmode="decimal" id="modalProdPrecio" step="0.01" min="0" placeholder="6.00" required />
      </div>
      <div class="form-group">
        <label for="modalProdCat">Categoría</label
        ><select id="modalProdCat">
          <option value="Bebidas">Bebidas</option>
          <option value="Comida">Comida</option>
          <option value="Tienda">Tienda / Material</option>
          <option value="Pista">Pista</option>
        </select>
      </div>
      <div class="form-group">
        <label for="modalProdEstado">Estado</label
        ><select id="modalProdEstado">
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </div>
    </div>
    <div class="modal-footer-bar">
      <button type="button" id="btnGuardarProducto" data-action="guardar-producto" class="btn-add blue">
        <i class="ri-save-line" aria-hidden="true"></i>Guardar artículo</button
      ><button type="button" data-action="cerrar-modal-producto" class="btn-add gray">
        Cancelar
      </button>
    </div>
  </div>
</dialog>
`;

const HTML_MODAL_AVISO_LIMPIEZA = `
<dialog id="modalAvisoLimpieza" class="modal-overlay" aria-labelledby="avisoLimpTitulo">
  <div class="modal-card-double small">
    <div class="modal-header-bar">
      <h4>
        <span class="gp-modal-brand">GEOPADEL</span> ·
        <span id="avisoLimpTitulo">Aviso de limpieza</span>
      </h4>
      <button type="button" class="modal-close" data-action="cerrar-aviso-limpieza" aria-label="Cerrar">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-single-body" id="avisoLimpCuerpo"></div>
    <div class="modal-footer-bar">
      <button type="button" data-action="cerrar-aviso-limpieza" class="btn-add">
        Entendido
      </button>
    </div>
  </div>
</dialog>
`;

const HTML_MODAL_ARTICULO = `
<dialog id="modalArticulo" class="modal-overlay" aria-labelledby="modalArticuloTitulo">
  <div class="modal-card-double small">
    <div class="modal-header-bar">
      <h4>
        <span class="gp-modal-brand">GEOPADEL</span> ·
        <span id="modalArticuloTitulo">Nuevo artículo</span>
      </h4>
      <button type="button" class="modal-close" data-action="cerrar-modal-articulo" aria-label="Cerrar">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-single-body">
      <div class="form-group">
        <label for="artFoto">Foto</label>
        <div id="artFotoPreview" class="art-preview"></div>
        <input type="file" id="artFoto" accept="image/*" /><button type="button" class="btn-add gray" id="btnArtQuitarFoto" style="margin-top: 8px" hidden>
          <i class="ri-delete-bin-line" aria-hidden="true"></i>Quitar foto
        </button>
        <p class="limp-leyenda" style="margin-top: 6px">
          Se reduce y se convierte a WebP automáticamente para que pese poco.
        </p>
      </div>
      <div class="form-group">
        <label for="artTitulo">Título</label
        ><input type="text" id="artTitulo" maxlength="80" placeholder="Ej. Pala Bullpadel Vertex" />
      </div>
      <div class="form-group">
        <label for="artDescripcion">Descripción</label
        ><textarea id="artDescripcion" class="art-textarea" maxlength="600" rows="4" placeholder="Opcional: marca, medidas, colores..."></textarea>
      </div>
      <div class="form-group">
        <label for="artPrecio">Precio (€)</label
        ><input type="number" inputmode="decimal" id="artPrecio" step="0.01" min="0" placeholder="0,00" />
      </div>
      <label class="cl-check" style="margin: 0"
        ><input type="checkbox" id="artVisible" checked /><span>Visible para los clientes</span></label
      >
      <div id="msgArticulo" class="msg-inline" aria-live="polite"></div>
    </div>
    <div class="modal-footer-bar">
      <button type="button" id="btnGuardarArticulo" class="btn-add blue">
        <i class="ri-save-line" aria-hidden="true"></i>Guardar artículo</button
      ><button type="button" data-action="cerrar-modal-articulo" class="btn-add gray">
        Cancelar
      </button>
    </div>
  </div>
</dialog>
`;

const HTML_MODAL_CONTRATO = `
<dialog id="modalContrato" class="modal-overlay" aria-labelledby="ctTitulo">
  <div class="modal-card-double">
    <div class="modal-header-bar">
      <h4>
        <span class="gp-modal-brand">GEOPADEL</span> ·
        <span id="ctTitulo">Tu contrato</span>
      </h4>
      <button type="button" class="modal-close" id="btnCerrarContrato" aria-label="Cerrar">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-single-body">
      <p id="ctObligatorio" class="aviso-limpieza" hidden>
        <i class="ri-information-line" aria-hidden="true"></i>Antes de fichar por primera vez necesitamos saber tu contrato.
      </p>
      <p class="limp-leyenda">
        Indica lo que figura en tu contrato firmado. Sirve para comparar tu jornada con tus fichajes. Si cambia, vuelve a entrar aquí y guárdalo de nuevo: se conserva el histórico. No sustituye a tu contrato.
      </p>
      <div class="form-inline" style="margin: 12px 0">
        <label>Horas semanales del contrato<input type="number" inputmode="decimal" id="ctHoras" step="0.5" min="0.5" max="48" placeholder="Ej. 20" /></label
        ><label>Vigente desde<input type="date" id="ctDesde" /></label>
      </div>
      <div class="ct-cab">
        <span>Día</span><span>Tramo 1 (entrada – salida)</span><span>Tramo 2 (opcional)</span>
      </div>
      <div id="ctFilas"></div>
      <p id="ctCalculo" class="limp-leyenda" style="font-weight: 700; margin-top: 10px" aria-live="polite"></p>
      <div class="form-group" style="margin-top: 10px">
        <label for="ctNotas" style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 6px;">Observaciones (opcional)</label
        ><input type="text" id="ctNotas" maxlength="300" placeholder="Ej. turnos rotativos, horario distinto en verano..." />
      </div>
      <div id="msgContrato" class="msg-inline" aria-live="polite"></div>
    </div>
    <div class="modal-footer-bar">
      <button type="button" id="btnGuardarContrato" class="btn-add blue">
        <i class="ri-save-line" aria-hidden="true"></i>Guardar contrato</button
      ><button type="button" id="btnCancelarContrato" class="btn-add gray">
        Cancelar
      </button>
    </div>
  </div>
</dialog>
`;

const HTML_MODAL_HISTORIAL = `
<dialog id="modalHistorial" class="modal-overlay" aria-labelledby="histTitulo">
  <div class="modal-card-double small">
    <div class="modal-header-bar">
      <h4>
        <span class="gp-modal-brand">GEOPADEL</span> ·
        <span id="histTitulo">Historial de cambios</span>
      </h4>
      <button type="button" class="modal-close" data-action="cerrar-historial" aria-label="Cerrar">
        <i class="ri-close-line" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-single-body" id="histCuerpo">
      <p style="color: var(--muted)">Cargando...</p>
    </div>
    <div class="modal-footer-bar">
      <button type="button" data-action="cerrar-historial" class="btn-add gray">
        Cerrar
      </button>
    </div>
  </div>
</dialog>
`;

function inyectarModal(id, htmlString) {
  if (document.getElementById(id)) return;
  if (!document.body) {
    console.warn("El body no está listo todavía para inyectar el modal " + id);
    return;
  }
  const div = document.createElement("div");
  div.innerHTML = htmlString.trim();
  const modal = div.firstChild;
  document.body.appendChild(modal);
}

function cargarModalReserva() {
  inyectarModal("modalReserva", HTML_MODAL_RESERVA);
}
function cargarModalProducto() {
  inyectarModal("modalProducto", HTML_MODAL_PRODUCTO);
}
function cargarModalAvisoLimpieza() {
  inyectarModal("modalAvisoLimpieza", HTML_MODAL_AVISO_LIMPIEZA);
}
function cargarModalArticulo() {
  inyectarModal("modalArticulo", HTML_MODAL_ARTICULO);
}
function cargarModalContrato() {
  inyectarModal("modalContrato", HTML_MODAL_CONTRATO);
}
function cargarModalHistorial() {
  inyectarModal("modalHistorial", HTML_MODAL_HISTORIAL);
}
