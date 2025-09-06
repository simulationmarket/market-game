'use strict';

(function () {
  // ===== Utilidades comunes =====
  function _norm(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function _matchRowByPlayer(row, playerName) {
    const c = _norm(row.jugador ?? row.empresa ?? row.nombreJugador ?? row.jugadorNombre);
    const p = _norm(playerName);
    return c === p || c.includes(p) || p.includes(c);
  }
  function _myProductSet(roundsHistory) {
    const last = roundsHistory?.[roundsHistory.length - 1];
    const prods = (last?.decisiones?.products || []).map(p => p?.nombre).filter(Boolean);
    return new Set(prods.map(_norm));
  }
  function formatearCanal(c) {
    const map = {
      granDistribucion: 'Gran Distribución',
      tiendaPropia: 'Tienda Propia',
      minoristas: 'Minoristas',
      online: 'Online'
    };
    return map[c] || c;
  }
  function formatearNumero(n, t = 'numero') {
    return t === 'moneda'
      ? (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : (Number(n) || 0).toLocaleString('es-ES');
  }
  function formatearSegmento(s) {
    const map = {
      altosIngresos: 'Altos Ingresos',
      granConsumidor: 'Gran Consumidor',
      innovadores: 'Innovadores',
      profesionales: 'Profesionales',
      bajosIngresos: 'Bajos Ingresos'
    };
    return map[s] || s;
  }

  const coloresSegmentos = {
    profesionales: 'rgba(54, 162, 235, 0.7)',
    altosIngresos: 'rgba(255, 206, 86, 0.7)',
    granConsumidor: 'rgba(75, 192, 192, 0.7)',
    bajosIngresos: 'rgba(255, 99, 132, 0.7)',
    innovadores: 'rgba(153, 102, 255, 0.7)'
  };

  // ===== Estado / Charts =====
  let chartEvolucionVentas = null;
  const chartsSegmentoPorId = {};

  document.addEventListener('DOMContentLoaded', function () {
    // Evita sockets globales si algún script común se cuela después
    window.DISABLE_GLOBAL_SOCKET = true;
    window.DISABLE_POLLING = true;

    const qs = new URLSearchParams(location.search);
    const partidaId = qs.get('partidaId') || '';
    const playerName = qs.get('playerName') || '';
    const LOG = '[VENTAS]';

    const SOCKET_URL = window.SOCKET_URL_OVERRIDE || location.origin;

    if (!('io' in window)) {
      console.error(LOG, 'socket.io no encontrado. Incluye <script src="/socket.io/socket.io.js"></script>');
      return;
    }

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'], // WebSocket puro
      upgrade: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    let roundsHistory = [];
    let resultados = [];
    let gotSync = false;
    let gotRes = false;

    function maybeRender() {
      if (gotSync && gotRes) {
        tryRender();
      }
    }

    socket.on('connect', () => {
      console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
      socket.emit('joinGame', { partidaId, playerName, nombre: playerName });
      socket.emit('identificarJugador', { partidaId, playerName });
      socket.emit('solicitarResultados', { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    });

    socket.on('connect_error', (e) => console.error(LOG, 'connect_error', e?.message || e));

    function handleSync(d = {}) {
      roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : [];
      gotSync = true;
      console.log(LOG, 'SYNC roundsHistory', roundsHistory.length);
      maybeRender();
    }

    function handleResultados(payload) {
      resultados = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.resultados) ? payload.resultados : []);
      gotRes = true;
      console.log(LOG, 'resultadosCompletos', resultados.length);
      maybeRender();
    }

    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador', handleSync);
    socket.on('resultadosCompletos', handleResultados);
    socket.on('resultadosCompletosIF', handleResultados);

    function tryRender() {
      let ventasJugador = resultados.filter(r => _matchRowByPlayer(r, playerName));
      if (ventasJugador.length === 0) {
        const mySet = _myProductSet(roundsHistory);
        ventasJugador = resultados.filter(r => mySet.has(_norm(r.producto)));
      }

      mostrarTablaPorProductoYCanal(ventasJugador);
      mostrarGraficoVentasPorSegmento(ventasJugador, 'ventasSegmentoChart');
      mostrarGraficoEvolucion(roundsHistory);
      mostrarCuotaPorSegmento(resultados, playerName, 'tabla-cuota-segmento');
      mostrarCuotaPorCanal(resultados, playerName, 'tabla-cuota-canal');

      // Por producto
      const productos = [...new Set(ventasJugador.map(r => r.producto))];
      const cont = document.getElementById('contenedor-productos');
      if (cont) {
        cont.innerHTML = '';
        const mySet = _myProductSet(roundsHistory);
        productos.forEach((prod) => {
          const div = document.createElement('div');
          div.classList.add('bloque-individual');
          div.innerHTML = `
            <h2>${prod}</h2>
            <canvas id="ventasSegmento-${prod}"></canvas>
            <div id="tablaCanal-${prod}"></div>
            <div id="cuotaSegmento-${prod}"></div>
            <div id="cuotaCanal-${prod}"></div>
          `;
          cont.appendChild(div);

          const filas = resultados.filter(
            (r) => (_matchRowByPlayer(r, playerName) || mySet.has(_norm(r.producto))) && r.producto === prod
          );

          mostrarGraficoVentasPorSegmento(filas, `ventasSegmento-${prod}`);
          mostrarTablaCanal(filas, `tablaCanal-${prod}`);
          mostrarCuotaPorSegmento(resultados, playerName, `cuotaSegmento-${prod}`, prod);
          mostrarCuotaPorCanal(resultados, playerName, `cuotaCanal-${prod}`, prod);
        });
      }
    }
  });

  // ===== Render helpers =====
  function mostrarTablaPorProductoYCanal(resultados) {
    const cont = document.getElementById('tabla-productos-canales');
    if (!cont) return;

    const agg = {};
    resultados.forEach(({ canal, facturacionNeta, unidadesNetas, unidadesVendidas }) => {
      if (!canal) return;
      if (!agg[canal]) agg[canal] = { canal, unidades: 0, ingresos: 0 };
      const uds = Number(unidadesNetas ?? unidadesVendidas) || 0;
      agg[canal].unidades += uds;
      agg[canal].ingresos += Number(facturacionNeta) || 0;
    });

    cont.innerHTML = `
      <table>
        <thead>
          <tr><th>Canal</th><th>Unidades Vendidas</th><th>Ingresos</th></tr>
        </thead>
        <tbody>
          ${Object.values(agg).map(p => `
            <tr>
              <td>${formatearCanal(p.canal)}</td>
              <td>${formatearNumero(p.unidades)}</td>
              <td>${formatearNumero(p.ingresos, 'moneda')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  function mostrarGraficoVentasPorSegmento(resultados, id) {
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;

    if (chartsSegmentoPorId[id]) chartsSegmentoPorId[id].destroy();

    const agg = {};
    resultados.forEach(({ segmento, unidadesVendidas }) => {
      if (!segmento || isNaN(unidadesVendidas)) return;
      agg[segmento] = (agg[segmento] || 0) + Number(unidadesVendidas);
    });

    const segs = Object.keys(agg);
    const datos = Object.values(agg);
    const colores = segs.map(s => coloresSegmentos[s] || 'rgba(200,200,200,0.5)');

    chartsSegmentoPorId[id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: segs.map(formatearSegmento),
        datasets: [{ label: 'Demanda Captada por Segmento', data: datos, backgroundColor: colores }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => formatearNumero(c.raw) } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: formatearNumero } },
          x: { ticks: { color: '#fff' }, grid: { color: '#444' } }
        }
      }
    });
  }

  function mostrarGraficoEvolucion(roundsHistory) {
    const c = document.getElementById('evolucionVentasChart');
    if (!c) return;
    const ctx = c.getContext('2d');

    const labels = roundsHistory.map((_, i) => `Ronda ${i + 1}`);
    const datos = roundsHistory.map(r => Number(r.facturacionNeta) || 0);

    if (chartEvolucionVentas) {
      chartEvolucionVentas.destroy();
    }

    chartEvolucionVentas = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Facturación Neta', data: datos, fill: false, borderColor: 'cyan', tension: 0.2 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: { callbacks: { label: c => formatearNumero(c.raw, 'moneda') } }
        },
        scales: { y: { beginAtZero: true, ticks: { callback: formatearNumero } } }
      }
    });
  }

  function mostrarCuotaPorSegmento(resultados, playerName, idDiv, productoFiltrado = null) {
    const tot = {};
    const yo = {};

    resultados.forEach(({ segmento, jugador: nom, unidadesVendidas, producto }) => {
      if (!segmento || isNaN(unidadesVendidas)) return;
      tot[segmento] = (tot[segmento] || 0) + Number(unidadesVendidas);
      const match = _matchRowByPlayer({ jugador: nom }, playerName);
      if (match && (!productoFiltrado || producto === productoFiltrado)) {
        yo[segmento] = (yo[segmento] || 0) + Number(unidadesVendidas);
      }
    });

    const cont = document.getElementById(idDiv);
    if (!cont) return;

    cont.innerHTML = `
      <table>
        <thead>
          <tr><th>Segmento</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr>
        </thead>
        <tbody>
          ${Object.keys(tot).map(seg => {
            const total = tot[seg];
            const parte = yo[seg] || 0;
            const cuota = total ? ((parte / total) * 100) : 0;
            const color = (coloresSegmentos[seg] || 'rgba(200,200,200,0.5)').replace('0.7', '0.1');
            return `
              <tr style="background:${color}">
                <td>${formatearSegmento(seg)}</td>
                <td>${formatearNumero(total)}</td>
                <td>${formatearNumero(parte)}</td>
                <td>${cuota.toFixed(1)}%</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function mostrarCuotaPorCanal(resultados, playerName, idDiv, productoFiltrado = null) {
    const tot = {};
    const yo = {};

    resultados.forEach(({ canal, jugador: nom, unidadesVendidas, producto }) => {
      if (!canal || isNaN(unidadesVendidas)) return;
      tot[canal] = (tot[canal] || 0) + Number(unidadesVendidas);
      const match = _matchRowByPlayer({ jugador: nom }, playerName);
      if (match && (!productoFiltrado || producto === productoFiltrado)) {
        yo[canal] = (yo[canal] || 0) + Number(unidadesVendidas);
      }
    });

    const cont = document.getElementById(idDiv);
    if (!cont) return;

    cont.innerHTML = `
      <table>
        <thead>
          <tr><th>Canal</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr>
        </thead>
        <tbody>
          ${Object.keys(tot).map(canal => {
            const total = tot[canal];
            const parte = yo[canal] || 0;
            const cuota = total ? ((parte / total) * 100) : 0;
            return `
              <tr>
                <td>${formatearCanal(canal)}</td>
                <td>${formatearNumero(total)}</td>
                <td>${formatearNumero(parte)}</td>
                <td>${cuota.toFixed(1)}%</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function mostrarTablaCanal(resultados, idDiv) {
    const cont = document.getElementById(idDiv);
    if (!cont) return;

    const agg = {};
    resultados.forEach(({ canal, facturacionNeta, unidadesVendidas, unidadesNetas }) => {
      if (!canal) return;
      agg[canal] = agg[canal] || { unidades: 0, ingresos: 0 };
      const uds = Number(unidadesVendidas ?? unidadesNetas) || 0;
      agg[canal].unidades += uds;
      agg[canal].ingresos += Number(facturacionNeta) || 0;
    });

    cont.innerHTML = `
      <table>
        <thead>
          <tr><th>Canal</th><th>Unidades</th><th>Ingresos</th></tr>
        </thead>
        <tbody>
          ${Object.entries(agg).map(([canal, { unidades, ingresos }]) => `
            <tr>
              <td>${formatearCanal(canal)}</td>
              <td>${formatearNumero(unidades)}</td>
              <td>${formatearNumero(ingresos, 'moneda')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }
})();
