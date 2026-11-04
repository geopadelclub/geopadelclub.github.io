const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const R = cargarContexto(["utils.js", "resumen.js"]);

test("resumen: resumenSaludo() responde correctamente según la hora", () => {
  const OriginalDate = R.Date;

  // Forzamos la hora dentro del contexto VM
  R.Date = class extends OriginalDate {
    constructor() {
      super();
      return new OriginalDate("2026-11-04T08:00:00"); // Mañana
    }
  };
  assert.strictEqual(R.resumenSaludo(), "Buenos días");

  R.Date = class extends OriginalDate {
    constructor() {
      super();
      return new OriginalDate("2026-11-04T15:00:00"); // Tarde
    }
  };
  assert.strictEqual(R.resumenSaludo(), "Buenas tardes");

  R.Date = class extends OriginalDate {
    constructor() {
      super();
      return new OriginalDate("2026-11-04T21:00:00"); // Noche
    }
  };
  assert.strictEqual(R.resumenSaludo(), "Buenas noches");

  R.Date = OriginalDate; // Restauramos
});
