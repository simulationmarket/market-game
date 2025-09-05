document.addEventListener('DOMContentLoaded', () => {
  // Este iframe recibe datos por postMessage desde informacion_financiera.js
  let playerName = null;
  let roundsHistory = [];
  let resultados = [];

  // Render gate: solo renderiza cuando hay jugador + roundsHistory + resultados
  function tryRender() {
    if (!playerName || !Array.isArray(roundsHistory) || roundsHistory.length === 0 || !Array.isArray(resultados) || resultados.length === 0) {
      return;
    }

    // Toma SIEMPRE la última ronda consolidada para mapear publicidad, costes financieros, etc.
    const lastIndex = roundsHistory.length - 1;
    const roundData = roundsHistory[lastIndex];

    // Filtra resultados del jugador
    const resultadosJugador = resultados.filter(r => r.jugador === playerName);
    if (resultadosJugador.length === 0) {
      // Limpia o muestra vacío
      const cont = document.getElementById("tabla-contenedor");
      if (cont) cont.innerHTML = "<p>No hay resultados para mostrar todavía.</p>";
      const canvas = document.getElementById("gastosProductoChart");
      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const productosConsolidados = consolidarResultadosPorProducto(resultadosJugador, roundData);
    generarEstructuraTabla(productosConsolidados);
    generarGraficoPorProducto(productosConsolidados);
  }

  // Compat: soporta mensajes con type o “legacy” sin type
  window.addEventListener('message', (event) => {
    const data = event.data || {};
    const { type } = data;

    if (!type) {
      // Mensaje “antiguo”: venían todo junto
      const { playerName: pn, resultados: res, roundsHistory: rh } = data;
      if (pn) playerName = pn;
      if (Array.isArray(rh)) roundsHistory = rh;
      if (Array.isArray(res)) resultados = res;
      tryRender();
      return;
    }

    if (type === 'SYNC') {
      const { playerName: pn, roundsHistory: rh } = data;
      if (pn) playerName = pn;
      if (Array.isArray(rh)) roundsHistory = rh;
      tryRender(); // aún puede faltar resultados, no pasa nada
      return;
    }

    if (type === 'RESULTADOS_COMPLETOS') {
      const { playerName: pn, roundsHistory: rh, resultados: res } = data;
      if (pn) playerName = pn;
      if (Array.isArray(rh)) roundsHistory = rh;
      if (Array.isArray(res)) resultados = res;
      tryRender();
      return;
    }
  });
});


/* ================== Lógica de consolidación/tabla/gráfico (tu base) ================== */

function consolidarResultadosPorProducto(resultados, roundData) {
  if (!roundData || !roundData.decisiones || !roundData.decisiones.products) {
    console.error("Datos de la ronda o decisiones no proporcionados.");
    return [];
  }

  const productosConsolidados = {};
  const totalesJugador = {
    facturacionBruta: 0,
    facturacionNeta: 0,
    costeVentas: 0,
    margenBruto: 0,
    gastosComerciales: 0,
    gastosPublicidad: 0,
    costesAlmacenaje: 0,
    gastosFinancieros: 0,
    impuestos: 0,
    resultadoNeto: 0,
  };

  resultados.forEach((resultado) => {
    const { producto, excedente, facturacionBruta, facturacionNeta, costeVentasProducto, margenBrutoProducto } = resultado;

    if (!productosConsolidados[producto]) {
      productosConsolidados[producto] = {
        producto,
        facturacionBruta: 0,
        devoluciones: 0,
        facturacionNeta: 0,
        costeVentas: 0,
        margenBruto: 0,
        gastosComerciales: 0,
        gastosPublicidad: 0,
        costesAlmacenaje: 0,
        BAII: 0,
        gastosFinancieros: roundData.gastosFinancieros || 0,
        BAI: 0,
        impuestos: 0,
        resultadoNeto: 0,
      };
    }

    const c = productosConsolidados[producto];
    c.facturacionBruta += facturacionBruta || 0;
    c.facturacionNeta  += facturacionNeta  || 0;
    c.costeVentas      += costeVentasProducto || 0;
    c.margenBruto      += margenBrutoProducto || 0;
    c.devoluciones     += (facturacionBruta || 0) - (facturacionNeta || 0);

    // Almacenaje (tu regla: 20 €/unidad excedente)
    c.costesAlmacenaje += (excedente || 0) * 20;

    // Totales jugador
    totalesJugador.facturacionBruta += facturacionBruta || 0;
    totalesJugador.facturacionNeta  += facturacionNeta  || 0;
    totalesJugador.costeVentas      += costeVentasProducto || 0;
    totalesJugador.margenBruto      += margenBrutoProducto || 0;
    totalesJugador.costesAlmacenaje += (excedente || 0) * 20;
  });

  // Publicidad y gastos comerciales prorrateados por facturación
  const productosDecision = roundData.decisiones.products || [];
  Object.values(productosConsolidados).forEach((c, idx) => {
    const d = productosDecision[idx];
    if (d) {
      c.gastosPublicidad = d.presupuestoPublicidad || 0;
      totalesJugador.gastosPublicidad += c.gastosPublicidad;
    }

    const pct = (totalesJugador.facturacionBruta > 0)
      ? (c.facturacionBruta / totalesJugador.facturacionBruta)
      : 0;

    c.gastosComerciales = (roundData.gastosComerciales || 0) * pct;
    totalesJugador.gastosComerciales += c.gastosComerciales;

    c.BAII = c.margenBruto - c.gastosComerciales - c.gastosPublicidad - c.costesAlmacenaje;
    c.BAI  = c.BAII - c.gastosFinancieros;
    c.impuestos = c.BAI * 0.15;
    totalesJugador.impuestos += c.impuestos;
    c.resultadoNeto = c.BAI - c.impuestos;
    totalesJugador.resultadoNeto += c.resultadoNeto;
  });

  validarTotales(roundData, totalesJugador);
  return Object.values(productosConsolidados);
}

function validarTotales(roundData, totalesJugador) {
  const keys = ["facturacionBruta", "facturacionNeta", "costeVentas", "margenBruto", "gastosComerciales", "gastosPublicidad", "costesAlmacenaje"];
  keys.forEach((k) => {
    const tv = Number(totalesJugador[k] || 0);
    const gv = Number(roundData[k] || 0);
    if (Math.abs(tv - gv) > 0.01) {
      console.warn(`Desviación en ${k}: jugador=${tv.toFixed(2)} vs global=${gv.toFixed(2)}`);
    }
  });
}

function generarEstructuraTabla(productosConsolidados) {
  const cont = document.getElementById("tabla-contenedor");
  if (!cont) return;
  cont.innerHTML = "";

  productosConsolidados.forEach(prod => {
    const wrap = document.createElement("div");
    wrap.classList.add("producto-tabla");

    const title = document.createElement("h3");
    title.textContent = `Producto: ${prod.producto}`;
    wrap.appendChild(title);

    const table = document.createElement("table");
    table.classList.add("table", "table-striped");

    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>Partida</th><th>Valor</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const partidas = [
      { key: "facturacionBruta", label: "Facturación Bruta" },
      { key: "devoluciones", label: "Devoluciones" },
      { key: "facturacionNeta", label: "Facturación Neta" },
      { key: "costeVentas", label: "Coste Ventas" },
      { key: "margenBruto", label: "Margen Bruto" },
      { key: "gastosComerciales", label: "Gastos Comerciales" },
      { key: "gastosPublicidad", label: "Gastos de Publicidad" },
      { key: "costesAlmacenaje", label: "Costes de Almacenaje" },
      { key: "BAII", label: "BAII" },
      { key: "gastosFinancieros", label: "Costes Financieros" },
      { key: "BAI", label: "BAI" },
      { key: "impuestos", label: "Impuestos" },
      { key: "resultadoNeto", label: "Resultado Neto" },
    ];

    const negativas = new Set(["gastosComerciales", "gastosPublicidad", "costesAlmacenaje", "gastosFinancieros", "costeVentas", "devoluciones", "impuestos"]);

    partidas.forEach(({ key, label }) => {
      const row = document.createElement("tr");
      const c1 = document.createElement("td"); c1.textContent = label;
      const c2 = document.createElement("td");

      const raw = Number(prod[key] || 0);
      const mostrado = negativas.has(key) ? -raw : raw;
      c2.textContent = mostrado.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
      c2.style.color = mostrado >= 0 ? "green" : "red";

      row.appendChild(c1); row.appendChild(c2);
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    cont.appendChild(wrap);
  });
}

function generarGraficoPorProducto(productosConsolidados) {
  const labels = productosConsolidados.map(p => p.producto);
  const partidas = [
    { key: "costeVentas", label: "Coste Ventas", color: "#ff6384" },
    { key: "gastosComerciales", label: "Gastos Comerciales", color: "#36a2eb" },
    { key: "gastosPublicidad", label: "Gastos Publicidad", color: "#ffcd56" },
    { key: "costesAlmacenaje", label: "Costes Almacenaje", color: "#4bc0c0" },
    { key: "gastosFinancieros", label: "Costes Financieros", color: "#9966ff" },
    { key: "impuestos", label: "Impuestos", color: "#ff9f40" },
    { key: "resultadoNeto", label: "Resultado Neto", color: "#c45850" },
  ];

  const datasets = partidas.map(p => ({
    label: p.label,
    data: productosConsolidados.map(px => px[p.key] || 0),
    backgroundColor: p.color,
  }));

  const ctx = document.getElementById("gastosProductoChart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    },
  });
}
