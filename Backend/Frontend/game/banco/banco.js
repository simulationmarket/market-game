// /Frontend/game/banco/banco.js

document.addEventListener("DOMContentLoaded", () => {
  const socket = io({ transports: ['websocket'], withCredentials: true, reconnection: true, reconnectionAttempts: 5, timeout: 20000 });;

  // === Multi-partida: obtener y preservar partidaId + playerName ===
  const params = new URLSearchParams(location.search);
  const partidaId = params.get("partidaId") || localStorage.getItem("partidaId") || "default";
  const playerName = localStorage.getItem("playerName") || params.get("playerName") || "";

  // Unirse a la sala ANTES de cualquier otra acción
  socket.emit("joinGame", { partidaId, nombre: playerName || null });

  // Identificarse (si tenemos nombre guardado)
  if (playerName) {
    socket.emit("identificarJugador", playerName);
  }

  // ====== UI: Volver a game.html preservando partidaId y playerName ======
  document.getElementById("back-button").addEventListener("click", () => {
    const url = new URL("../game.html", location.href);
    url.searchParams.set("partidaId", partidaId);
    if (playerName) url.searchParams.set("playerName", playerName);
    location.href = url.pathname + "?" + url.searchParams.toString();
  });

  // ====== Elementos HTML ======
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
  let projects = []; // ya lo usabas en sync

  // ====== Utilidades ======
  const formatCurrency = (n) =>
    (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  function updateDisplay() {
    budgetElement.textContent = formatCurrency(budget);
    reservesElement.textContent = formatCurrency(reserves);
  }

  function parseLoanAmount() {
    const amount = parseFloat(loanAmountInput.value);
    return isNaN(amount) || amount <= 0 ? null : amount;
  }

  function syncWithServer() {
    const playerData = { budget, reserves, loans, projects };
    socket.emit("updatePlayerData", { playerName, playerData });
  }

  // ====== Sincronización inicial desde servidor ======
  socket.on("syncPlayerData", (data) => {
    budget   = data.budget   ?? 0;
    reserves = data.reserves ?? 0;
    loans    = data.loans    ?? [];
    projects = data.projects ?? [];

    updateDisplay();
    renderLoans();
  });

  // ====== Cálculo de préstamo (preview) ======
  function updateCalculations() {
    const loanAmount = parseLoanAmount();
    const loanTerm = parseInt(loanTermInput.value, 10);

    if (loanAmount !== null && !isNaN(loanTerm) && loanTerm > 0) {
      const interestRate = loanTerm <= 3 ? 0.06 : 0.06 + (loanTerm - 3) * 0.017;
      const amortizationPerRound = loanAmount / loanTerm;
      const interestPerRound = amortizationPerRound * interestRate;
      const totalPerRound = amortizationPerRound + interestPerRound;

      interestRateElement.innerText = (interestRate * 100).toFixed(2) + " %";
      amortizationElement.innerText = formatCurrency(amortizationPerRound);
      interestPerRoundElement.innerText = formatCurrency(interestPerRound);
      totalPerRoundElement.innerText = formatCurrency(totalPerRound);
    } else {
      interestRateElement.innerText = "0 %";
      amortizationElement.innerText = "0 €";
      interestPerRoundElement.innerText = "0 €";
      totalPerRoundElement.innerText = "0 €";
    }
  }

  loanAmountInput.addEventListener("input", updateCalculations);
  loanTermInput.addEventListener("input", updateCalculations);

  // ====== Solicitar préstamo ======
  document.getElementById("request-loan-button").addEventListener("click", () => {
    const loanAmount = parseLoanAmount();
    const loanTerm = parseInt(loanTermInput.value, 10);

    if (loanAmount === null || isNaN(loanTerm) || loanTerm <= 0) {
      alert("Introduce valores válidos.");
      return;
    }

    // Nota: Mantengo tus fórmulas originales para el interés efectivo del préstamo
    const interestRate = loanTerm <= 3 ? 0.06 : 0.06 + (loanTerm - 3) * 0.0075;
    const amortizationPerRound = loanAmount / loanTerm;
    const interestPerRound = amortizationPerRound * interestRate;
    const totalPerRound = amortizationPerRound + interestPerRound;

    const totalCurrentLoansPerRound = loans.reduce((sum, loan) => sum + (loan.totalPerRound || 0), 0);
    const minimumReservesRequired = (totalCurrentLoansPerRound + totalPerRound) * 3;

    if (reserves < minimumReservesRequired) {
      alert(`No tienes suficientes reservas. Necesitas al menos ${formatCurrency(minimumReservesRequired)} en reservas.`);
      return;
    }

    if (confirm(`¿Seguro que quieres solicitar un préstamo de ${formatCurrency(loanAmount)} con un plazo de ${loanTerm} rondas?`)) {
      budget += loanAmount;
      loans.push({
        amount: loanAmount,
        term: loanTerm,
        interestRate,
        totalPerRound,
        remainingRounds: loanTerm
      });

      updateDisplay();
      syncWithServer();
      renderLoans();
    }
  });

  // ====== Render de préstamos ======
  function renderLoans() {
    loansListElement.innerHTML = "";

    loans.forEach((loan, index) => {
      const row = document.createElement("tr");

      const loanAmountCell = document.createElement("td");
      loanAmountCell.textContent = formatCurrency(loan.amount);
      row.appendChild(loanAmountCell);

      const interestRateCell = document.createElement("td");
      interestRateCell.textContent = (loan.interestRate * 100).toFixed(2) + "%";
      row.appendChild(interestRateCell);

      const interestPerRoundCell = document.createElement("td");
      const interestPerRound = (loan.amount / loan.term) * loan.interestRate;
      interestPerRoundCell.textContent = formatCurrency(interestPerRound);
      row.appendChild(interestPerRoundCell);

      const totalPerRoundCell = document.createElement("td");
      totalPerRoundCell.textContent = formatCurrency(loan.totalPerRound);
      row.appendChild(totalPerRoundCell);

      const remainingRoundsCell = document.createElement("td");
      remainingRoundsCell.textContent = `${loan.remainingRounds} rondas`;
      row.appendChild(remainingRoundsCell);

      const actionsCell = document.createElement("td");
      const liquidateButton = document.createElement("button");
      liquidateButton.textContent = "Liquidar";
      liquidateButton.addEventListener("click", () => liquidateLoan(index));
      actionsCell.appendChild(liquidateButton);
      row.appendChild(actionsCell);

      loansListElement.appendChild(row);
    });
  }

  // ====== Liquidar préstamo ======
  function liquidateLoan(index) {
    const loan = loans[index];
    const remainingRounds = loan.remainingRounds;
    const penalty = 0.02; // 2%

    const totalToPay = loan.totalPerRound * remainingRounds * (1 + penalty);

    if (confirm(`¿Seguro que quieres liquidar este préstamo por valor de ${formatCurrency(totalToPay)}?`)) {
      if (budget >= totalToPay) {
        budget -= totalToPay;
        loans.splice(index, 1);

        updateDisplay();
        syncWithServer();
        renderLoans();
      } else {
        const falta = totalToPay - budget;
        alert(`No tienes suficiente presupuesto. Te faltan ${formatCurrency(falta)}.`);
      }
    }
  }
});
