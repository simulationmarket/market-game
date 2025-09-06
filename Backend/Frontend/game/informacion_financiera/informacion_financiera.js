'use strict';

(function () {
  // Esta vista no usa sockets
  window.DISABLE_GLOBAL_SOCKET = true;
  window.DISABLE_POLLING = true;

  const qs = new URLSearchParams(location.search);
  let partidaId  = qs.get('partidaId')  || localStorage.getItem('partidaId')  || '';
  let playerName = qs.get('playerName') || localStorage.getItem('playerName') || '';

  // guarda por comodidad (igual que suele hacer Productos)
  if (partidaId)  localStorage.setItem('partidaId', partidaId);
  if (playerName) localStorage.setItem('playerName', playerName);

  function buildQuery(extra = {}) {
    const sp = new URLSearchParams();
    if (partidaId)  sp.set('partidaId', partidaId);
    if (playerName) sp.set('playerName', playerName);
    Object.entries(extra).forEach(([k, v]) => sp.set(k, v));
    sp.set('v', Date.now().toString()); // cache-buster
    return '?' + sp.toString();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const aCRG   = document.getElementById('link-cr-general');
    const aCRP   = document.getElementById('link-cr-producto');
    const aVENT  = document.getElementById('link-ventas');
    const who    = document.getElementById('who');
    const volver = document.getElementById('volver-btn');

    if (aCRG)  aCRG.href  = 'cuenta_resultados/cuenta_resultados.html' + buildQuery();
    if (aCRP)  aCRP.href  = 'cr_producto/cr_producto.html'            + buildQuery();
    if (aVENT) aVENT.href = 'ventas/ventas.html'                       + buildQuery();

    if (who) who.textContent = `Partida: ${partidaId || '(sin partida)'} — Jugador: ${playerName || '(sin nombre)'}`;

    if (volver) {
      volver.addEventListener('click', () => {
        const url = new URL('../game.html', location.href);
        if (partidaId)  url.searchParams.set('partidaId', partidaId);
        if (playerName) url.searchParams.set('playerName', playerName);
        location.href = url.pathname + '?' + url.searchParams.toString();
      });
    }
  });
})();
