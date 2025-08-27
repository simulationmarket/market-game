document.addEventListener('DOMContentLoaded', function () {
    const isIframe = window.self !== window.top;
    let playerName = null;

    if (isIframe) {
        window.addEventListener('message', (event) => {
            const { playerName: receivedPlayerName, resultados, roundsHistory } = event.data || {};

            if (!receivedPlayerName || !roundsHistory || roundsHistory.length === 0) {
                console.error("Datos incompletos recibidos en C.R. Producto:", event.data);
                return;
            }

            playerName = receivedPlayerName;
            console.log(`Jugador identificado en iframe: ${playerName}`);
            console.log("RoundsHistory recibido:", roundsHistory);

            if (!Array.isArray(resultados) || resultados.length === 0) {
                console.warn("Resultados está vacío o no es un array. Esperando datos adicionales.");
                return;
            }

            console.log("Procesando datos de resultados en iframe de C.R. Producto:", resultados);

            // Filtrar resultados por el jugador actual
            const resultadosJugador = resultados.filter(resultado => resultado.jugador === playerName);

            if (resultadosJugador.length === 0) {
                console.warn(`No se encontraron resultados para el jugador: ${playerName}`);
                return;
            }

            console.log(`Resultados filtrados para ${playerName}:`, resultadosJugador);

            // Consolidar resultados por producto
            const productosConsolidados = consolidarResultadosPorProducto(resultadosJugador, roundsHistory[0]);

            // Generar estructura de la tabla y gráficos
            generarEstructuraTabla(productosConsolidados);
            generarGraficoPorProducto(productosConsolidados);
        });
    }
});


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

    // Agrupar resultados por producto
    resultados.forEach((resultado) => {
        const { producto, excedente, facturacionBruta, facturacionNeta, costeVentasProducto, margenBrutoProducto, unidadesDevueltas } = resultado;

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

        const consolidado = productosConsolidados[producto];

        // Sumar valores específicos del producto
        consolidado.facturacionBruta += facturacionBruta || 0;
        consolidado.facturacionNeta += facturacionNeta || 0;
        consolidado.costeVentas += costeVentasProducto || 0;
        consolidado.margenBruto += margenBrutoProducto || 0;
        consolidado.devoluciones += (facturacionBruta || 0) - (facturacionNeta || 0);

        // Acumular coste de almacenaje
        consolidado.costesAlmacenaje += (excedente || 0) * 20;

        // Acumular totales globales
        totalesJugador.facturacionBruta += facturacionBruta || 0;
        totalesJugador.facturacionNeta += facturacionNeta || 0;
        totalesJugador.costeVentas += costeVentasProducto || 0;
        totalesJugador.margenBruto += margenBrutoProducto || 0;
        totalesJugador.costesAlmacenaje += (excedente || 0) * 20;
    });

    // Asignar presupuesto de publicidad desde roundData.decisiones.products
    Object.values(productosConsolidados).forEach((consolidado, index) => {
        const productoDecision = roundData.decisiones.products[index];
        if (productoDecision) {
            consolidado.gastosPublicidad = productoDecision.presupuestoPublicidad || 0;
            totalesJugador.gastosPublicidad += consolidado.gastosPublicidad;
        }

        // Calcular gastos comerciales proporcionados
        const porcentajeFacturacion = consolidado.facturacionBruta / totalesJugador.facturacionBruta;
        consolidado.gastosComerciales = (roundData.gastosComerciales || 0) * porcentajeFacturacion;
        totalesJugador.gastosComerciales += consolidado.gastosComerciales;

        // Calcular métricas adicionales
        consolidado.BAII =
            consolidado.margenBruto -
            consolidado.gastosComerciales -
            consolidado.gastosPublicidad -
            consolidado.costesAlmacenaje;

        consolidado.BAI = consolidado.BAII - consolidado.gastosFinancieros;

        // Calcular impuestos
        consolidado.impuestos = consolidado.BAI * 0.15;
        totalesJugador.impuestos += consolidado.impuestos;

        // Calcular resultado neto
        consolidado.resultadoNeto = consolidado.BAI - consolidado.impuestos;
        totalesJugador.resultadoNeto += consolidado.resultadoNeto;
    });

    // Validar totales
    validarTotales(roundData, totalesJugador);

    return Object.values(productosConsolidados);
}




function validarTotales(roundData, totalesJugador) {
    const keysToValidate = ["facturacionBruta", "facturacionNeta", "costeVentas", "margenBruto", "gastosComerciales", "gastosPublicidad", "costesAlmacenaje"];

    keysToValidate.forEach((key) => {
        const totalJugador = totalesJugador[key];
        const totalGlobal = roundData[key];

        if (Math.abs(totalJugador - totalGlobal) > 0.01) {
            console.warn(
                `Desviación detectada en ${key}: Jugador (${totalJugador.toFixed(2)}) vs. Global (${totalGlobal ? totalGlobal.toFixed(2) : 0})`
            );
        } else {
            console.log(`Validación exitosa para ${key}: ${totalJugador.toFixed(2)} coincide con ${totalGlobal ? totalGlobal.toFixed(2) : 0}`);
        }
    });
}


function generarEstructuraTabla(productosConsolidados) {
    const tablaContenedor = document.getElementById("tabla-contenedor");

    if (!tablaContenedor) {
        console.error("No se encontró el contenedor de la tabla con ID 'tabla-contenedor'.");
        return;
    }

    tablaContenedor.innerHTML = "";

    productosConsolidados.forEach(producto => {
        const tableWrapper = document.createElement("div");
        tableWrapper.classList.add("producto-tabla");

        const title = document.createElement("h3");
        title.textContent = `Producto: ${producto.producto}`;
        tableWrapper.appendChild(title);

        const table = document.createElement("table");
        table.classList.add("table", "table-striped");

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Partida</th>
                <th>Valor</th>
            </tr>
        `;
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
            { key: "gastosFinancieros", label: "Costes Financieros" }, // Añadido
            { key: "BAI", label: "BAI" },
            { key: "impuestos", label: "Impuestos" }, // Añadido
            { key: "resultadoNeto", label: "Resultado Neto" },
        ];

        partidas.forEach(({ key, label }) => {
            const row = document.createElement("tr");

            const partidaCell = document.createElement("td");
            partidaCell.textContent = label;
            row.appendChild(partidaCell);

            const valueCell = document.createElement("td");
            const value = producto[key] !== undefined && producto[key] !== null ? producto[key] : 0;

            // Lista de partidas que deben verse como negativas visualmente aunque sean positivas
            const partidasNegativasSiempre = [
                "gastosComerciales",
                "gastosPublicidad",
                "costesAlmacenaje",
                "gastosFinancieros",
                "costeVentas",
                "devoluciones",
                "impuestos"
            ];

            // Valor para mostrar en pantalla (negativo si corresponde)
            const mostrarValor = partidasNegativasSiempre.includes(key) ? -value : value;

            // Formatear como moneda
            valueCell.textContent = mostrarValor.toLocaleString("es-ES", {
                style: "currency",
                currency: "EUR"
            });

            // Colorear según signo visual del valor mostrado
            valueCell.style.color = mostrarValor >= 0 ? "green" : "red";

            row.appendChild(valueCell);

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        tablaContenedor.appendChild(tableWrapper);
    });
}



function generarGraficoPorProducto(productosConsolidados) {
    const labels = productosConsolidados.map((p) => p.producto);

    const partidas = [
        { key: "costeVentas", label: "Coste Ventas", color: "#ff6384" },
        { key: "gastosComerciales", label: "Gastos Comerciales", color: "#36a2eb" },
        { key: "gastosPublicidad", label: "Gastos Publicidad", color: "#ffcd56" },
        { key: "costesAlmacenaje", label: "Costes Almacenaje", color: "#4bc0c0" },
        { key: "gastosFinancieros", label: "Costes Financieros", color: "#9966ff" },
        { key: "impuestos", label: "Impuestos", color: "#ff9f40" },
        { key: "resultadoNeto", label: "Resultado Neto", color: "#c45850" },
    ];

    const datasets = partidas.map((partida) => ({
        label: partida.label,
        data: productosConsolidados.map((p) => p[partida.key] || 0),
        backgroundColor: partida.color,
    }));

    const ctx = document.getElementById("gastosProductoChart").getContext("2d");
    new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets,
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "top" },
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true },
            },
        },
    });
}