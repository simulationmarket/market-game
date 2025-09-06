'use strict';

document.addEventListener('DOMContentLoaded', function () {
  // Abre un socket como en Estudios (opcional, solo identifica al jugador)
  const socket = io();

  // Lee params / guarda en localStorage como hace Productos
  const qs = new URLSearchParams(location.search);
  let partidaId  = qs.get('partidaId')  || localStorage.getItem('partidaId')  || '';
  let playerName = qs.get('playerName') || localStorage.getItem('playerName') || '';

  if (!playerName) {
    alert('No se ha encontrado el nombre del jugador. Redirigiendo al inicio.');
    window.location.href = '../game.html';
    return;
  }

  // Persistimos para que las subpantallas (dentro del iframe) lo lean si lo necesitan
  localStorage.setItem('playerName', playerName);
  if (partidaId) localStorage.setItem('partidaId', partidaId);

  // Notificamos al backend (como en Estudios/Productos)
  socket.emit('identificarJugador', playerName);

  // Construye src del iframe con query (útil si las subpantallas leen por URL)
  function buildQuery() {
    const sp = new URLSearchParams();
    if (partidaId)  sp.set('partidaId', partidaId);
    if (playerName) sp.set('playerName', playerName);
    sp.set('v', Date.now().toString()); // evita caché
    return '?' + sp.toString();
  }

  const iframe = document.getElementById('iframe-content');
  const btnCRG = document.getElementById('cr-general-btn');
  const btnCRP = document.getElementById('cr-producto-btn');
  const btnVEN = document.getElementById('ventas-btn');
  const btnVolver = document.getElementById('volver-btn');

  // Carga por defecto CR General (encajada)
  if (iframe) iframe.src = 'cuenta_resultados/cuenta_resultados.html' + buildQuery();

  if (btnCRG) {
    btnCRG.addEventListener('click', function () {
      iframe.src = 'cuenta_resultados/cuenta_resultados.html' + buildQuery();
    });
  }
  if (btnCRP) {
    btnCRP.addEventListener('click', function () {
      iframe.src = 'cr_producto/cr_producto.html' + buildQuery();
    });
  }
  if (btnVEN) {
    btnVEN.addEventListener('click', function () {
      iframe.src = 'ventas/ventas.html' + buildQuery();
    });
  }
  if (btnVolver) {
    btnVolver.addEventListener('click', function () {
      const url = new URL('../game.html', location.href);
      if (partidaId)  url.searchParams.set('partidaId', partidaId);
      if (playerName) url.searchParams.set('playerName', playerName);
      window.location.href = url.pathname + '?' + url.searchParams.toString();
    });
  }
});
