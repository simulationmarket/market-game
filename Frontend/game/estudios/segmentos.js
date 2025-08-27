const activeCharts = {};

document.addEventListener('DOMContentLoaded', function () {
    const socket = io();

    // Solicitar los datos del mercado al cargar la página
    socket.emit('getMarketData');

    // Escuchar la actualización de los datos del mercado
    socket.on("marketUpdate", (marketData) => {
        console.log("Datos de Market Update recibidos:", marketData);

        // Extraer los segmentos
        const segmentos = marketData.segmentos;
        if (!segmentos) {
            console.error("No se recibieron datos de segmentos");
            return;
        }

        // Colores por segmento
        const colors = {
            profesionales: 'rgba(54, 162, 235, 1)', // Azul
            altosIngresos: 'rgba(255, 206, 86, 1)', // Amarillo
            granConsumidor: 'rgba(75, 192, 192, 1)', // Verde
            bajosIngresos: 'rgba(255, 99, 132, 1)', // Rojo
            innovadores: 'rgba(153, 102, 255, 1)' // Púrpura
        };

        // Crear gráficos de barras para cada segmento
        const createBarChart = (ctxId, dataPoblacionTotal, dataDemanda, label, color) => {
            const canvas = document.getElementById(ctxId);
            if (!canvas) {
                console.error(`Canvas con ID '${ctxId}' no encontrado.`);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error(`No se pudo obtener el contexto para '${ctxId}'.`);
                return;
            }

            // Destruir el gráfico anterior si existe
            if (activeCharts[ctxId]) {
                activeCharts[ctxId].destroy();
            }

            // Crear el gráfico
            activeCharts[ctxId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Población Actual', 'Demanda'],
                    datasets: [
                        {
                            label: label,
                            data: [dataPoblacionTotal, dataDemanda],
                            backgroundColor: [color, `${color.replace('1)', '0.6)')}`],
                            borderColor: color,
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Número de Personas',
                                color: '#fff'
                            },
                            ticks: {
                                color: '#fff'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.2)'
                            }
                        },
                        x: {
                            ticks: {
                                color: '#fff'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.2)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        };

        // Iterar sobre los segmentos y crear gráficos de barras con la demanda
        Object.entries(segmentos).forEach(([segmento, datos]) => {
            // Calcular la demanda como un porcentaje de los usuarios potenciales
            const demanda = datos.usuariosPotenciales * (datos.demandaAno1 / 100);

            // Crear gráficos de barras dinámicamente
            createBarChart(
                `barChart${segmento.charAt(0).toUpperCase() + segmento.slice(1)}`, // ID dinámico
                datos.usuariosPotenciales, // Población actual
                demanda, // Demanda calculada
                segmento.charAt(0).toUpperCase() + segmento.slice(1), // Etiqueta del gráfico
                colors[segmento] // Color correspondiente
            );
        });

        // Crear gráficos de radar para cada segmento
        const createRadarChart = (ctxId, data, label, color) => {
            const canvas = document.getElementById(ctxId);
            if (!canvas) {
                console.error(`Canvas con ID '${ctxId}' no encontrado.`);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error(`No se pudo obtener el contexto para '${ctxId}'.`);
                return;
            }

            // Destruir el gráfico anterior si existe
            if (activeCharts[ctxId]) {
                activeCharts[ctxId].destroy();
            }

            // Crear el gráfico
            activeCharts[ctxId] = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['Pantalla', 'Procesador', 'Batería', 'Placa Base', 'Ergonomía', 'Acabados', 'Color'],
                    datasets: [
                        {
                            label: label,
                            data: data,
                            backgroundColor: `${color.replace('1)', '0.2)')}`,
                            borderColor: color,
                            pointBackgroundColor: color
                        }
                    ]
                },
                options: {
                    scales: {
                        r: {
                            beginAtZero: true,
                            pointLabels: {
                                color: '#fff'
                            },
                            ticks: {
                                color: '#fff',
                                backdropColor: 'transparent'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.2)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#fff'
                            }
                        }
                    }
                }
            });
        };


        // Crear gráficos de radar para cada segmento
        createRadarChart('radarChartProfesionales', [
            segmentos.profesionales.productoIdeal.pantalla,
            segmentos.profesionales.productoIdeal.procesador,
            segmentos.profesionales.productoIdeal.bateria,
            segmentos.profesionales.productoIdeal.placaBase,
            segmentos.profesionales.productoIdeal.ergonomia,
            segmentos.profesionales.productoIdeal.acabados,
            segmentos.profesionales.productoIdeal.color
        ], 'Profesionales', colors.profesionales);

        createRadarChart('radarChartAltosIngresos', [
            segmentos.altosIngresos.productoIdeal.pantalla,
            segmentos.altosIngresos.productoIdeal.procesador,
            segmentos.altosIngresos.productoIdeal.bateria,
            segmentos.altosIngresos.productoIdeal.placaBase,
            segmentos.altosIngresos.productoIdeal.ergonomia,
            segmentos.altosIngresos.productoIdeal.acabados,
            segmentos.altosIngresos.productoIdeal.color
        ], 'Altos Ingresos', colors.altosIngresos);
        
        createRadarChart('radarChartGranConsumidor', [
            segmentos.granConsumidor.productoIdeal.pantalla,
            segmentos.granConsumidor.productoIdeal.procesador,
            segmentos.granConsumidor.productoIdeal.bateria,
            segmentos.granConsumidor.productoIdeal.placaBase,
            segmentos.granConsumidor.productoIdeal.ergonomia,
            segmentos.granConsumidor.productoIdeal.acabados,
            segmentos.granConsumidor.productoIdeal.color
        ], 'Gran Consumidor', colors.granConsumidor);
        
        createRadarChart('radarChartBajosIngresos', [
            segmentos.bajosIngresos.productoIdeal.pantalla,
            segmentos.bajosIngresos.productoIdeal.procesador,
            segmentos.bajosIngresos.productoIdeal.bateria,
            segmentos.bajosIngresos.productoIdeal.placaBase,
            segmentos.bajosIngresos.productoIdeal.ergonomia,
            segmentos.bajosIngresos.productoIdeal.acabados,
            segmentos.bajosIngresos.productoIdeal.color
        ], 'Bajos Ingresos', colors.bajosIngresos);
        
        createRadarChart('radarChartInnovadores', [
            segmentos.innovadores.productoIdeal.pantalla,
            segmentos.innovadores.productoIdeal.procesador,
            segmentos.innovadores.productoIdeal.bateria,
            segmentos.innovadores.productoIdeal.placaBase,
            segmentos.innovadores.productoIdeal.ergonomia,
            segmentos.innovadores.productoIdeal.acabados,
            segmentos.innovadores.productoIdeal.color
        ], 'Innovadores', colors.innovadores);

    // Función para convertir una ecuación en cadena a una función ejecutable
function convertirCadenaAFuncion(equation) {
    try {
        const fn = new Function("x", `return ${equation.replace('y =', '')};`);
        return fn;
    } catch (error) {
        console.error("Error al convertir la cadena a función:", error);
        return () => 0; // Retorna una función predeterminada que siempre devuelve 0
    }
}

// Función para crear gráficos de la curva de sensibilidad
const createSensitivityChart = (ctxId, equation, label, color) => {
    const canvas = document.getElementById(ctxId);
    if (!canvas) {
        console.error(`Canvas con ID '${ctxId}' no encontrado.`);
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(`No se pudo obtener el contexto para '${ctxId}'.`);
        return;
    }

    // Destruir el gráfico anterior si existe
    if (activeCharts[ctxId]) {
        activeCharts[ctxId].destroy();
    }

    // Convertir la ecuación a función si es una cadena
    let sensibilidadFuncion;
    if (typeof equation === "string") {
        sensibilidadFuncion = convertirCadenaAFuncion(equation);
    } else if (typeof equation === "function") {
        sensibilidadFuncion = equation;
    } else {
        console.error("Ecuación no válida:", equation);
        return;
    }

    // Calcular los datos
    const xValues = [];
    const yValues = [];
    for (let x = 100; x <= 900; x += 10) { // Precios de 0 a 800
        const y = sensibilidadFuncion(x); // Calcular la demanda
        const yPercentage = Math.max(0, Math.min(110, y)); // Limitar entre 0% y 110%
        xValues.push(x);
        yValues.push(yPercentage);
    }

    // Crear el gráfico
    activeCharts[ctxId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: xValues,
            datasets: [
                {
                    label: label,
                    data: yValues,
                    backgroundColor: `${color.replace('1)', '0.2)')}`,
                    borderColor: color,
                    fill: true
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 110,
                    title: {
                        display: true,
                        text: 'Porcentaje de Demanda (%)',
                        color: '#fff'
                    },
                    ticks: {
                        color: '#fff',
                        callback: (value) => value + '%'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Precio',
                        color: '#fff'
                    },
                    ticks: {
                        color: '#fff',
                        stepSize: 75
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            }
        }
    });
};

const sensitivityEquations = {};

// Crear las ecuaciones dinámicamente desde los datos del servidor
for (const segmento in marketData.segmentos) {
    const funcionSensibilidad = marketData.segmentos[segmento].funcionSensibilidad;
    try {
        // Evaluar la cadena de la función y convertirla en una función ejecutable
        sensitivityEquations[segmento] = new Function("return " + funcionSensibilidad)();
    } catch (error) {
        console.error(`Error al procesar la función de sensibilidad para el segmento ${segmento}:`, error);
        sensitivityEquations[segmento] = () => 0; // Función por defecto
    }
}

// Crear gráficos dinámicamente para cada segmento
for (const segmento in sensitivityEquations) {
    createSensitivityChart(
        `sensitivityChart${segmento.charAt(0).toUpperCase() + segmento.slice(1)}`, // ID del canvas
        sensitivityEquations[segmento], // Ecuación de sensibilidad ejecutable
        segmento.charAt(0).toUpperCase() + segmento.slice(1), // Etiqueta del gráfico
        colors[segmento] // Color asociado
    );
}


// Crear gráficos para cada segmento
createSensitivityChart('sensitivityChartProfesionales', sensitivityEquations.profesionales, 'Profesionales', colors.profesionales);
createSensitivityChart('sensitivityChartAltosIngresos', sensitivityEquations.altosIngresos, 'Altos Ingresos', colors.altosIngresos);
createSensitivityChart('sensitivityChartGranConsumidor', sensitivityEquations.granConsumidor, 'Gran Consumidor', colors.granConsumidor);
createSensitivityChart('sensitivityChartBajosIngresos', sensitivityEquations.bajosIngresos, 'Bajos Ingresos', colors.bajosIngresos);
createSensitivityChart('sensitivityChartInnovadores', sensitivityEquations.innovadores, 'Innovadores', colors.innovadores);
})
    socket.emit('getMarketData'); // Emit para solicitar datos del mercado
});
