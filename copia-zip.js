/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function (root) {
    const TABLA_CRC = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();
    function crc32(u8) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < u8.length; i++) c = TABLA_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function crearZip(archivos) {
        const enc = new TextEncoder(), partes = [], central = [];
        const d = new Date();
        const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
        const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
        let offset = 0;
        archivos.forEach(f => {
            const nombre = enc.encode(f.nombre), size = f.datos.length, crc = crc32(f.datos);
            const lh = new DataView(new ArrayBuffer(30));
            lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
            lh.setUint16(10, hora, true); lh.setUint16(12, fecha, true); lh.setUint32(14, crc, true);
            lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nombre.length, true); lh.setUint16(28, 0, true);
            partes.push(new Uint8Array(lh.buffer), nombre, f.datos);
            const ch = new DataView(new ArrayBuffer(46));
            ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
            ch.setUint16(12, hora, true); ch.setUint16(14, fecha, true); ch.setUint32(16, crc, true);
            ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, nombre.length, true);
            ch.setUint32(42, offset, true);
            central.push(new Uint8Array(ch.buffer), nombre);
            offset += 30 + nombre.length + size;
        });
        const tamCentral = central.reduce((s, c) => s + c.length, 0);
        const fin = new DataView(new ArrayBuffer(22));
        fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
        fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
        return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
    }
    root.CopiaZip = { crc32, crearZip };
})(self);