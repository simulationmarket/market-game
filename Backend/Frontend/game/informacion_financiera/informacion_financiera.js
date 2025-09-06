'use strict';

(function () {
  // Evita sockets globales aquí
  window.DISABLE_GLOBAL_SOCKET = true;
  window.DISABLE_POLLING = true;

  const qs = new URLSearchParams(location.search);
  const partidaId  = qs.get('partidaId')  || '';
  const playerName = qs.get('playerName') || '';
  // Portabilidad del backend
  const socketHost = qs.get('socketHost') || window.SOCKET_HOST || location.origin;

  function q(params) {
    const u = new URL(location.href);
    const sp = new URLSearchParams();
    if (partidaId)  sp.set('partidaId',  partidaId);
    if (playerName) sp.set('playerName', playerName);
    if (socketHost) sp.set('socketHost', socketHost);
    if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, v));
    sp.set('v', Date.now().toString()); // cache-buster
    return '?' + sp.toString();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const aCRG = document.getElementById('link-cr-general');
    const aCRP = document.getElementById('link-cr-producto');
    const aVEN = document.getElementById('link-ventas');
    const who  = document.getElementById('who');
    const volver = document.getElementById('volver-btn');

    if (aCRG) aCRG.href = 'cuenta_resultados.html' + q();
    if (aCRP) aCRP.href = 'cr_producto.html'      + q();
    if (aVEN) aVEN.href = 'ventas.html'           + q();

    if (who) who.textContent = `Partida: ${partidaId} — Jugador: ${playerName}`;

    if (volver) {
      volver.addEventListener('click', () => {
        const url = new URL('game.html', location.href);
        if (partidaId)  url.searchParams.set('partidaId', partidaId);
        if (playerName) url.searchParams.set('playerName', playerName);
        if (socketHost) url.searchParams.set('socketHost', socketHost);
        location.href = url.pathname + '?' + url.searchParams.toString();
      });
    }
  });
})();
