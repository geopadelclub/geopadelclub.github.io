/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
document.addEventListener("DOMContentLoaded", () => {
  const btnMenu = document.getElementById("btnMenu");
  const mainNav = document.getElementById("mainNav");
  if (!btnMenu || !mainNav) return;

  const setAbierto = (abierto) => {
    mainNav.classList.toggle("open", abierto);
    btnMenu.setAttribute("aria-expanded", abierto ? "true" : "false");
    btnMenu.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  };

  btnMenu.addEventListener("click", () => {
    setAbierto(!mainNav.classList.contains("open"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("open")) {
      setAbierto(false);
      btnMenu.focus();
    }
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setAbierto(false));
  });
});
