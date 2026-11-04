const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const B = cargarContexto(["utils.js", "bar.js"]);

test("bar: totalItems() suma los precios de la cuenta", () => {
  const items = [
    { nombre: "Cerveza", precio: 2.5 },
    { nombre: "Tapa", precio: 3.0 },
    { nombre: "Agua", precio: 1.5 },
  ];
  assert.strictEqual(B.totalItems(items), 7.0);
});

test("bar: totalItems() devuelve 0 si la mesa está vacía", () => {
  assert.strictEqual(B.totalItems([]), 0);
  assert.strictEqual(B.totalItems(null), 0);
});

test("bar: totalItems() ignora precios inválidos", () => {
  const items = [
    { nombre: "Cerveza", precio: 2.5 },
    { nombre: "Error", precio: "abc" },
    { nombre: "Nulo", precio: null },
  ];
  assert.strictEqual(B.totalItems(items), 2.5);
});
