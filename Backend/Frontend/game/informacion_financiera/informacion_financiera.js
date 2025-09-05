document.addEventListener('DOMContentLoaded', function () {
  const socket = io('/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 20000
  });

  // ===== Utils =====
  const _norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

  // Inferimos el nombre "canónico" que usa el backend en resultados (por si en resultados sale "PERLITA S.A." y tú eres "PERLITA")
  function inferPlayerKeyNorm(resultados, roundsHistory, defaultName) {
    try {
      const last = Array.isArray(roundsHistory) && roundsHistory.length
        ? roundsHistory[roundsHistory.length - 1]
        : null;
      const prods = (last?.decisiones?.products || []).map(p => p?.nombre).filter(Boolean);
      const set = new Set(prods.map(_norm));
      const counts = {};
      (Array.isArray(resultados) ? resultados : []).forEach(r => {
        const prod = _norm(r?.producto);
        if (!set.has(prod)) return;
        const name = _norm(r?.jugador ?? r?.empresa ?? r?.nombreJugador ?? r?.jugadorNombre);
        if (!name) return;
        counts[name] = (counts[name] || 0) + 1;
      });
      const best = Object.entries(counts).sort((a,b)=> b[1]-a[1])[0]?.[0];
      return best || _norm(defaultName);
    } catch {
      return _norm(defaultName);
    }
  }

  // ===== Parámetros =====
  const params     = new URLSearchParams(location.search);
  const partidaId  = params.get('partidaId')   || localStorage.getItem('partidaId')  || 'default';
  const playerName = params.get('playerName')  || localStorage.getItem('playerName') || '';

  // ===== Sala y asociación =====
  socket.emit('joinGame', { partidaId, nombre: playerName || null });

  if (!playerName) {
    alert('No se ha encontrado el nombre del jugador. Redirigiendo al inicio.');
    const url = new URL('../../index.html', location.href);
    url.searchParams.set('partidaId', partidaId);
    window.location.href = url.pathname + '?' + url.searchParams.toString();
    return;
  }

  socket.emit('identificarJugador', playerName);

  // ===== Navegación / iframes =====
  const navButtons       = document.querySelectorAll('.nav-button');
  const contentSections  = document.querySelectorAll('.content-section');
  const btnVolver        = document.getElementById('volver-btn');

  const ifrCRGeneral     = document.getElementById('iframe-cr-general');
  const ifrCRProducto    = document.getElementById('iframe-cr-producto');
  const ifrVentas        = document.getElementById('iframe-ventas');

  const withQuery = (path) => {
    const u = new URL(path, location.href);
    u.searchParams.set('partidaId', partidaId);
    if (playerName) u.searchParams.set('playerName', playerName);
    return u.pathname + '?' + u.searchParams.toString();
  };

  if (ifrCRGeneral)  ifrCRGeneral.src  = withQuery('cuenta_resultados/cuenta_resultados.html');
  if (ifrCRProducto) ifrCRProducto.src = withQuery('cr_producto/cr_producto.html');
  if (ifrVentas)     ifrVentas.src     = withQuery('ventas/ventas.html');

  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      const url = new URL('../game.html', location.href);
      url.searchParams.set('partidaId', partidaId);
      if (playerName) url.searchParams.set('playerName', playerName);
      location.href = url.pathname + '?' + url.searchParams.toString();
    });
  }

  const sincronizarIframe = (iframeEl, message) => {
    if (iframeEl && iframeEl.contentWindow) {
      iframeEl.contentWindow.postMessage(message, '*');
    }
  };

  // ===== Estado local para reenviar =====
  let lastRoundsHistory = [];
  let lastResultadosCompletos = [];

  // Pide datos al cargar (por si entras directo a CR-Producto/Ventas)
  socket.emit('solicitarResultados',          { partidaId, playerName });
  socket.emit('solicitarResultadosCompletos', { partidaId, playerName });

  // SYNC: reenviar a todos
  socket.on('syncPlayerData', (data) => {
    lastRoundsHistory = data.roundsHistory || [];
    const payloadSync = { type: 'SYNC', playerName, roundsHistory: lastRoundsHistory };
    sincronizarIframe(ifrCRProducto, payloadSync);
    sincronizarIframe(ifrVentas,     payloadSync);
    sincronizarIframe(ifrCRGeneral,  payloadSync);

    if (!Array.isArray(lastResultadosCompletos) || lastResultadosCompletos.length === 0) {
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    }
  });

  // Resultados completos (acepta [] o { resultados: [] })
  socket.on('resultadosCompletos', (payload) => {
    const arr = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.resultados) ? payload.resultados : []);

    lastResultadosCompletos = arr;
    const playerKeyNorm = inferPlayerKeyNorm(lastResultadosCompletos, lastRoundsHistory, playerName);

    const msg = {
      type: 'RESULTADOS_COMPLETOS',
      playerName,
      playerKeyNorm, // 👈 clave normalizada
      roundsHistory: lastRoundsHistory || [],
      resultados: lastResultadosCompletos
    };

    sincronizarIframe(ifrCRProducto, msg);
    sincronizarIframe(ifrVentas,     msg);
    sincronizarIframe(ifrCRGeneral,  msg);

    console.log('[INF.FIN.] reenviados resultados:', lastResultadosCompletos.length, 'playerKeyNorm:', playerKeyNorm);
  });

  // Tabs: al entrar en CR-Producto o Ventas, reforzar petición por si acaso
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      navButtons.forEach((b) => b.classList.remove('active'));
      button.classList.add('active');

      contentSections.forEach((sec) => sec.classList.remove('active'));
      const targetId = button.getAttribute('data-target');
      document.getElementById(targetId)?.classList.add('active');

      if (targetId === 'cuenta-productos' || targetId === 'ventas') {
        socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
      }
    });
  });
});
