// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const os = require('os');

const { router: playerRoutes, players } = require('./routes/players');
const handlePlayerSockets = require('./sockets/playersSocket');
const { handleMarketSockets } = require('./sockets/market');
require('./utils/resultadosJugadores'); // inicializa estructuras actuales

const app = express();
const server = http.createServer(app);

// ✅ Si frontend y backend van en el mismo puerto/IP no haría falta CORS,
//    pero lo dejo abierto para pruebas en LAN:
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;

// 🔹 NUEVO: importar GameService y deps (sin romper nada si no existen)
const { createGameService } = require('./services/gameService'); // ← crea este archivo
let iniciarCalculos, eventEmitter, tomarDecisionesBot, resultados, roundsHistory, marketData;
try {
  ({ iniciarCalculos, eventEmitter } = require('./utils/calculos'));
} catch (_) { iniciarCalculos = undefined; eventEmitter = { emit: () => {} }; }
try {
  ({ tomarDecisionesBot } = require('./utils/bots'));
} catch (_) { tomarDecisionesBot = undefined; }
try {
  const rj = require('./utils/resultadosJugadores');
  resultados = (rj && rj.resultados) || {};
  roundsHistory = (rj && rj.roundsHistory) || {};
} catch (_) { resultados = {}; roundsHistory = {}; }
try {
  const market = require('./sockets/market');
  marketData = (market && market.marketData) || {};
} catch (_) { marketData = {}; }

// 🔹 NUEVO: instanciar GameService pasando tus objetos actuales
const gameService = createGameService({
  players, roundsHistory, resultados, marketData,
  iniciarCalculos, eventEmitter, tomarDecisionesBot
});

// 🔹 NUEVO: colgarlo del io para usarlo desde cualquier handler de sockets
io.gameService = gameService;

console.log('GameService TEST -> crearPartida:', io.gameService.crearPartida());
console.log('GameService TEST -> estado:', io.gameService.getEstado());

// Sirve estáticos (index.html dentro de ./frontend)
// AHORA (apunta a la carpeta hermana ../frontend)

app.use(express.static(path.resolve(__dirname, '../frontend')));

// (opcional recomendado) servir index por defecto en "/"
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});

// API
app.use('/api', playerRoutes);

// Sockets (se mantienen igual que en tu versión)
handlePlayerSockets(io, players, MAX_PLAYERS);
handleMarketSockets(io);

// Utilidad para mostrar tu IP local en consola
function getLocalIPv4() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const net of ifs[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// ✅ Escucha en todas las interfaces
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIPv4();
  console.log(`Servidor listo en:
  -> http://${ip}:${PORT}
  -> (LAN) usa esa URL en otros equipos del mismo Wi-Fi)`);
});
