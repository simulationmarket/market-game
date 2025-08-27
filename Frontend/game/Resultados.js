const socket = io();

// Colores fijos para jugadores
const fixedColorMap = {
  jugador1: '#00ffff',  // cyan
  jugador2: '#ff0055',  // rosa neón
  jugador3: '#ffcc00',  // amarillo neón
  jugador4: '#00ff66',  // verde neón
  jugador5: '#aa00ff'   // violeta eléctrico
};

function getColorForPlayer(playerName) {
  if (!fixedColorMap[playerName]) {
    fixedColorMap[playerName] = getRandomColor();
  }
  return fixedColorMap[playerName];
}

const neonPalette = [
  '#00ffff',  // cyan
  '#ff0055',  // rosa neón
  '#ffcc00',  // amarillo neón
  '#00ff66',  // verde neón
  '#aa00ff',  // violeta eléctrico
  '#ff6600',  // naranja neón
  '#00ccff',  // azul cielo neón
  '#ff00cc'   // fucsia neón
];

// Marcar colores ya usados en fixedColorMap
const usedNeonColors = new Set(Object.values(fixedColorMap));

socket.emit('solicitarEstadosJugadores');

socket.on('todosLosEstados', (estados) => {
  console.log("📈 Estados de jugadores recibidos:", estados);

  const jugadores = estados.map(estado => estado.playerName || `Jugador ${estados.indexOf(estado) + 1}`);
  const rondas = ["Ronda 0", ...estados[0]?.roundsHistory.map((_, i) => `Ronda ${i + 1}`) || []];

  const facturacionNetaData = estados.map(e => [0, ...e.roundsHistory.map(r => r.facturacionNeta || 0)]);
  const margenBrutoData = estados.map(e => [0, ...e.roundsHistory.map(r => r.margenBruto || 0)]);
  const baiiData = estados.map(e => [0, ...e.roundsHistory.map(r => r.baii || 0)]);
  const resultadoNetoData = estados.map(e => [0, ...e.roundsHistory.map(r => r.resultadoNeto || 0)]);

  const valorAccionData = estados.map((e, i) => {
    return [0, ...e.roundsHistory.map((r, j) => {
      const fn = facturacionNetaData[i][j + 1] || 0;
      const mb = margenBrutoData[i][j + 1] || 0;
      const ba = baiiData[i][j + 1] || 0;
      const rn = resultadoNetoData[i][j + 1] || 0;
      return ((0.1 * fn) + (0.2 * mb) + (0.3 * ba) + (0.4 * rn)) / 1e7;
    })];
  });

  createLineChart('facturacionChart', 'Evolución de la Facturación Neta', rondas, jugadores, facturacionNetaData);
  createLineChart('margenBrutoChart', 'Evolución del Margen Bruto', rondas, jugadores, margenBrutoData);
  createLineChart('baiiChart', 'Evolución del BAII', rondas, jugadores, baiiData);
  createLineChart('resultadoNetoChart', 'Evolución del Resultado Neto', rondas, jugadores, resultadoNetoData);
  createLineChart('valorAccionChart', 'Valor de la Acción Estimado', rondas, jugadores, valorAccionData);
});

function createLineChart(id, label, labels, jugadores, dataSets) {
  const ctx = document.getElementById(id).getContext('2d');
  const datasets = jugadores.map((nombre, i) => ({
    label: nombre,
    data: dataSets[i],
    fill: false,
    borderColor: getColorForPlayer(nombre),
    tension: 0.1,
    pointRadius: 4,
    borderWidth: 2
  }));

  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: 'white',
            font: { weight: 'bold' }
          }
        },
        title: {
          display: true,
          text: label,
          color: 'white',
          font: { size: 18, weight: 'bold' }
        }
      },
      scales: {
        x: {
          ticks: { color: 'white', font: { size: 13 } },
          grid: { color: 'rgba(255,255,255,0.2)' }
        },
        y: {
          ticks: { color: 'white', font: { size: 13 } },
          grid: { color: 'rgba(255,255,255,0.2)' }
        }
      }
    }
  });
}

function getColorForPlayer(playerName) {
  if (!fixedColorMap[playerName]) {
    fixedColorMap[playerName] = getRandomNeonColor();
  }
  return fixedColorMap[playerName];
}

function getRandomNeonColor() {
  const available = neonPalette.filter(color => !usedNeonColors.has(color));
  const pool = available.length > 0 ? available : neonPalette;

  const color = pool[Math.floor(Math.random() * pool.length)];
  usedNeonColors.add(color);
  return color;
}

document.getElementById('volver-btn').addEventListener('click', () => {
  window.location.href = '../game/game.html';
});
