const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

// Cargamos utils y core, para tener timeToMin y las TARIFAS_DEFECTO
const R = cargarContexto(["utils.js", "core.js", "reservas.js"]);

test("reservas: agruparReservas() agrupa por ID de serie", () => {
  const filas = [
    { id: 1, serie: "S1", fecha: "2026-11-04", hora: "18:00" },
    { id: 2, serie: "S1", fecha: "2026-11-11", hora: "18:00" },
    { id: 3, serie: "", fecha: "2026-11-05", hora: "19:00" },
    { id: 4, serie: null, fecha: "2026-11-06", hora: "20:00" },
  ];

  const res = R.agruparReservas(filas);

  assert.strictEqual(res.length, 3); // Un grupo de serie, y dos individuales
  assert.strictEqual(res[0].repeticion, true);
  assert.deepStrictEqual(res[0].ids, [1, 2]); // Ha agrupado los dos de la serie S1
  assert.strictEqual(res[1].repeticion, false);
});

test("reservas: precioParaFechaHora() aplica tarifas de fin de semana", () => {
  // Usa las TARIFAS_DEFECTO de core.js (finde = 26€)
  // Sábado (2026-11-07) a las 10:00
  assert.strictEqual(
    R.precioParaFechaHora("2026-11-07", "10:00", 90, "Normal"),
    26,
  );
  // Miércoles (2026-11-04) a las 10:00 (semanaManana = 20€)
  assert.strictEqual(
    R.precioParaFechaHora("2026-11-04", "10:00", 90, "Normal"),
    20,
  );
});
