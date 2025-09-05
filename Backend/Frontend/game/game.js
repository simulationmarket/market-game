document.addEventListener('DOMContentLoaded', () => {
  const socket = io({
  transports: ['websocket'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});
  window.socket = socket;

  // === Multi-partida: obtenemos y guardamos partidaId ===
  const params = new URLSearchParams(location.search);
  let partidaId = params.get('partidaId') || localStorage.getItem('partidaId') || 'default';
  localStorage.setItem('partidaId', partidaId);

  // Jugador (nombre desde localStorage o query)
  let playerName = localStorage.getItem('playerName') || params.get('playerName') || '';

  // ÚNETE A LA SALA ANTES DE NADA
  socket.emit('joinGame', { partidaId, nombre: playerName || null });

  // Si tenemos nombre, identifícate
  if (playerName) {
    socket.emit('identificarJugador', playerName);
    console.log(`Jugador reconectado: ${playerName}`);
  }

  // Pide datos de mercado de ESTA partida (si el cliente los usa)
  socket.emit('getMarketData', { partidaId });

  // Exponer helper global para navegación preservando partidaId y playerName
  window.navigateTo = function (path) {
    const base = new URL(path, location.href);
    base.searchParams.set('partidaId', partidaId);
    if (playerName) base.searchParams.set('playerName', playerName);
    location.href = base.pathname + '?' + base.searchParams.toString();
  };

  // ====== Overlays inicialización ======
  if (window.Overlay?.init) Overlay.init({ overlayId: 'resultadosOverlay', contentId: 'resultadosContent' });
  if (window.FinalOverlay?.init) FinalOverlay.init({ overlayId: 'finalOverlay', contentId: 'finalContent' });

  // ====== Estado UI / jugador ======
  let budget = 0;
  let reserves = 0;
  let loans = [];
  let round = 0;
  let products = [];
  let canalesDistribucion = { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 };

  let lastRoundOverlayShown = -1;      // última ronda mostrada en overlay
  let showOverlayPendingForRound = -1; // ronda pendiente de mostrar (cuando consolide)

  const confirmationDialog = document.getElementById('confirmationDialog');
  const waitingForOthersScreen = document.getElementById('waitingForOthersScreen');
  const calculatingResultsScreen = document.getElementById('calculatingResultsScreen');
  const rondaElement = document.getElementById('ronda');
  const navButtons = document.querySelectorAll('.sidebar button');

  const disableNavigation = () => {
    navButtons.forEach(button => button.classList.add('disabled'));
    document.getElementById('submit_decisions').disabled = true;
    document.getElementById('addReserve').disabled = true;
    document.getElementById('removeReserve').disabled = true;

    const mainContent = document.querySelector(".main-content");
    const sidebar = document.querySelector(".sidebar");
    if (mainContent) mainContent.classList.add('disabled');
    if (sidebar) sidebar.classList.add('disabled');
  };

  const enableNavigation = () => {
    navButtons.forEach(button => button.classList.remove('disabled'));
    document.getElementById('submit_decisions').disabled = false;
    document.getElementById('addReserve').disabled = false;
    document.getElementById('removeReserve').disabled = false;

    const mainContent = document.querySelector(".main-content");
    const sidebar = document.querySelector(".sidebar");
    if (mainContent) mainContent.classList.remove('disabled');
    if (sidebar) sidebar.classList.remove('disabled');
  };

  // ====== Sincronización inicial ======
  socket.on("syncPlayerData", (data) => {
    console.log("Datos iniciales sincronizados:", data);
    budget  = data.budget  !== undefined ? data.budget  : budget;
    reserves= data.reserves!== undefined ? data.reserves: reserves;
    loans   = data.loans   !== undefined ? data.loans   : loans;
    if (data.round !== undefined) round = data.round;

    products = data.products || [];
    canalesDistribucion = data.canalesDistribucion || { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 };

    rondaElement.textContent = `Ronda: ${round}`;
    updateDisplay();

    // 🔓 Re-activar navegación cuando recibimos estado fresco
    calculatingResultsScreen.classList.add("hidden");
    waitingForOthersScreen.classList.add("hidden");
    enableNavigation();
  });

  // ====== Fin de partida ======
  socket.on('gameEnded', (payload) => {
    console.log('🏁 Partida finalizada', payload);

    if (typeof disableNavigation === 'function') disableNavigation();
    if (window.Overlay && Overlay.hide) Overlay.hide();

    if (window.FinalOverlay?.render) FinalOverlay.render(payload);

    socket.emit('solicitarEstadosJugadores');
    socket.once('todosLosEstados', (estados) => {
      const rIndex = getLastClosedRoundIndex(estados);
      if (window.FinalOverlay?.injectResults && rIndex >= 0) {
        FinalOverlay.injectResults(estados, rIndex);
      }
    });
  });

  // ====== Siguiente ronda ======
  socket.on('iniciarSiguienteRonda', ({ round: nuevaRonda }) => {
    console.log("✅ 'iniciarSiguienteRonda' con round:", nuevaRonda);

    round = nuevaRonda;
    rondaElement.innerText = `Ronda: ${round}`;

    waitingForOthersScreen.classList.add('hidden');
    calculatingResultsScreen.classList.add('hidden');
    enableNavigation();

    const resultsRoundToShow = (nuevaRonda - 1);
    if (resultsRoundToShow >= 0 && resultsRoundToShow > lastRoundOverlayShown && playerName) {
      showOverlayPendingForRound = resultsRoundToShow;
      socket.emit('solicitarEstadosJugadores');
    }
  });

  // ====== Botón enviar decisiones ======
  document.getElementById('submit_decisions').addEventListener('click', () => {
    console.log("Confirmación de decisiones mostrada.");
    confirmationDialog.classList.remove('hidden');
  });

  document.getElementById('confirmSubmit').addEventListener('click', () => {
    if (budget < 0) {
      alert("No puedes enviar decisiones con un presupuesto negativo.");
      console.error("Intento de enviar decisiones con presupuesto negativo:", budget);
      return;
    }

    confirmationDialog.classList.add('hidden');
    waitingForOthersScreen.classList.remove('hidden');
    disableNavigation();

    const playerData = {
      playerName,
      products,
      canalesDistribucion,
    };

    console.log("Enviando playerReadyForNextRound:", playerData);
    socket.emit('playerReadyForNextRound', playerData);
  });

  document.getElementById('cancelSubmit').addEventListener('click', () => {
    confirmationDialog.classList.add('hidden');
    console.log("Envío de decisiones cancelado.");
  });

  socket.on('allPlayersReady', () => {
    console.log("Todos los jugadores están listos, comenzando el cálculo de resultados...");
    waitingForOthersScreen.classList.add('hidden');
    calculatingResultsScreen.classList.remove('hidden');
  });

  // ====== Presupuesto / reservas ======
  const updateDisplay = () => {
    const budgetElement = document.getElementById('budgetAmount');
    const reservesElement = document.getElementById('reservesAmount');

    budgetElement.innerText = formatCurrency(budget);
    reservesElement.innerText = formatCurrency(reserves);

    if (budget < 0) {
      budgetElement.classList.remove('positive');
      budgetElement.classList.add('negative');
    } else {
      budgetElement.classList.remove('negative');
      budgetElement.classList.add('positive');
    }
  };

  const formatCurrency = (amount) =>
    (Number(amount) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  document.getElementById('removeReserve').addEventListener('click', () => {
    const cantidadQuitar = parseFloat(prompt("Introduce la cantidad que deseas quitar de las reservas:"));
    if (isNaN(cantidadQuitar) || cantidadQuitar <= 0) {
      alert("Por favor, introduce una cantidad válida para quitar.");
      return;
    }

    const cuotasTotales = calcularCuotasTotales();
    const reservasMinimasPermitidas = cuotasTotales * 3;

    if ((reserves - cantidadQuitar) < reservasMinimasPermitidas) {
      alert(`No puedes reducir las reservas por debajo de 3 cuotas de tus préstamos. Reservas mínimas permitidas: ${formatCurrency(reservasMinimasPermitidas)}.`);
      return;
    }

    reserves -= cantidadQuitar;
    budget += cantidadQuitar;
    updateDisplay();
    syncWithServer();
  });

  document.getElementById('addReserve').addEventListener('click', () => {
    const cantidadAñadir = parseFloat(prompt("Introduce la cantidad que deseas añadir a las reservas:"));
    if (isNaN(cantidadAñadir) || cantidadAñadir <= 0) {
      alert("Por favor, introduce una cantidad válida para añadir.");
      return;
    }
    reserves += cantidadAñadir;
    budget -= cantidadAñadir;
    updateDisplay();
    syncWithServer();
  });

  const calcularCuotasTotales = () =>
    loans.reduce((total, loan) => total + (loan.totalPerRound || 0), 0);

  const syncWithServer = () => {
    const playerData = {
      budget,
      reserves,
      loans,
      // products / projects si los quieres persistir aquí también
    };
    console.log(`Sincronizando datos con el servidor:`, playerData);
    socket.emit("updatePlayerData", { playerName, playerData });
  };

  // ====== Overlay de resultados por ronda ======
  const resultadosOverlay = document.getElementById("resultadosOverlay");
  const resultadosContent = document.getElementById("resultadosContent");
  const closeResultados = document.getElementById("closeResultados");

  if (closeResultados) {
    closeResultados.addEventListener("click", () => {
      resultadosOverlay.classList.add("hidden");
    });
  }

  function renderResultadosSimple(data) {
    if (!resultadosOverlay || !resultadosContent) return;
    const fmt = (n) => (Number(n)||0).toLocaleString('es-ES', { style:'currency', currency:'EUR' });
    resultadosContent.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        <div style="background:#0f0f18;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
          <div style="opacity:.8;font-size:12px;">Facturación Neta</div>
          <div style="font-size:20px;font-weight:800;">${fmt(data.facturacionNeta)}</div>
        </div>
        <div style="background:#0f0f18;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
          <div style="opacity:.8;font-size:12px;">Margen Bruto</div>
          <div style="font-size:20px;font-weight:800;">${fmt(data.margenBruto)}</div>
        </div>
        <div style="background:#0f0f18;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
          <div style="opacity:.8;font-size:12px;">BAII</div>
          <div style="font-size:20px;font-weight:800;">${fmt(data.baii)}</div>
        </div>
        <div style="background:#0f0f18;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px;">
          <div style="opacity:.8;font-size:12px;">Resultado Neto</div>
          <div style="font-size:20px;font-weight:800;">${fmt(data.resultadoNeto)}</div>
        </div>
      </div>`;
    resultadosOverlay.classList.remove("hidden");
  }

  // Índice de última ronda consolidada (helper único, evitamos duplicados)
  const getLastClosedRoundIndex = (estados = []) => {
    if (!Array.isArray(estados) || estados.length === 0) return -1;
    const maxLen = estados.reduce((m, e) => {
      const len = Array.isArray(e.roundsHistory) ? e.roundsHistory.length : 0;
      return Math.max(m, len);
    }, 0);
    return Math.max(-1, maxLen - 1);
  };

  socket.on("actualizarCuentaResultados", (roundsHistory = [], payload = {}) => {
    console.log("📩 actualizarCuentaResultados",
      { roundsHistory, payload, showOverlayPendingForRound, lastRoundOverlayShown }
    );
    const closedRounds = Array.isArray(roundsHistory) ? roundsHistory.length : 0;
    const shouldShow =
      showOverlayPendingForRound >= 0 &&
      closedRounds >= (showOverlayPendingForRound + 1) &&
      showOverlayPendingForRound > lastRoundOverlayShown;

    if (shouldShow) {
      socket.emit('solicitarEstadosJugadores');
    } else {
      console.log("⏭️ Respuesta ignorada (no toca aún):", {
        closedRounds, showOverlayPendingForRound, lastRoundOverlayShown
      });
    }
  });

  socket.on('todosLosEstados', (estados = []) => {
    console.log("📩 todosLosEstados", {len: estados.length, showOverlayPendingForRound, lastRoundOverlayShown});

    const closedIndex = getLastClosedRoundIndex(estados);
    if (closedIndex < 0) {
      console.log("⏳ Aún no hay ninguna ronda cerrada consolidada.");
      return;
    }

    const rIndex = Math.min(
      (typeof showOverlayPendingForRound === 'number' ? showOverlayPendingForRound : closedIndex),
      closedIndex
    );

    if (rIndex <= lastRoundOverlayShown) return;

    if (Array.isArray(estados) && estados.length > 0) {
      if (window.Overlay?.renderResultados) {
        Overlay.renderResultados(estados, rIndex);
      } else if (estados[0]?.roundsHistory?.[rIndex]) {
        // fallback muy simple
        renderResultadosSimple(estados[0].roundsHistory[rIndex]);
      }
      lastRoundOverlayShown = rIndex;
      showOverlayPendingForRound = -1;
    }
  });

});
