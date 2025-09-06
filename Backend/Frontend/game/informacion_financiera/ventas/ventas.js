// ===== Utilidades =====
function formatearCanal(canal) {
  const mapa = { granDistribucion: "Gran Distribución", tiendaPropia: "Tienda Propia", minoristas: "Minoristas", online: "Online" };
  return mapa[canal] || canal;
}
function formatearNumero(n, tipo = "numero") {
  if (tipo === "moneda") return (Number(n) || 0).toLocaleString("es-ES", { style: 'currency', currency: 'EUR' });
  return (Number(n) || 0).toLocaleString("es-ES", { minimumFractionDigits: 0 });
}
function formatearSegmento(seg) {
  const m = { altosIngresos: "Altos Ingresos", granConsumidor: "Gran Consumidor", innovadores: "Innovadores", profesionales: "Profesionales", bajosIngresos: "Bajos Ingresos" };
  return m[seg] || seg;
}
function _norm(s){ return String(s||"").trim().toLowerCase().replace(/\s+/g," "); }
function _matchRowByPlayer(row, playerName, playerKeyNorm){
  const c = _norm(row.jugador ?? row.empresa ?? row.nombreJugador ?? row.jugadorNombre);
  if (playerKeyNorm) return c === playerKeyNorm || c.includes(playerKeyNorm) || playerKeyNorm.includes(c);
  const p = _norm(playerName);
  return c === p || c.includes(p) || p.includes(c);
}
function _myProductSet(roundsHistory){
  const last = roundsHistory?.[roundsHistory.length-1];
  const prods = (last?.decisiones?.products || []).map(p => p?.nombre).filter(Boolean);
  return new Set(prods.map(_norm));
}

const coloresSegmentos = {
  profesionales: 'rgba(54, 162, 235, 0.7)',
  altosIngresos: 'rgba(255, 206, 86, 0.7)',
  granConsumidor: 'rgba(75, 192, 192, 0.7)',
  bajosIngresos: 'rgba(255, 99, 132, 0.7)',
  innovadores: 'rgba(153, 102, 255, 0.7)'
};

// ===== Estado / Charts =====
let chartVentasSegmento = null;
let chartEvolucionVentas = null;
const chartsSegmentoPorId = {};

document.addEventListener('DOMContentLoaded', () => {
  const isIframe = window.self !== window.top;
  let playerName = null;
  let playerKeyNorm = null;
  let roundsHistory = [];
  let resultados = [];

  function tryRender() {
    if (!playerName || !Array.isArray(roundsHistory) || roundsHistory.length === 0 || !Array.isArray(resultados) || resultados.length === 0) {
      return;
    }

    // Por jugador (o fallback por producto)
    let ventasJugador = resultados.filter(r => _matchRowByPlayer(r, playerName, playerKeyNorm));
    if (ventasJugador.length === 0) {
      const mySet = _myProductSet(roundsHistory);
      ventasJugador = resultados.filter(r => mySet.has(_norm(r.producto)));
      console.warn("[VENTAS] usando fallback por producto → filas:", ventasJugador.length);
    }

    // General
    mostrarTablaPorProductoYCanal(ventasJugador);
    mostrarGraficoVentasPorSegmento(ventasJugador, "ventasSegmentoChart");
    mostrarGraficoEvolucion(roundsHistory);
    mostrarCuotaPorSegmento(resultados, playerName, playerKeyNorm, "tabla-cuota-segmento");
    mostrarCuotaPorCanal(resultados, playerName, playerKeyNorm, "tabla-cuota-canal");

    // Por producto
    const productosUnicos = [...new Set(ventasJugador.map(r => r.producto))];
    const contenedor = document.getElementById("contenedor-productos");
    if (contenedor) {
      contenedor.innerHTML = ""; // limpiar antes de repintar
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

        const resultadosJugadorProducto = resultados.filter(
          r => (_matchRowByPlayer(r, playerName, playerKeyNorm) || _myProductSet(roundsHistory).has(_norm(r.producto)))
            && r.producto === producto
        );

        mostrarGraficoVentasPorSegmento(resultadosJugadorProducto, `ventasSegmento-${producto}`);
        mostrarTablaCanal(resultadosJugadorProducto, `tablaCanal-${producto}`);
        mostrarCuotaPorSegmento(resultados, playerName, playerKeyNorm, `cuotaSegmento-${producto}`, producto);
        mostrarCuotaPorCanal(resultados, playerName, playerKeyNorm, `cuotaCanal-${producto}`, producto);
      });
    }
  }

  if (isIframe) {
    // Pide sincronización al padre por si cargamos después
    try { window.parent?.postMessage({ type: 'NEED_SYNC' }, '*'); } catch {}

    window.addEventListener('message', (event) => {
      const data = event.data || {};
      const { type } = data;

      if (!type) {
        const { playerName: pn, resultados: res, roundsHistory: rh } = data;
        if (pn) playerName = pn;
        if (Array.isArray(rh)) roundsHistory = rh;
        if (Array.isArray(res)) resultados = res;
        tryRender();
        return;
      }
      if (type === 'SYNC') {
        const { playerName: pn, roundsHistory: rh, playerKeyNorm: pkn } = data;
        if (pn) playerName = pn;
        if (pkn) playerKeyNorm = pkn;
        if (Array.isArray(rh)) roundsHistory = rh;
        tryRender();
        return;
      }
      if (type === 'RESULTADOS_COMPLETOS') {
        const { playerName: pn, playerKeyNorm: pkn, roundsHistory: rh, resultados: res } = data;
        if (pn) playerName = pn;
        if (pkn) playerKeyNorm = pkn;
        if (Array.isArray(rh)) roundsHistory = rh;
        if (Array.isArray(res)) resultados = res;
        tryRender();
        return;
      }
    });
  }
});

// ===== Render helpers =====

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
        <td>${formatearNumero(p.unidades)}</td>
        <td>${formatearNumero(p.ingresos, "moneda")}</td></tr>
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
    data: { labels: segmentos.map(formatearSegmento), datasets: [{ label: "Demanda Captada por Segmento", data: datos, backgroundColor: colores }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => formatearNumero(c.raw) } } },
      scales: { y: { beginAtZero: true, ticks: { callback: formatearNumero } }, x: { ticks: { color: "#fff" }, grid: { color: "#444" } } }
    }
  });
}

function mostrarGraficoEvolucion(roundsHistory) {
  const c = document.getElementById("evolucionVentasChart");
  if (!c) return;
  const ctx = c.getContext("2d");
  const labels = roundsHistory.map((r, i) => `Ronda ${i + 1}`);
  const datos = roundsHistory.map(r => Number(r.facturacionNeta) || 0);

  chartEvolucionVentas?.destroy();
  chartEvolucionVentas = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Facturación Neta", data: datos, fill: false, borderColor: "cyan", tension: 0.2 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: "top" }, tooltip: { callbacks: { label: c => formatearNumero(c.raw, "moneda") } } },
      scales: { y: { beginAtZero: true, ticks: { callback: formatearNumero } } }
    }
  });
}

function mostrarCuotaPorSegmento(resultados, playerName, playerKeyNorm, idDiv, productoFiltrado = null) {
  const totales = {}, jugador = {};
  resultados.forEach(({ segmento, jugador: nombre, unidadesVendidas, producto }) => {
    if (!segmento || isNaN(unidadesVendidas)) return;
    totales[segmento] = (totales[segmento] || 0) + Number(unidadesVendidas);
    const match = _matchRowByPlayer({ jugador: nombre }, playerName, playerKeyNorm);
    if (match && (!productoFiltrado || producto === productoFiltrado)) {
      jugador[segmento] = (jugador[segmento] || 0) + Number(unidadesVendidas);
    }
  });

  const contenedor = document.getElementById(idDiv);
  if (!contenedor) return;

  contenedor.innerHTML = `<table><thead><tr><th>Segmento</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr></thead><tbody>${
    Object.keys(totales).map(seg => {
      const total = totales[seg], parte = jugador[seg] || 0, cuota = total ? ((parte / total) * 100) : 0;
      const color = (coloresSegmentos[seg] || 'rgba(200,200,200,0.5)').replace('0.7', '0.1');
      return `<tr style="background:${color}"><td>${formatearSegmento(seg)}</td><td>${formatearNumero(total)}</td><td>${formatearNumero(parte)}</td><td>${cuota.toFixed(1)}%</td></tr>`;
    }).join("")
  }</tbody></table>`;
}

function mostrarCuotaPorCanal(resultados, playerName, playerKeyNorm, idDiv, productoFiltrado = null) {
  const totales = {}, jugador = {};
  resultados.forEach(({ canal, jugador: nombre, unidadesVendidas, producto }) => {
    if (!canal || isNaN(unidadesVendidas)) return;
    totales[canal] = (totales[canal] || 0) + Number(unidadesVendidas);
    const match = _matchRowByPlayer({ jugador: nombre }, playerName, playerKeyNorm);
    if (match && (!productoFiltrado || producto === productoFiltrado)) {
      jugador[canal] = (jugador[canal] || 0) + Number(unidadesVendidas);
    }
  });

  const contenedor = document.getElementById(idDiv);
  if (!contenedor) return;

  contenedor.innerHTML = `<table><thead><tr><th>Canal</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr></thead><tbody>${
    Object.keys(totales).map(canal => {
      const total = totales[canal], parte = jugador[canal] || 0, cuota = total ? ((parte / total) * 100) : 0;
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
    Object.entries(agrupado).map(([canal, { unidades, ingresos }]) =>
      `<tr><td>${formatearCanal(canal)}</td><td>${formatearNumero(unidades)}</td><td>${formatearNumero(ingresos, "moneda")}</td></tr>`
    ).join("")
  }</tbody></table>`;
}
