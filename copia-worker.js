/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
importScripts("copia-zip.js");
self.onmessage = async (e) => {
  const { archivos } = e.data || {};
  try {
    const blob = CopiaZip.crearZip(archivos || []);
    const buffer = await blob.arrayBuffer();
    self.postMessage({ ok: true, buffer }, [buffer]);
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
