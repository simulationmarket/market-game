document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
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

    console.log("➡️ Actualizado rondaElement:", rondaElement.innerText);

    waitingForOthersScreen.classList.add('hidden');
    calculatingResultsScreen.classList.add('hidden');
    enableNavigation();
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
    
       
}); // Fin del bloque document.addEventListener
