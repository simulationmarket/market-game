// services/gameService.js
/**
 * Orquestador de persistencia y estado mínimo por partida.
 * - No hace listen()
 * - Trabaja con el estado inyectado (players, resultados, etc.)
 * - Persiste en Prisma si está disponible (silencioso si falla)
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
    eventEmitter = { emit: () => {}, on: () => {}, once: () => {} },
    tomarDecisionesBot = () => {},
    // opcional: si quieres inicializar el código de partida desde fuera
    partidaCodigo = null,
  } = deps;

  const state = {
    partida: { codigo: partidaCodigo || null, estado: 'inscripcion', rondaActual: 0 },
  };

  const generateCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

  /** Asegura que existe una partida con código (opcionalmente usando uno dado). */
  async function ensureCodigo(codigoPreferido = null) {
    if (state.partida.codigo) return state.partida.codigo;

    const codigo = codigoPreferido || generateCode();
    state.partida = { codigo, estado: 'inscripcion', rondaActual: 0 };
    eventEmitter.emit('partidaCreada', { codigo });

    if (prisma) {
      try {
        await prisma.partida.upsert({
          where: { codigo },
          update: { estado: 'inscripcion', rondaActual: 0 },
          create: { codigo, estado: 'inscripcion' },
        });
      } catch (_) {}
    }
    return codigo;
  }

  return {
    // Debug/estado
    getEstado() {
      return {
        partida: { ...state.partida },
        totalPlayers: Object.keys(players).length,
      };
    },

    /** Inicializa/garantiza el código de partida (recomendado: usar el partidaId como código). */
    ensurePartida(codigo) {
      return ensureCodigo(codigo);
    },

    /** (Conveniencia) Obtiene el código actual de la partida. */
    getCodigoPartida() {
      return state.partida.codigo || null;
    },

    // Inscripción (útil si quieres usar esta capa para alta/baja)
    crearPartida(codigo) {
      return this.ensurePartida(codigo);
    },

    unirsePartida({ nombre, esBot = false }) {
      eventEmitter.emit('jugadorUnido', { nombre, esBot });

      if (prisma && state.partida.codigo) {
        prisma.partida.findUnique({ where: { codigo: state.partida.codigo } })
          .then((p) => {
            if (!p) return;
            return prisma.jugador.create({
              data: { nombre, esBot, budget: 0, partidaId: p.id },
            });
          })
          .catch(() => {});
      }
      return { nombre, esBot };
    },

    marcarListo(ref, ready = true) {
      const p = players[ref]
        || Object.values(players).find(x =>
          x?.nombreEmpresa === ref || x?.nombre === ref);

      if (p) {
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

    async registrarDecision({ id, decision }) {
      const p = players[id];
      if (!p) throw new Error('Jugador no existe');
      p.gameState.decisions = p.gameState.decisions || [];
      p.gameState.decisions.push(decision);
      eventEmitter.emit('decisionRegistrada', { jugador: p.nombre || p.nombreEmpresa, decision });
      return true;
    },

    // ===== Persistencia JSON segura (Prisma) =====
    async guardarDecision({ nombre, decision }) {
      try {
        if (!prisma) return false;

        // Asegura código de partida antes de persistir (si no estaba)
        await ensureCodigo();

        const partida = await prisma.partida.findUnique({
          where: { codigo: state.partida.codigo }
        });
        if (!partida) return false;

        let jugador = await prisma.jugador.findFirst({
          where: { partidaId: partida.id, nombre }
        });
        if (!jugador) {
          // Si existe en memoria y es bot, úsalo; si no, asume humano
          const esBot = !!Object.values(players).find(p =>
            (p.nombreEmpresa === nombre || p.nombre === nombre) && p.esBot);

          jugador = await prisma.jugador.create({
            data: { nombre, esBot, budget: 0, partidaId: partida.id }
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
      } catch (e) {
        console.error('[DB] Error guardando Decision:', e);
        return false;
      }
    },

    async guardarResultadosRonda({ rondaNumero, data }) {
      try {
        if (!prisma) return false;

        // Asegura código de partida antes de persistir (si no estaba)
        await ensureCodigo();

        const partida = await prisma.partida.findUnique({
          where: { codigo: state.partida.codigo }
        });
        if (!partida) return false;

        let ronda = await prisma.ronda.findFirst({
          where: { partidaId: partida.id, numero: rondaNumero }
        });
        if (!ronda) {
          ronda = await prisma.ronda.create({
            data: { numero: rondaNumero, partidaId: partida.id }
          });
        }

        await prisma.resultadoRonda.upsert({
          where: {
            resultado_unico_por_ronda: {
              partidaId: partida.id,
              rondaId: ronda.id
            }
          },
          update: { data },
          create: { partidaId: partida.id, rondaId: ronda.id, data }
        });

        return true;
      } catch (e) {
        console.error('[DB] Error guardando ResultadoRonda:', e);
        return false;
      }
    },

    // Cierra ronda invocando tu motor y publicando eventos
    async cerrarRonda() {
      // ★ Pasa meta con partidaId para emitir también el evento namespaced
      await iniciarCalculos(players, marketData, { partidaId: state.partida.codigo });

      const ronda = ++state.partida.rondaActual;

      if (prisma && state.partida.codigo) {
        try {
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
        } catch (_) {}
      }

      const snapResultados = JSON.parse(JSON.stringify(resultados || {}));
      const snapHistory   = JSON.parse(JSON.stringify(roundsHistory || {}));
      eventEmitter.emit('resultadosPublicados', { ronda });

      return { ronda, resultados: snapResultados, history: snapHistory };
    },
  };
}

module.exports = { createGameService };
