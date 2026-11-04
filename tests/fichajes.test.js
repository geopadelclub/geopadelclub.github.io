const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const F = cargarContexto(["utils.js", "fichajes.js"]);

test("fichajes: fxCalcular() calcula tramos y horas trabajadas correctamente", () => {
  const filas = [
    { empleado: "juan", tipo: "Entrada", created_at: "2026-11-04T08:00:00Z" },
    { empleado: "juan", tipo: "Salida", created_at: "2026-11-04T12:00:00Z" },
    { empleado: "juan", tipo: "Entrada", created_at: "2026-11-04T13:00:00Z" },
    { empleado: "juan", tipo: "Salida", created_at: "2026-11-04T15:00:00Z" },
  ];

  // Simulamos que el contrato de Juan es de 6 horas (360 minutos)
  const obtenerJornadaContrato = () => ({ min: 360, contrato: true });

  const res = F.fxCalcular(
    filas,
    "2026-11-04",
    "2026-11-04",
    obtenerJornadaContrato,
  );

  const dia = res.dias[0];
  assert.strictEqual(dia.total, 360); // 4h + 2h = 6h trabajadas
  assert.strictEqual(dia.pausa, 60); // 1h de pausa entre tramos
  assert.strictEqual(dia.extra, 0); // Hizo exactamente sus horas
  assert.strictEqual(dia.sinContrato, false);
});

test("fichajes: fxCalcular() detecta exceso de horas", () => {
  const filas = [
    { empleado: "ana", tipo: "Entrada", created_at: "2026-11-04T08:00:00Z" },
    { empleado: "ana", tipo: "Salida", created_at: "2026-11-04T16:00:00Z" }, // 8 horas
  ];

  // Su contrato es de 6 horas
  const obtenerJornadaContrato = () => ({ min: 360, contrato: true });

  const res = F.fxCalcular(
    filas,
    "2026-11-04",
    "2026-11-04",
    obtenerJornadaContrato,
  );

  const dia = res.dias[0];
  assert.strictEqual(dia.total, 480);
  assert.strictEqual(dia.extra, 120); // 2 horas extra
});
