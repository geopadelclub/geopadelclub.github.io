/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
  const input = document.getElementById("gpBuscador");
  const resultados = document.getElementById("gpBuscadorResultados");
  if (!input || !resultados) return;

  let tmr = null;
  let ultimaConsulta = 0;
  let listaActual = null;

  function cerrar() {
    resultados.hidden = true;
    resultados.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
  }

  function abrir() {
    resultados.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function fechaBonitaLocal(iso) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d, 12).toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function render(data) {
    listaActual = data;
    const partes = [];
    const total =
      (data.clientes?.length || 0) +
      (data.reservas?.length || 0) +
      (data.deudas?.length || 0) +
      (data.facturas?.length || 0);

    if (total === 0) {
      resultados.innerHTML =
        '<div class="gp-search-empty">Sin resultados</div>';
      abrir();
      return;
    }

    if (data.clientes?.length) {
      partes.push('<div class="gp-search-group-title">Clientes</div>');
      data.clientes.forEach((c) => {
        partes.push(
          `<button type="button" class="gp-search-item" data-tipo="cliente" data-id="${esc(c.id)}" data-q="${esc(c.nombre || c.telefono || "")}">
            <span class="gp-search-icon"><i class="ri-user-line"></i></span>
            <span class="gp-search-body">
              <b>${esc(c.nombre)}</b>
              <small>${esc(c.telefono || "sin teléfono")}${c.bloqueado ? " · BLOQUEADO" : ""}</small>
            </span>
          </button>`,
        );
      });
    }

    if (data.reservas?.length) {
      partes.push(
        '<div class="gp-search-group-title">Reservas (hoy y mañana)</div>',
      );
      data.reservas.forEach((r) => {
        partes.push(
          `<button type="button" class="gp-search-item" data-tipo="reserva" data-id="${esc(r.id)}" data-fecha="${esc(r.fecha)}">
            <span class="gp-search-icon"><i class="ri-calendar-event-line"></i></span>
            <span class="gp-search-body">
              <b>${esc(r.cliente)}</b>
              <small>${esc(fechaBonitaLocal(r.fecha))} · ${esc(String(r.hora_inicio).slice(0, 5))} · ${esc(r.pista)}</small>
            </span>
          </button>`,
        );
      });
    }

    if (data.deudas?.length) {
      partes.push('<div class="gp-search-group-title">Deudas pendientes</div>');
      data.deudas.forEach((d) => {
        partes.push(
          `<button type="button" class="gp-search-item" data-tipo="deuda" data-id="${esc(d.id)}" data-q="${esc(d.nombre || d.telefono || "")}">
            <span class="gp-search-icon"><i class="ri-wallet-3-line"></i></span>
            <span class="gp-search-body">
              <b>${esc(d.nombre)} · ${eur(d.importe)}</b>
              <small>${esc(d.telefono || "sin teléfono")}</small>
            </span>
          </button>`,
        );
      });
    }

    if (data.facturas?.length) {
      partes.push(
        '<div class="gp-search-group-title">Facturas (último mes)</div>',
      );
      data.facturas.forEach((f) => {
        partes.push(
          `<button type="button" class="gp-search-item" data-tipo="factura" data-id="${esc(f.id)}" data-q="${esc(f.numero || f.cliente_nombre || "")}">
            <span class="gp-search-icon"><i class="ri-file-list-3-line"></i></span>
            <span class="gp-search-body">
              <b>${esc(f.numero)} · ${esc(f.cliente_nombre)}</b>
              <small>${esc(fechaBonitaLocal(f.fecha))} · ${eur(f.total)}</small>
            </span>
          </button>`,
        );
      });
    }

    resultados.innerHTML = partes.join("");
    abrir();
  }

  async function buscar(q) {
    const miId = ++ultimaConsulta;
    try {
      const { data, error } = await supabaseClient.rpc("gp_buscar_global", {
        p_q: q,
      });
      if (miId !== ultimaConsulta) return;
      if (error) {
        console.error("buscar global:", error);
        resultados.innerHTML =
          '<div class="gp-search-empty">Error al buscar</div>';
        abrir();
        return;
      }
      if (!data || !data.ok) {
        resultados.innerHTML =
          '<div class="gp-search-empty">Sin resultados</div>';
        abrir();
        return;
      }
      render(data);
    } catch (e) {
      if (miId !== ultimaConsulta) return;
      console.error(e);
      cerrar();
    }
  }

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(tmr);
    if (q.length < 2) {
      cerrar();
      return;
    }
    tmr = setTimeout(() => buscar(q), 300);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrar();
      input.blur();
    }
  });

  input.addEventListener("focus", () => {
    if (!listaActual || input.value.trim().length < 2) return;
    const total =
      (listaActual.clientes?.length || 0) +
      (listaActual.reservas?.length || 0) +
      (listaActual.deudas?.length || 0) +
      (listaActual.facturas?.length || 0);
    if (total > 0) abrir();
  });

  document.addEventListener("click", (e) => {
    if (!resultados.hidden && !e.target.closest("#gpBuscadorWrap")) {
      cerrar();
    }
  });

  resultados.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tipo]");
    if (!b) return;
    const tipo = b.dataset.tipo;
    const q = b.dataset.q || "";
    const fecha = b.dataset.fecha || "";

    cerrar();
    input.value = "";

    if (tipo === "cliente") {
      const cli = document.getElementById("cliBuscar");
      if (cli) {
        cli.value = q;
        cli.dispatchEvent(new Event("input", { bubbles: true }));
      }
      cambiarPestana("ajustes");
    } else if (tipo === "reserva") {
      cambiarPestana("reservas");
      const fc = document.getElementById("fechaCuadrante");
      if (fc && fecha) {
        fc.value = fecha;
        if (typeof alCambiarFecha === "function") alCambiarFecha();
      }
    } else if (tipo === "deuda") {
      cambiarPestana("deudas");
      const db = document.getElementById("deudaBuscar");
      if (db) {
        db.value = q;
        db.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else if (tipo === "factura") {
      cambiarPestana("facturas");
      const fb = document.getElementById("facBuscar");
      if (fb) {
        fb.value = q;
        fb.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });
})();
