const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const I = cargarContexto(["i18n.js"]);

test("i18n: t() devuelve el texto en español por defecto", () => {
  assert.strictEqual(I.t("nav.tienda"), "Tienda");
  assert.strictEqual(I.t("nav.reservar-corto"), "Reservar");
});

test("i18n: t() reemplaza variables dinámicas", () => {
  const txt = I.t("mis-reservas.hola", { nombre: "Juan" });
  assert.strictEqual(txt, "Hola, <b>Juan</b>");
});

test("i18n: setIdioma() cambia a inglés y traduce", () => {
  I.setIdioma("en");
  assert.strictEqual(I.t("nav.tienda"), "Shop");
  assert.strictEqual(
    I.t("mis-reservas.hola", { nombre: "John" }),
    "Hello, <b>John</b>",
  );
  I.setIdioma("es"); // Restauramos
});
