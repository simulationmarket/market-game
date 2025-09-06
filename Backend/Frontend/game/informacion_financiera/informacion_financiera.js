'use strict';

(function () {
  // Evita que scripts globales (index.js, game.js, etc.) abran sockets en esta vista
  window.DISABLE_GLOBAL_SOCKET = true;
  window.DISABLE_POLLING = true;

  const LOG = '[INF FIN PADRE]';
  const qs = new URLSearchParams(window.location.search);
  const partidaId = qs.get('partidaId') || '';
  const playerName = qs.get('playerName') || '';

  // IDs esperados en el HTML del padre
  const ifrCRGeneral  = document.getElementById('iframe-cr-general');
  const ifrCRProducto = document.getElementById('iframe-cr-producto');
  const ifrVentas     = document.getElementById('iframe-ventas');
  const btnVolver     = document.getElementById('volver-btn');

  // Construye una URL con los query params necesarios + cache-buster
  function withQuery(path) {
    const u = new URL(path, window.location.href);
    if (partidaId)  u.searchParams.set('partidaId', partidaId);
    if (playerName) u.searchParams.set('playerName', playerName);
    u.searchParams.set('v', Date.now().toString()); // evita caché en Koyeb/CDN
    return u.pathname + '?' + u.searchParams.toString();
  }

  // Asegura que cada iframe tenga los params; si no tenía src, usa fallbackPath
  function ensureIframeSrc(ifr, fallbackPath) {
    if (!ifr) return;
    try {
      const current = ifr.getAttribute('src');
      if (current && current.trim() !== '') {
        const u = new URL(current, window.location.href);
        if (partidaId)  u.searchParams.set('partidaId', partidaId);
        if (playerName) u.searchParams.set('playerName', playerName);
        u.searchParams.set('v', Date.now().toString());
        ifr.src = u.pathname + '?' + u.searchParams.toString();
      } else if (fallbackPath) {
        ifr.src = withQuery(fallbackPath);
      }
    } catch (e) {
      console.warn(LOG, 'ensureIframeSrc: fallback por error', e);
      if (fallbackPath) ifr.src = withQuery(fallbackPath);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // ⚠️ Ajusta los nombres si tus archivos reales usan otro case (Linux/Koyeb es case-sensitive)
    ensureIframeSrc(ifrCRGeneral,  'cr_general.html');
    ensureIframeSrc(ifrCRProducto, 'cr_producto.html');
    ensureIframeSrc(ifrVentas,     'ventas.html');

    if (btnVolver) {
      btnVolver.addEventListener('click', function () {
        try {
          const url = new URL('../game.html', window.location.href);
          if (partidaId)  url.searchParams.set('partidaId', partidaId);
          if (playerName) url.searchParams.set('playerName', playerName);
          window.location.href = url.pathname + '?' + url.searchParams.toString();
        } catch (e) {
          console.error(LOG, 'navegación volver falló', e);
        }
      });
    }

    console.log(LOG, 'inicializado', { partidaId, playerName });
  });
})();
