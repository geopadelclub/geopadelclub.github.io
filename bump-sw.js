/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const fs = require('fs'), crypto = require('crypto');
const sw = fs.readFileSync('sw.js', 'utf8');
const m = sw.match(/const ARCHIVOS = \[(.*?)\];/s);
if (!m) { console.error('No encuentro ARCHIVOS en sw.js'); process.exit(1); }
const lista = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).filter(f => !/^https?:/.test(f) && f !== './').sort();
const limpio = sw.replace(/const VERSION = '[^']*';/, '');
const h = crypto.createHash('sha256');
for (const f of lista) if (fs.existsSync(f)) h.update(f).update(fs.readFileSync(f));
h.update(limpio);
const v = 'geopadel-' + h.digest('hex').slice(0, 10);
fs.writeFileSync('sw.js', sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`));
console.log('sw.js VERSION =', v);