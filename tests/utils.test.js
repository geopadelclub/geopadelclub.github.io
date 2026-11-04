const test = require("node:test");
const assert = require("node:assert");
const { cargarArchivo } = require("./helpers");

const U = cargarArchivo("utils.js");

test("utils: esc() previene inyecciones HTML", () => {
  assert.strictEqual(U.esc("<b>Hola</b>"), "&lt;b&gt;Hola&lt;/b&gt;");
  assert.strictEqual(U.esc('"Comillas"'), "&quot;Comillas&quot;");
  assert.strictEqual(U.esc(null), "");
  assert.strictEqual(U.esc(undefined), "");
});

test("utils: eur() formatea moneda correctamente", () => {
  // Usamos replace para limpiar espacios raros de Intl en Node
  assert.strictEqual(U.eur(20).replace(/\u00A0/g, " "), "20,00 €");
  assert.strictEqual(U.eur(20.5).replace(/\u00A0/g, " "), "20,50 €");
  assert.strictEqual(U.eur(null).replace(/\u00A0/g, " "), "0,00 €");
});

test("utils: eur() con flag short quita decimales si es entero", () => {
  assert.strictEqual(U.eur(20, true).replace(/\u00A0/g, " "), "20 €");
  assert.strictEqual(U.eur(20.5, true).replace(/\u00A0/g, " "), "20,50 €");
});

test("utils: timeToMin() y minToTimeStr() son inversas", () => {
  const casos = ["00:00", "09:30", "14:15", "23:59"];
  casos.forEach((hora) => {
    assert.strictEqual(U.minToTimeStr(U.timeToMin(hora)), hora);
  });
  assert.strictEqual(U.timeToMin("09:30"), 570);
});

test("utils: duracionTxt() formatea minutos", () => {
  assert.strictEqual(U.duracionTxt(60), "1 h");
  assert.strictEqual(U.duracionTxt(90), "1 h 30 min");
  assert.strictEqual(U.duracionTxt(45), "45 min");
});

test("utils: normalizarNombre() quita tildes y pone Title Case", () => {
  assert.strictEqual(U.normalizarNombre("  josé  ángel  "), "Jose Angel");
  assert.strictEqual(U.normalizarNombre("MARÍA JOSÉ"), "Maria Jose");
  assert.strictEqual(U.normalizarNombre(""), "");
  assert.strictEqual(U.normalizarNombre(null), null);
});

test("utils: normalizarTelefono() limpia el formato", () => {
  assert.strictEqual(U.normalizarTelefono("+34 600 000 000"), "600000000");
  assert.strictEqual(U.normalizarTelefono("600-000-000"), "600000000");
  assert.strictEqual(U.normalizarTelefono("34600000000"), "600000000");
});

test("utils: telefonoValido() valida longitud y caracteres", () => {
  assert.strictEqual(U.telefonoValido("600000000"), true);
  assert.strictEqual(U.telefonoValido("+34 600 000 000"), true);
  assert.strictEqual(U.telefonoValido("123"), false);
  assert.strictEqual(U.telefonoValido("abcdefghi"), false);
});

test("utils: sumarDiasISO() calcula fechas correctamente", () => {
  assert.strictEqual(U.sumarDiasISO("2026-11-04", 7), "2026-11-11");
  assert.strictEqual(U.sumarDiasISO("2026-12-31", 1), "2027-01-01");
});
