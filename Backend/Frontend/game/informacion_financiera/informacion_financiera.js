document.addEventListener('DOMContentLoaded', function () {
  const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],  // ✅ permite fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

  // === Multi-partida: partidaId + playerName ===
  const params = new URLSearchParams(location.search);
  const partidaId  = params.get('partidaId')  || localStorage.getItem('partidaId')  || 'default';
  const playerName = localStorage.getItem('playerName') || params.get('playerName') || '';

  // Unirse a la sala ANTES de cualquier acción
  socket.emit('joinGame', { partidaId, nombre: playerName || null });
  if (!playerName) {
    alert('No se ha encontrado el nombre del jugador. Redirigiendo al inicio.');
    const url = new URL('../../index.html', location.href);
    url.searchParams.set('partidaId', partidaId);
    window.location.href = url.pathname + '?' + url.searchParams.toString();
    return;
  }

  // Asociar socket a jugador
  socket.emit('identificarJugador', playerName);

  // ====== Navegación lateral ======
  const navButtons = document.querySelectorAll('.nav-button');
  const contentSections = document.querySelectorAll('.content-section');
  const btnVolver = document.getElementById('volver-btn');

  const withQuery = (path) => {
    const u = new URL(path, location.href);
    u.searchParams.set('partidaId', partidaId);
    if (playerName) u.searchParams.set('playerName', playerName);
    return u.pathname + '?' + u.searchParams.toString();
  };

  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      const url = new URL('../game.html', location.href);
      url.searchParams.set('partidaId', partidaId);
      if (playerName) url.searchParams.set('playerName', playerName);
      location.href = url.pathname + '?' + url.searchParams.toString();
    });
  }

  // ====== Iframes: asegurar que cargan con la query (partidaId/playerName) ======
  const ifrCRGeneral  = document.getElementById('iframe-cr-general');
  const ifrCRProducto = document.getElementById('iframe-cr-producto');
  const ifrVentas     = document.getElementById('iframe-ventas');

  if (ifrCRGeneral)  ifrCRGeneral.src  = withQuery('cuenta_resultados/cuenta_resultados.html');
  if (ifrCRProducto) ifrCRProducto.src = withQuery('cr_producto/cr_producto.html');
  if (ifrVentas)     ifrVentas.src     = withQuery('ventas/ventas.html');

  // ====== Sincronización con iframes (postMessage) ======
  const sincronizarIframe = (iframeEl, message) => {
    if (iframeEl && iframeEl.contentWindow) {
      iframeEl.contentWindow.postMessage(message, '*');
    }
  };

  // Estado local mínimo para reenviar a iframes
  let lastRoundsHistory = [];
  let lastResultadosCompletos = [];

  socket.on('syncPlayerData', (data) => {
    // roundsHistory para CR general y para contexto de las otras vistas
    const roundsHistory = data.roundsHistory || [];
    lastRoundsHistory = roundsHistory;

    sincronizarIframe(ifrCRGeneral, {
      type: 'SYNC',
      playerName,
      partidaId,
      roundsHistory
    });

    // Inicial, sin resultados completos aún
    sincronizarIframe(ifrCRProducto, {
      type: 'SYNC',
      playerName,
      partidaId,
      roundsHistory,
      resultados: lastResultadosCompletos
    });

    sincronizarIframe(ifrVentas, {
      type: 'SYNC',
      playerName,
      partidaId,
      roundsHistory,
      resultados: lastResultadosCompletos
    });
  });

  socket.on('resultadosCompletos', (resultados) => {
    lastResultadosCompletos = Array.isArray(resultados) ? resultados : [];

    sincronizarIframe(ifrCRProducto, {
      type: 'RESULTADOS_COMPLETOS',
      playerName,
      partidaId,
      roundsHistory: lastRoundsHistory,
      resultados: lastResultadosCompletos
    });

    sincronizarIframe(ifrVentas, {
      type: 'RESULTADOS_COMPLETOS',
      playerName,
      partidaId,
      roundsHistory: lastRoundsHistory,
      resultados: lastResultadosCompletos
    });
  });

  // Lógica de pestañas + disparo de solicitud de resultados completos
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      navButtons.forEach((b) => b.classList.remove('active'));
      button.classList.add('active');

      contentSections.forEach((sec) => sec.classList.remove('active'));
      const targetId = button.getAttribute('data-target');
      document.getElementById(targetId)?.classList.add('active');

      // Cuando se entra a CR Producto o Ventas, pedimos resultados completos
      if (targetId === 'cuenta-productos' || targetId === 'ventas') {
        socket.emit('solicitarResultadosCompletos');
      }
    });
  });

  // Al cargar la vista, pide también resultados (por si entras directo)
  socket.emit('solicitarResultados');
});
