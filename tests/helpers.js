const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dummyElement = {
  style: {},
  value: "",
  innerText: "",
  innerHTML: "",
  hidden: false,
  disabled: false,
  className: "",
  classList: {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false,
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  appendChild: () => {},
  removeChild: () => {},
  remove: () => {},
  querySelector: () => dummyElement,
  querySelectorAll: () => [],
  setAttribute: () => {},
  getAttribute: () => null,
  removeAttribute: () => {},
  focus: () => {},
  blur: () => {},
  closest: () => null,
  click: () => {},
  insertBefore: () => {},
  after: () => {},
  before: () => {},
  parentNode: {
    insertBefore: () => {},
    appendChild: () => {},
    removeChild: () => {},
  },
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
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    TypeError,
    ReferenceError,
    TextEncoder,
    TextDecoder,
    URL,
    AbortController,
    Event: class Event {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    setTimeout: (fn) => {
      // No ejecutamos para evitar que tests se disparen solos
      return 0;
    },
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    fetch: () => Promise.reject(new Error("Fetch no permitido")),
    navigator: {
      language: "es-ES",
      onLine: true,
      vibrate: () => {},
      userAgent: "node-test",
      serviceWorker: null,
    },
    location: {
      origin: "https://geopadelclub.com",
      search: "",
      href: "https://geopadelclub.com/",
    },
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
    sessionStorage: {
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
      removeEventListener: () => {},
      dispatchEvent: () => {},
      createElement: () => dummyElement,
      body: dummyElement,
      head: dummyElement,
      readyState: "complete",
      documentElement: {
        setAttribute: () => {},
        getAttribute: () => "light",
        removeAttribute: () => {},
        style: {},
      },
    },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      location: { href: "", origin: "https://geopadelclub.com", search: "" },
      requestIdleCallback: (cb) => {
        return 0;
      },
      AudioContext: function () {
        this.state = "running";
        this.currentTime = 0;
        this.destination = {};
        this.resume = () => {};
        this.createOscillator = () => ({
          connect: () => {},
          start: () => {},
          stop: () => {},
          frequency: { value: 0 },
        });
        this.createGain = () => ({
          connect: () => {},
          gain: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
        });
      },
    },
    crypto: { randomUUID: () => "uuid-fake-123" },
    Notification: undefined,
    navigator_onLine: true,
  };

  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  ctx.window.window = ctx;
  ctx.window.document = ctx.document;
  ctx.window.localStorage = ctx.localStorage;
  ctx.window.setTimeout = ctx.setTimeout;
  ctx.window.clearTimeout = ctx.clearTimeout;
  ctx.window.setInterval = ctx.setInterval;
  ctx.window.clearInterval = ctx.clearInterval;
  ctx.window.crypto = ctx.crypto;

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
