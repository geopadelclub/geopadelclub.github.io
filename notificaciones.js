/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function pedirPermisoNotificaciones() {
  if (!("Notification" in window)) return !1;
  if (Notification.permission === "granted") return !0;
  if (Notification.permission === "denied") return !1;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch (e) {
    return !1;
  }
}
function mostrarNotificacion(e, t = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted")
    return !1;
  try {
    const n = new Notification(e, {
      icon: "geopadel.webp",
      badge: "geopadel.webp",
      tag: "geopadel-reserva",
      renotify: !0,
      ...t,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return !0;
  } catch (e) {
    return !1;
  }
}
