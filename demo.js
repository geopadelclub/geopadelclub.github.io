/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
  let modoDemoActivo = false;
  let _origCaja, _origDeudas, _origFacturas;

  const fakeCaja = {
    totalEfectivo: 340.5,
    totalTarjeta: 1250.0,
    totalGeneral: 1590.5,
  };
  const fakeDeudas = [
    {
      id: "d1",
      nombre: "Juan Pérez",
      telefono: "600111222",
      fecha: fechaLocalISO(),
      hora: "18:00",
      importe: 26.0,
      estado: "Pendiente",
      creado_por: "Demo",
    },
    {
      id: "d2",
      nombre: "María López",
      telefono: "600333444",
      fecha: fechaLocalISO(),
      hora: "20:00",
      importe: 15.0,
      estado: "Pendiente",
      creado_por: "Demo",
    },
  ];
  const fakeFacturas = [
    {
      id: "f1",
      tipo: "Factura",
      numero: "F-2026-000001",
      fecha: fechaLocalISO(),
      cliente_nombre: "Empresa Demo S.L.",
      cliente_nif: "B12345678",
      metodo_pago: "Transferencia",
      total: 120.0,
      estado: "Emitida",
      empleado: "Demo",
    },
    {
      id: "f2",
      tipo: "Justificante",
      numero: "J-2026-000042",
      fecha: fechaLocalISO(),
      cliente_nombre: "Carlos Ruiz",
      cliente_nif: "",
      metodo_pago: "Efectivo",
      total: 26.0,
      estado: "Emitida",
      empleado: "Demo",
    },
  ];

  function activarDemo() {
    _origCaja = window.cargarCajaHoy;
    _origDeudas = window.cargarDeudas;
    _origFacturas = window.cargarFacturas;

    window.cargarCajaHoy = async () => {
      datosLocales.caja = fakeCaja;
      if (document.getElementById("cajaEfectivo")) {
        document.getElementById("cajaEfectivo").innerText = eur(
          fakeCaja.totalEfectivo,
        );
        document.getElementById("cajaTarjeta").innerText = eur(
          fakeCaja.totalTarjeta,
        );
        document.getElementById("cajaTotal").innerText = eur(
          fakeCaja.totalGeneral,
        );
      }
      if (typeof calcCierre === "function") calcCierre();
    };

    window.cargarDeudas = async () => {
      window.deudas = fakeDeudas;
      if (document.getElementById("deudaTotal")) {
        document.getElementById("deudaTotal").innerText = eur(41.0);
      }
      if (typeof dibujarDeudas === "function") dibujarDeudas();
    };

    window.cargarFacturas = async () => {
      window.facLista = fakeFacturas;
      if (typeof dibujarFacturas === "function") dibujarFacturas();
    };

    if (typeof cargarCajaHoy === "function") cargarCajaHoy();
    if (typeof cargarDeudas === "function") cargarDeudas();
    if (typeof cargarFacturas === "function") cargarFacturas();
    if (typeof dibujarResumen === "function") dibujarResumen();
    if (typeof calcCierre === "function") calcCierre();

    document.addEventListener("submit", bloquearSubmit, true);
    document.addEventListener("click", bloquearClick, true);

    modoDemoActivo = true;
    actualizarBoton(true);
    toast(
      "Modo Demostración Activado. Los datos reales de dinero están ocultos.",
      "ok",
      5000,
    );
  }

  function desactivarDemo() {
    window.cargarCajaHoy = _origCaja;
    window.cargarDeudas = _origDeudas;
    window.cargarFacturas = _origFacturas;

    if (typeof cargarDatosGlobales === "function") cargarDatosGlobales();
    if (typeof entrarResumen === "function") entrarResumen();
    if (document.getElementById("tab-caja")?.classList.contains("active"))
      entrarCaja();
    if (document.getElementById("tab-deudas")?.classList.contains("active"))
      cargarDeudas();
    if (document.getElementById("tab-facturas")?.classList.contains("active"))
      entrarFacturas();

    document.removeEventListener("submit", bloquearSubmit, true);
    document.removeEventListener("click", bloquearClick, true);

    modoDemoActivo = false;
    actualizarBoton(false);
    toast(
      "Modo Demostración Desactivado. Datos reales restaurados.",
      "ok",
      5000,
    );
  }

  function actualizarBoton(activo) {
    const btn = document.getElementById("btnModoDemo");
    if (!btn) return;
    if (activo) {
      btn.className = "btn-add danger";
      btn.innerHTML =
        '<i class="ri-eye-line" aria-hidden="true"></i>Desactivar Modo Demo';
    } else {
      btn.className = "btn-add gray";
      btn.innerHTML =
        '<i class="ri-eye-off-line" aria-hidden="true"></i>Activar Modo Demo';
    }
  }

  function bloquearSubmit(e) {
    if (e.target.id === "formDeuda") {
      e.preventDefault();
      toast("Acción bloqueada en Modo Demostración", "warn");
    }
  }

  function bloquearClick(e) {
    if (e.target.closest("#facEmitir") || e.target.closest("#btnCerrarCaja")) {
      e.preventDefault();
      e.stopPropagation();
      toast("Acción bloqueada en Modo Demostración", "warn");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnModoDemo");
    if (btn) {
      btn.addEventListener("click", () => {
        if (modoDemoActivo) desactivarDemo();
        else activarDemo();
      });
    }
  });
})();
