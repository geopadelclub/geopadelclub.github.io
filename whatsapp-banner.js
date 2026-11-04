/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
  const CLAVE = "gp-wa-community-dismissed";

  function init() {
    if (localStorage.getItem(CLAVE)) return;
    if (!document.body) return;

    const url =
      typeof WHATSAPP_COMMUNITY_URL !== "undefined"
        ? WHATSAPP_COMMUNITY_URL
        : "";
    if (!url || url.includes("XXXXX")) return;

    const div = document.createElement("div");
    div.id = "gpWaBanner";
    div.setAttribute("role", "region");
    div.setAttribute("aria-label", "Comunidad de WhatsApp");
    div.innerHTML = `
      <span class="gp-wa-icon" aria-hidden="true"><i class="ri-whatsapp-line"></i></span>
      <div class="gp-wa-text">
        <b data-i18n="wa.titulo">Únete a nuestra comunidad</b>
        <span data-i18n="wa.desc">Recibe avisos de huecos libres y novedades del club.</span>
      </div>
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="gp-wa-cta" data-i18n="wa.cta">Unirme</a>
      <button type="button" class="gp-wa-close" aria-label="Cerrar" data-i18n-aria="tienda.cerrar"><i class="ri-close-line" aria-hidden="true"></i></button>
    `;

    const header = document.querySelector("header");
    if (header && header.parentNode) {
      header.parentNode.insertBefore(div, header.nextElementSibling);
    } else {
      document.body.insertBefore(div, document.body.firstChild);
    }

    div.querySelector(".gp-wa-close").addEventListener("click", () => {
      div.remove();
      try {
        localStorage.setItem(CLAVE, "1");
      } catch (e) {}
    });

    if (typeof aplicarIdioma === "function") aplicarIdioma();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
