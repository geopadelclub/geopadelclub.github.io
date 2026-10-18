/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function pedirPermisoNotificaciones() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        const r = await Notification.requestPermission();
        return r === 'granted';
    } catch (e) { return false; }
}
function mostrarNotificacion(titulo, opciones = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
        const n = new Notification(titulo, {
            icon: 'Geopadel.webp', badge: 'Geopadel.webp',
            tag: 'geopadel-reserva', renotify: true, ...opciones
        });
        n.onclick = () => { window.focus(); n.close(); };
        return true;
    } catch (e) { return false; }
}