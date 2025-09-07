'use strict';

// --- Utilidades ---
function formatearCanal(canal) {
  const mapa = {
    granDistribucion: "Gran Distribución",
    tiendaPropia: "Tienda Propia",
    minoristas: "Minoristas",
    online: "Online"
  };
  return mapa[canal] || canal;
}

function formatearNumero(n, tipo = "numero") {
  const num = Number(n) || 0;
  if (tipo === "moneda") {
    return num.toLocaleString("es-ES", { style: 'currency', currency: 'EUR' });
  }
  return num.toLocaleString("es-ES", { minimumFractionDigits: 0 });
}

function formatearSegmento(segmento) {
  const mapa = {
    altosIngresos: "Altos Ingresos",
    granConsumidor: "Gran Consumidor",
    innovadores: "Innovadores",
    profesionales: "Profesionales",
    bajosIngresos: "Bajos Ingresos"
  };
  return mapa[segmento] || segmento;
}

const coloresSegmentos = {
  profesionales: 'rgba(54, 162, 235, 0.7)',
  altosIngresos: 'rgba(255, 206, 86, 0.7)',
  granConsumidor: 'rgba(75, 192, 192, 0.7)',
  bajosIngresos: 'rgba(255, 99, 132, 0.7)',
  innovadores: 'rgba(153, 102, 255, 0.7)'
};

// --- Globales de gráficos ---
let chartEvolucionVentas = null;
const chartsSegmentoPorId = {};

// --- Helpers de filtrado ---
const _norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const _matchRowByPlayer = (row, playerName) => {
  const c = _norm(row.jugador ?? row.empresa ?? row.nombreJugador ?? row.jugadorNombre);
  const p = _norm(playerName);
  return c === p || c.includes(p) || p.includes(c);
};
const _myProductSet = (roundsHistory) => {
  const last = roundsHistory?.[roundsHistory.length - 1];
  const prods = (last?.decisiones?.products || []).map(p => p?.nombre).filter(Boolean);
  return new Set(prods.map(_norm));
};

// --- Principal ---
document.addEventListener('DOMContentLoaded', () => {
  // Esta subpantalla se conecta sola (no usa postMessage)
  window.DISABLE_GLOBAL_SOCKET = true;
  window.DISABLE_POLLING = true;

  const qs = new URLSearchParams(location.search);
  const partidaId  = qs.get('partidaId')  || localStorage.getItem('partidaId')  || '';
  const playerName = qs.get('playerName') || localStorage.getItem('playerName') || '';
  if (partidaId)  localStorage.setItem('partidaId', partidaId);
  if (playerName) localStorage.setItem('playerName', playerName);

  const LOG = '[VENTAS]';
  if (!('io' in window)) {
    console.error(LOG, 'socket.io no encontrado. Asegúrate de cargar /socket.io/socket.io.js');
    return;
  }

  // === Igual que Productos/Estudios: mismo origen, path /socket.io y WS+polling ===
  const socket = io('/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 20000
  });

  let roundsHistory = [];
  let resultados = [];
  let gotSync = false;
  let gotRes  = false;

  const maybeRender = () => { if (gotSync && gotRes) tryRender(); };

  socket.on('connect', () => {
    console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
    // Orden recomendado (como en Productos)
    socket.emit('joinGame', { partidaId, nombre: playerName });
    socket.emit('identificarJugador', playerName); // STRING
    socket.emit('solicitarResultados',          { partidaId, playerName });
    socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
  });
  socket.on('connect_error', e => console.error(LOG, 'connect_error', e?.message || e));

  // Sincronía básica del jugador (trae roundsHistory)
  function handleSync(d = {}) {
    roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : [];
    gotSync = true;
    console.log(LOG, 'syncPlayerData rounds:', roundsHistory.length);
    maybeRender();
  }
  socket.on('syncPlayerData', handleSync);
  socket.on('syncJugador',    handleSync);

  // Resultados completos (filas de ventas por producto/segmento/canal)
  function handleResultados(payload) {
    resultados = Array.isArray(payload) ? payload
              : (Array.isArray(payload?.resultados) ? payload.resultados : []);
    gotRes = true;
    console.log(LOG, 'resultadosCompletos filas:', resultados.length);
    maybeRender();
  }
  socket.on('resultadosCompletos', handleResultados);

  function tryRender() {
    // 1) Filas del jugador
    let ventasJugador = resultados.filter(r => _matchRowByPlayer(r, playerName));

    // 2) Si no hay, usa productos del jugador según última ronda
    if (ventasJugador.length === 0) {
      const mySet = _myProductSet(roundsHistory);
      ventasJugador = resultados.filter(r => mySet.has(_norm(r.producto)));
    }

    // 3) Si sigue sin haber, limpiar y salir
    if (ventasJugador.length === 0) {
      limpiarPantallaSinDatos();
      return;
    }

    // --- General ---
    mostrarTablaPorProductoYCanal(ventasJugador);
    mostrarGraficoVentasPorSegmento(ventasJugador, "ventasSegmentoChart");
    mostrarGraficoEvolucion(roundsHistory);
    mostrarCuotaPorSegmento(resultados, playerName, "tabla-cuota-segmento");
    mostrarCuotaPorCanal(resultados, playerName, "tabla-cuota-canal");

    // --- Por producto ---
    const productosUnicos = [...new Set(ventasJugador.map(r => r.producto))];
    const contenedor = document.getElementById("contenedor-productos");
    if (contenedor) contenedor.innerHTML = '';

    productosUnicos.forEach(producto => {
      const div = document.createElement("div");
      div.classList.add("bloque-individual");
      div.innerHTML = `
        <h2>${producto}</h2>
        <canvas id="ventasSegmento-${producto}"></canvas>
        <div id="tablaCanal-${producto}"></div>
        <div id="cuotaSegmento-${producto}"></div>
        <div id="cuotaCanal-${producto}"></div>
      `;
      contenedor.appendChild(div);

      const resultadosJugadorProducto = resultados.filter(r =>
        (_matchRowByPlayer(r, playerName)) && r.producto === producto
      );

      // Datos del jugador para ventas
      mostrarGraficoVentasPorSegmento(resultadosJugadorProducto, `ventasSegmento-${producto}`);
      mostrarTablaCanal(resultadosJugadorProducto, `tablaCanal-${producto}`);

      // Todos para cuota, filtrando por producto del jugador
      mostrarCuotaPorSegmento(resultados, playerName, `cuotaSegmento-${producto}`, producto);
      mostrarCuotaPorCanal(resultados,   playerName, `cuotaCanal-${producto}`,   producto);
    });
  }

  function limpiarPantallaSinDatos() {
    const idsVacias = [
      "tabla-productos-canales", "ventasSegmentoChart", "evolucionVentasChart",
      "tabla-cuota-segmento", "tabla-cuota-canal", "contenedor-productos"
    ];
    idsVacias.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'CANVAS') {
        const ctx = el.getContext('2d');
        ctx && ctx.clearRect(0, 0, el.width, el.height);
      } else {
        el.innerHTML = '<p>Sin datos para tu jugador/productos todavía.</p>';
      }
    });
  }
});

// ================== RENDER ==================

function mostrarTablaPorProductoYCanal(resultados) {
  const contenedor = document.getElementById("tabla-productos-canales");
  if (!contenedor) return;

  const agrupado = {};
  resultados.forEach(({ canal, facturacionNeta, unidadesNetas, unidadesVendidas }) => {
    if (!canal) return;
    if (!agrupado[canal]) agrupado[canal] = { canal, unidades: 0, ingresos: 0 };
    const uds = Number(unidadesNetas ?? unidadesVendidas) || 0;
    agrupado[canal].unidades += uds;
    agrupado[canal].ingresos += Number(facturacionNeta) || 0;
  });

  const tabla = `<table><thead><tr>
      <th>Canal</th><th>Unidades Vendidas</th><th>Ingresos</th>
  </tr></thead><tbody>${
    Object.values(agrupado).map(p => `
      <tr><td>${formatearCanal(p.canal)}</td>
      <td>${formatearNumero(p.unidades)}</td><td>${formatearNumero(p.ingresos, "moneda")}</td></tr>
    `).join("")
  }</tbody></table>`;

  contenedor.innerHTML = tabla;
}

function mostrarGraficoVentasPorSegmento(resultados, idCanvas) {
  const ctx = document.getElementById(idCanvas)?.getContext("2d");
  if (!ctx) return;

  if (chartsSegmentoPorId[idCanvas]) chartsSegmentoPorId[idCanvas].destroy();

  const agrupado = {};
  resultados.forEach(({ segmento, unidadesVendidas }) => {
    if (!segmento || isNaN(unidadesVendidas)) return;
    agrupado[segmento] = (agrupado[segmento] || 0) + Number(unidadesVendidas);
  });

  const segmentos = Object.keys(agrupado);
  const datos = Object.values(agrupado);
  const colores = segmentos.map(s => coloresSegmentos[s] || 'rgba(200,200,200,0.5)');

  chartsSegmentoPorId[idCanvas] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: segmentos.map(formatearSegmento),
      datasets: [{
        label: "Demanda Captada por Segmento",
        data: datos,
        backgroundColor: colores
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => formatearNumero(c.raw) } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: formatearNumero } },
        x: { ticks: { color: "#fff" }, grid: { color: "#444" } }
      }
    }
  });
}

function mostrarGraficoEvolucion(roundsHistory) {
  const c = document.getElementById("evolucionVentasChart");
  if (!c) return;
  const ctx = c.getContext("2d");

  // labels por índice o por campo round si existe
  const labels = roundsHistory.map((r, i) => ('round' in r ? `Ronda ${Number(r.round)+1}` : `Ronda ${i + 1}`));
  const datos  = roundsHistory.map(r => Number(r.facturacionNeta) || 0);

  chartEvolucionVentas?.destroy();
  chartEvolucionVentas = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Facturación Neta", data: datos, fill: false, borderColor: "cyan", tension: 0.2 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { callbacks: { label: c => formatearNumero(c.raw, "moneda") } }
      },
      scales: { y: { beginAtZero: true, ticks: { callback: formatearNumero } } }
    }
  });
}

function mostrarCuotaPorSegmento(resultados, playerName, idDiv, productoFiltrado = null) {
  const totales = {}, jugador = {};
  resultados.forEach(({ segmento, jugador: nombre, unidadesVendidas, producto }) => {
    if (!segmento || isNaN(unidadesVendidas)) return;
    const uds = Number(unidadesVendidas) || 0;
    totales[segmento] = (totales[segmento] || 0) + uds;
    if (_norm(nombre) === _norm(playerName) && (!productoFiltrado || producto === productoFiltrado)) {
      jugador[segmento] = (jugador[segmento] || 0) + uds;
    }
  });

  const contenedor = document.getElementById(idDiv);
  if (!contenedor) return;

  contenedor.innerHTML = `<table><thead><tr><th>Segmento</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr></thead><tbody>${
    Object.keys(totales).map(seg => {
      const total = totales[seg], parte = jugador[seg] || 0, cuota = total ? (parte / total) * 100 : 0;
      const color = (coloresSegmentos[seg] || 'rgba(200,200,200,0.5)').replace('0.7', '0.1');
      return `<tr style="background:${color}"><td>${formatearSegmento(seg)}</td><td>${formatearNumero(total)}</td><td>${formatearNumero(parte)}</td><td>${cuota.toFixed(1)}%</td></tr>`;
    }).join("")
  }</tbody></table>`;
}

function mostrarCuotaPorCanal(resultados, playerName, idDiv, productoFiltrado = null) {
  const totales = {}, jugador = {};
  resultados.forEach(({ canal, jugador: nombre, unidadesVendidas, producto }) => {
    if (!canal || isNaN(unidadesVendidas)) return;
    const uds = Number(unidadesVendidas) || 0;
    totales[canal] = (totales[canal] || 0) + uds;
    if (_norm(nombre) === _norm(playerName) && (!productoFiltrado || producto === productoFiltrado)) {
      jugador[canal] = (jugador[canal] || 0) + uds;
    }
  });

  const contenedor = document.getElementById(idDiv);
  if (!contenedor) return;

  contenedor.innerHTML = `<table><thead><tr><th>Canal</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr></thead><tbody>${
    Object.keys(totales).map(canal => {
      const total = totales[canal], parte = jugador[canal] || 0, cuota = total ? (parte / total) * 100 : 0;
      return `<tr><td>${formatearCanal(canal)}</td><td>${formatearNumero(total)}</td><td>${formatearNumero(parte)}</td><td>${cuota.toFixed(1)}%</td></tr>`;
    }).join("")
  }</tbody></table>`;
}

function mostrarTablaCanal(resultados, idDiv) {
  const contenedor = document.getElementById(idDiv);
  if (!contenedor) return;

  const agrupado = {};
  resultados.forEach(({ canal, facturacionNeta, unidadesVendidas, unidadesNetas }) => {
    if (!canal) return;
    agrupado[canal] = agrupado[canal] || { unidades: 0, ingresos: 0 };
    const uds = Number(unidadesVendidas ?? unidadesNetas) || 0;
    agrupado[canal].unidades += uds;
    agrupado[canal].ingresos += Number(facturacionNeta) || 0;
  });

  contenedor.innerHTML = `<table><thead><tr><th>Canal</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>${
    Object.entries(agrupado).map(([canal, { unidades, ingresos }]) => `
      <tr><td>${formatearCanal(canal)}</td><td>${formatearNumero(unidades)}</td><td>${formatearNumero(ingresos, "moneda")}</td></tr>
    `).join("")
  }</tbody></table>`;
}
