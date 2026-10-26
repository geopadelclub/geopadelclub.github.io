/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
document.addEventListener("DOMContentLoaded", () => {
  const btnMenu = document.getElementById("btnMenu");
  const mainNav = document.getElementById("mainNav");
  if (!btnMenu || !mainNav) return;

  btnMenu.addEventListener("click", () => {
    mainNav.classList.toggle("open");
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
    });
  });
});
