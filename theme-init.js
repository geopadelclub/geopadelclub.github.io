/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
(function () {
    try {
        var t = localStorage.getItem('gp-theme');
        if (t !== 'dark' && t !== 'light') {
            t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', t);
        var m = document.getElementById('metaTheme');
        if (m) m.setAttribute('content', t === 'dark' ? '#364650' : '#fcfdfc');
    } catch (e) { }
})();