const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const C = cargarContexto(["utils.js", "core.js", "caja.js"]);
C.FONDO_CAJA_DEF = 100; // Fondo de caja de 100€

test("caja: calcularCierre() cuadra perfecto con el fondo", () => {
  // Billetes = 100, Monedas = 50. Esperado = 100 (fondo) + ventas (0)
  // Como hay 50 en monedas, el sistema intentará dejar 50 en billetes.
  // Dejar 50 en billetes + 50 en monedas = 100€ exactos en caja.
  // Sobran 50€ en billetes para el sobre.
  const res = C.calcularCierre(100, 50, 0);
  assert.strictEqual(res.cajaFinal, 100);
  assert.strictEqual(res.dejarBilletes, 50);
  assert.strictEqual(res.sobre, 50);
  assert.strictEqual(res.faltaFondo, 0);
});

test("caja: calcularCierre() redondea billetes a múltiplos de 5", () => {
  // Billetes = 100, Monedas = 17.50. Ideal en billetes = 100 - 17.50 = 82.50
  // Redondeo a múltiplo de 5 más cercano: 80€ o 85€.
  // Math.round(82.5 / 5) * 5 = Math.round(16.5) * 5 = 17 * 5 = 85€.
  // Deja 85 en billetes + 17.50 en monedas = 102.50€.
  // Sobran 15€ en billetes.
  const res = C.calcularCierre(100, 17.5, 0);
  assert.strictEqual(res.dejarBilletes, 85);
  assert.strictEqual(res.sobre, 15);
  assert.strictEqual(res.cajaFinal, 102.5);
  assert.strictEqual(res.excesoFondo, 2.5); // Avisa que sobran 2.5€
});

test("caja: calcularCierre() detecta cuando falta dinero", () => {
  // Billetes = 10, Monedas = 5. Esperado = 100. Caja final = 15.
  const res = C.calcularCierre(10, 5, 0);
  assert.strictEqual(res.dejarBilletes, 10);
  assert.strictEqual(res.cajaFinal, 15);
  assert.strictEqual(res.faltaFondo, 85); // Faltan 85€ para llegar al fondo de 100
});
