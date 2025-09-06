'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Evita sockets globales aquí
    window.DISABLE_GLOBAL_SOCKET = true;
    window.DISABLE_POLLING = true;

    const qs = new URLSearchParams(location.search);
    const partidaId = qs.get('partidaId') || '';
    const playerName = qs.get('playerName') || '';
    const LOG = '[CR-GENERAL]';

    const SOCKET_URL = window.SOCKET_URL_OVERRIDE || location.origin;

    if (!('io' in window)) {
      console.error(LOG, 'socket.io no encontrado. Incluye <script src="/socket.io/socket.io.js"></script>');
      return;
    }

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      upgrade: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    let roundsHistory = [];

    socket.on('connect', () => {
      console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
      socket.emit('joinGame', { partidaId, playerName, nombre: playerName });
      socket.emit('identificarJugador', { partidaId, playerName });
      socket.emit('solicitarResultados', { partidaId, playerName });
    });

    socket.on('connect_error', (e) => console.error(LOG, 'connect_error', e?.message || e));

    function handleSync(data = {}) {
      if (Array.isArray(data.roundsHistory)) {
        roundsHistory = data.roundsHistory;
        render();
        console.log(LOG, 'SYNC roundsHistory', roundsHistory.length);
      }
    }

    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador', handleSync);

    function render() {
      if (!Array.isArray(roundsHistory) || roundsHistory.length === 0) return;
      generarEstructuraTabla(roundsHistory);
      actualizarTabla(roundsHistory);
      actualizarGrafico(roundsHistory);
    }

    function formatPartidaName(partida) {
      const formatted = partida.replace(/([a-z])([A-Z])/g, '$1 $2');
      return formatted
        .split(' ')
        .map((w) => (['baii', 'bai'].includes(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(' ');
    }

    function generarEstructuraTabla(hist) {
      const tableHeader = document.getElementById('header-row');
      const tableBody = document.getElementById('results-body');
      if (!tableHeader || !tableBody) return;

      tableHeader.innerHTML = '<th>Partida</th>';
      tableBody.innerHTML = '';

      hist.forEach((_, idx) => {
        const th = document.createElement('th');
        th.textContent = `R${idx + 1}`;
        tableHeader.appendChild(th);
      });

      const partidas = [
        'facturacionBruta', 'devoluciones', 'facturacionNeta', 'costeVentas', 'margenBruto',
        'gastosOperativos', 'gastosPublicidad', 'gastosComerciales', 'costeAlmacenaje',
        'baii', 'gastosFinancieros', 'bai', 'impuestos', 'resultadoNeto'
      ];
      const importantes = ['facturacionBruta', 'facturacionNeta', 'margenBruto', 'gastosOperativos', 'baii', 'bai', 'resultadoNeto'];
      const suma = ['facturacionBruta', 'facturacionNeta', 'margenBruto', 'baii', 'bai', 'resultadoNeto'];
      const resta = ['devoluciones', 'costeVentas', 'gastosPublicidad', 'gastosOperativos', 'gastosComerciales', 'costeAlmacenaje', 'gastosFinancieros', 'impuestos'];

      partidas.forEach((partida) => {
        const row = document.createElement('tr');

        const partidaCell = document.createElement('td');
        partidaCell.textContent = formatPartidaName(partida);
        if (importantes.includes(partida)) {
          partidaCell.style.fontWeight = 'bold';
          partidaCell.style.color = 'black';
        } else {
          partidaCell.style.color = 'black';
        }
        row.appendChild(partidaCell);

        hist.forEach((_, idx) => {
          const cell = document.createElement('td');
          cell.id = `${partida}-r${idx}`;
          cell.textContent = '0';

          if (suma.includes(partida)) cell.style.color = 'green';
          else if (resta.includes(partida)) cell.style.color = 'red';
          if (importantes.includes(partida)) cell.style.fontWeight = 'bold';

          row.appendChild(cell);
        });

        tableBody.appendChild(row);
      });
    }

    function actualizarTabla(hist) {
      hist.forEach((datos, idx) => {
        const partidas = [
          'facturacionBruta', 'devoluciones', 'facturacionNeta', 'costeVentas', 'margenBruto',
          'gastosOperativos', 'gastosPublicidad', 'gastosComerciales', 'costeAlmacenaje',
          'baii', 'gastosFinancieros', 'bai', 'impuestos', 'resultadoNeto'
        ];

        partidas.forEach((partida) => {
          const cell = document.getElementById(`${partida}-r${idx}`);
          if (!cell) return;

          let valor = Number(datos[partida] || 0);

          if (partida === 'gastosPublicidad') {
            valor = 0;
            if (datos.decisiones && Array.isArray(datos.decisiones.products)) {
              valor = datos.decisiones.products.reduce((acc, p) => acc + (Number(p.presupuestoPublicidad) || 0), 0);
            }
          }

          cell.textContent = Number(valor).toLocaleString('es-ES');
        });
      });
    }

    function actualizarGrafico(hist) {
      const canvas = document.getElementById('gastosPorcentajeChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const etiquetas = hist.map((_, i) => `R${i + 1}`);

      const pct = (num, den) => (den ? ((num / den) * 100).toFixed(2) : 0);

      const costesVentas = hist.map((d) => pct(d.costeVentas, d.facturacionNeta));
      const gastosOperativos = hist.map((d) => pct(d.gastosOperativos, d.facturacionNeta));
      const gastosComerciales = hist.map((d) => pct(d.gastosComerciales, d.facturacionNeta));
      const costeAlmacenaje = hist.map((d) => pct(d.costeAlmacenaje, d.facturacionNeta));
      const gastosFinancieros = hist.map((d) => pct(d.gastosFinancieros, d.facturacionNeta));
      const impuestos = hist.map((d) => pct(d.impuestos, d.facturacionNeta));
      const resultadoNeto = hist.map((d) => pct(d.resultadoNeto, d.facturacionNeta));

      if (window.financialChart) {
        window.financialChart.destroy();
      }

      window.financialChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [
            { label: 'Costes de Ventas', data: costesVentas, backgroundColor: 'rgba(54, 162, 235, 0.7)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 },
            { label: 'Gastos Operativos', data: gastosOperativos, backgroundColor: 'rgba(75, 192, 192, 0.7)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 },
            { label: 'Gastos Comerciales', data: gastosComerciales, backgroundColor: 'rgba(200, 200, 200, 0.7)', borderColor: 'rgba(200, 200, 200, 1)', borderWidth: 1 },
            { label: 'Almacenaje', data: costeAlmacenaje, backgroundColor: 'rgba(150, 150, 255, 0.7)', borderColor: 'rgba(150, 150, 255, 1)', borderWidth: 1 },
            { label: 'Gastos Financieros', data: gastosFinancieros, backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 },
            { label: 'Impuestos', data: impuestos, backgroundColor: 'rgba(102, 255, 102, 0.7)', borderColor: 'rgba(102, 255, 102, 1)', borderWidth: 1 },
            { label: 'Resultado Neto', data: resultadoNeto, backgroundColor: 'rgba(255, 159, 64, 0.7)', borderColor: 'rgba(255, 159, 64, 1)', borderWidth: 1 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              title: { display: true, text: 'Rondas', color: '#ffffff', font: { size: 16, weight: 'bold' } },
              ticks: { color: '#ffffff' },
              grid: { color: 'rgba(255,255,255,0.2)' }
            },
            y: {
              stacked: true,
              title: { display: true, text: 'Porcentaje (%)', color: '#ffffff', font: { size: 16, weight: 'bold' } },
              ticks: { color: '#ffffff', callback: (v) => `${v}%` },
              grid: { color: 'rgba(255,255,255,0.2)' }
            }
          },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#ffffff', font: { size: 14 } } },
            tooltip: { callbacks: { title: (items) => items[0].dataset.label, label: (it) => `${it.raw}%` } }
          },
          layout: { padding: { top: 20, bottom: 10, left: 20, right: 20 } }
        }
      });

      const parent = canvas.parentElement;
      if (parent) {
        parent.style.backgroundColor = '#333';
        parent.style.borderRadius = '10px';
      }
    }
  });
})();
