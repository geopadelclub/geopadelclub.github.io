/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
    const A = window.accion;
    if (typeof A !== 'function') return;
    A('alternar-tema', () => typeof alternarTema === 'function' && alternarTema());
    A('cerrar-sesion', () => typeof cerrarSesion === 'function' && cerrarSesion());
    A('imprimir-dia', () => typeof imprimirDia === 'function' && imprimirDia());
    A('ir-fecha-hoy', () => typeof irAFechaHoy === 'function' && irAFechaHoy());
    A('cambiar-fecha', el => typeof cambiarFechaDias === 'function' && cambiarFechaDias(parseInt(el.dataset.offset, 10) || 0));
    A('al-cambiar-fecha', () => typeof alCambiarFecha === 'function' && alCambiarFecha());
    A('ir-primera-pendiente', () => typeof irAPrimeraPendiente === 'function' && irAPrimeraPendiente());
    A('nueva-reserva', () => typeof abrirModalNuevaReserva === 'function' && abrirModalNuevaReserva());
    A('cobrar-mesa', el => typeof cobrarMesaActiva === 'function' && cobrarMesaActiva(el.dataset.metodo));
    A('calc-cierre', () => typeof calcCierre === 'function' && calcCierre());
    A('cerrar-caja', () => typeof cerrarCajaHoy === 'function' && cerrarCajaHoy());
    A('guardar-tarifas', () => typeof guardarTarifasUI === 'function' && guardarTarifasUI());
    A('abrir-nuevo-producto', () => typeof abrirModalNuevoProducto === 'function' && abrirModalNuevoProducto());
    A('filtrar-gestion', () => typeof filtrarGestionCatalogo === 'function' && filtrarGestionCatalogo());
    A('dibujar-deudas', () => typeof dibujarDeudas === 'function' && dibujarDeudas());
    A('cargar-deudas', () => typeof cargarDeudas === 'function' && cargarDeudas());
    A('cerrar-modal', () => typeof cerrarModal === 'function' && cerrarModal());
    A('confirmar-pendiente', () => typeof confirmarReservaPendiente === 'function' && confirmarReservaPendiente());
    A('guardar-reserva', () => typeof confirmarGuardarReserva === 'function' && confirmarGuardarReserva());
    A('eliminar-serie', () => typeof confirmarEliminarSerie === 'function' && confirmarEliminarSerie());
    A('ver-historial', () => typeof verHistorialReserva === 'function' && verHistorialReserva());
    A('eliminar-reserva', () => typeof confirmarEliminarReserva === 'function' && confirmarEliminarReserva());
    A('cerrar-modal-producto', () => typeof cerrarModalProducto === 'function' && cerrarModalProducto());
    A('guardar-producto', () => typeof guardarProductoModal === 'function' && guardarProductoModal());
    A('cerrar-aviso-limpieza', () => typeof cerrarAvisoLimpieza === 'function' && cerrarAvisoLimpieza());
    A('cerrar-modal-articulo', () => typeof cerrarModalArticulo === 'function' && cerrarModalArticulo());
    A('cerrar-confirm', () => { const d = document.getElementById('modalConfirmDialog'); if (d && d.open) d.close('cancel'); });
    A('cerrar-historial', () => typeof cerrarHistorial === 'function' && cerrarHistorial());
    A('al-cambiar-tipo', () => typeof alCambiarTipo === 'function' && alCambiarTipo());
    A('recalcular-precio', el => typeof recalcularPrecioSugerido === 'function' && recalcularPrecioSugerido(el.dataset.forzar !== 'false'));
    A('actualizar-split', () => typeof actualizarVistasJugadoresSplit === 'function' && actualizarVistasJugadoresSplit());
    A('limpieza-seleccionar', el => typeof limpiezaSeleccionarPistas === 'function' && limpiezaSeleccionarPistas(el.dataset.on === 'true'));
    A('cambiar-idioma', () => typeof alternarIdioma === 'function' && alternarIdioma());
    A('fichar-entrada', el => typeof fichar === 'function' && fichar('Entrada', el));
    A('fichar-salida', el => typeof fichar === 'function' && fichar('Salida', el));
    A('activar-notificaciones', async () => {
        if (typeof pedirPermisoNotificaciones !== 'function') return;
        const ok = await pedirPermisoNotificaciones();
        if (ok) {
            toast('Notificaciones activadas', 'ok');
            const b = document.getElementById('btnNotif');
            if (b) b.style.display = 'none';
        } else toast('No se pudieron activar las notificaciones', 'warn');
    });
})();