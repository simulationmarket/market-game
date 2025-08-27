// Función para redirigir a la pantalla game
function volver() {
    window.location.href = "../game.html";  // Asegúrate de que la ruta sea correcta según tu estructura de carpetas
}

document.addEventListener("DOMContentLoaded", () => {
    const socket = io();


 // Asignar la función volver al botón "Volver"
    document.getElementById("back-button").addEventListener("click", () => {
        window.location.href = "../game.html";  // Ajusta la ruta según la estructura de tus carpetas
    });

    // Elementos HTML
    const budgetElement = document.getElementById("budgetAmount");
    const reservesElement = document.getElementById("reservesAmount");
    const loanAmountInput = document.getElementById("loan-amount");
    const loanTermInput = document.getElementById("loan-term");
    const interestRateElement = document.getElementById("interest-rate");
    const amortizationElement = document.getElementById("amortization-per-round");
    const interestPerRoundElement = document.getElementById("interest-per-round");
    const totalPerRoundElement = document.getElementById("total-per-round");
    const loansListElement = document.querySelector("#loans-list");

    let budget = 0;
    let reserves = 0;
    let loans = [];
    let projects = [];  // Añadir esta línea para los proyectos

    // Función para analizar y convertir el monto del préstamo
    function parseLoanAmount() {
        const amount = parseFloat(loanAmountInput.value);
        return isNaN(amount) || amount <= 0 ? null : amount;
    }

    // Función para sincronizar los datos del jugador con el servidor
    function syncWithServer() {
    const playerData = { budget, reserves, loans, projects };  // Añadir "projects" aquí
    socket.emit("updatePlayerData", { playerName: localStorage.getItem("playerName"), playerData });
}


    // Función para actualizar el presupuesto y las reservas en la pantalla
    function updateDisplay() {
        budgetElement.textContent = budget.toLocaleString('es-ES') + " €";
        reservesElement.textContent = reserves.toLocaleString('es-ES') + " €";
    }

    // Función para manejar la recepción de datos desde el servidor
    socket.emit("identificarJugador", localStorage.getItem("playerName"));
    socket.on("syncPlayerData", (data) => {
    budget = data.budget || 0;
    reserves = data.reserves || 0;
    loans = data.loans || [];
    projects = data.projects || [];  // Añadir "projects" aquí para actualizar el estado

    updateDisplay();  // Actualizar la interfaz con los datos
    renderLoans();    // Mostrar los préstamos en la interfaz
});

    // Función para actualizar los cálculos de préstamos
    function updateCalculations() {
        const loanAmount = parseLoanAmount();
        const loanTerm = parseInt(loanTermInput.value);

        if (loanAmount !== null && !isNaN(loanTerm) && loanTerm > 0) {
            const interestRate = loanTerm <= 3 ? 0.06 : 0.06 + (loanTerm - 3) * 0.017;
            const amortizationPerRound = loanAmount / loanTerm;
            const interestPerRound = amortizationPerRound * interestRate;
            const totalPerRound = amortizationPerRound + interestPerRound;

            // Actualizar en la pantalla
            interestRateElement.innerText = (interestRate * 100).toFixed(2) + " %";
            amortizationElement.innerText = amortizationPerRound.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            interestPerRoundElement.innerText = interestPerRound.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            totalPerRoundElement.innerText = totalPerRound.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        } else {
            // Limpiar los campos si no hay valores válidos
            interestRateElement.innerText = "0 %";
            amortizationElement.innerText = "0 €";
            interestPerRoundElement.innerText = "0 €";
            totalPerRoundElement.innerText = "0 €";
        }
    }

    // Vincular eventos de entrada para recalcular en tiempo real
    loanAmountInput.addEventListener("input", updateCalculations);
    loanTermInput.addEventListener("input", updateCalculations);

    // Solicitar préstamo
    document.getElementById("request-loan-button").addEventListener("click", () => {
        const loanAmount = parseLoanAmount();
        const loanTerm = parseInt(loanTermInput.value);

        if (loanAmount === null || isNaN(loanTerm)) {
            alert("Introduce valores válidos.");
            return;
        }

        // Cálculo de la tasa de interés
        const interestRate = loanTerm <= 3 ? 0.06 : 0.06 + (loanTerm - 3) * 0.0075;
        const amortizationPerRound = loanAmount / loanTerm;
        const interestPerRound = amortizationPerRound * interestRate;
        const totalPerRound = amortizationPerRound + interestPerRound;

        const totalCurrentLoansPerRound = loans.reduce((sum, loan) => sum + loan.totalPerRound, 0);
        const minimumReservesRequired = (totalCurrentLoansPerRound + totalPerRound) * 3;

        if (reserves < minimumReservesRequired) {
            alert(`No tienes suficientes reservas. Necesitas al menos ${minimumReservesRequired.toLocaleString('es-ES')} € en reservas.`);
            return;
        }

        // Confirmación del préstamo
        if (confirm(`¿Seguro que quieres solicitar un préstamo de ${loanAmount.toLocaleString('es-ES')} € con un plazo de ${loanTerm} rondas?`)) {
            // Actualizar el presupuesto y añadir el préstamo
            budget += loanAmount;
            loans.push({
                amount: loanAmount,
                term: loanTerm,
                interestRate,
                totalPerRound,
                remainingRounds: loanTerm
            });

            updateDisplay();  // Actualizar la pantalla
            syncWithServer(); // Sincronizar con el servidor
            renderLoans();    // Mostrar los préstamos en la tabla
        }
    });

    // Mostrar préstamos activos
    function renderLoans() {
        loansListElement.innerHTML = "";  // Limpiar la lista de préstamos

        loans.forEach((loan, index) => {
            const row = document.createElement("tr");

            // Celdas para mostrar la información del préstamo
            const loanAmountCell = document.createElement("td");
            loanAmountCell.textContent = loan.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            row.appendChild(loanAmountCell);

            const interestRateCell = document.createElement("td");
            interestRateCell.textContent = (loan.interestRate * 100).toFixed(2) + "%";
            row.appendChild(interestRateCell);

            const interestPerRoundCell = document.createElement("td");
            interestPerRoundCell.textContent = (loan.amount / loan.term * loan.interestRate).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            row.appendChild(interestPerRoundCell);

            const totalPerRoundCell = document.createElement("td");
            totalPerRoundCell.textContent = loan.totalPerRound.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            row.appendChild(totalPerRoundCell);

            const remainingRoundsCell = document.createElement("td");
            remainingRoundsCell.textContent = loan.remainingRounds + " rondas";
            row.appendChild(remainingRoundsCell);

            // Botón para liquidar el préstamo
            const actionsCell = document.createElement("td");
            const liquidateButton = document.createElement("button");
            liquidateButton.textContent = "Liquidar";
            liquidateButton.addEventListener("click", () => {
                liquidateLoan(index);
            });
            actionsCell.appendChild(liquidateButton);
            row.appendChild(actionsCell);

            loansListElement.appendChild(row);
        });
    }

    // Función para liquidar el préstamo
    function liquidateLoan(index) {
        const loan = loans[index];
        const remainingRounds = loan.remainingRounds;
        const totalPerRound = loan.totalPerRound;
        const penalty = 0.02;  // Penalización del 2%

        // Calcular el monto total a pagar por las rondas restantes + penalización
        const totalToPay = totalPerRound * remainingRounds * (1 + penalty);

        // Confirmar la liquidación
        if (confirm(`¿Seguro que quieres liquidar este préstamo por valor de ${totalToPay.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}?`)) {
            // Verificar si el jugador tiene suficiente presupuesto
            if (budget >= totalToPay) {
                // Restar el total a pagar del presupuesto
                budget -= totalToPay;

                // Eliminar el préstamo de la lista
                loans.splice(index, 1);

                updateDisplay();  // Actualizar la pantalla
                syncWithServer(); // Sincronizar con el servidor
                renderLoans();    // Actualizar la lista de préstamos
            } else {
                alert(`No tienes suficiente presupuesto para liquidar este préstamo. Te faltan ${(totalToPay - budget).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`);
            }
        }
    }
});


