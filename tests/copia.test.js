const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

// copia.js necesita utils.js
const C = cargarContexto(["utils.js", "copia.js", "copia-zip.js"]);

test("copia: celdaCSV() escapa correctamente para Excel", () => {
  // Decimales usan coma
  assert.strictEqual(C.celdaCSV(12.5), "12,5");
  // Textos con punto y coma se rodean de comillas
  assert.strictEqual(C.celdaCSV("Hola;Mundo"), '"Hola;Mundo"');
  // Textos con comillas dobles se duplican
  assert.strictEqual(C.celdaCSV('Dice "hola"'), '"Dice ""hola"""');
  // Inyecciones de fórmulas (peligro en Excel) se bloquean
  assert.strictEqual(C.celdaCSV("=SUMA(A1:A2)"), "'=SUMA(A1:A2)");
});

test("copia: aCSV() genera un CSV completo sin columnas privadas", () => {
  const filas = [
    { id: 1, nombre: "Juan", codigo_hash: "xyz", email: "juan@test.com" },
    { id: 2, nombre: "Ana;", codigo_hash: "abc", email: null },
  ];
  const csv = C.aCSV(filas, "clientes");

  // La cabecera no debe tener codigo_hash
  assert.ok(!csv.includes("codigo_hash"));
  assert.ok(csv.includes("id;nombre;email"));
  // La fila con punto y coma debe ir entrecomillada
  assert.ok(csv.includes('2;"Ana;";'));
});

test("copia-zip: crc32() calcula el checksum correctamente", () => {
  const str = "123456789";
  // Usamos TextEncoder del propio contexto o de Node
  const bytes = new TextEncoder().encode(str);
  // CRC32 de "123456789" es 0xCBF43926 (3405731100 en decimal)
  assert.strictEqual(C.CopiaZip.crc32(bytes), 3405731100);
});
