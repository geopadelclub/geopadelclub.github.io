const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dummyElement = {
  style: {},
  value: "",
  innerText: "",
  innerHTML: "",
  classList: {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false,
  },
  addEventListener: () => {},
  appendChild: () => {},
  removeChild: () => {},
  remove: () => {},
  querySelector: () => dummyElement,
  querySelectorAll: () => [],
  setAttribute: () => {},
  getAttribute: () => null,
  focus: () => {},
  blur: () => {},
  closest: () => null,
  dataset: {},
};

function cargarContexto(archivos = []) {
  const ctx = {
    console,
    Date,
    Math,
    JSON,
    Intl,
    RegExp,
    Set,
    Map,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    fetch: () => Promise.reject(new Error("Fetch no permitido")),
    navigator: { language: "es-ES", onLine: true, vibrate: () => {} },
    location: { origin: "https://geopadelclub.com", search: "", href: "" },
    localStorage: {
      _data: {},
      getItem(k) {
        return this._data[k] || null;
      },
      setItem(k, v) {
        this._data[k] = String(v);
      },
      removeItem(k) {
        delete this._data[k];
      },
    },
    document: {
      getElementById: () => dummyElement,
      querySelector: () => dummyElement,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => dummyElement,
      body: dummyElement,
      head: dummyElement,
      documentElement: {
        setAttribute: () => {},
        getAttribute: () => "light",
        style: {},
      },
    },
    window: {
      addEventListener: () => {},
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      location: { href: "" },
    },
    crypto: { randomUUID: () => "uuid-fake-123" },
  };

  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  for (const nombre of archivos) {
    const filePath = path.join(__dirname, "..", nombre);
    const code = fs.readFileSync(filePath, "utf8");
    vm.runInContext(code, ctx, { filename: nombre });
  }

  return ctx;
}

function cargarArchivo(nombre) {
  return cargarContexto([nombre]);
}

module.exports = { cargarContexto, cargarArchivo };
