/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const fs = require("fs"),
  crypto = require("crypto");
const sw = fs.readFileSync("sw.js", "utf8");

const arrays = [
  ...sw.matchAll(/const (BASE|PANEL|PUBLICO)\s*=\s*\[(.*?)\];/gs),
];

if (!arrays.length) {
  console.error("❌ No encuentro arrays BASE/PANEL/PUBLICO en sw.js");
  process.exit(1);
}

const archivosSet = new Set();
for (const [, , contenido] of arrays) {
  for (const m of contenido.matchAll(/['"]([^'"]+)['"]/g)) {
    const f = m[1];
    if (!/^https?:/.test(f) && f !== "./") archivosSet.add(f);
  }
}

const lista = [...archivosSet].sort();
let swLimpio = sw;
swLimpio = swLimpio.replace(/const VERSION\s*=\s*['"][^'"]*['"];/, "");

const h = crypto.createHash("sha256");

let hasheados = 0;
for (const f of lista) {
  if (fs.existsSync(f)) {
    h.update(f).update(fs.readFileSync(f));
    hasheados++;
  }
}

h.update(swLimpio);
const v = "geopadel-" + h.digest("hex").slice(0, 10);

const swFinal = sw.replace(
  /const VERSION\s*=\s*['"][^'"]*['"];/,
  `const VERSION = '${v}';`,
);

fs.writeFileSync("sw.js", swFinal);
console.log(
  `✅ sw.js VERSION = ${v} (${hasheados} archivos hasheados de ${lista.length} encontrados)`,
);
