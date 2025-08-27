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
    if (tipo === "moneda") {
        return n.toLocaleString("es-ES", { style: 'currency', currency: 'EUR' });
    }
    return n.toLocaleString("es-ES", { minimumFractionDigits: 0 });
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

// --- Globales ---
let chartVentasSegmento = null;
let chartEvolucionVentas = null;

// --- Principal ---
document.addEventListener('DOMContentLoaded', () => {
    const isIframe = window.self !== window.top;
    let playerName = null;

    if (isIframe) {
        window.addEventListener('message', (event) => {
            const { playerName: receivedPlayerName, resultados, roundsHistory } = event.data || {};
            if (!receivedPlayerName || !resultados || !roundsHistory || roundsHistory.length === 0) return;

            playerName = receivedPlayerName;

            const ventasJugador = resultados.filter(r => r.jugador === playerName);

            // --- General ---
            mostrarTablaPorProductoYCanal(ventasJugador);
            mostrarGraficoVentasPorSegmento(ventasJugador, "ventasSegmentoChart");
            mostrarGraficoEvolucion(roundsHistory);
            mostrarCuotaPorSegmento(resultados, playerName, "tabla-cuota-segmento");
            mostrarCuotaPorCanal(resultados, playerName, "tabla-cuota-canal");

            // --- Por producto ---
            const productosUnicos = [...new Set(ventasJugador.map(r => r.producto))];
            const contenedor = document.getElementById("contenedor-productos");

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

                const resultadosJugadorProducto = resultados.filter(r => r.jugador === playerName && r.producto === producto);

                // Usamos datos del jugador solo para ventas
                mostrarGraficoVentasPorSegmento(resultadosJugadorProducto, `ventasSegmento-${producto}`);
                mostrarTablaCanal(resultadosJugadorProducto, `tablaCanal-${producto}`);

                // Usamos todos los datos para cuota, pero filtramos por producto del jugador
                mostrarCuotaPorSegmento(resultados, playerName, `cuotaSegmento-${producto}`, producto);
                mostrarCuotaPorCanal(resultados, playerName, `cuotaCanal-${producto}`, producto);
            });
        });
    }
});

function mostrarTablaPorProductoYCanal(resultados) {
    const contenedor = document.getElementById("tabla-productos-canales");
    if (!contenedor) return;

    const agrupado = {};
    resultados.forEach(({ canal, facturacionNeta, unidadesNetas }) => {
    if (!canal) return;
    if (!agrupado[canal]) agrupado[canal] = { canal, unidades: 0, ingresos: 0 };
    agrupado[canal].unidades += unidadesNetas || 0;
    agrupado[canal].ingresos += facturacionNeta || 0;
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

const chartsSegmentoPorId = {};

function mostrarGraficoVentasPorSegmento(resultados, idCanvas) {
    const ctx = document.getElementById(idCanvas)?.getContext("2d");
    if (!ctx) return;

    if (chartsSegmentoPorId[idCanvas]) chartsSegmentoPorId[idCanvas].destroy();

    const agrupado = {};
    resultados.forEach(({ segmento, unidadesVendidas }) => {
    if (!segmento || isNaN(unidadesVendidas)) return;
    agrupado[segmento] = (agrupado[segmento] || 0) + unidadesVendidas;
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
    const ctx = document.getElementById("evolucionVentasChart").getContext("2d");
    const labels = roundsHistory.map(r => `Ronda ${r.round + 1}`);
    const datos = roundsHistory.map(r => r.facturacionNeta || 0);

    chartEvolucionVentas?.destroy();
    chartEvolucionVentas = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{ label: "Facturación Neta", data: datos, fill: false, borderColor: "cyan", tension: 0.2 }]
        },
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
    totales[segmento] = (totales[segmento] || 0) + unidadesVendidas;
    if (nombre === playerName && (!productoFiltrado || producto === productoFiltrado)) {
        jugador[segmento] = (jugador[segmento] || 0) + unidadesVendidas;
    }
});

    const contenedor = document.getElementById(idDiv);
    if (!contenedor) return;

    contenedor.innerHTML = `<table><thead><tr><th>Segmento</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr></thead><tbody>${
        Object.keys(totales).map(seg => {
            const total = totales[seg], parte = jugador[seg] || 0, cuota = (parte / total) * 100;
            const color = (coloresSegmentos[seg] || 'rgba(200,200,200,0.5)').replace('0.7', '0.1');
            return `<tr style="background:${color}"><td>${formatearSegmento(seg)}</td><td>${formatearNumero(total)}</td><td>${formatearNumero(parte)}</td><td>${cuota.toFixed(1)}%</td></tr>`;
        }).join("")
    }</tbody></table>`;
}

function mostrarCuotaPorCanal(resultados, playerName, idDiv, productoFiltrado = null) {
    const totales = {}, jugador = {};
    resultados.forEach(({ canal, jugador: nombre, unidadesVendidas, producto }) => {
    if (!canal || isNaN(unidadesVendidas)) return;
    totales[canal] = (totales[canal] || 0) + unidadesVendidas;
    if (nombre === playerName && (!productoFiltrado || producto === productoFiltrado)) {
        jugador[canal] = (jugador[canal] || 0) + unidadesVendidas;
    }
});

    const contenedor = document.getElementById(idDiv);
    if (!contenedor) return;

    contenedor.innerHTML = `<table><thead><tr><th>Canal</th><th>Total</th><th>Jugador</th><th>Cuota (%)</th></tr></thead><tbody>${
        Object.keys(totales).map(canal => {
            const total = totales[canal], parte = jugador[canal] || 0, cuota = (parte / total) * 100;
            return `<tr><td>${formatearCanal(canal)}</td><td>${formatearNumero(total)}</td><td>${formatearNumero(parte)}</td><td>${cuota.toFixed(1)}%</td></tr>`;
        }).join("")
    }</tbody></table>`;
}

function mostrarTablaCanal(resultados, idDiv) {
    const contenedor = document.getElementById(idDiv);
    if (!contenedor) return;

    const agrupado = {};
    resultados.forEach(({ canal, facturacionNeta, unidadesVendidas }) => {
        if (!canal) return;
        agrupado[canal] = agrupado[canal] || { unidades: 0, ingresos: 0 };
        agrupado[canal].unidades += unidadesVendidas || 0;
        agrupado[canal].ingresos += facturacionNeta || 0;
    });

    contenedor.innerHTML = `<table><thead><tr><th>Canal</th><th>Unidades</th><th>Ingresos</th></tr></thead><tbody>${
        Object.entries(agrupado).map(([canal, { unidades, ingresos }]) => `
            <tr><td>${formatearCanal(canal)}</td><td>${formatearNumero(unidades)}</td><td>${formatearNumero(ingresos, "moneda")}</td></tr>
        `).join("")
    }</tbody></table>`;
}
