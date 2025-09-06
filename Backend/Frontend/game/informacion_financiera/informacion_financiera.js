'use strict';

// ================================================
// Información financiera - cliente principal (hub)
// - Inyecta query params en iframes (partidaId/playerName)
// - Socket.io forzado a WebSocket (evita 502 por polling)
// - Recibe roundsHistory y resultadosCompletos del backend
// - Reenvía a subpantallas vía postMessage (incluye playerKeyNorm)
// ================================================

(function () {
  // ---------- Utilidades base ----------
  const qs = new URLSearchParams(location.search);
  const partidaId = qs.get('partidaId') || '';
  const playerName = qs.get('playerName') || '';
  const LOG_PREFIX = '[INF FIN]';

  const normalizeKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const playerKeyNorm = normalizeKey(playerName);

  // Referencias DOM (ajusta IDs si tus iframes usan otros)
  const ifrCRGeneral  = document.getElementById('iframe-cr-general');
  const ifrCRProducto = document.getElementById('iframe-cr-producto');
  const ifrVentas     = document.getElementById('iframe-ventas');
  const btnVolver     = document.getElementById('volver-btn');

  // Caches de datos
  let lastRoundsHistory = [];
  let lastResultadosCompletos = [];

  // ---------- Helper: construir src con query params ----------
  const withQuery = (path) => {
    const u = new URL(path, location.href);
    if (partidaId)  u.searchParams.set('partidaId', partidaId);
    if (playerName) u.searchParams.set('playerName', playerName);
    // cache-buster para despliegues en Koyeb/CDN
    u.searchParams.set('v', Date.now());
    return u.pathname + '?' + u.searchParams.toString();
  };

  // Asegura que un iframe tiene los params correctos
  function ensureIframeSrc(ifr, fallbackPath) {
    if (!ifr) return;
    try {
      const current = ifr.getAttribute('src');
      if (current) {
        const u = new URL(current, location.href);
        if (partidaId)  u.searchParams.set('partidaId', partidaId);
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
    const message = {
      type,
      payload,
      playerName,
      playerKeyNorm,
      partidaId
    };
    [ifrCRGeneral, ifrCRProducto, ifrVentas].forEach((ifr) => {
      if (ifr && ifr.contentWindow) {
        try { ifr.contentWindow.postMessage(message, '*'); }
        catch (e) { console.warn(LOG_PREFIX, 'postMessage error', e); }
      }
    });
  }

  // ---------- Socket.io (forzado WebSocket) ----------
  let socket;
  if (!('io' in window)) {
    console.error(LOG_PREFIX, 'socket.io no encontrado. Incluye <script src="/socket.io/socket.io.js"></script>');
  } else {
    // Si el backend de sockets está en otro dominio, define window.SOCKET_URL_OVERRIDE = 'https://tu-backend.koyeb.app'
    const SOCKET_URL = window.SOCKET_URL_OVERRIDE || location.origin;

    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'], // evita *polling* (502 en proxies)
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true
    });

    socket.on('connect', () => {
      console.log(LOG_PREFIX, 'conectado', { partidaId, playerName, sid: socket.id });
      // Compatibilidad con distintos handlers
      socket.emit('joinGame', { partidaId, playerName, nombre: playerName });
      socket.emit('identificarJugador', { partidaId, playerName });

      // Pedimos datos iniciales
      socket.emit('solicitarResultados',          { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    });

    socket.on('disconnect', (reason) => {
      console.warn(LOG_PREFIX, 'disconnect:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error(LOG_PREFIX, 'connect_error:', err?.message || err);
    });

    // ----- Handlers de sincronización -----
    function handleSync(data = {}) {
      try {
        const rh = Array.isArray(data.roundsHistory) ? data.roundsHistory : [];
        lastRoundsHistory = rh;
        console.log(LOG_PREFIX, `SYNC roundsHistory (${rh.length})`);
        // Enviamos roundsHistory también en RESULTADOS para que las subpantallas pinten con un solo mensaje
        broadcast('SYNC', { roundsHistory: rh, playerKeyNorm });
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
        // Incluimos roundsHistory y playerKeyNorm para que las subpantallas no dependan del orden de llegada
        broadcast('RESULTADOS_COMPLETOS', {
          resultados: lastResultadosCompletos,
          roundsHistory: lastRoundsHistory,
          playerKeyNorm
        });
      } catch (e) {
        console.error(LOG_PREFIX, 'handleResultadosCompletos error:', e);
      }
    }

    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador',    handleSync);
    socket.on('resultadosCompletos',   handleResultadosCompletos);
    socket.on('resultadosCompletosIF', handleResultadosCompletos);
  }

  // ---------- Comunicación desde iframes al padre ----------
  window.addEventListener('message', (ev) => {
    const data = ev?.data || {};
    const { type } = data;
    if (type === 'NEED_SYNC') {
      if (lastRoundsHistory.length) {
        broadcast('SYNC', { roundsHistory: lastRoundsHistory, playerKeyNorm });
      }
      if (lastResultadosCompletos.length) {
        broadcast('RESULTADOS_COMPLETOS', {
          resultados: lastResultadosCompletos,
          roundsHistory: lastRoundsHistory,
          playerKeyNorm
        });
      }
      if (socket) {
        socket.emit('solicitarResultados',          { partidaId, playerName });
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

    if (socket) {
      if (targetId === 'cuenta-productos' || targetId === 'ventas' || targetId.includes('producto')) {
        socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
      }
      socket.emit('solicitarResultados', { partidaId, playerName });
    }

    // Reenvío inmediato desde caché
    if (lastRoundsHistory.length) {
      broadcast('SYNC', { roundsHistory: lastRoundsHistory, playerKeyNorm });
    }
    if (lastResultadosCompletos.length) {
      broadcast('RESULTADOS_COMPLETOS', {
        resultados: lastResultadosCompletos,
        roundsHistory: lastRoundsHistory,
        playerKeyNorm
      });
    }
  });

  // ---------- Botón Volver (si existe) ----------
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      try {
        const url = new URL('../game.html', location.href);
        if (partidaId)  url.searchParams.set('partidaId', partidaId);
        if (playerName) url.searchParams.set('playerName', playerName);
        location.href = url.pathname + '?' + url.searchParams.toString();
      } catch (e) {
        console.error(LOG_PREFIX, 'navegación volver falló', e);
      }
    });
  }

  // ---------- Inicialización de iframes ----------
  // ¡Asegura nombres/paths exactos (case-sensitive en Koyeb/Linux)!
  ensureIframeSrc(ifrCRGeneral,  'cr_general.html');
  ensureIframeSrc(ifrCRProducto, 'cr_producto.html');
  ensureIframeSrc(ifrVentas,     'ventas.html');

  console.log(LOG_PREFIX, 'inicializado', { partidaId, playerName });
})();
