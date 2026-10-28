/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
  const CLAVE = "gp-cookies-accepted";
  if (localStorage.getItem(CLAVE)) return;

  const banner = document.createElement("div");
  banner.id = "gpCookieBanner";
  banner.innerHTML = `
<div class="gp-cookie-text">
  <p>Usamos cookies técnicas para el funcionamiento de la web. <a href="politica-cookies.html">Política de Cookies</a>.</p>
</div>
<button type="button" class="gp-cookie-btn" id="gpCookieBtn">Aceptar</button>
`;
  document.body.appendChild(banner);
  document.getElementById("gpCookieBtn").addEventListener("click", function () {
    localStorage.setItem(CLAVE, "1");
    banner.remove();
  });
})();
