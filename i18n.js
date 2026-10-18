/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const I18N = {
    es: {
        'nav.tarifas': 'Tarifas', 'nav.ubicacion': 'Ubicación', 'nav.reservar': 'Reservar pista',
        'hero.titulo': 'Tu pista de pádel en Ogíjares',
        'hero.subtitulo': 'Consulta disponibilidad al instante, elige tu hora y juega. El pago se realiza cómodamente en el club.',
        'hero.cta': 'Reservar pista ahora',
        'features.titulo': '¿Por qué jugar en Geopadel?',
        'features.subtitulo': 'Las mejores instalaciones para disfrutar del pádel en Granada.',
        'feature1.titulo': 'Reserva en 1 minuto',
        'feature1.texto': 'Elige día, duración y hora de forma sencilla. Sin registros complicados, directo al juego.',
        'feature2.titulo': 'Pistas de primer nivel',
        'feature2.texto': 'Instalaciones de última generación, mantenidas a diario para que solo te preocupes de jugar.',
        'feature3.titulo': 'Ambiente inmejorable',
        'feature3.texto': 'Ven a disfrutar del deporte y quédate después en nuestra zona de bar y tienda.',
        'tarifas.titulo': 'Nuestras Tarifas',
        'tarifas.subtitulo': 'Precios claros por pista. Sin sorpresas.',
        'huecos.titulo': 'Huecos libres hoy',
        'huecos.subtitulo': 'Actualizado en tiempo real. Reserva desde aquí.',
        'ubicacion.titulo': '¿Dónde estamos?',
        'ubicacion.subtitulo': 'Ven a conocernos, estamos muy cerca.',
        'ubicacion.cta': 'Ver en Google Maps'
    },
    en: {
        'nav.tarifas': 'Prices', 'nav.ubicacion': 'Location', 'nav.reservar': 'Book a court',
        'hero.titulo': 'Your padel court in Ogíjares',
        'hero.subtitulo': 'Check availability instantly, pick your time and play. Payment is made at the club.',
        'hero.cta': 'Book a court now',
        'features.titulo': 'Why play at Geopadel?',
        'features.subtitulo': 'The best facilities to enjoy padel in Granada.',
        'feature1.titulo': 'Book in 1 minute',
        'feature1.texto': 'Pick day, duration and time easily. No complicated sign-ups, straight to the game.',
        'feature2.titulo': 'Top-level courts',
        'feature2.texto': 'State-of-the-art facilities, maintained daily so you only worry about playing.',
        'feature3.titulo': 'Unbeatable atmosphere',
        'feature3.texto': 'Come to enjoy the sport and stay afterwards at our bar and shop area.',
        'tarifas.titulo': 'Our Prices',
        'tarifas.subtitulo': 'Clear prices per court. No surprises.',
        'huecos.titulo': 'Free slots today',
        'huecos.subtitulo': 'Updated in real time. Book from here.',
        'ubicacion.titulo': 'Where are we?',
        'ubicacion.subtitulo': 'Come and meet us, we are very close.',
        'ubicacion.cta': 'View on Google Maps'
    }
};
let _idioma = 'es';
function t(clave) {
    return (I18N[_idioma] && I18N[_idioma][clave]) || I18N.es[clave] || clave;
}
function aplicarIdioma() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const v = t(el.dataset.i18n);
        if (v) el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const v = t(el.dataset.i18nPlaceholder);
        if (v) el.placeholder = v;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const v = t(el.dataset.i18nAria);
        if (v) el.setAttribute('aria-label', v);
    });
    document.documentElement.lang = _idioma;
    const b = document.getElementById('btnIdioma');
    if (b) b.textContent = _idioma.toUpperCase();
}
function setIdioma(lang) {
    if (!I18N[lang]) return;
    _idioma = lang;
    try { localStorage.setItem('gp-lang', lang); } catch (e) { }
    aplicarIdioma();
}
function alternarIdioma() {
    setIdioma(_idioma === 'es' ? 'en' : 'es');
}
(function initIdioma() {
    let guardado = null;
    try { guardado = localStorage.getItem('gp-lang'); } catch (e) { }
    const urlLang = new URLSearchParams(location.search).get('lang');
    if (urlLang === 'en' || urlLang === 'es') _idioma = urlLang;
    else if (guardado === 'en' || guardado === 'es') _idioma = guardado;
    else if (navigator.language && !navigator.language.toLowerCase().startsWith('es')) _idioma = 'en';
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarIdioma);
    else aplicarIdioma();
})();
if (typeof window.accion === 'function') window.accion('cambiar-idioma', alternarIdioma);