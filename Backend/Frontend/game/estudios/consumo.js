document.addEventListener('DOMContentLoaded', function () {
    const socket = io();
    const ctx = document.getElementById('consumoChart').getContext('2d');
    let consumoChart;

    // ----------- ESTADO COMPARTIDO -----------
    let demandaPorSegmento = {};     // llega por marketUpdate (para Venta Bruta)
    let consumoPorSegmento = {};     // llega por resultadosFinales (para Venta Neta)
    let tieneMarket = false;
    let tieneResultados = false;

    // ----------- COLORES / HELPERS -----------
    const coloresBase = {
        profesionales: 'rgba(54, 162, 235',
        altosIngresos: 'rgba(255, 206, 86',
        granConsumidor: 'rgba(75, 192, 192',
        bajosIngresos: 'rgba(255, 99, 132',
        innovadores: 'rgba(153, 102, 255'
    };
    function colorSeg(seg, alpha = 0.9) {
        const base = coloresBase[seg] || 'rgba(200, 200, 200';
        return `${base}, ${alpha})`;
    }

    // Gráficos individuales para cada segmento
    const segmentCharts = {};
    const gastoCharts = {};
    const segmentCanvasIds = {
        profesionales: 'consumoProfesionales',
        altosIngresos: 'consumoAltosIngresos',
        granConsumidor: 'consumoGranConsumidor',
        bajosIngresos: 'consumoBajosIngresos',
        innovadores: 'consumoInnovadores'
    };

    const gastoCanvasIds = {
        profesionales: 'gastoProfesionales',
        altosIngresos: 'gastoAltosIngresos',
        granConsumidor: 'gastoGranConsumidor',
        bajosIngresos: 'gastoBajosIngresos',
        innovadores: 'gastoInnovadores'
    };

    const colors = {
        granDistribucion: 'rgba(54, 162, 235, 0.7)', // Azul
        minoristas: 'rgba(255, 206, 86, 0.7)',      // Amarillo
        online: 'rgba(75, 192, 192, 0.7)',          // Verde
        tiendaPropia: 'rgba(255, 99, 132, 0.7)'     // Rojo
    };

    function generarColorPorProducto(producto = '') {
        const hash = [...producto].reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const r = (hash * 37) % 255;
        const g = (hash * 67) % 255;
        const b = (hash * 97) % 255;
        return `rgba(${r}, ${g}, ${b}, 0.7)`; // Color con transparencia
    }

    const porcentajeCanvasIds = {
        profesionales: 'porcentajeProfesionales',
        altosIngresos: 'porcentajeAltosIngresos',
        granConsumidor: 'porcentajeGranConsumidor',
        bajosIngresos: 'porcentajeBajosIngresos',
        innovadores: 'porcentajeInnovadores'
    };
    const porcentajeCharts = {}; // Para almacenar los gráficos de porcentaje

    // ----------- CONEXIÓN -----------
    socket.on('connect', () => {
        console.log("Conectado al servidor. Solicitando datos...");
        socket.emit('solicitarResultados'); // Solicita los resultados al servidor
        // Si tu backend tiene este evento, lo pedimos. Si no, puedes quitar esta línea.
        socket.emit('getMarketData');
    });

    // ----------- MARKET UPDATE -> DEMANDA (Venta Bruta) -----------
    socket.on('marketUpdate', (marketData) => {
        console.log("Datos de mercado recibidos:", marketData);

        demandaPorSegmento = Object.fromEntries(
            Object.entries(marketData?.segmentos || {}).map(([seg, d]) => {
                const unidades = (typeof d?.unidades === 'number')
                    ? d.unidades
                    : ((parseFloat(d?.usuariosPotenciales) || 0) * ((parseFloat(d?.demandaAno1) || 0) / 100));
                return [seg, Math.round(unidades)];
            })
        );

        console.log("Demanda por segmento:", demandaPorSegmento);
        tieneMarket = true;
        renderConsumoPrincipalSiListo();
    });

    // ----------- RESULTADOS FINALES -> CONSUMO (Venta Neta) -----------
    socket.on('resultadosFinales', (resultadosFinales) => {
        console.log("Resultados finales recibidos:", resultadosFinales);

        // Calcular las unidades netas y gasto promedio por segmento y canal
        consumoPorSegmento = {};
        const consumoPorSegmentoYCanal = {};
        const gastoPorSegmentoYCanal = {};

        resultadosFinales.forEach(data => {
            const segmento = data.segmento;
            const canal = data.canal;
            const unidadesNetas = parseFloat(data.unidadesNetas) || 0;
            const precio = parseFloat(data.precio) || 0;

            // Sumar por segmento (NETO)
            if (!consumoPorSegmento[segmento]) {
                consumoPorSegmento[segmento] = 0;
            }
            consumoPorSegmento[segmento] += unidadesNetas;

            // Sumar por segmento y canal
            if (!consumoPorSegmentoYCanal[segmento]) {
                consumoPorSegmentoYCanal[segmento] = {};
            }
            if (!consumoPorSegmentoYCanal[segmento][canal]) {
                consumoPorSegmentoYCanal[segmento][canal] = 0;
            }
            consumoPorSegmentoYCanal[segmento][canal] += unidadesNetas;

            // Calcular gasto promedio por segmento y canal
            if (!gastoPorSegmentoYCanal[segmento]) {
                gastoPorSegmentoYCanal[segmento] = {};
            }
            if (!gastoPorSegmentoYCanal[segmento][canal]) {
                gastoPorSegmentoYCanal[segmento][canal] = { totalGasto: 0, totalUnidades: 0 };
            }
            gastoPorSegmentoYCanal[segmento][canal].totalGasto += precio * unidadesNetas;
            gastoPorSegmentoYCanal[segmento][canal].totalUnidades += unidadesNetas;
        });

        console.log("Consumo total por segmento:", consumoPorSegmento);
        console.log("Consumo por segmento y canal:", consumoPorSegmentoYCanal);
        console.log("Gasto promedio por segmento y canal:", gastoPorSegmentoYCanal);

        // ----------- GRÁFICO PRINCIPAL (se dibuja más abajo cuando haya market + resultados) -----------
        tieneResultados = true;
        renderConsumoPrincipalSiListo();

        // ----------- GRÁFICOS POR SEGMENTO (consumo por canal) -----------
        Object.keys(segmentCanvasIds).forEach(segmento => {
            const canvasId = segmentCanvasIds[segmento];
            const el = document.getElementById(canvasId);
            if (!el) return; // por si no existe el canvas
            const ctxSegmento = el.getContext('2d');

            const dataPorCanal = consumoPorSegmentoYCanal[segmento] || {};
            const labelsPorCanal = Object.keys(dataPorCanal);
            const valuesPorCanal = Object.values(dataPorCanal);

            if (segmentCharts[segmento]) {
                segmentCharts[segmento].destroy(); // Destruir gráfico previo si existe
            }

            segmentCharts[segmento] = new Chart(ctxSegmento, {
                type: 'bar',
                data: {
                    labels: labelsPorCanal,
                    datasets: [{
                        label: `Consumo por Canal (${segmento})`,
                        data: valuesPorCanal,
                        backgroundColor: labelsPorCanal.map(canal => colors[canal] || 'rgba(0,0,0,0.7)'),
                        borderColor: labelsPorCanal.map(canal => colors[canal] || 'rgba(0,0,0,1)'),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Unidades Netas Consumidas',
                                font: { size: 14 },
                                color: '#fff'
                            },
                            ticks: { color: '#fff', callback: value => value.toLocaleString() }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Canales de Distribución',
                                font: { size: 14 },
                                color: '#fff'
                            },
                            ticks: { color: '#fff' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                font: { size: 12 },
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        });

        // ----------- GRÁFICOS DE GASTO PROMEDIO -----------
        Object.keys(gastoCanvasIds).forEach(segmento => {
            const canvasId = gastoCanvasIds[segmento];
            const el = document.getElementById(canvasId);
            if (!el) return;
            const ctxGasto = el.getContext('2d');

            const dataPorCanal = gastoPorSegmentoYCanal[segmento] || {};
            const labelsPorCanal = Object.keys(dataPorCanal);
            const valuesPorCanal = labelsPorCanal.map(canal => {
                const gasto = dataPorCanal[canal];
                return gasto.totalUnidades > 0 ? gasto.totalGasto / gasto.totalUnidades : 0;
            });

            if (gastoCharts[segmento]) {
                gastoCharts[segmento].destroy(); // Destruir gráfico previo si existe
            }

            gastoCharts[segmento] = new Chart(ctxGasto, {
                type: 'bar',
                data: {
                    labels: labelsPorCanal,
                    datasets: [{
                        label: `Gasto Promedio por Canal (${segmento})`,
                        data: valuesPorCanal,
                        backgroundColor: labelsPorCanal.map(canal => colors[canal] || 'rgba(0,0,0,0.7)'),
                        borderColor: labelsPorCanal.map(canal => colors[canal] || 'rgba(0,0,0,1)'),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Precio Promedio (Unidades Monetarias)',
                                font: { size: 14 },
                                color: '#fff'
                            },
                            ticks: { color: '#fff', callback: value => Number(value).toFixed(2) }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Canales de Distribución',
                                font: { size: 14 },
                                color: '#fff'
                            },
                            ticks: { color: '#fff' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                font: { size: 12 },
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        });

        // ----------- PORCENTAJE POR PRODUCTO -----------
        const consumoPorSegmentoYProducto = {};
        resultadosFinales.forEach(data => {
            const segmento = data.segmento;
            const producto = data.producto;
            const unidadesNetas = parseFloat(data.unidadesNetas) || 0;

            if (!consumoPorSegmentoYProducto[segmento]) {
                consumoPorSegmentoYProducto[segmento] = {};
            }
            if (!consumoPorSegmentoYProducto[segmento][producto]) {
                consumoPorSegmentoYProducto[segmento][producto] = 0;
            }
            consumoPorSegmentoYProducto[segmento][producto] += unidadesNetas;
        });

        Object.keys(porcentajeCanvasIds).forEach(segmento => {
            const canvasId = porcentajeCanvasIds[segmento];
            const el = document.getElementById(canvasId);
            if (!el) return;
            const ctxPorcentaje = el.getContext('2d');

            const dataPorProducto = consumoPorSegmentoYProducto[segmento] || {};
            const totalUnidadesSegmento = Object.values(dataPorProducto).reduce((a, b) => a + b, 0);
            const labelsPorProducto = Object.keys(dataPorProducto);
            const valuesPorProducto = labelsPorProducto.map(
                producto => totalUnidadesSegmento > 0
                    ? ((dataPorProducto[producto] / totalUnidadesSegmento) * 100).toFixed(2)
                    : 0
            );

            const coloresPorProducto = labelsPorProducto.map(producto => generarColorPorProducto(producto));

            if (porcentajeCharts[segmento]) {
                porcentajeCharts[segmento].destroy(); // Destruir gráfico previo si existe
            }

            porcentajeCharts[segmento] = new Chart(ctxPorcentaje, {
                type: 'bar',
                data: {
                    labels: labelsPorProducto,
                    datasets: [{
                        label: `Porcentaje de Consumo (${segmento})`,
                        data: valuesPorProducto,
                        backgroundColor: coloresPorProducto,
                        borderColor: coloresPorProducto.map(color => color.replace('0.7', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Porcentaje (%)',
                                font: { size: 14 },
                                color: '#fff'
                            },
                            ticks: { color: '#fff', callback: value => `${value}%` }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Productos',
                                font: { size: 14 },
                                color: '#fff'
                            },
                            ticks: { color: '#fff' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                font: { size: 12 },
                                color: '#fff'
                            }
                        },
                        tooltip: { enabled: true }
                    }
                }
            });
        });
    });

    // ----------- RENDER PRINCIPAL (espera a tener market + resultados) -----------
    function renderConsumoPrincipalSiListo() {
        if (!tieneMarket || !tieneResultados) return;

        const labels = Object.keys(demandaPorSegmento);          // segmentos del mercado
        const datosBrutos = labels.map(s => demandaPorSegmento[s] || 0); // Venta Bruta = DEMANDA
        const datosNetos = labels.map(s => consumoPorSegmento[s] || 0);  // Venta Neta = consumo real

        if (consumoChart) consumoChart.destroy();

        consumoChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Demanda',
                        data: datosBrutos,
                        backgroundColor: labels.map(s => colorSeg(s, 0.3)),
                        borderWidth: 0,
                        barThickness: 60,
                        order: 1
                    },
                    {
                        label: 'Venta Neta',
                        data: datosNetos,
                        backgroundColor: labels.map(s => colorSeg(s, 0.9)),
                        borderColor: labels.map(s => colorSeg(s, 1)),
                        borderWidth: 1,
                        barThickness: 60,
                        order: 2
                    }
                ]
            },
            options: {
                indexAxis: 'x',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: false,
                        title: {
                            display: true,
                            text: 'Segmentos',
                            font: { size: 20 },
                            color: '#fff'
                        },
                        ticks: { color: '#fff', font: { size: 16 } }
                    },
                    y: {
                        stacked: false,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Unidades por Segmento',
                            font: { size: 20 },
                            color: '#fff'
                        },
                        ticks: {
                            color: '#fff',
                            font: { size: 16 },
                            callback: value => Number(value).toLocaleString()
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            font: { size: 18 },
                            color: '#fff'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const valor = Number(ctx.raw || 0).toLocaleString();
                                return `${ctx.dataset.label}: ${valor} unidades`;
                            }
                        }
                    }
                }
            }
        });
    }
});
