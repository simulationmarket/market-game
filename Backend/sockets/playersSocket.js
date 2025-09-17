// sockets/playersSocket.js
// Manejador de sockets multi-partida (una sala por partidaId)

let totalPlayersConnected = 0;
const { createGameService } = require('../services/gameService');
const { actualizarMercado } = require('./market.js');
const { iniciarCalculos, eventEmitter } = require('../utils/calculos');
const { tomarDecisionesBot } = require('../utils/bots');
const { generarResultados } = require('../utils/resultadosJugadores');
const TIEMPO_ESPERA_INSCRIPCION = 5000; // ms
const MAX_ROUNDS = 10;

/* ===================== Helpers de estado por partida ===================== */

function getPartidaState(registry, partidaId) {
  const partida = registry.getOrCreatePartida(partidaId);
  partida.players ||= {};
  partida.marketData ||= {};
  partida.socketsToPlayers ||= {};
  partida.resultadosCache ||= null;              // (puedes mantenerlo para compat vieja)
  partida.resultadosRawCache ||= null;           // ★ NUEVO: crudos (resultadosFinales)
  partida.estadosCache ||= null;
  partida.resultadosCompletosCache ||= null;     // procesados (para CR Producto)
  partida.inscripcionCerrada ||= false;
  partida.inscripcionTemporizador ||= null;
  partida.gamePhase ||= 'lobby';
  return partida;
}

function obtenerMarketData(registry, partidaId) {
  const partida = getPartidaState(registry, partidaId);
  return partida.marketData;
}

// ★ Helper: nombre del jugador asociado a este socket en esta partida
function getPlayerNameFromSocket(partida, socketId) {
  return partida.socketsToPlayers[socketId] || null;
}

// ★ Guard: asegura que el socket actúa sobre su propio jugador
function ensureAuthOrThrow(socket, partida, claimedName, action = 'acción') {
  const owner = getPlayerNameFromSocket(partida, socket.id);
  if (!owner || owner !== claimedName) {
    const msg = `Bloqueado: ${action} no autorizada para ${claimedName}. Socket pertenece a ${owner || 'nadie'}.`;
    console.warn('[SEC]', msg);
    throw new Error(msg);
  }
}

/* ===================== Generación de productos iniciales ===================== */

function calcularCosteUnitario(caracteristicas) {
  const tablaCosteUnitario = {
    pantalla: [10, 11, 12.5, 13.5, 15, 15, 15, 15, 15, 15, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42],
    procesador: [7.5, 7.5, 7.5, 7.5, 7.5, 10, 10, 10, 10, 13.5, 13.5, 13.5, 13.5, 13.5, 16, 19, 22, 25, 28, 31],
    bateria: [11, 11, 11, 11, 11, 13, 13, 13, 30, 30, 30, 30, 30, 30, 30, 30, 37.5, 45, 52.5, 60],
    placaBase: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    ergonomia: [5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    acabados: [5, 5, 5, 5, 5, 7.5, 7.5, 7.5, 7.5, 7.5, 10, 12.5, 15, 17.5, 20, 24, 28, 32, 36, 40],
    color: [5, 7, 8, 10, 11, 12.5, 14, 15.5, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]
  };

  let costeUnitario = 0;
  for (const [caracteristica, valor] of Object.entries(caracteristicas)) {
    costeUnitario += tablaCosteUnitario[caracteristica][Math.max(1, Math.min(20, valor)) - 1]; // ★ bound-safe
  }
  return costeUnitario;
}

function generarProducto(nombreJugador, numProducto) {
  const rangos = [
    { min: 1, max: 5 },
    { min: 6, max: 10 },
    { min: 7, max: 16 },
    { min: 10, max: 20 }
  ];
  const rangoElegido = rangos[Math.floor(Math.random() * rangos.length)];

  const caracteristicas = {
    pantalla: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min,
    procesador: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min,
    bateria: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min,
    placaBase: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min,
    ergonomia: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min,
    acabados: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min,
    color: Math.floor(Math.random() * (rangoElegido.max - rangoElegido.min + 1)) + rangoElegido.min
  };

  const costeUnitario = calcularCosteUnitario(caracteristicas);

  return {
    nombre: `${nombreJugador.substring(0, 3).toUpperCase()}${numProducto}`,
    descripcion: `Producto inicial ${numProducto}`,
    caracteristicas,
    costeUnitarioEst: costeUnitario,
    precio: 0,
    unidadesFabricar: 0,
    posicionamientoPrecio: 1,
    calidad: 1,
    publicidad: 0
  };
}

/* ===================== Inscripción automática + bots ===================== */

function cerrarInscripcionAutomatica(io, registry, partidaId) {
  const partida = getPartidaState(registry, partidaId);
  if (partida.inscripcionCerrada) return; // ⛔ prevenir ejecución doble
  partida.inscripcionCerrada = true;

  const nombresBots = ["ZENTEC", "NOVA", "FUTURA", "TEKNO", "CYBERIA", "DIGITECH", "ALPHACORE", "OMNISYS"];
  const nivelesDificultad = ['facil', 'normal', 'dificil'];
  const dificultadAleatoria = () => nivelesDificultad[Math.floor(Math.random() * nivelesDificultad.length)];

  console.log("Estado de players antes de cerrar inscripción:", partida.players);

  const jugadoresReales = Object.values(partida.players).filter(p => !p.esBot && p.ready);
  const maxCap = partida.MAX_PLAYERS ?? registry.MAX_PLAYERS;
  const botsNecesarios = Math.max(0, maxCap - jugadoresReales.length);

  console.log(`Inscripción cerrada automáticamente [${partidaId}]. Jugadores reales: ${jugadoresReales.length}, Bots necesarios: ${botsNecesarios}`);

  for (let i = 0; i < botsNecesarios; i++) {
    const nombreBot = nombresBots[i] || `BOT${i + 1}`;
    const dificultad = dificultadAleatoria();

    partida.players[nombreBot] = {
      nombreEmpresa: nombreBot,
      esBot: true,
      dificultad,
      gameState: {
        round: 0,
        budget: 200000000,
        reserves: 0,
        loans: [],
        products: [ generarProducto(nombreBot, 1), generarProducto(nombreBot, 2) ],
        projects: [],
        valorAccion: 1500,
        canalesDistribucion: { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 },
        interactuadoEnRonda: null
      },
      prepared: false,
      ready: true,
      roundsHistory: []
    };
    console.log(`Creado bot ${nombreBot} con dificultad "${dificultad}"`);
  }

  // Marcar todos como listos (para startGame)
  Object.values(partida.players).forEach(p => p.ready = true);
  partida.gamePhase = 'playing';
  io.to(`partida:${partidaId}`).emit('startGame');
}

/* ===================== Export principal ===================== */

module.exports = (io, registry) => {

  io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado:', socket.id);
    totalPlayersConnected++;

    /* ---- 1) El cliente se une a una partida (sala) ---- */
    socket.on('joinGame', ({ partidaId, nombre }) => {
      const pid = partidaId || 'default';
      socket.data.partidaId = pid;
      socket.join(`partida:${pid}`);
      console.log(`Socket ${socket.id} unido a sala partida:${pid}`);
      // 🔌 Inyecta el servicio de persistencia una vez por partida
const partidaObj = getPartidaState(registry, pid);
if (!partidaObj.service) {
  partidaObj.service = createGameService({
    players: partidaObj.players,
    marketData: partidaObj.marketData,
    resultados: {},          // opcional
    roundsHistory: {},       // opcional
    iniciarCalculos,         // ya lo tienes importado arriba
    eventEmitter,            // ya lo tienes importado arriba
    tomarDecisionesBot,      // ya lo tienes importado arriba
    partidaCodigo: pid,      // usamos el pid como “código” de la partida
  });
  console.log(`[persist] Servicio Prisma inicializado para partida ${pid}`);
}
      if (nombre) socket.emit('joinedGame', { partidaId: pid });
    });

    /* ---- 2) Resultados: generales, completos y estados ---- */
    socket.on('solicitarResultados', () => {
  const partidaId = socket.data.partidaId || 'default';
  const partida = getPartidaState(registry, partidaId);
  console.log(`Cliente solicitó resultados generales [${partidaId}]:`, socket.id);
  socket.emit('resultadosFinales', partida.resultadosRawCache || []);
});

    socket.on('solicitarEstadosJugadores', () => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);
      console.log(`Cliente solicitó estados de jugadores [${partidaId}]:`, socket.id);
      const estados = Object.entries(partida.players).map(([playerName, p]) => ({
        playerName,
        ...p.gameState,
      }));
      socket.emit('todosLosEstados', estados);
    });

    socket.on('solicitarResultadosCompletos', () => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);
      console.log(`Cliente solicitó resultados completos [${partidaId}]:`, socket.id);
      socket.emit('resultadosCompletos', partida.resultadosCompletosCache || []);
    });

    /* ---- 3) Salir al índice (solo limpia en su partida) ---- */
    socket.on('leaveRoom', () => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);
      const name = partida.socketsToPlayers[socket.id];
      if (!name) return;
      console.log(`🚪 ${name} sale al índice [${partidaId}]`);
      delete partida.socketsToPlayers[socket.id];
      delete partida.players[name];

      const humanos = Object.values(partida.players).filter(p => !p.esBot).length;
      if (partida.gamePhase === 'ended' && humanos === 0) {
        partida.players = {};
        partida.resultadosCache = null;
        partida.estadosCache = null;
        partida.resultadosCompletosCache = null;
        partida.inscripcionCerrada = false;
        partida.inscripcionTemporizador = null;
        partida.gamePhase = 'lobby';
        io.to(`partida:${partidaId}`).emit('lobbyReset');
      }

      socket.leave(`partida:${partidaId}`); // ★ salir también de la room
    });

    /* ---- 4) Identificar/registrar jugador ---- */
    socket.on('identificarJugador', (playerName) => {
      const partidaId = socket.data.partidaId || 'default';
      const room = `partida:${partidaId}`;
      const partida = getPartidaState(registry, partidaId);

      if (partida.gamePhase === 'ended') {
        console.log('♻️ Nuevo jugador tras partida terminada → reset lobby (solo esta partida)');
        partida.players = {};
        partida.resultadosCache = null;
        partida.estadosCache = null;
        partida.resultadosCompletosCache = null;
        partida.inscripcionCerrada = false;
        partida.inscripcionTemporizador = null;
        partida.gamePhase = 'lobby';
        io.to(room).emit('lobbyReset');
      }

      if (partida.socketsToPlayers[socket.id]) {
        console.log(`El jugador ya está identificado con este socket.`);
        return;
      }

      if (partida.players[playerName]) {
        if (!Object.values(partida.socketsToPlayers).includes(playerName)) {
          console.log(`Jugador ${playerName} se ha reconectado. Asignando nuevo socket.`);
          partida.socketsToPlayers[socket.id] = playerName;
          socket.data.playerName = playerName; // ★ persistimos dueño
          partida.players[playerName].prepared = false;
          socket.emit('syncPlayerData', partida.players[playerName].gameState);
          socket.emit('testEvent', { message: "Confirmando conexión tras reconexión" });
        } else {
          console.log(`El jugador ${playerName} ya está conectado. No se actualizará el socket.`);
        }
      } else {
        console.log(`Registrando nuevo jugador: ${playerName}`);
        partida.players[playerName] = {
          nombreEmpresa: playerName,
          esBot: false,
          gameState: {
            round: 0,
            budget: 200000000,
            reserves: 0,
            loans: [],
            products: [ generarProducto(playerName, 1), generarProducto(playerName, 2) ],
            projects: [],
            valorAccion: 1500,
            canalesDistribucion: { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 },
            interactuadoEnRonda: null
          },
          prepared: false,
          ready: false,
          roundsHistory: []
        };

        partida.socketsToPlayers[socket.id] = playerName;
        socket.data.playerName = playerName; // ★ persistimos dueño
        socket.emit('playerRegistered', partida.players[playerName]);

        // Temporizador de inscripción por partida
        if (!partida.inscripcionTemporizador && !partida.inscripcionCerrada) {
          console.log(`⏳ Iniciando temporizador de inscripción (${TIEMPO_ESPERA_INSCRIPCION / 1000}s) [${partidaId}]`);
          let tiempoRestante = Math.floor(TIEMPO_ESPERA_INSCRIPCION / 1000);

          io.to(room).emit('temporizadorInscripcionTick', { tiempoRestante });

          const temporizadorIntervalo = setInterval(() => {
            tiempoRestante--;
            io.to(room).emit('temporizadorInscripcionTick', { tiempoRestante });

            if (tiempoRestante <= 0) {
              clearInterval(temporizadorIntervalo);
              partida.inscripcionTemporizador = null;
              cerrarInscripcionAutomatica(io, registry, partidaId);
            }
          }, 1000);

          // Flag para bloquear dobles inicios (no guardamos ref. al intervalo)
          partida.inscripcionTemporizador = true;
        }
      }

      console.log("Estado actual de todos los jugadores antes de enviar decisiones:");
      Object.entries(partida.players).forEach(([name, player]) => {
        console.log(`Jugador: ${name}, Prepared: ${player.prepared}`);
      });
    });

    /* ---- 5) Ready inicial ---- */
    socket.on('playerReady', (playerName) => {
      const partidaId = socket.data.partidaId || 'default';
      const room = `partida:${partidaId}`;
      const partida = getPartidaState(registry, partidaId);

      // ★ Evita que otro socket marque listo en tu nombre
      try { ensureAuthOrThrow(socket, partida, playerName, 'playerReady'); } catch { return; }

      if (partida.players[playerName]) {
        partida.players[playerName].ready = true;
        console.log(`${playerName} está listo para comenzar el juego [${partidaId}]`);

        const readyPlayersCount = Object.values(partida.players).filter(player => player.ready).length;
        const cap = (partida.MAX_PLAYERS ?? registry.MAX_PLAYERS);

        if (readyPlayersCount === cap) {
          console.log('Todos los jugadores están listos, iniciando el juego...');
          io.to(room).emit('startGame');
        } else {
          const message = `Esperando a otros jugadores. Jugadores listos: ${readyPlayersCount}/${cap}`;
          io.to(room).emit('waitingForPlayers', message);
        }
      }
    });

    /* ---- 6) Decisiones de ronda ---- */
    socket.on('playerReadyForNextRound', (data) => {
      const { playerName, products = [], canalesDistribucion = {} } = data;
      const partidaId = socket.data.partidaId || 'default';
      const room = `partida:${partidaId}`;
      const partida = getPartidaState(registry, partidaId);

      // ★ Anti-suplantación
      try { ensureAuthOrThrow(socket, partida, playerName, 'playerReadyForNextRound'); } catch { return; }

      console.log(`Evento playerReadyForNextRound de ${playerName} [${partidaId}]`, {
        productsCount: products.length,
        canales: canalesDistribucion
      });

      if (partida.players[playerName]) {
        partida.players[playerName].prepared = true;

        /// 1) Guardar decisiones del HUMANO (y cobrar precargadas si no interactuó)
const pj = partida.players[playerName];
const gs = pj.gameState || (pj.gameState = {});

// Persistimos las decisiones recibidas para esta ronda
gs.roundDecisions = {
  products: products.map(product => ({
    caracteristicas: product.caracteristicas,
    precio: product.precio,
    posicionamientoCalidad: product.calidad,
    posicionamientoPrecio: product.posicionamientoPrecio,
    presupuestoPublicidad: product.publicidad,
    stock: product.stock,
    unidadesFabricar: product.unidadesFabricar
  })),
  canalesDistribucion: {
    granDistribucion: canalesDistribucion.granDistribucion || 0,
    minoristas:       canalesDistribucion.minoristas       || 0,
    online:           canalesDistribucion.online           || 0,
    tiendaPropia:     canalesDistribucion.tiendaPropia     || 0
  }
};

// === COBRO AUTOMÁTICO DE DECISIONES PRECARGADAS =======================
// Si el jugador NO ha entrado en la pantalla de decisiones esta ronda
// (gs.interactuadoEnRonda !== gs.round), cobramos el coste aquí.
const rondaActual = Number(gs.round ?? 0);
const yaProcesada = Number(gs.interactuadoEnRonda ?? -1) === rondaActual;

if (!yaProcesada) {
  // Usamos los productos/canales de la petición; si vinieran vacíos,
  // caemos al estado que ya tiene el servidor en gameState.
  const productosParaCoste = (Array.isArray(products) && products.length)
    ? products
    : (gs.products || []);

  const canalesParaCoste = Object.assign(
    { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 },
    (canalesDistribucion && Object.keys(canalesDistribucion).length)
      ? canalesDistribucion
      : (gs.canalesDistribucion || {})
  );

  // Costes por canal (mismos que usas en la UI de decisiones)
  const COSTE_CANALES = {
    granDistribucion: 75000,
    minoristas:      115000,
    online:          150000,
    tiendaPropia:    300000
  };

  // Coste de fabricación y publicidad (igual que hace el cliente)
  const gastoFabricacion = productosParaCoste.reduce((acc, p) =>
    acc + (Number(p.unidadesFabricar) || 0) * (Number(p.costeUnitarioEst) || 0)
  , 0);

  const gastoPublicidad = productosParaCoste.reduce((acc, p) =>
    acc + (Number(p.publicidad ?? p.presupuestoPublicidad) || 0)
  , 0);

  const gastoCanales = Object.entries(COSTE_CANALES).reduce((acc, [k, coste]) =>
    acc + ((Number(canalesParaCoste[k]) || 0) * coste)
  , 0);

  const gastoTotal = gastoFabricacion + gastoPublicidad + gastoCanales;

  // Aplica el cobro en servidor e idempotencia marcando la ronda como "interactuada"
  gs.budget = Number(gs.budget || 0) - gastoTotal;
  gs.interactuadoEnRonda = rondaActual;

  console.log(`[Cobro auto] ${playerName} r${rondaActual} → fab=${gastoFabricacion}, pub=${gastoPublicidad}, canales=${gastoCanales}, total=${gastoTotal}. Budget=${gs.budget}`);
}


        // Persistir decisión HUMANO
        const service = getPartidaState(registry, partidaId).service;
        service?.guardarDecision({
          nombre: playerName,
          decision: partida.players[playerName].gameState.roundDecisions
        }).catch(() => {});
      }

      // 2) Decisiones de BOTS si faltan
      const bots = Object.entries(partida.players).filter(([_, p]) => p.esBot && !p.prepared);
      if (bots.length > 0) {
        const mkt = obtenerMarketData(registry, partidaId);
        const resultadosUltimaRonda = partida.resultadosCache; // [] en ronda 1

        bots.forEach(([botName, bot]) => {
          const decisiones = tomarDecisionesBot(
            botName,
            bot.dificultad,
            bot.gameState,
            mkt,
            resultadosUltimaRonda
          );

          bot.gameState.roundDecisions = {
            products: decisiones.products.map(p => ({
              caracteristicas: p.caracteristicas,
              precio: p.precio,
              posicionamientoCalidad: p.calidad,
              posicionamientoPrecio: p.posicionamientoPrecio,
              presupuestoPublicidad: p.publicidad,
              unidadesFabricar: p.unidadesFabricar,
            })),
            canalesDistribucion: decisiones.canalesDistribucion
          };
           console.log(`[BOT ${botName}] decisiones r${bot.gameState.round}:`,
            JSON.stringify(bot.gameState.roundDecisions, null, 2));
          // Persistir decisión BOT
          const service = getPartidaState(registry, partidaId).service;
          service?.guardarDecision({
            nombre: botName,
            decision: bot.gameState.roundDecisions
          }).catch(() => {});

          // Aplicar al estado actual (para UI)
          bot.gameState.canalesDistribucion = { ...decisiones.canalesDistribucion };
          bot.gameState.products = bot.gameState.products.map((productoOriginal, idx) => {
            const d = decisiones.products[idx];
            return {
              ...productoOriginal,
              precio: d.precio,
              unidadesFabricar: d.unidadesFabricar,
              publicidad: d.publicidad,
              calidad: d.calidad,
              posicionamientoPrecio: d.posicionamientoPrecio,
              caracteristicas: d.caracteristicas
            };
          });

          bot.prepared = true;
          console.log(`✅ Bot ${botName} ha tomado sus decisiones [${partidaId}].`);
        });
      }

      // 3) ¿Todos preparados?
      const preparedPlayersCount = Object.values(partida.players).filter(p => p.prepared).length;
      const cap = (partida.MAX_PLAYERS ?? registry.MAX_PLAYERS);

      if (preparedPlayersCount === cap) {
        console.log('Todos han enviado decisiones. Ejecutando cálculos...');
        io.to(room).emit('allPlayersReady'); // UI: "Calculando..."

        // ★ Namespacing del evento de cálculos por partida
        const eventName = `calculosRealizados:${partidaId}`;
        const handler = (processedPlayersData, _marketData, resultadosFinales, meta) => {
          // Si viene meta con partidaId en utils/calculos, filtramos por seguridad (fallback)
          if (meta?.partidaId && meta.partidaId !== partidaId) {
            console.warn(`[calc] Evento recibido de otra partida (${meta.partidaId}) → ignorado`);
            return;
          }

          console.log("Resultados procesados. Actualizando y notificando...");

const partida = getPartidaState(registry, partidaId);

// 1) Guardamos SIEMPRE los crudos por compatibilidad
partida.resultadosRawCache = Array.isArray(resultadosFinales) ? resultadosFinales : [];

// 2) Generamos los PROCESADOS (contables) que consumen las pantallas
let resultadosProcesados = [];
try {
  resultadosProcesados = generarResultados(
    JSON.parse(JSON.stringify(partida.players)),  // playersData
    partida.marketData,                           // marketData
    partida.resultadosRawCache,                   // resultadosFinales (crudos)
    { partidaId }                                 // meta opcional
  ) || [];
} catch (e) {
  console.error('Error en generarResultados:', e);
  resultadosProcesados = [];
}

// 3) Cache que servirán las pantallas “completas”
partida.resultadosCompletosCache = resultadosProcesados;

// (opcional) mantén resultadosCache apuntando a los procesados para compat vieja
partida.resultadosCache = resultadosProcesados;

// 4) Estados de jugadores (igual que antes)
partida.estadosCache = Object.entries(partida.players).map(([playerName, p]) => ({
  playerName,
  ...p.gameState,
}));

// 5) Emitimos ambos canales: generales (raw) y completos (procesados)
io.to(room).emit('resultadosFinales', partida.resultadosRawCache);
io.to(room).emit('resultadosCompletos', partida.resultadosCompletosCache);

// Diagnóstico útil (ver primera fila procesada)
if (partida.resultadosCompletosCache?.length) {
  console.log('Fila ejemplo resultadosCompletosCache:', partida.resultadosCompletosCache[0]);
}

          Object.keys(processedPlayersData).forEach(nombre => {
            const player = partida.players[nombre];
            if (!player) return;
            player.gameState = { ...player.gameState, ...processedPlayersData[nombre].gameState };

            const socketId = Object.keys(partida.socketsToPlayers).find(key => partida.socketsToPlayers[key] === nombre);
            if (socketId) io.to(socketId).emit('syncPlayerData', player.gameState);
          });

          // nº de ronda = la que empieza ahora (max round de players + 1)
          const rondas = Object.values(partida.players).map(p => p.gameState?.round || 0);
          const rondaNumero = Math.max(...rondas) + 1;

          // Persistimos el agregado de resultados
          const service = getPartidaState(registry, partidaId).service;
          service?.guardarResultadosRonda({ rondaNumero, data: resultadosFinales }).catch(() => {});

          // FIN DE PARTIDA
          if (rondaNumero > MAX_ROUNDS) {
            const rows = Object.entries(partida.players).map(([name, p]) => {
              const rh = Array.isArray(p?.gameState?.roundsHistory) ? p.gameState.roundsHistory : [];
              const last = rh[rh.length - 1] || {};
              const prev = rh.length > 1 ? rh[rh.length - 2] : null;

              const valorAccion = Number(last.valorAccion) || 0;
              const resultadoNeto = Number(last.resultadoNeto) || 0;
              const bai = Number(last.bai) || 0;
              const baii = Number(last.baii) || 0;
              const facturacionNeta = Number(last.facturacionNeta) || 0;

              const prevPrecio = prev ? Number(prev.valorAccion) || 0 : null;
              const deltaAbs = prevPrecio === null ? null : (valorAccion - prevPrecio);
              const deltaPct = (prevPrecio && prevPrecio !== 0)
                ? ((valorAccion - prevPrecio) / Math.abs(prevPrecio)) * 100
                : null;

              const displayName = p.nombreEmpresa || p.nombre || name;
              return { playerId: name, name: displayName, valorAccion, resultadoNeto, bai, baii, facturacionNeta, deltaAbs, deltaPct };
            });

            rows.sort((a, b) =>
              (b.valorAccion - a.valorAccion) ||
              (b.resultadoNeto - a.resultadoNeto) ||
              (b.bai - a.bai)
            );

            const topValor = rows.length ? rows[0].valorAccion : null;
            const winners = rows.filter(r => r.valorAccion === topValor);

            const payload = {
              roomId: partidaId,
              roundIndex: MAX_ROUNDS,
              winners: winners.map(w => ({
                playerId: w.playerId,
                name: w.name,
                valorAccion: w.valorAccion,
                deltaAbs: w.deltaAbs,
                deltaPct: w.deltaPct
              })),
              leaderboard: rows.map(r => ({
                playerId: r.playerId,
                name: r.name,
                valorAccion: r.valorAccion,
                deltaPct: r.deltaPct,
                resultadoNeto: r.resultadoNeto,
                baii: r.baii,
                facturacionNeta: r.facturacionNeta
              })),
              tiebreaker: "resultadoNeto>BAI",
              endedAt: new Date().toISOString()
            };

            io.to(room).emit('gameEnded', payload);
            partida.gamePhase = 'ended';

            setTimeout(() => {
              partida.players = {};
              partida.resultadosCache = null;
              partida.estadosCache = null;
              partida.resultadosCompletosCache = null;
              partida.inscripcionCerrada = false;
              partida.inscripcionTemporizador = null;
              partida.gamePhase = 'lobby';
              io.to(room).emit('lobbyReset');
            }, 15000);

            return; // no iniciar siguiente ronda
          }

          // NO ha terminado → siguiente ronda
          iniciarSiguienteRonda(io, registry, partidaId, resultadosFinales);
        };

        // Preferimos evento namespaced; si no existe, caemos al genérico con filtro
        let usedNamespaced = false;
        try {
          eventEmitter.once(eventName, handler);
          usedNamespaced = true;
        } catch {}
        if (!usedNamespaced) {
          eventEmitter.once('calculosRealizados', handler); // ⚠️ fallback; confía en meta.partidaId si lo hay
        }

        // Lanzar cálculos (si tu iniciarCalculos acepta meta, pásale partidaId)
        const playersData = JSON.parse(JSON.stringify(partida.players));
        const mkt = obtenerMarketData(registry, partidaId);
        try {
          iniciarCalculos(playersData, mkt, { partidaId }); // ★ meta opcional
        } catch {
          iniciarCalculos(playersData, mkt);
        }
      } else {
        console.log(`Jugadores preparados [${partidaId}]: ${preparedPlayersCount}/${cap}`);
      }
    });

    /* ---- 7) Cuenta de resultados por jugador ---- */
    socket.on("obtenerCuentaResultados", (playerName) => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);

      // ★ Anti-suplantación de lectura sensible (opcional)
      try { ensureAuthOrThrow(socket, partida, playerName, 'obtenerCuentaResultados'); } catch { return; }

      if (partida.players[playerName] && partida.players[playerName].gameState) {
        const roundsHistory = partida.players[playerName].gameState.roundsHistory;
        socket.emit("actualizarCuentaResultados", roundsHistory);
      } else {
        console.error(`No se encontraron datos para el jugador: ${playerName}`);
      }
    });

    /* ---- 8) Desconexión ---- */
    socket.on('disconnect', () => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);
      if (partida.socketsToPlayers[socket.id]) {
        const playerName = partida.socketsToPlayers[socket.id];
        console.log(`Jugador ${playerName} se ha desconectado [${partidaId}].`);
        delete partida.socketsToPlayers[socket.id];

        totalPlayersConnected--;

        setTimeout(() => {
          if (!Object.values(partida.socketsToPlayers).includes(playerName)) {
            console.log(`Eliminando datos del jugador ${playerName} por desconexión prolongada.`);
            delete partida.players[playerName];
          }
        }, 500000);
      }
    });

    /* ---- 9) Actualización de estado por el cliente ---- */
    socket.on("updatePlayerData", ({ playerName, playerData }) => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);

      // ★ Anti-suplantación
      try { ensureAuthOrThrow(socket, partida, playerName, 'updatePlayerData'); } catch { return; }

      if (partida.players[playerName] && partida.players[playerName].gameState) {
        const currentGameState = partida.players[playerName].gameState;

        const existingProducts = currentGameState.products || [];
        const newProducts = playerData.products || [];

        const productMap = new Map();
        existingProducts.forEach(product => productMap.set(product.nombre, product));
        newProducts.forEach(product => productMap.set(product.nombre, product));

        partida.players[playerName].gameState = {
          ...currentGameState,
          budget: playerData.budget !== undefined ? playerData.budget : currentGameState.budget,
          reserves: playerData.reserves !== undefined ? playerData.reserves : currentGameState.reserves,
          loans: playerData.loans !== undefined ? playerData.loans : currentGameState.loans,
          projects: playerData.projects !== undefined ? playerData.projects : currentGameState.projects,
          canalesDistribucion: playerData.canalesDistribucion !== undefined ? playerData.canalesDistribucion : currentGameState.canalesDistribucion,
          products: Array.from(productMap.values()),
          interactuadoEnRonda: playerData.interactuadoEnRonda !== undefined ? playerData.interactuadoEnRonda : currentGameState.interactuadoEnRonda, // ★ nombre consistente
        };

        console.log(`Datos actualizados para ${playerName} [${partidaId}]:`, {
          budget: partida.players[playerName].gameState.budget,
          products: partida.players[playerName].gameState.products.length
        });
      } else {
        console.error(`Error al actualizar los datos para ${playerName}. Jugador no encontrado.`);
      }
    });

    /* ---- 10) Proyectos y productos ---- */
    socket.on("lanzarProyecto", (data) => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);

      console.log("Datos recibidos para lanzarProyecto:", data);
      const { playerName, proyecto } = data;

      // ★ Anti-suplantación
      try { ensureAuthOrThrow(socket, partida, playerName, 'lanzarProyecto'); } catch { return; }

      if (!playerName || !proyecto) {
        console.error(`Datos inválidos recibidos: playerName = ${playerName}, proyecto = ${JSON.stringify(proyecto)}`);
        return;
      }
      if (!partida.players[playerName] || !partida.players[playerName].gameState) {
        console.error(`Jugador ${playerName} no encontrado o no tiene estado válido.`);
        return;
      }

      const gameState = partida.players[playerName].gameState;

      const nuevoProducto = {
        nombre: proyecto.nombre || `Producto ${gameState.products.length + 1}`,
        descripcion: proyecto.descripcion || `Nuevo producto derivado de ${proyecto.nombre || "proyecto desconocido"}`,
        caracteristicas: proyecto.caracteristicas || { pantalla: 1, procesador: 1, bateria: 1 },
        costeUnitarioEst: proyecto.costeUnitarioEst || 100,
        precio: 0,
        unidadesFabricar: 0,
        posicionamientoPrecio: 1,
        calidad: 1,
        publicidad: 0,
        posicionamientoProductoReal: "0.00",
        ratioPosicionamiento: "0.00",
        promedioCaracteristicas: 0,
        efectoPosicionamiento: "0.00",
        caracteristicasAjustadas: { pantalla: "0", procesador: "0", bateria: "0", placaBase: "0", ergonomia: "0", acabados: "0", color: "0" },
        pvp: 0,
        precioPosicionado: 0,
        precioAjustado: 0,
        interesPorSegmento: { profesionales: {}, altosIngresos: {}, granConsumidor: {}, bajosIngresos: {}, innovadores: {} }
      };

      gameState.products.push(nuevoProducto);

      socket.emit("syncPlayerData", {
        ...gameState,
        products: [...gameState.products],
      });

      console.log(`Proyecto ${proyecto.nombre || "desconocido"} lanzado como producto para ${playerName} [${partidaId}].`);
    });

    socket.on("eliminarProducto", (data) => {
      const partidaId = socket.data.partidaId || 'default';
      const partida = getPartidaState(registry, partidaId);
      const { playerName, producto } = data;

      // ★ Anti-suplantación
      try { ensureAuthOrThrow(socket, partida, playerName, 'eliminarProducto'); } catch { return; }

      if (partida.players[playerName] && partida.players[playerName].gameState.products) {
        partida.players[playerName].gameState.products =
          partida.players[playerName].gameState.products.filter(p => p.nombre !== producto);
        console.log(`Producto ${producto} eliminado para el jugador ${playerName} [${partidaId}]`);
        socket.emit("syncPlayerData", {
          products: [...partida.players[playerName].gameState.products],
          budget: partida.players[playerName].gameState.budget
        });
      }
    });

  }); // io.on('connection') close
}; // module.exports

/* ===================== Siguiente ronda (por partida) ===================== */

function iniciarSiguienteRonda(io, registry, partidaId, resultadosCache) {
  const partida = getPartidaState(registry, partidaId);
  const room = `partida:${partidaId}`;
  console.log('Iniciando la siguiente ronda para todos los jugadores...');

  if (!resultadosCache || !Array.isArray(resultadosCache)) {
    console.error("Error: resultadosCache no es válido o está vacío.");
    return;
  }

  // Calcula la nueva ronda en base a cualquier jugador
  const rondas = Object.values(partida.players).map(p => p.gameState?.round || 0);
  const rondaActual = Math.max(...rondas) + 1;

  console.log(`Actualizando el mercado para la ronda ${rondaActual}...`);
  actualizarMercado(partida.marketData, rondaActual, resultadosCache, partida.players);

  // Avanza y notifica a cada jugador
  Object.entries(partida.players).forEach(([name, player]) => {
    const gs = player.gameState || (player.gameState = {});
    gs.round = rondaActual;
    player.prepared = false;
    gs.interactuadoEnRonda = null;

    const effectiveName = player.nombreEmpresa || player.nombre || name;
    console.log(`Iniciando nueva ronda ${gs.round} para el jugador ${effectiveName}.`);

    const socketId = Object.keys(partida.socketsToPlayers).find(
      sid => partida.socketsToPlayers[sid] === effectiveName
    );

    if (socketId) {
      io.to(socketId).emit('iniciarSiguienteRonda', { round: gs.round });
      io.to(socketId).emit('syncPlayerData', {
        ...gs,
        products: [...(gs.products || [])],
        canalesDistribucion: gs.canalesDistribucion || {
          granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0
        },
      });
    } else {
      console.warn(`Socket no encontrado para jugador ${effectiveName}`);
    }
  });

  io.to(room).emit('marketUpdate', partida.marketData);
}
