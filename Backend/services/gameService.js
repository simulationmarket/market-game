// services/gameService.js
/**
 * Capa fina que ORQUESTA tu sim sin cambiar tu lógica:
 * - Puede usar BD (Prisma) si está disponible, pero no es obligatorio
 * - No reemplaza tus funciones; las llama
 * - Mantiene estructuras actuales: players, resultados, roundsHistory, marketData
 */

let prisma = null;
try { ({ prisma } = require('../prisma')); } catch (_) {}

function createGameService(deps = {}) {
  const {
    players = {},
    roundsHistory = {},
    resultados = {},
    marketData = {},
    iniciarCalculos = async () => {},
    eventEmitter = { emit: () => {} },
    tomarDecisionesBot = () => {},
  } = deps;

  const state = {
    partida: { codigo: null, estado: 'inscripcion', rondaActual: 0 },
  };

  function generateCode() {
    return Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  return {
    // Lectura básica del estado (para debug)
    getEstado() {
      return {
        partida: { ...state.partida },
        totalPlayers: Object.keys(players).length,
      };
    },

    // Inscripción y arranque
    crearPartida(codigo) {
      const _codigo = codigo || generateCode();

      // Estado en memoria (como antes)
      state.partida.codigo = _codigo;
      state.partida.estado = 'inscripcion';
      state.partida.rondaActual = 0;
      eventEmitter.emit('partidaCreada', { codigo: _codigo });

      // Persistir en BD si Prisma está disponible (no bloqueante)
      if (prisma) {
        prisma.partida.upsert({
          where: { codigo: _codigo },
          update: { estado: 'inscripcion', rondaActual: 0 },
          create: { codigo: _codigo, estado: 'inscripcion' },
        }).catch(() => {});
      }

      return { ...state.partida };
    },

   // ✅ NO tocar tu objeto `players` aquí.
// Solo emitimos evento y (si hay Prisma) persistimos en BD.
unirsePartida({ id, nombre, esBot = false }) {
  eventEmitter.emit('jugadorUnido', { nombre, esBot });

  if (prisma && state.partida.codigo) {
    prisma.partida.findUnique({ where: { codigo: state.partida.codigo } })
      .then(p => {
        if (!p) return;
        return prisma.jugador.create({
          data: { nombre, esBot, budget: 0, partidaId: p.id },
        });
      })
      .catch(() => {});
  }

  // Devolvemos algo simple por si lo usas
  return { nombre, esBot };

  
},

// ✅ Opciones:
// A) Deja de llamarlo desde playersSocket (tu módulo ya marca listo en su propio `players`).
// B) Si quieres mantenerlo, hazlo tolerante a id o nombre:
marcarListo(ref, ready = true) {
  // Busca por clave directa o por nombreEmpresa/nombre
  const p = players[ref]
    || Object.values(players).find(x => x?.nombreEmpresa === ref || x?.nombre === ref);

  if (p) {
    // en tu estructura real la flag suele ser `prepared`
    if (typeof p.prepared !== 'boolean') p.prepared = false;
    p.prepared = ready;
    eventEmitter.emit('jugadorListo', { nombre: p.nombreEmpresa || p.nombre, ready });
    return true;
  }
  return false;
},


    async cerrarInscripcionYCrearBotsSiFaltan({ plazas = 0, nombreBotBase = 'Bot' } = {}) {
      const humanos = Object.values(players).filter(p => !p.esBot);
      const faltan = Math.max(0, plazas - humanos.length);
      for (let i = 0; i < faltan; i++) {
        const id = `bot_${Date.now()}_${i}`;
        players[id] = {
          nombre: `${nombreBotBase} ${i + 1}`,
          esBot: true,
          ready: true,
          budget: 0,
          gameState: { products: [], decisions: [] },
        };
      }
      state.partida.estado = 'en_curso';
      eventEmitter.emit('inscripcionCerrada', { total: Object.keys(players).length });
      return { total: Object.keys(players).length, botsCreados: faltan };
    },

    // Decisiones
    async registrarDecision({ id, decision }) {
      const p = players[id];
      if (!p) throw new Error('Jugador no existe');
      p.gameState.decisions = p.gameState.decisions || [];
      p.gameState.decisions.push(decision);
      eventEmitter.emit('decisionRegistrada', { jugador: p.nombre, decision });
      return true;
    },
     // Persistencia: guardar decisión de un jugador (humano o bot) como JSON
    // ✅ Guardar decisión como JSON en BD
  async guardarDecision({ nombre, decision }) {
    if (!prisma || !state.partida.codigo) return false;

    const partida = await prisma.partida.findUnique({
      where: { codigo: state.partida.codigo }
    });
    if (!partida) return false;

    let jugador = await prisma.jugador.findFirst({
      where: { partidaId: partida.id, nombre }
    });
    if (!jugador) {
      jugador = await prisma.jugador.create({
        data: { nombre, esBot: false, budget: 0, partidaId: partida.id }
      });
    }

    let ronda = await prisma.ronda.findFirst({
      where: { partidaId: partida.id },
      orderBy: { numero: 'desc' }
    });
    if (!ronda) {
      ronda = await prisma.ronda.create({
        data: { numero: 1, partidaId: partida.id }
      });
    }

    await prisma.decision.create({
      data: {
        jugadorId: jugador.id,
        partidaId: partida.id,
        rondaId: ronda.id,
        data: decision
      }
    });

    return true;
  },

  // Guarda el resultado agregado de una ronda (JSON)
async guardarResultadosRonda({ rondaNumero, data }) {
  if (!prisma || !state.partida.codigo) return false;

  const partida = await prisma.partida.findUnique({
    where: { codigo: state.partida.codigo }
  });
  if (!partida) return false;

  // Asegurar/obtener la ronda
  let ronda = await prisma.ronda.findFirst({
    where: { partidaId: partida.id, numero: rondaNumero }
  });
  if (!ronda) {
    ronda = await prisma.ronda.create({
      data: { numero: rondaNumero, partidaId: partida.id }
    });
  }

  // Upsert por (partidaId, rondaId)
  await prisma.resultadoRonda.upsert({
    where: { resultado_unico_por_ronda: { partidaId: partida.id, rondaId: ronda.id } },
    update: { data },
    create: { partidaId: partida.id, rondaId: ronda.id, data }
  });

  return true;
},


  // ✅ Cerrar ronda y asegurar persistencia de la ronda
  async cerrarRonda() {
    await iniciarCalculos(players, marketData);

    const ronda = ++state.partida.rondaActual;

    if (prisma && state.partida.codigo) {
      const partida = await prisma.partida.findUnique({
        where: { codigo: state.partida.codigo }
      });
      if (partida) {
        await prisma.ronda.upsert({
          where: { ronda_unica_por_partida: { partidaId: partida.id, numero: ronda } },
          update: {},
          create: { numero: ronda, partidaId: partida.id },
        });
      }
    }

    const snapResultados = JSON.parse(JSON.stringify(resultados || {}));
    const snapHistory = JSON.parse(JSON.stringify(roundsHistory || {}));
    eventEmitter.emit('resultadosPublicados', { ronda });

    return { ronda, resultados: snapResultados, history: snapHistory };
  },
};            // ← cierra el objeto del return

}             // ← cierra la función createGameService

module.exports = { createGameService };