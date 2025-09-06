'use strict';

// ================================================
// Información financiera - cliente principal (hub)
// - Carga subpantallas en iframes con parámetros
// - Se identifica contra el backend vía socket.io
// - Recibe roundsHistory y resultadosCompletos
// - Reenvía datos a subpantallas vía window.postMessage
// ================================================

(function () {
  // ---------- Utilidades base ----------
  const qs = new URLSearchParams(location.search);
  const partidaId = qs.get('partidaId') || '';
  const playerName = qs.get('playerName') || '';
  const LOG_PREFIX = '[INF FIN]';

  // Referencias DOM (ajusta los IDs si tus iframes usan otros)
  const ifrCRGeneral = document.getElementById('iframe-cr-general');
  const ifrCRProducto = document.getElementById('iframe-cr-producto');
  const ifrVentas = document.getElementById('iframe-ventas');
  const btnVolver = document.getElementById('volver-btn');

  // Caches de datos
  let lastRoundsHistory = [];
  let lastResultadosCompletos = [];

  // ---------- Helper: construir src con query params ----------
  const withQuery = (path) => {
    const u = new URL(path, location.href);
    if (partidaId) u.searchParams.set('partidaId', partidaId);
    if (playerName) u.searchParams.set('playerName', playerName);
    // cache-buster para despliegues en Koyeb/CDN
    u.searchParams.set('v', Date.now());
    return u.pathname + '?' + u.searchParams.toString();
  };

  // Establece o refuerza el src de un iframe para que lleve los query params
  function ensureIframeSrc(ifr, fallbackPath) {
    if (!ifr) return;
    try {
      const current = ifr.getAttribute('src');
      if (current) {
        // Si ya tenía src, le añadimos los params (o los refrescamos)
        const u = new URL(current, location.href);
        if (partidaId) u.searchParams.set('partidaId', partidaId);
        if (playerName) u.searchParams.set('playerName', playerName);
        u.searchParams.set('v', Date.now());
        ifr.src = u.pathname + '?' + u.searchParams.toString();
      } else if (fallbackPath) {
        ifr.src = withQuery(fallbackPath);
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'ensureIframeSrc falló, usando fallback', e);
      if (fallbackPath) ifr.src = withQuery(fallbackPath);
    }
  }

  // ---------- postMessage a subpantallas ----------
  function broadcast(type, payload) {
    const message = { type, payload, playerName, partidaId };
    [ifrCRGeneral, ifrCRProducto, ifrVentas].forEach((ifr) => {
      if (ifr && ifr.contentWindow) {
        try {
          ifr.contentWindow.postMessage(message, '*');
        } catch (e) {
          console.warn(LOG_PREFIX, 'postMessage error', e);
        }
      }
    });
  }

  // ---------- Socket.io ----------
  let socket;
  if (!('io' in window)) {
    console.error(LOG_PREFIX, 'socket.io no encontrado. Asegúrate de incluir <script src="/socket.io/socket.io.js"></script>');
  } else {
    socket = io();

    socket.on('connect', () => {
      console.log(LOG_PREFIX, 'conectado', { partidaId, playerName, sid: socket.id });
      // Enviamos ambos campos por compatibilidad con distintos handlers
      socket.emit('joinGame', { partidaId, playerName, nombre: playerName });
      socket.emit('identificarJugador', { partidaId, playerName });
      // Pedimos datos iniciales
      socket.emit('solicitarResultados', { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    });

    socket.on('disconnect', (reason) => {
      console.warn(LOG_PREFIX, 'disconnect:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error(LOG_PREFIX, 'connect_error:', err?.message || err);
    });

    // ----- Handlers de sincronización (nombres alternativos por compatibilidad) -----
    function handleSync(data = {}) {
      try {
        const rh = Array.isArray(data.roundsHistory) ? data.roundsHistory : [];
        lastRoundsHistory = rh;
        console.log(LOG_PREFIX, `SYNC roundsHistory (${rh.length})`);
        broadcast('SYNC', { roundsHistory: rh });
        // Si aún no tenemos resultados completos, volvemos a pedirlos
        if (!Array.isArray(lastResultadosCompletos) || lastResultadosCompletos.length === 0) {
          socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
        }
      } catch (e) {
        console.error(LOG_PREFIX, 'handleSync error:', e);
      }
    }

    function handleResultadosCompletos(payload) {
      try {
        let arr = [];
        if (Array.isArray(payload)) arr = payload;
        else if (Array.isArray(payload?.resultados)) arr = payload.resultados;
        lastResultadosCompletos = arr || [];
        console.log(LOG_PREFIX, `resultadosCompletos (${lastResultadosCompletos.length})`);
        broadcast('RESULTADOS_COMPLETOS', { resultados: lastResultadosCompletos });
      } catch (e) {
        console.error(LOG_PREFIX, 'handleResultadosCompletos error:', e);
      }
    }

    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador', handleSync);
    socket.on('resultadosCompletos', handleResultadosCompletos);
    socket.on('resultadosCompletosIF', handleResultadosCompletos);
  }

  // ---------- Comunicación desde iframes al padre ----------
  window.addEventListener('message', (ev) => {
    const data = ev?.data || {};
    const { type } = data;
    if (type === 'NEED_SYNC') {
      if (lastRoundsHistory.length) broadcast('SYNC', { roundsHistory: lastRoundsHistory });
      if (lastResultadosCompletos.length) broadcast('RESULTADOS_COMPLETOS', { resultados: lastResultadosCompletos });
      // Por si el backend tiene datos más recientes
      if (socket) {
        socket.emit('solicitarResultados', { partidaId, playerName });
        socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
      }
    }
  });

  // ---------- Navegación interna (pestañas/botones con data-target) ----------
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-target]');
    if (!target) return;
    const targetId = target.getAttribute('data-target');
    if (!targetId) return;

    // Acciones al cambiar de subpantalla: refrescar datos y, si procede, pedir completos
    if (socket) {
      if (targetId === 'cuenta-productos' || targetId === 'ventas' || targetId.includes('producto')) {
        socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
      }
      socket.emit('solicitarResultados', { partidaId, playerName });
    }

    // Reenvío inmediato desde caché para que la subpantalla no quede en blanco
    if (lastRoundsHistory.length) broadcast('SYNC', { roundsHistory: lastRoundsHistory });
    if (lastResultadosCompletos.length) broadcast('RESULTADOS_COMPLETOS', { resultados: lastResultadosCompletos });
  });

  // ---------- Botón Volver (si existe) ----------
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      try {
        const url = new URL('../game.html', location.href);
        if (partidaId) url.searchParams.set('partidaId', partidaId);
        if (playerName) url.searchParams.set('playerName', playerName);
        location.href = url.pathname + '?' + url.searchParams.toString();
      } catch (e) {
        console.error(LOG_PREFIX, 'navegación volver falló', e);
      }
    });

  }

  // ---------- Inicialización de iframes ----------
  // OJO: ajusta los nombres si tus archivos reales difieren en mayúsculas/minúsculas
  ensureIframeSrc(ifrCRGeneral, 'cr_general.html');
  ensureIframeSrc(ifrCRProducto, 'cr_producto.html');
  ensureIframeSrc(ifrVentas, 'ventas.html');

  // ---------- Logs de arranque ----------
  console.log(LOG_PREFIX, 'inicializado', { partidaId, playerName });
})();
