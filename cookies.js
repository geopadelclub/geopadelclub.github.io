/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
  const CLAVE = "gp-cookies-accepted";
  if (localStorage.getItem(CLAVE)) return;

  const banner = document.createElement("div");
  banner.id = "gpCookieBanner";
  banner.innerHTML = `
<p>Utilizamos cookies técnicas y de almacenamiento local para el correcto funcionamiento de la web y para recordar tus preferencias. No usamos cookies publicitarias. Puedes leer más en nuestra <a href="politica-cookies.html">Política de Cookies</a>.</p>
<button type="button" class="gp-cookie-btn" id="gpCookieBtn">Aceptar y continuar</button>
`;
  document.body.appendChild(banner);
  document.getElementById("gpCookieBtn").addEventListener("click", function () {
    localStorage.setItem(CLAVE, "1");
    banner.remove();
  });
})();
