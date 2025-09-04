document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    Overlay.init({ overlayId: 'resultadosOverlay', contentId: 'resultadosContent' });
    FinalOverlay.init({ overlayId: 'finalOverlay', contentId: 'finalContent' });
    socket.on('gameEnded', (payload) => {
  console.log('🏁 Partida finalizada', payload);

  // Desactiva UI y cierra overlay de KPIs si estuviera abierto
  if (typeof disableNavigation === 'function') disableNavigation();
  if (window.Overlay && Overlay.hide) Overlay.hide();

  // Muestra el overlay final (podio 1–4 y botón)
  FinalOverlay.render(payload);

  // Pide los estados y embebe el carrusel de resultados dentro del overlay final
  socket.emit('solicitarEstadosJugadores');
  socket.once('todosLosEstados', (estados) => {
    // Usa el último índice consolidado
    const getLastClosedRoundIndex = (arr=[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return -1;
      const maxLen = arr.reduce((m,e)=> Math.max(m, Array.isArray(e.roundsHistory)? e.roundsHistory.length : 0), 0);
      return Math.max(-1, maxLen - 1);
    };
    const rIndex = getLastClosedRoundIndex(estados);
    FinalOverlay.injectResults(estados, rIndex);
  });
});


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
    // Recuperar el nombre del jugador de localStorage
    let playerName = localStorage.getItem("playerName");

    // Verificar si el jugador está registrado en localStorage
    if (playerName) {
        socket.emit('identificarJugador', playerName);
        console.log(`Jugador reconectado: ${playerName}`);
    }

    let budget = 0;
    let reserves = 0;
    let loans = [];
    let round = 0;
    let products = []; // Aquí se cargarán los productos del jugador
let canalesDistribucion = {
    granDistribucion: 0,
    minoristas: 0,
    online: 0,
    tiendaPropia: 0,
};
    let lastRoundOverlayShown = -1;       // última ronda para la que ya mostramos overlay (histórico)
    let showOverlayPendingForRound = -1;  // ronda cuyos resultados estamos esperando para mostrar
    // Elementos del DOM
    const confirmationDialog = document.getElementById('confirmationDialog');
    const waitingForOthersScreen = document.getElementById('waitingForOthersScreen');
    const calculatingResultsScreen = document.getElementById('calculatingResultsScreen');
    const rondaElement = document.getElementById('ronda');
    const navButtons = document.querySelectorAll('.sidebar button');

    

    // Sincronizar datos iniciales del jugador
    socket.on("syncPlayerData", (data) => {
        console.log("Datos iniciales sincronizados:", data);
        budget = data.budget !== undefined ? data.budget : budget;
        reserves = data.reserves !== undefined ? data.reserves : reserves;
        loans = data.loans !== undefined ? data.loans : loans;
        if (data.round !== undefined ) {
    round = data.round;
}
        // Actualizar productos y canales
    products = data.products || [];
    canalesDistribucion = data.canalesDistribucion || {
        granDistribucion: 0,
        minoristas: 0,
        online: 0,
        tiendaPropia: 0,
    };

        rondaElement.textContent = `Ronda: ${round}`;
        updateDisplay();

            // 🔓 REACTIVAR elementos al sincronizar datos nuevos
    calculatingResultsScreen.classList.add("hidden");
    waitingForOthersScreen.classList.add("hidden");
    enableNavigation();
    });

    socket.on('iniciarSiguienteRonda', ({ round: nuevaRonda }) => {
  console.log("✅ Evento 'iniciarSiguienteRonda' recibido con round:", nuevaRonda);

  round = nuevaRonda;
  rondaElement.innerText = `Ronda: ${round}`;

  waitingForOthersScreen.classList.add('hidden');
  calculatingResultsScreen.classList.add('hidden');
  enableNavigation();

  // Resultados de la ronda que acaba de terminar
  const resultsRoundToShow = (nuevaRonda - 1);

  // 👉 Ahora permitimos 0
  if (resultsRoundToShow >= 0 && resultsRoundToShow > lastRoundOverlayShown && playerName) {
    showOverlayPendingForRound = resultsRoundToShow;

    // Podemos pedir el paquete de estados; si aún no estuviera listo,
    // el handler de "actualizarCuentaResultados" lo volverá a intentar.
    socket.emit('solicitarEstadosJugadores');
  }



});





    

    rondaElement.textContent = `Ronda: ${round}`;

    // Mostrar cuadro de confirmación al hacer clic en "Enviar Decisiones"
    document.getElementById('submit_decisions').addEventListener('click', () => {
        console.log("Confirmación de decisiones mostrada.");
        confirmationDialog.classList.remove('hidden');
    });

    // Confirmar el envío de decisiones
document.getElementById('confirmSubmit').addEventListener('click', () => {
    if (budget < 0) {
        alert("No puedes enviar decisiones con un presupuesto negativo.");
        console.error("Intento de enviar decisiones con presupuesto negativo:", budget);
        return;
    }

    confirmationDialog.classList.add('hidden');
    waitingForOthersScreen.classList.remove('hidden');
    disableNavigation();

     // Asegúrate de incluir los productos y canales actuales
     const playerData = {
        playerName,
        products, // Productos configurados por el jugador
        canalesDistribucion, // Canales configurados
    };

    console.log("Enviando playerReadyForNextRound:", playerData);
    socket.emit('playerReadyForNextRound', playerData);
});

    // Cancelar el envío de decisiones
    document.getElementById('cancelSubmit').addEventListener('click', () => {
        confirmationDialog.classList.add('hidden');
        console.log("Envío de decisiones cancelado.");
    });

    // Cuando todos los jugadores están listos, cambiar a "Calculando resultados"
    socket.on('allPlayersReady', () => {
        console.log("Todos los jugadores están listos, comenzando el cálculo de resultados...");
        waitingForOthersScreen.classList.add('hidden');
        calculatingResultsScreen.classList.remove('hidden');
    });

    

    const updateDisplay = () => {
        const budgetElement = document.getElementById('budgetAmount');
        const reservesElement = document.getElementById('reservesAmount');
    
        // Actualizar los valores de texto
        budgetElement.innerText = formatCurrency(budget);
        reservesElement.innerText = formatCurrency(reserves);
    
        // Cambiar el color del presupuesto según su valor
        if (budget < 0) {
            budgetElement.classList.remove('positive');
            budgetElement.classList.add('negative');
        } else {
            budgetElement.classList.remove('negative');
            budgetElement.classList.add('positive');
        }
    };

    const formatCurrency = (amount) => {
        return amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    };

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

    const calcularCuotasTotales = () => {
        return loans.reduce((total, loan) => total + loan.totalPerRound, 0);
    };

    const syncWithServer = () => {
        const playerData = {
            budget,
            reserves,
            loans,
            // Si tienes `products` y `projects` definidos en el cliente:
            
        };
    
        console.log(`Sincronizando datos con el servidor:`, playerData);
        socket.emit("updatePlayerData", { playerName, playerData });
    };

    const resultadosOverlay = document.getElementById("resultadosOverlay");
const resultadosContent = document.getElementById("resultadosContent");
const closeResultados = document.getElementById("closeResultados");

if (closeResultados) {
  closeResultados.addEventListener("click", () => {
    resultadosOverlay.classList.add("hidden");
  });
}

// Pintar los 4 KPIs en el overlay
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
    </div>
  `;
  resultadosOverlay.classList.remove("hidden");
}

socket.on("actualizarCuentaResultados", (roundsHistory = [], payload = {}) => {
  console.log("📩 actualizarCuentaResultados",
    { roundsHistory, payload, showOverlayPendingForRound, lastRoundOverlayShown }
  );
  // nº de rondas cerradas = longitud del histórico
  const closedRounds = Array.isArray(roundsHistory) ? roundsHistory.length : 0;

  // Debe mostrarse si:
  // - tenemos una ronda pendiente (>= 0)
  // - el histórico ya alcanzó esa ronda (closedRounds >= showOverlayPendingForRound + 1)
  // - y aún no la hemos mostrado
  const shouldShow =
    showOverlayPendingForRound >= 0 &&
    closedRounds >= (showOverlayPendingForRound + 1) &&
    showOverlayPendingForRound > lastRoundOverlayShown;

  if (shouldShow) {
    // Pedimos los estados de todos y pintamos todos al recibirlos
    socket.emit('solicitarEstadosJugadores');
  } else {
    console.log("⏭️ Respuesta ignorada (no toca aún):", {
      closedRounds,
      showOverlayPendingForRound,
      lastRoundOverlayShown
    });
  }
});


function getLastClosedRoundIndex(estados = []) {
  if (!Array.isArray(estados) || estados.length === 0) return -1;
  const maxLen = estados.reduce((m, e) => {
    const len = Array.isArray(e.roundsHistory) ? e.roundsHistory.length : 0;
    return Math.max(m, len);
  }, 0);
  return Math.max(-1, maxLen - 1); // -1 si aún no hay ninguna ronda cerrada
}
// === Pintar KPIs de TODOS los jugadores para la ronda pendiente ===
// Helper (déjalo cerca del listener)
function getLastClosedRoundIndex(estados = []) {
  if (!Array.isArray(estados) || estados.length === 0) return -1;
  const maxLen = estados.reduce((m, e) => Math.max(m, Array.isArray(e.roundsHistory) ? e.roundsHistory.length : 0), 0);
  return Math.max(-1, maxLen - 1);
}

socket.on('todosLosEstados', (estados = []) => {
  console.log("📩 todosLosEstados", {len: estados.length, showOverlayPendingForRound, lastRoundOverlayShown});

  // Índice realmente consolidado (lo que EXISTE en datos)
  const closedIndex = getLastClosedRoundIndex(estados);   // p.ej. 0 al empezar la ronda 1
  if (closedIndex < 0) {
    console.log("⏳ Aún no hay ninguna ronda cerrada consolidada.");
    return;
  }

  // Nunca pintes por delante de lo consolidado:
  const rIndex = Math.min(
    (typeof showOverlayPendingForRound === 'number' ? showOverlayPendingForRound : closedIndex),
    closedIndex
  );

  // Si ya la mostramos, salimos
  if (rIndex <= lastRoundOverlayShown) return;

  // Asegura que VAMOS a pintar a TODOS (no solo a mí)
  if (!Array.isArray(estados) || estados.length === 0) return;

  Overlay.renderResultados(estados, rIndex); // 👈 PASA EL ARRAY COMPLETO + el índice correcto
  lastRoundOverlayShown = rIndex;
  showOverlayPendingForRound = -1;
});




       
}); // Fin del bloque document.addEventListener
