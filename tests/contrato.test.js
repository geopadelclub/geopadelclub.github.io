const test = require("node:test");
const assert = require("node:assert");
const { cargarContexto } = require("./helpers");

const C = cargarContexto(["contrato.js"]);

test("contrato: ctMin() convierte string de hora a minutos", () => {
  assert.strictEqual(C.ctMin("08:30"), 510);
  assert.strictEqual(C.ctMin("00:00"), 0);
});

test("contrato: ctMinutosDia() calcula los minutos de un día con 1 tramo", () => {
  const dia = { on: true, ini: "08:00", fin: "12:00" };
  assert.strictEqual(C.ctMinutosDia(dia), 240); // 4 horas
});

test("contrato: ctMinutosDia() calcula los minutos de un día con 2 tramos", () => {
  const dia = {
    on: true,
    ini: "08:00",
    fin: "12:00",
    ini2: "14:00",
    fin2: "17:00",
  };
  assert.strictEqual(C.ctMinutosDia(dia), 420); // 4h + 3h = 7 horas
});

test("contrato: ctMinutosDia() calcula los minutos si es 'sin horario fijo'", () => {
  const dia = { on: true, sinHorario: true, horasDia: 5.5 };
  assert.strictEqual(C.ctMinutosDia(dia), 330); // 5.5 horas * 60
});

test("contrato: ctMinutosSemana() suma los días activos", () => {
  const horario = {
    lun: { on: true, ini: "08:00", fin: "12:00" },
    mar: { on: true, ini: "08:00", fin: "12:00" },
    mie: { on: false },
    jue: { on: true, ini: "08:00", fin: "12:00" },
    vie: { on: true, ini: "08:00", fin: "12:00" },
    sab: { on: false },
    dom: { on: false },
  };
  assert.strictEqual(C.ctMinutosSemana(horario), 960); // 4 días * 4h = 16h = 960 min
});
