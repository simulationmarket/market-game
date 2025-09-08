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

// campos alternativos: incluye player/playerName/company
const _rowPlayer = (row={}) =>
  row.jugador ?? row.empresa ?? row.nombreJugador ?? row.jugadorNombre ?? row.player ?? row.playerName ?? row.company;

const _rowProducto = (row={}) =>
  row.producto ?? row.product ?? row.nombreProducto ?? row.productName;

const _matchRowByPlayer = (row, playerName) => {
  const c = _norm(_rowPlayer(row));
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
  // Esta subpantalla se conecta sola
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

  const socket = io('/', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 20000
  });

  // ===== DIAGNÓSTICO GLOBAL =====
  try {
    socket.onAny?.((event, ...args) => {
      if (['ping','pong','connect','disconnect'].includes(event)) return;
      console.debug(LOG, 'onAny <-', event, args?.[0], { extraCount: args.length - 1 });
    });
  } catch {}

  let roundsHistory = [];
  let resultados = [];
  let gotSync = false;
  let gotRes  = false;

  const maybeRender = () => { if (gotSync && gotRes) tryRender(); };

  socket.on('connect', () => {
    console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
    socket.emit('joinGame', { partidaId, nombre: playerName });
    socket.emit('identificarJugador', playerName);

    // Pedimos todas las variantes
    socket.emit('solicitarResultados',          { partidaId, playerName });
    socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    socket.emit('solicitarResultadosFinales',   { partidaId, playerName });

    setTimeout(() => {
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
      socket.emit('solicitarResultadosFinales',   { partidaId, playerName });
    }, 1500);
  });
  socket.on('connect_error', e => console.error(LOG, 'connect_error', e?.message || e));

  // Sync (roundsHistory)
  function handleSync(d = {}) {
    roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : [];
    gotSync = true;
    console.log(LOG, 'syncPlayerData rounds:', roundsHistory.length);
    maybeRender();
  }
  socket.on('syncPlayerData', handleSync);
  socket.on('syncJugador',    handleSync);

  // Resultados completos/finales
  function extractResultados(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    const candidates = ['resultados','resultadosCompletos','resultadosFinales','data','rows','ventas','items','list'];
    for (const k of candidates) if (Array.isArray(payload[k])) return payload[k];
    if (payload.data && typeof payload.data === 'object') {
      for (const k of candidates) if (Array.isArray(payload.data[k])) return payload.data[k];
    }
    return [];
  }

  function applyResultados(arr, source) {
    if (!arr?.length) return;
    if (source === 'finales') {
      resultados = arr;
    } else if (!resultados.length) {
      resultados = arr;
    }
    gotRes = true;
    console.log(LOG, `aplicados (${source}) filas:`, resultados.length);
    maybeRender();
  }

  function handleResultados(payload) {
    const arr = extractResultados(payload);
    console.log(LOG, 'resultadosCompletos recibidos:', arr.length);
    applyResultados(arr, 'completos');
  }
  socket.on('resultadosCompletos', handleResultados);
  socket.on('resultados',          handleResultados);
  socket.on('ventasCompletas',     handleResultados);

  function handleResultadosFinales(payload) {
    const arr = extractResultados(payload);
    if (arr?.length) console.log(LOG, 'resultadosFinales keys[0]:', Object.keys(arr[0]));
    console.log(LOG, 'resultadosFinales recibidos:', arr.length);
    applyResultados(arr, 'finales');
  }
  socket.on('resultadosFinales', handleResultadosFinales);
  socket.on('resumenResultados', handleResultadosFinales);

  function tryRender() {
    // 1) Filas del jugador
    let ventasJugador = resultados.filter(r => _matchRowByPlayer(r, playerName));

    // 2) Fallback por productos del jugador
    if (ventasJugador.length === 0) {
      const mySet = _myProductSet(roundsHistory);
      ventasJugador = resultados.filter(r => mySet.has(_norm(_rowProducto(r))));
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
    const productosUnicos = [...new Set(ventasJugador.map(r => _rowProducto(r)).filter(Boolean))];
    const contenedor = document.getElementById("contenedor-productos");
    if (contenedor) contenedor.innerHTML = '';

    productosUnicos.forEach(producto => {
      const div = document.createElement("div");
      div.classList.add("bloque-individual");
      const idCanvas = `ventasSegmento-${producto}`;
      const idTablaCanal = `tablaCanal-${producto}`;
      const idCuotaSeg = `cuotaSegmento-${producto}`;
      const idCuotaCan = `cuotaCanal-${producto}`;

      div.innerHTML = `
        <h2>${producto}</h2>
        <canvas id="${idCanvas}"></canvas>
        <div id="${idTablaCanal}"></div>
        <div id="${idCuotaSeg}"></div>
        <div id="${idCuotaCan}"></div>
      `;
      contenedor.appendChild(div);

      const resultadosJugadorProducto = resultados.filter(r =>
        (_matchRowByPlayer(r, playerName)) && _rowProducto(r) === producto
      );

      mostrarGraficoVentasPorSegmento(resultadosJugadorProducto, idCanvas);
      mostrarTablaCanal(resultadosJugadorProducto, idTablaCanal);

      mostrarCuotaPorSegmento(resultados, playerName, idCuotaSeg, producto);
      mostrarCuotaPorCanal(resultados,   playerName, idCuotaCan, producto);
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
  resultados.forEach((row) => {
    const canal = row.canal;
    if (!canal) return;
    if (!agrupado[canal]) agrupado[canal] = { canal, unidades: 0, ingresos: 0 };

    const udsNetas   = Number(row.unidadesNetas ?? row.unidadesVendidas) || 0;
    const precio     = Number(row.precio) || 0;
    const ingresosRow = Number(row.facturacionNeta ?? row.ingresos ?? row.facturacion) || (precio * udsNetas);

    agrupado[canal].unidades += udsNetas;
    agrupado[canal].ingresos += ingresosRow;
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
  resultados.forEach((row) => {
    const segmento = row.segmento;
    if (!segmento) return;
    const uds = Number(row.unidadesVendidas ?? row.unidadesNetas) || 0;
    agrupado[segmento] = (agrupado[segmento] || 0) + uds;
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

  const labels = roundsHistory.map((r, i) => ('round' in r ? `Ronda ${Number(r.round)+1}` : `Ronda ${i + 1}`));
  const datos  = roundsHistory.map(r => Number(r.facturacionNeta ?? r.ingresos ?? r.facturacion) || 0);

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
  resultados.forEach((row) => {
    const segmento = row.segmento;
    if (!segmento) return;
    const nombre = _rowPlayer(row);
    const producto = _rowProducto(row);
    const uds = Number(row.unidadesVendidas ?? row.unidadesNetas) || 0;

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
  resultados.forEach((row) => {
    const canal = row.canal;
    if (!canal) return;
    const nombre = _rowPlayer(row);
    const producto = _rowProducto(row);
    const uds = Number(row.unidadesVendidas ?? row.unidadesNetas) || 0;

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
  resultados.forEach((row) => {
    const canal = row.canal;
    if (!canal) return;

    const udsNetas   = Number(row.unidadesVendidas ?? row.unidadesNetas) || 0;
    const precio     = Number(row.precio) || 0;
    const ingresosRow = Number(row.facturacionNeta ?? row.ingresos ?? row.facturacion) || (precio * udsNetas);

    agrupado[canal] = agrupado[canal] || { unidades: 0, ingresos: 0 };
    agrupado[canal].unidades += udsNetas;
    agrupado[canal].ingresos += ingresosRow;
  });

  contenedor.innerHTML = `<table><thead><tr><th>Canal</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>${
    Object.entries(agrupado).map(([canal, { unidades, ingresos }]) => `
      <tr><td>${formatearCanal(canal)}</td><td>${formatearNumero(unidades)}</td><td>${formatearNumero(ingresos, "moneda")}</td></tr>
    `).join("")
  }</tbody></table>`;
}
