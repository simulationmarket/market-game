// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');              // ⬅️ añadido
const os = require('os');

const { router: playerRoutes, players } = require('./routes/players');
const handlePlayerSockets = require('./sockets/playersSocket');
const { handleMarketSockets } = require('./sockets/market');
require('./utils/resultadosJugadores'); // inicializa estructuras actuales

const app = express();
const server = http.createServer(app);

// CORS abierto para pruebas/LAN
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;

// GameService + dependencias (tolerante si faltan módulos)
const { createGameService } = require('./services/gameService');
let iniciarCalculos, eventEmitter, tomarDecisionesBot, resultados, roundsHistory, marketData;
try { ({ iniciarCalculos, eventEmitter } = require('./utils/calculos')); } catch (_) { iniciarCalculos = undefined; eventEmitter = { emit: () => {} }; }
try { ({ tomarDecisionesBot } = require('./utils/bots')); } catch (_) { tomarDecisionesBot = undefined; }
try {
  const rj = require('./utils/resultadosJugadores');
  resultados = (rj && rj.resultados) || {};
  roundsHistory = (rj && rj.roundsHistory) || {};
} catch (_) { resultados = {}; roundsHistory = {}; }
try {
  const market = require('./sockets/market');
  marketData = (market && market.marketData) || {};
} catch (_) { marketData = {}; }

const gameService = createGameService({
  players, roundsHistory, resultados, marketData,
  iniciarCalculos, eventEmitter, tomarDecisionesBot
});
io.gameService = gameService;

console.log('GameService TEST -> crearPartida:', io.gameService.crearPartida());
console.log('GameService TEST -> estado:', io.gameService.getEstado());

// ====== 🔽 SERVIR FRONTEND (ROBUSTO) 🔽 ======
const FRONTEND_CANDIDATES = [
  path.resolve(__dirname, './Frontend'),   // si en el build copias Frontend dentro de Backend
  path.resolve(__dirname, '../Frontend'),  // si Frontend es carpeta hermana
  path.resolve(process.cwd(), 'Frontend'), // por si el CWD es la raíz del repo
];

// Elegimos una carpeta válida
let FRONTEND_DIR =
  FRONTEND_CANDIDATES.find(p => fs.existsSync(path.join(p, 'index.html'))) ||
  FRONTEND_CANDIDATES.find(p => fs.existsSync(path.join(p, 'game', 'game.html'))) ||
  FRONTEND_CANDIDATES[0];

const hasIndex = fs.existsSync(path.join(FRONTEND_DIR, 'index.html'));
const hasGame = fs.existsSync(path.join(FRONTEND_DIR, 'game', 'game.html'));

console.log('[Frontend] Sirviendo desde:', FRONTEND_DIR, '| index:', hasIndex, '| game:', hasGame);

app.use(express.static(FRONTEND_DIR));

// Raíz -> si hay index.html lo servimos; si no, caemos a game.html si existe
app.get('/', (_req, res) => {
  if (hasIndex) return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  if (hasGame)  return res.sendFile(path.join(FRONTEND_DIR, 'game', 'game.html'));
  return res.status(404).send('Frontend no encontrado');
});

// Juego
app.get('/game', (_req, res) => {
  if (hasGame)  return res.sendFile(path.join(FRONTEND_DIR, 'game', 'game.html'));
  if (hasIndex) return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  return res.status(404).send('game.html no encontrado');
});

// Benchmark (si existe)
app.get('/benchmark', (_req, res) => {
  const bench = path.join(FRONTEND_DIR, 'game', 'estudios', 'benchmark.html');
  if (fs.existsSync(bench)) return res.sendFile(bench);
  return res.status(404).send('benchmark.html no encontrado');
});

// Fallback → no uses rutas absolutas tipo '/Frontend/index.html'
app.get('*', (_req, res) => {
  if (hasIndex) return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  if (hasGame)  return res.sendFile(path.join(FRONTEND_DIR, 'game', 'game.html'));
  return res.status(404).send('Frontend no encontrado');
});
// ====== 🔼 SERVIR FRONTEND (ROBUSTO) 🔼 ======

// API
app.use('/api', playerRoutes);

// Sockets
handlePlayerSockets(io, players, MAX_PLAYERS);
handleMarketSockets(io);

// Utilidad para mostrar IP local
function getLocalIPv4() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const net of ifs[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// Escucha en todas las interfaces
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIPv4();
  console.log(`Servidor listo en:
  -> http://${ip}:${PORT}
  -> (LAN) usa esa URL en otros equipos del mismo Wi-Fi)`);
});
