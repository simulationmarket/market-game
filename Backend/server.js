// server.js (Koyeb-ready, multipartida)
// -------------------------------------------------
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Seguridad y rendimiento (recomendado)
let compression, helmet, cors;
try {
  compression = require('compression');
  helmet = require('helmet');
  cors = require('cors');
} catch (_) {
  compression = () => (req, res, next) => next();
  helmet = () => (req, res, next) => next();
  cors = () => (req, res, next) => next();
}

// ====== Imports de tu app (ajusta rutas si difieren) ======
const handlePlayerSockets = require('./sockets/playersSocket');
const { handleMarketSockets } = require('./sockets/market');
const { createGameService } = require('./services/gameService');
const { router: playerRoutes } = require('./routes/players');

let iniciarCalculos, eventEmitter, tomarDecisionesBot;
try {
  ({ iniciarCalculos, eventEmitter } = require('./utils/calculos'));
} catch {
  iniciarCalculos = undefined;
  eventEmitter = { emit: () => {}, on: () => {}, once: () => {} };
}
try {
  ({ tomarDecisionesBot } = require('./utils/bots'));
} catch {
  tomarDecisionesBot = undefined;
}
try {
  require('./utils/resultadosJugadores'); // si inicializa estructuras
} catch {}

// ====== App / Server ======
const app = express();
app.set('trust proxy', 1); // Koyeb/Proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 4);

// ====== CORS ======
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean); // e.g. https://tu-dominio.com,https://tuapp.koyeb.app

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin/curl
    if (!allowedOrigins.length || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!allowedOrigins.length || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Heartbeat razonable para móviles/redes inestables
  pingInterval: 25000,
  pingTimeout: 20000,
  // path: '/socket.io' // (por defecto)
});

// ====== (Opcional) Adapter Redis si un día escalas a 2+ instancias ======
(async () => {
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pub = createClient({ url: process.env.REDIS_URL });
      const sub = pub.duplicate();
      await Promise.all([pub.connect(), sub.connect()]);
      io.adapter(createAdapter(pub, sub));
      console.log('[Socket.IO] Redis adapter activo');
    } catch (e) {
      console.warn('[Socket.IO] No se pudo activar Redis adapter:', e.message);
    }
  }
})();

// ====== Registro de partidas (multipartida) ======
const partidas = new Map(); // Map<partidaId, EstadoPartida>

function crearEstadoPartida(partidaId) {
  return {
    id: partidaId,
    players: {},               // { [nombre]: PlayerState }
    resultados: {},            // resultados por jugador
    roundsHistory: {},         // histórico por jugador/ronda
    marketData: {},            // datos de mercado compartidos
    socketsToPlayers: {},      // { [socketId]: nombreJugador }
    resultadosCache: null,
    estadosCache: null,
    resultadosCompletosCache: null,
    inscripcionCerrada: false,
    inscripcionTemporizador: null,
    gamePhase: 'lobby',
    timers: {},                // timers por partida (claves libres)
    bots: {},                  // info/estado de bots por partida
    MAX_PLAYERS,
    service: null,             // instancia de servicios para esta partida
  };
}

function getOrCreatePartida(partidaId = 'default') {
  if (!partidas.has(partidaId)) {
    partidas.set(partidaId, crearEstadoPartida(partidaId));
  }
  const p = partidas.get(partidaId);
  if (!p.service) {
    p.service = createGameService({
      players: p.players,
      roundsHistory: p.roundsHistory,
      resultados: p.resultados,
      marketData: p.marketData,
      iniciarCalculos,
      eventEmitter,
      tomarDecisionesBot,
    });
    if (p.service?.ensurePartida) {
      p.service.ensurePartida(partidaId);
    }
  }
  return p;
}

// Expón helpers al resto de módulos de sockets
io.partidas = partidas;
io.getOrCreatePartida = getOrCreatePartida;

// ====== Health checks para Koyeb ======
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
app.get('/readyz', (_req, res) => res.status(200).json({ status: 'ready' }));

// ====== API ======
app.use('/api', playerRoutes);

// ====== Servir Frontend (auto-detección) ======
const FRONTEND_CANDIDATES = [
  process.env.FRONTEND_DIR && path.resolve(process.env.FRONTEND_DIR),
  path.resolve(__dirname, './Frontend'),
  path.resolve(__dirname, '../Frontend'),
  path.resolve(process.cwd(), 'Frontend'),
  path.resolve(process.cwd(), 'frontend'),
  path.resolve(process.cwd(), 'public'),
].filter(Boolean);

let FRONTEND_DIR =
  FRONTEND_CANDIDATES.find(p => fs.existsSync(path.join(p, 'index.html'))) ||
  FRONTEND_CANDIDATES.find(p => fs.existsSync(path.join(p, 'game', 'game.html'))) ||
  FRONTEND_CANDIDATES[0];

const hasIndex = FRONTEND_DIR && fs.existsSync(path.join(FRONTEND_DIR, 'index.html'));
const hasGame  = FRONTEND_DIR && fs.existsSync(path.join(FRONTEND_DIR, 'game', 'game.html'));

console.log('[Frontend] Sirviendo desde:', FRONTEND_DIR, '| index:', hasIndex, '| game:', hasGame);

if (FRONTEND_DIR) {
  app.use(express.static(FRONTEND_DIR));

  app.get('/', (_req, res) => {
    if (hasIndex) return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    if (hasGame)  return res.sendFile(path.join(FRONTEND_DIR, 'game', 'game.html'));
    return res.status(404).send('Frontend no encontrado');
  });

  app.get('/game', (_req, res) => {
    if (hasGame)  return res.sendFile(path.join(FRONTEND_DIR, 'game', 'game.html'));
    if (hasIndex) return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    return res.status(404).send('game.html no encontrado');
  });

  app.get('/benchmark', (_req, res) => {
    const bench = path.join(FRONTEND_DIR, 'game', 'estudios', 'benchmark.html');
    if (fs.existsSync(bench)) return res.sendFile(bench);
    return res.status(404).send('benchmark.html no encontrado');
  });

  // Fallback SPA
  app.get('*', (_req, res) => {
    if (hasIndex) return res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
    if (hasGame)  return res.sendFile(path.join(FRONTEND_DIR, 'game', 'game.html'));
    return res.status(404).send('Frontend no encontrado');
  });
}

// ====== Sockets (multipartida) ======
const registry = { getOrCreatePartida, partidas, MAX_PLAYERS };
handlePlayerSockets(io, registry);
handleMarketSockets(io, registry);

// ====== Utilidades ======
function getLocalIPv4() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const net of ifs[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// ====== Start ======
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIPv4();
  console.log(`Servidor listo en:
  -> http://${ip}:${PORT}
  CORS_ORIGINS: ${allowedOrigins.length ? allowedOrigins.join(', ') : '[*]'}`);
});

// ====== Graceful shutdown ======
// ====== Graceful shutdown ======
async function shutdown() {
  console.log('Cerrando servidor con gracia...');
  try {
    // Limpieza de timers por partida
    for (const p of partidas.values()) {
      if (p.inscripcionTemporizador) clearInterval(p.inscripcionTemporizador);
      for (const t of Object.values(p.timers || {})) clearTimeout(t);
    }

    // Cerrar la conexión de Prisma (si existe)
    await prisma?.$disconnect();
  } catch (e) {
    console.error('Error limpiando timers/Prisma:', e);
  }

  server.close(() => {
    io.close(() => process.exit(0));
  });

  setTimeout(() => process.exit(0), 10_000).unref(); // kill duro si se atasca
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
