document.addEventListener('DOMContentLoaded', () => {
  const socket = io({ transports: ['websocket'], withCredentials: true, reconnection: true, reconnectionAttempts: 5, timeout: 20000 });;

  // Lee partida y nombre desde la URL o, si no, desde localStorage
  const params = new URLSearchParams(location.search);
  const partidaId  = params.get('partidaId')  || localStorage.getItem('partidaId')  || 'default';
  const playerName = params.get('playerName') || localStorage.getItem('playerName') || '';

  if (!playerName) {
    alert('No se ha encontrado el nombre del jugador. Volviendo al inicio.');
    location.href = 'index.html';
    return;
  }

  // Persistimos para que las páginas hijas (iframes) lo lean en fallback
  localStorage.setItem('partidaId', partidaId);
  localStorage.setItem('playerName', playerName);

  // Identificarse y unirse a la sala de la partida
  socket.emit('identificarJugador', playerName);
  socket.emit('joinGame', { partidaId, nombre: playerName });

  socket.on('connect', () => {
    socket.emit('identificarJugador', playerName);
    socket.emit('joinGame', { partidaId, nombre: playerName });
  });

  const iframe       = document.getElementById('iframe-content');
  const btnSegmentos = document.getElementById('segmentos-btn');
  const btnConsumo   = document.getElementById('consumo-btn');
  const btnBenchmark = document.getElementById('benchmark-btn');
  const btnVolver    = document.getElementById('volver-btn');

  // Helper para construir URL con query
  const withQuery = (path) => {
    const u = new URL(path, location.href);
    u.searchParams.set('partidaId', partidaId);
    u.searchParams.set('playerName', playerName);
    return u.pathname + '?' + u.searchParams.toString();
  };

  // Carga inicial
  iframe.src = withQuery('segmentos.html');

  // Navegación
  if (btnSegmentos) btnSegmentos.addEventListener('click', () => { iframe.src = withQuery('segmentos.html'); });
  if (btnConsumo)   btnConsumo.addEventListener('click',   () => { iframe.src = withQuery('consumo.html'); });
  if (btnBenchmark) btnBenchmark.addEventListener('click', () => { iframe.src = withQuery('benchmark.html'); });

  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      const u = new URL('../game.html', location.href);
      u.searchParams.set('partidaId', partidaId);
      u.searchParams.set('playerName', playerName);
      location.href = u.pathname + '?' + u.searchParams.toString();
    });
  }
});
