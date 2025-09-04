const players = {};  // Objeto para almacenar los jugadores y su estado
let gamePhase = 'lobby'; // 'lobby' | 'playing' | 'ended'

function humanosConectados() {
  return Object.keys(socketsToPlayers)
    .map(id => socketsToPlayers[id])
    .filter(name => players[name] && !players[name].esBot).length;
}

function resetLobby(io) {
  console.log('🔁 Reset lobby → vaciando estado');
  // Limpia jugadores y mapas
  for (const id of Object.keys(socketsToPlayers)) delete socketsToPlayers[id];
  for (const name of Object.keys(players)) delete players[name];

  // Limpia caches/timers de tu módulo
  resultadosCache = null;
  estadosCache = null;
  resultadosCompletosCache = null;

  // Reabre inscripción
  inscripcionCerrada = false;
  inscripcionTemporizador = null;

  gamePhase = 'lobby';
  io?.emit?.('lobbyReset');
}

const socketsToPlayers = {};  // Mapeo para rastrear qué socket pertenece a qué jugador
let totalPlayersConnected = 0;  // Llevar un conteo de los jugadores conectados
const { marketData, actualizarMercado } = require('./market.js');  // Asegúrate de tener esta referencia correctamente
const { iniciarCalculos, eventEmitter } = require('../utils/calculos');
const { tomarDecisionesBot } = require('../utils/bots');
const TIEMPO_ESPERA_INSCRIPCION = 5000; // o el tiempo que quieras
const MAX_ROUNDS = 10;

let inscripcionTemporizador = null;
let inscripcionCerrada = false;
// Definir funciones antes de utilizarlas
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
        costeUnitario += tablaCosteUnitario[caracteristica][valor - 1];
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




// Función para obtener los datos del mercado (mock function)
function obtenerMarketData() {
    return marketData;  // Asegúrate de tener `marketData` bien definido y exportado en `market.js`
}



function cerrarInscripcionAutomatica(io, MAX_PLAYERS, players) {
  if (inscripcionCerrada) return; // ⛔ prevenir ejecución doble
  inscripcionCerrada = true;

  const nombresBots = ["ZENTEC", "NOVA", "FUTURA", "TEKNO", "CYBERIA", "DIGITECH", "ALPHACORE", "OMNISYS"];
  const nivelesDificultad = ['facil', 'normal', 'dificil'];
  const dificultadAleatoria = () => nivelesDificultad[Math.floor(Math.random() * nivelesDificultad.length)];
    console.log("Estado de players antes de cerrar inscripción:", players);
  const jugadoresReales = Object.values(players).filter(p => !p.esBot && p.ready);
  const botsNecesarios = MAX_PLAYERS - jugadoresReales.length;

  console.log(`Inscripción cerrada automáticamente. Jugadores reales: ${jugadoresReales.length}, Bots necesarios: ${botsNecesarios}`);

  for (let i = 0; i < botsNecesarios; i++) {
  const nombreBot = nombresBots[i] || `BOT${i + 1}`;
  const dificultad = dificultadAleatoria();

  // ⚠️ Generar copia de rangos para ese bot
  const rangosDisponibles = [
        { min: 1, max: 5 },
        { min: 6, max: 10 },
        { min: 7, max: 16 },
        { min: 10, max: 20 }
  ];

  players[nombreBot] = {
    nombreEmpresa: nombreBot,
    esBot: true,
    dificultad: dificultad,
    gameState: {
      round: 0,
      budget: 200000000,
      reserves: 0,
      loans: [],
      products: [
        generarProducto(nombreBot, 1, rangosDisponibles),
        generarProducto(nombreBot, 2, rangosDisponibles)
      ],
      projects: [],
      valorAccion: 1500,
      canalesDistribucion: {
        granDistribucion: 0,
        minoristas: 0,
        online: 0,
        tiendaPropia: 0
      },
      interactuadoEnRonda: null
    },
    prepared: false,
    ready: true,
    roundsHistory: []
  };

  console.log(`Creado bot ${nombreBot} con dificultad "${dificultad}"`);
}


  // Marcar todos como listos (para startGame)
  Object.values(players).forEach(p => p.ready = true);
  inscripcionCerrada = true;
  gamePhase = 'playing';
  io.emit('startGame')
}



// Módulo de sockets para el servidor
module.exports = (io, players, MAX_PLAYERS) => {

    let resultadosCache = null; // Caché para resultados finales
    let estadosCache = null;    // Caché para estados de los jugadores
    let resultadosCompletosCache = null; // Nueva caché para resultados completos

    
    // Escuchar el evento "calculosRealizados"
    eventEmitter.on('calculosRealizados', (playersData, marketData, resultadosFinales) => {
        console.log("Procesando resultados finales...");

        // Actualizar la caché con los resultados finales
        resultadosCache = resultadosFinales;

        // Actualizar estados de jugadores
        if (players && Object.keys(players).length > 0) {
            estadosCache = Object.entries(players).map(([playerName, player]) => ({
                playerName,
                ...player.gameState
            }));
            console.log("Estados de los jugadores actualizados en caché:", estadosCache);
        }
    });

    // Escuchar el evento "resultadosCompletosGenerados"
    eventEmitter.on('resultadosCompletosGenerados', (resultados) => {
      resultadosCompletosCache = resultados;

      // Refrescar estadosCache AHORA que roundsHistory ya está escrito
      estadosCache = Object.entries(players).map(([playerName, p]) => ({
        playerName,
        ...p.gameState,
      }));
    });

    // Manejar eventos de conexión del cliente
    io.on('connection', (socket) => {
        console.log('Nuevo cliente conectado:', socket.id);

        totalPlayersConnected++;

        // Manejar la solicitud de resultados generales
        socket.on('solicitarResultados', () => {
            console.log("Cliente solicitó resultados generales:", socket.id);
            if (resultadosCache) {
                console.log("Enviando resultados generales al cliente.");
                socket.emit('resultadosFinales', resultadosCache); // Emitir resultados de la caché
            } else {
                console.log("No hay resultados generales disponibles.");
                socket.emit('resultadosFinales', []); // Enviar lista vacía si no hay datos
            }
        });

        socket.on('leaveRoom', () => {
        const name = socketsToPlayers[socket.id];
        if (!name) return;
        console.log(`🚪 ${name} sale al índice`);
        delete socketsToPlayers[socket.id];
        delete players[name];

        if (gamePhase === 'ended' && humanosConectados() === 0) {
          resetLobby(io);
        }
      });


        // Manejar la solicitud de estados de todos los jugadores  ✅ FRESCO (sin caché)
        socket.on('solicitarEstadosJugadores', () => {
          console.log("Cliente solicitó estados de todos los jugadores:", socket.id);
          const estados = Object.entries(players).map(([playerName, p]) => ({
            playerName,
            ...p.gameState,            // 👈 incluye roundsHistory ya persistido
          }));
          console.log("Enviando estados de jugadores al cliente. rh_len:",
            estados.map(e => ({ player: e.playerName, rh_len: Array.isArray(e.roundsHistory) ? e.roundsHistory.length : 0 }))
          );
          socket.emit('todosLosEstados', estados);
        });
        // Manejar solicitud de resultados completos
        socket.on('solicitarResultadosCompletos', () => {
            console.log("Cliente solicitó resultados completos:", socket.id);

            if (resultadosCompletosCache) {
                console.log("Enviando resultados completos al cliente.");
                socket.emit('resultadosCompletos', resultadosCompletosCache); // Enviar resultados completos almacenados
            } else {
                console.log("No hay resultados completos disponibles en este momento.");
                socket.emit('resultadosCompletos', []); // Enviar lista vacía si no hay datos
            }
        });
    


        // Evento para registrar o reconectar un jugador
        socket.on('identificarJugador', (playerName) => {

          if (gamePhase === 'ended') {
          console.log('♻️ Nuevo jugador tras partida terminada → reset lobby');
          resetLobby(io);
        }

            if (socketsToPlayers[socket.id]) {
                console.log(`El jugador ya está identificado con este socket.`);
                return;
            }

            if (players[playerName]) {
                if (!Object.values(socketsToPlayers).includes(playerName)) {
                    console.log(`Jugador ${playerName} se ha reconectado. Asignando nuevo socket.`);
                    socketsToPlayers[socket.id] = playerName;
                    players[playerName].prepared = false;
                    socket.emit('syncPlayerData', players[playerName].gameState);

            // Emitir el evento de prueba tras la reconexión para confirmar la conexión
            socket.emit('testEvent', { message: "Confirmando conexión tras reconexión" });

                } else {
                    console.log(`El jugador ${playerName} ya está conectado. No se actualizará el socket.`);
                }
            } else {
                console.log(`Registrando nuevo jugador: ${playerName}`);
                players[playerName] = {
                    nombreEmpresa: playerName,
                    esBot: false,
                    gameState: {
                        round: 0,
                        budget: 200000000,
                        reserves: 0,
                        loans: [],
                        products: [
                            generarProducto(playerName, 1),
                            generarProducto(playerName, 2)
                        ],
                        projects: [],
                        valorAccion: 1500,
                        canalesDistribucion: {
                            granDistribucion: 0,
                            minoristas: 0,
                            online: 0,
                            tiendaPropia: 0
                        },
                        interactuadoEnRonda: null // Agregado para registrar interacciones por ronda
                    },
                    prepared: false,
                    roundsHistory: []
                };
                
                socketsToPlayers[socket.id] = playerName;
                socket.emit('playerRegistered', players[playerName]);
                // Iniciar el temporizador solo si aún no está iniciado y la inscripción está abierta
            if (!inscripcionTemporizador && !inscripcionCerrada) {
  console.log("⏳ Iniciando temporizador de inscripción (60s)");
  let tiempoRestante = TIEMPO_ESPERA_INSCRIPCION / 1000;

  io.emit('temporizadorInscripcionTick', { tiempoRestante });

  const temporizadorIntervalo = setInterval(() => {
      tiempoRestante--;
      io.emit('temporizadorInscripcionTick', { tiempoRestante });

      if (tiempoRestante <= 0) {
          clearInterval(temporizadorIntervalo);
          inscripcionTemporizador = null;
          cerrarInscripcionAutomatica(io, MAX_PLAYERS,players);
      }
  }, 1000);

  // Solo usas inscripcionTemporizador para bloquear el doble inicio
  inscripcionTemporizador = true;
}



  }

    console.log("Estado actual de todos los jugadores antes de enviar decisiones:");
    Object.entries(players).forEach(([name, player]) => {
    console.log(`Jugador: ${name}, Prepared: ${player.prepared}`);
 });
          
            
     });

        // Evento para iniciar el juego
        socket.on('playerReady', (playerName) => {
            if (players[playerName]) {
                players[playerName].ready = true;
                console.log(`${playerName} está listo para comenzar el juego`);

                const readyPlayersCount = Object.values(players).filter(player => player.ready).length;

                if (readyPlayersCount === MAX_PLAYERS) {
                    console.log('Todos los jugadores están listos, iniciando el juego...');
                    io.emit('startGame');
                } else {
                    const message = `Esperando a otros jugadores. Jugadores listos: ${readyPlayersCount}/${MAX_PLAYERS}`;
                    io.emit('waitingForPlayers', message);
                }
            }
        });

       
        
        socket.on('playerReadyForNextRound', (data) => {
  const { playerName, products = [], canalesDistribucion = {} } = data;
  console.log(`Evento playerReadyForNextRound recibido del jugador: ${playerName}`, data);

  if (players[playerName]) {
    players[playerName].prepared = true;

    // 1) Guardar decisiones del HUMANO en estado
    players[playerName].gameState.roundDecisions = {
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
        minoristas: canalesDistribucion.minoristas || 0,
        online: canalesDistribucion.online || 0,
        tiendaPropia: canalesDistribucion.tiendaPropia || 0
      }
    };

    // Persistir decisión HUMANO
    io.gameService.guardarDecision({
      nombre: playerName,
      decision: players[playerName].gameState.roundDecisions
    }).catch(() => {});
  } // <-- cierra if (players[playerName])

  // 2) Decisiones de BOTS si faltan
  const bots = Object.entries(players).filter(([_, p]) => p.esBot && !p.prepared);
  if (bots.length > 0) {
    const marketData = obtenerMarketData();
    const resultadosUltimaRonda = resultadosCache; // [] en ronda 1

    bots.forEach(([botName, bot]) => {
      const decisiones = tomarDecisionesBot(
        botName,
        bot.dificultad,
        bot.gameState,
        marketData,
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

      // Persistir decisión BOT
      io.gameService.guardarDecision({
        nombre: botName,
        decision: bot.gameState.roundDecisions
      }).catch(() => {});

      // (opcional) aplicar al estado actual
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
      console.log(`✅ Bot ${botName} ha tomado sus decisiones.`);
    });
  } // <-- cierra if (bots.length > 0)

  // 3) ¿Todos preparados?
  const preparedPlayersCount = Object.values(players).filter(p => p.prepared).length;

  if (preparedPlayersCount === MAX_PLAYERS) {
    console.log('Todos han enviado decisiones. Ejecutando cálculos...');
    io.emit('allPlayersReady'); // para que la UI muestre "Calculando..."

    // Escucha el evento que emite tu motor
    eventEmitter.once('calculosRealizados', (processedPlayersData, _marketData, resultadosFinales) => {
      console.log("Resultados procesados. Actualizando y notificando...");

      Object.keys(processedPlayersData).forEach(nombre => {
        const player = players[nombre];
        if (!player) return;

        player.gameState = { ...player.gameState, ...processedPlayersData[nombre].gameState };

        const socketId = Object.keys(socketsToPlayers).find(key => socketsToPlayers[key] === nombre);
        if (socketId) {
          io.to(socketId).emit('syncPlayerData', player.gameState);
        }
      });

      // nº de ronda = la que empieza ahora (max round de players + 1)
const rondas = Object.values(players).map(p => p.gameState?.round || 0);
const rondaNumero = Math.max(...rondas) + 1;

// Persistimos el agregado de resultados de la ronda que acaba de cerrar (como hacías)
io.gameService.guardarResultadosRonda({
  rondaNumero,
  data: resultadosFinales
}).catch(() => {});

// 👇 CORTE DE FIN DE PARTIDA
if (rondaNumero > MAX_ROUNDS) {
  // Construir leaderboard con datos de la ÚLTIMA ronda cerrada
  const rows = Object.entries(players).map(([name, p]) => {
    const rh = Array.isArray(p?.gameState?.roundsHistory) ? p.gameState.roundsHistory : [];
    const last = rh[rh.length - 1] || {};
    const prev = rh.length > 1 ? rh[rh.length - 2] : null;

    const valorAccion = Number(last.valorAccion) || 0;
    const resultadoNeto = Number(last.resultadoNeto) || 0;
    const bai = Number(last.bai) || 0;       // desempate 2
    const baii = Number(last.baii) || 0;     // por si quieres mostrar en tabla
    const facturacionNeta = Number(last.facturacionNeta) || 0;

    const prevPrecio = prev ? Number(prev.valorAccion) || 0 : null;
    const deltaAbs = prevPrecio === null ? null : (valorAccion - prevPrecio);
    const deltaPct = (prevPrecio && prevPrecio !== 0)
      ? ( (valorAccion - prevPrecio) / Math.abs(prevPrecio) ) * 100
      : null;

    const displayName = p.nombreEmpresa || p.nombre || name;

    return {
      playerId: name,
      name: displayName,
      valorAccion,
      resultadoNeto,
      bai,
      baii,
      facturacionNeta,
      deltaAbs,
      deltaPct
    };
  });

  // Orden: 1) Precio acción DESC, 2) Resultado Neto DESC, 3) BAI DESC
  rows.sort((a, b) =>
    (b.valorAccion - a.valorAccion) ||
    (b.resultadoNeto - a.resultadoNeto) ||
    (b.bai - a.bai)
  );

  // Ganador(es) por precio de la acción (co-ganadores si empatan en precio)
  const topValor = rows.length ? rows[0].valorAccion : null;
  const winners = rows.filter(r => r.valorAccion === topValor);

  const payload = {
    roomId: null, // si manejas salas pon aquí su id
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

  io.emit('gameEnded', payload);
  gamePhase = 'ended';
// limpia a los X segundos o al primer jugador nuevo
  setTimeout(() => resetLobby(io), 15000);
  
  // ¡OJO! No llames a iniciarSiguienteRonda: la partida termina aquí.
  return;
}

// Si NO ha terminado, continúas como antes
iniciarSiguienteRonda(io, players, resultadosFinales, socketsToPlayers);

    }); // <-- cierra once('calculosRealizados', ...)

    // Lanza cálculos
    const playersData = JSON.parse(JSON.stringify(players));
    const marketData = obtenerMarketData();
    iniciarCalculos(playersData, marketData);
  } else {
    console.log(`Jugadores preparados: ${preparedPlayersCount}/${MAX_PLAYERS}`);
  } // <-- cierra if preparedPlayersCount
}); // <-- cierra socket.on


       function iniciarSiguienteRonda(io, players, resultadosCache, socketsToPlayers) {
  console.log('Iniciando la siguiente ronda para todos los jugadores...');

  if (!resultadosCache || !Array.isArray(resultadosCache)) {
    console.error("Error: resultadosCache no es válido o está vacío.");
    return;
  }

  // Calcula la nueva ronda en base a cualquier jugador
  const rondas = Object.values(players).map(p => p.gameState?.round || 0);
  const rondaActual = Math.max(...rondas) + 1;

  console.log(`Actualizando el mercado para la ronda ${rondaActual}...`);
  actualizarMercado(marketData, rondaActual, resultadosCache, players);

  // Avanza y notifica a cada jugador (usando la CLAVE 'name')
  Object.entries(players).forEach(([name, player]) => {
    const gs = player.gameState || (player.gameState = {});
    gs.round = rondaActual;
    player.prepared = false;
    gs.interactuadoEnRonda = null;

    // El nombre efectivo para logs/map
    const effectiveName = player.nombreEmpresa || player.nombre || name;
    console.log(`Iniciando nueva ronda ${gs.round} para el jugador ${effectiveName}.`);

    // Busca su socket actual por nombre
    const socketId = Object.keys(socketsToPlayers).find(
      sid => socketsToPlayers[sid] === effectiveName
    );

    if (socketId) {
      io.to(socketId).emit('iniciarSiguienteRonda', { round: gs.round });
      // (Opcional) re-sincroniza su estado por si la UI lo espera
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

  io.emit('marketUpdate', marketData);
}

        
        socket.on("obtenerCuentaResultados", (playerName) => {
            if (players[playerName] && players[playerName].gameState) {
                const roundsHistory = players[playerName].gameState.roundsHistory;
                console.log(`Enviando cuenta de resultados para ${playerName}:`, roundsHistory);
        
                // Emitir los datos al cliente
                socket.emit("actualizarCuentaResultados", roundsHistory);
            } else {
                console.error(`No se encontraron datos para el jugador: ${playerName}`);
            }
        });

       
        


        // Manejo de desconexión
        socket.on('disconnect', () => {
            if (socketsToPlayers[socket.id]) {
                const playerName = socketsToPlayers[socket.id];
                console.log(`Jugador ${playerName} se ha desconectado.`);
                delete socketsToPlayers[socket.id];

                totalPlayersConnected--;

                setTimeout(() => {
                    if (!Object.values(socketsToPlayers).includes(playerName)) {
                        console.log(`Eliminando datos del jugador ${playerName} debido a desconexión prolongada.`);
                        delete players[playerName];
                    }
                }, 3000);
            }
        });

        socket.on("updatePlayerData", ({ playerName, playerData }) => {
            if (players[playerName] && players[playerName].gameState) {
                const currentGameState = players[playerName].gameState;
        
                const existingProducts = currentGameState.products || [];
                const newProducts = playerData.products || [];
        
                const productMap = new Map();
                existingProducts.forEach(product => productMap.set(product.nombre, product));
                newProducts.forEach(product => productMap.set(product.nombre, product));
        
                players[playerName].gameState = {
                    ...currentGameState, // Mantén los datos existentes
                    budget: playerData.budget !== undefined ? playerData.budget : currentGameState.budget,
                    reserves: playerData.reserves !== undefined ? playerData.reserves : currentGameState.reserves,
                    loans: playerData.loans !== undefined ? playerData.loans : currentGameState.loans,
                    projects: playerData.projects !== undefined ? playerData.projects : currentGameState.projects,
                    canalesDistribucion: playerData.canalesDistribucion !== undefined ? playerData.canalesDistribucion : currentGameState.canalesDistribucion,
                    products: Array.from(productMap.values()), // Lista sin duplicados
                    interactuadoEnRonda: playerData.rondaInteractuada !== undefined ? playerData.rondaInteractuada : currentGameState.interactuadoEnRonda,
                };
        
                console.log(`Datos actualizados para ${playerName}:`, players[playerName].gameState);
            } else {
                console.error(`Error al actualizar los datos para ${playerName}. Jugador no encontrado.`);
            }
        });
        
        
        
        


        socket.on("lanzarProyecto", (data) => {
    console.log("Datos recibidos para lanzarProyecto:", data);

    const { playerName, proyecto } = data;

    if (!playerName || !proyecto) {
        console.error(`Datos inválidos recibidos: playerName = ${playerName}, proyecto = ${JSON.stringify(proyecto)}`);
        return;
    }

    if (!players[playerName] || !players[playerName].gameState) {
        console.error(`Jugador ${playerName} no encontrado o no tiene estado válido.`);
        return;
    }

    const gameState = players[playerName].gameState;

    // Crear el nuevo producto con estructura uniforme
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

    // Agregar el nuevo producto al portafolio
    gameState.products.push(nuevoProducto);

    console.log("Productos actuales en el servidor antes de sincronizar:", gameState.products);

    // Sincronizar el estado completo con el cliente
    socket.emit("syncPlayerData", {
        ...gameState,
        products: [...gameState.products], // Asegurar que los productos estén incluidos
    });

    console.log(`Proyecto ${proyecto.nombre || "desconocido"} lanzado como producto para ${playerName}.`);
});



socket.on("obtenerCuentaResultados", (playerName) => {
    if (players[playerName] && players[playerName].gameState) {
        const roundsHistory = players[playerName].gameState.roundsHistory;
        console.log(`Enviando cuenta de resultados para ${playerName}:`, roundsHistory);

        // Emitir los datos al cliente
        socket.emit("actualizarCuentaResultados", roundsHistory);
    } else {
        console.error(`No se encontraron datos para el jugador: ${playerName}`);
    }
});

 // Manejo de eliminación de producto
    socket.on("eliminarProducto", (data) => {
            const { playerName, producto } = data;
            if (players[playerName] && players[playerName].gameState.products) {
                players[playerName].gameState.products = players[playerName].gameState.products.filter(p => p.nombre !== producto);
                console.log(`Producto ${producto} eliminado para el jugador ${playerName}`);
                socket.emit("syncPlayerData", {
                    products: [...players[playerName].gameState.products],
                    budget: players[playerName].gameState.budget
                });
            }
        });
    });
};
