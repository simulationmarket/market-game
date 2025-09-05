document.addEventListener('DOMContentLoaded', function () {
  // Si está embebido, recibe datos por postMessage; si no, usa socket (compat)
  const isIframe = window.self !== window.top;
  let playerName = null;
  let roundsHistory = [];

  if (isIframe) {
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      const { type } = data;

      // Soporta mensajes SYNC / RESULTADOS_COMPLETOS y legacy
      if (!type) {
        const { playerName: pn, roundsHistory: rh } = data;
        if (pn) playerName = pn;
        if (Array.isArray(rh)) roundsHistory = rh;
        render();
        return;
      }
      if (type === 'SYNC') {
        const { playerName: pn, roundsHistory: rh } = data;
        if (pn) playerName = pn;
        if (Array.isArray(rh)) roundsHistory = rh;
        render();
        return;
      }
      if (type === 'RESULTADOS_COMPLETOS') {
        const { playerName: pn, roundsHistory: rh } = data;
        if (pn) playerName = pn;
        if (Array.isArray(rh)) roundsHistory = rh;
        render();
        return;
      }
    });
  } else {
    // Fallback fuera de iframe (poco común en tu flujo)
    const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],  // ✅ permite fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});
    playerName = localStorage.getItem("playerName");
    if (!playerName) {
      alert("No se ha encontrado el nombre del jugador. Redirigiendo al inicio.");
      window.location.href = "index.html";
      return;
    }
    socket.emit("identificarJugador", playerName);
    socket.on("syncPlayerData", (data) => {
      if (data && Array.isArray(data.roundsHistory)) {
        roundsHistory = data.roundsHistory;
        render();
      }
    });
  }

  function render() {
    if (!Array.isArray(roundsHistory) || roundsHistory.length === 0) return;
    generarEstructuraTabla(roundsHistory);
    actualizarTabla(roundsHistory);
    actualizarGrafico(roundsHistory);
  }

  function formatPartidaName(partida) {
    const formatted = partida.replace(/([a-z])([A-Z])/g, "$1 $2");
    return formatted
      .split(" ")
      .map(word => {
        if (["baii", "bai"].includes(word.toLowerCase())) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  function generarEstructuraTabla(roundsHistory) {
    const tableHeader = document.getElementById("header-row");
    const tableBody = document.getElementById("results-body");

    tableHeader.innerHTML = "<th>Partida</th>";
    tableBody.innerHTML = "";

    // Encabezados: R1..Rn (en tu versión salía R0)
    roundsHistory.forEach((_, idx) => {
      const th = document.createElement("th");
      th.textContent = `R${idx + 1}`;
      tableHeader.appendChild(th);
    });

    const partidas = [
      "facturacionBruta",
      "devoluciones",
      "facturacionNeta",
      "costeVentas",
      "margenBruto",
      "gastosOperativos",
      "gastosPublicidad",
      "gastosComerciales",
      "costeAlmacenaje",
      "baii",
      "gastosFinancieros",
      "bai",
      "impuestos",
      "resultadoNeto",
    ];

    const partidasImportantes = [
      "facturacionBruta", "facturacionNeta", "margenBruto", "gastosOperativos", "baii", "bai", "resultadoNeto",
    ];
    const partidasSuma = ["facturacionBruta", "facturacionNeta", "margenBruto", "baii", "bai", "resultadoNeto"];
    const partidasResta = ["devoluciones","costeVentas","gastosPublicidad","gastosOperativos","gastosComerciales","costeAlmacenaje","gastosFinancieros","impuestos"];

    partidas.forEach(partida => {
      const row = document.createElement("tr");
      const partidaCell = document.createElement("td");
      partidaCell.textContent = formatPartidaName(partida);
      if (partidasImportantes.includes(partida)) {
        partidaCell.style.fontWeight = "bold";
        partidaCell.style.color = "black";
      } else {
        partidaCell.style.color = "black";
      }
      row.appendChild(partidaCell);

      roundsHistory.forEach((_, idx) => {
        const cell = document.createElement("td");
        cell.id = `${partida}-r${idx}`;
        cell.textContent = "0";

        if (partidasSuma.includes(partida)) cell.style.color = "green";
        else if (partidasResta.includes(partida)) cell.style.color = "red";
        if (partidasImportantes.includes(partida)) cell.style.fontWeight = "bold";

        row.appendChild(cell);
      });

      tableBody.appendChild(row);
    });
  }

  function actualizarTabla(roundsHistory) {
    roundsHistory.forEach((datos, idx) => {
      const partidas = [
        "facturacionBruta",
        "devoluciones",
        "facturacionNeta",
        "costeVentas",
        "margenBruto",
        "gastosOperativos",
        "gastosPublicidad",
        "gastosComerciales",
        "costeAlmacenaje",
        "baii",
        "gastosFinancieros",
        "bai",
        "impuestos",
        "resultadoNeto",
      ];

      partidas.forEach(partida => {
        const cell = document.getElementById(`${partida}-r${idx}`);
        if (!cell) return;

        let valor = Number(datos[partida] || 0);

        // gastosPublicidad = suma de presupuestoPublicidad de products en decisiones
        if (partida === "gastosPublicidad") {
          valor = 0;
          if (datos.decisiones && Array.isArray(datos.decisiones.products)) {
            valor = datos.decisiones.products.reduce((acc, p) => acc + (Number(p.presupuestoPublicidad) || 0), 0);
          }
        }

        cell.textContent = Number(valor).toLocaleString("es-ES");
      });
    });
  }

  function actualizarGrafico(roundsHistory) {
    const etiquetas = roundsHistory.map((_, i) => `R${i + 1}`);

    const pct = (num, den) => (den ? ((num / den) * 100).toFixed(2) : 0);

    const costesVentas     = roundsHistory.map(d => pct(d.costeVentas,     d.facturacionNeta));
    const gastosOperativos = roundsHistory.map(d => pct(d.gastosOperativos,d.facturacionNeta));
    const gastosComerciales= roundsHistory.map(d => pct(d.gastosComerciales,d.facturacionNeta));
    const costeAlmacenaje  = roundsHistory.map(d => pct(d.costeAlmacenaje, d.facturacionNeta));
    const gastosFinancieros= roundsHistory.map(d => pct(d.gastosFinancieros,d.facturacionNeta));
    const impuestos        = roundsHistory.map(d => pct(d.impuestos,       d.facturacionNeta));
    const resultadoNeto    = roundsHistory.map(d => pct(d.resultadoNeto,   d.facturacionNeta));

    const ctx = document.getElementById('gastosPorcentajeChart').getContext('2d');
    if (window.financialChart) window.financialChart.destroy();

    window.financialChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [
          { label: 'Costes de Ventas',     data: costesVentas,      backgroundColor: 'rgba(54, 162, 235, 0.7)',  borderColor: 'rgba(54, 162, 235, 1)',  borderWidth: 1 },
          { label: 'Gastos Operativos',    data: gastosOperativos,  backgroundColor: 'rgba(75, 192, 192, 0.7)',  borderColor: 'rgba(75, 192, 192, 1)',  borderWidth: 1 },
          { label: 'Gastos Comerciales',   data: gastosComerciales, backgroundColor: 'rgba(200, 200, 200, 0.7)', borderColor: 'rgba(200, 200, 200, 1)', borderWidth: 1 },
          { label: 'Almacenaje',           data: costeAlmacenaje,   backgroundColor: 'rgba(150, 150, 255, 0.7)', borderColor: 'rgba(150, 150, 255, 1)', borderWidth: 1 },
          { label: 'Gastos Financieros',   data: gastosFinancieros, backgroundColor: 'rgba(255, 99, 132, 0.7)',  borderColor: 'rgba(255, 99, 132, 1)',  borderWidth: 1 },
          { label: 'Impuestos',            data: impuestos,         backgroundColor: 'rgba(102, 255, 102, 0.7)', borderColor: 'rgba(102, 255, 102, 1)', borderWidth: 1 },
          { label: 'Resultado Neto',       data: resultadoNeto,     backgroundColor: 'rgba(255, 159, 64, 0.7)',  borderColor: 'rgba(255, 159, 64, 1)',  borderWidth: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, title: { display: true, text: 'Rondas', color: '#ffffff', font: { size: 16, weight: 'bold' } }, ticks: { color: '#ffffff' }, grid: { color: 'rgba(255,255,255,0.2)' } },
          y: { stacked: true, title: { display: true, text: 'Porcentaje (%)', color: '#ffffff', font: { size: 16, weight: 'bold' } }, ticks: { color: '#ffffff', callback: v => `${v}%` }, grid: { color: 'rgba(255,255,255,0.2)' } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: '#ffffff', font: { size: 14 } } },
          tooltip: { callbacks: { title: (items) => items[0].dataset.label, label: (item) => `${item.raw}%` } },
        },
        layout: { padding: { top: 20, bottom: 10, left: 20, right: 20 } },
      },
    });

    const parent = document.getElementById('gastosPorcentajeChart').parentElement;
    parent.style.backgroundColor = '#333';
    parent.style.borderRadius = '10px';
  }
});
