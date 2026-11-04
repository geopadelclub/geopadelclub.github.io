const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const C = cargarContexto(["utils.js", "core.js"]);

test("core: esFinde() detecta sábados, domingos y laborables", () => {
  assert.strictEqual(C.esFinde("2026-11-07"), true); // Sábado
  assert.strictEqual(C.esFinde("2026-11-08"), true); // Domingo
  assert.strictEqual(C.esFinde("2026-11-04"), false); // Miércoles
});

test("core: obtenerCierreMin() aplica horario de finde", () => {
  assert.strictEqual(C.obtenerCierreMin("2026-11-04"), 1410); // Miércoles normal (23:30)
  assert.strictEqual(C.obtenerCierreMin("2026-11-07"), 1320); // Sábado (22:00)
});

test("core: esCerrado() bloquea descanso, antes de abrir y después de cerrar", () => {
  const miercoles = "2026-11-04";
  assert.strictEqual(C.esCerrado(480, miercoles), true); // 08:00 (antes de abrir)
  assert.strictEqual(C.esCerrado(600, miercoles), false); // 10:00 (abierto)
  assert.strictEqual(C.esCerrado(850, miercoles), true); // 14:10 (descanso)
  assert.strictEqual(C.esCerrado(1100, miercoles), false); // 18:20 (abierto)
  assert.strictEqual(C.esCerrado(1440, miercoles), true); // 24:00 (cerrado)
});

test("core: esFranjaBloqueada() valida solapamientos con cierre", () => {
  const miercoles = "2026-11-04";
  // Reserva de 17:00 (1020) a 18:30 (1110)
  assert.strictEqual(
    C.esFranjaBloqueada(1020, 1110, "Normal", miercoles),
    false,
  );
  // Reserva de 23:00 a 00:30 (excede cierre de 23:30)
  assert.strictEqual(
    C.esFranjaBloqueada(1380, 1470, "Normal", miercoles),
    true,
  );
});
