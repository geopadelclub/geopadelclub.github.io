/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
    const CLAVE = 'gp-cookies-accepted';
    if (localStorage.getItem(CLAVE)) return;

    const style = document.createElement('style');
    style.textContent = `
        #gpCookieBanner { position: fixed; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom)); background: var(--surface, #fff); border: 1.5px solid var(--border, #dfe7e3); border-radius: var(--radius-md, 14px); padding: 18px; box-shadow: 0 10px 28px rgba(0,0,0,.15); z-index: 9999; display: flex; flex-direction: column; gap: 14px; font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; }
        #gpCookieBanner p { font-size: 14px; font-weight: 600; color: var(--text, #2a3834); margin: 0; line-height: 1.4; }
        #gpCookieBanner a { color: var(--blue, #3f6fa8); text-decoration: underline; font-weight: 700; }
        #gpCookieBanner .gp-cookie-btn { background: var(--primary, #4b7a86); color: var(--on-primary, #fff); border: none; padding: 12px 20px; border-radius: var(--radius-sm, 8px); font-weight: 700; font-size: 14px; cursor: pointer; align-self: flex-end; transition: opacity .15s; }
        #gpCookieBanner .gp-cookie-btn:hover { opacity: .9; }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'gpCookieBanner';
    banner.innerHTML = `
        <p>Utilizamos cookies técnicas y de almacenamiento local para el correcto funcionamiento de la web y para recordar tus preferencias. No usamos cookies publicitarias. Puedes leer más en nuestra <a href="politica-cookies.html">Política de Cookies</a>.</p>
        <button type="button" class="gp-cookie-btn" id="gpCookieBtn">Aceptar y continuar</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('gpCookieBtn').addEventListener('click', function () {
        localStorage.setItem(CLAVE, '1');
        banner.remove();
    });
})();