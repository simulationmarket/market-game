document.addEventListener('DOMContentLoaded', function () {
    const socket = io();

    // Registrar el plugin para etiquetas
    Chart.register(ChartDataLabels);

    // Definir colores para los segmentos
    const colors = {
        profesionales: 'rgba(54, 162, 235, 1)', // Azul
        altosIngresos: 'rgba(255, 206, 86, 1)', // Amarillo
        granConsumidor: 'rgba(75, 192, 192, 1)', // Verde
        bajosIngresos: 'rgba(255, 99, 132, 1)', // Rojo
        innovadores: 'rgba(153, 102, 255, 1)' // Púrpura
    };

    const posicionamientoData = [];
    const productosData = [];

    // Solicitar los datos del mercado
    socket.emit('getMarketData');
    socket.on("marketUpdate", (data) => {
        console.log("Datos de mercado recibidos:", data);

        const segmentos = data.segmentos;

        for (const segmento in segmentos) {
            if (segmentos.hasOwnProperty(segmento)) {
                const datosSegmento = segmentos[segmento];

                // Extraer la función de sensibilidad
                const funcionTexto = datosSegmento.funcionSensibilidad.replace("function anonymous", "function");

                // Extraer los coeficientes de la función cuadrática
                const coeficientes = funcionTexto.match(/-?\d+(\.\d+)?/g); // Captura números con decimales y signos
                if (coeficientes && coeficientes.length >= 3) {
                    const a = parseFloat(coeficientes[0]); // Coeficiente de x^2
                    const b = parseFloat(coeficientes[1]); // Coeficiente de x
                    const c = parseFloat(coeficientes[2]); // Término independiente

                    // Calcular el valor máximo (Precio)
                    const xMax = -c / (2 * a);

                    // Calcular la calidad (Y) como el promedio del producto ideal
                    const valoresProductoIdeal = Object.values(datosSegmento.productoIdeal);
                    const calidadPromedio = valoresProductoIdeal.reduce((a, b) => a + b, 0) / valoresProductoIdeal.length;

                    // Añadir el punto al dataset
                    posicionamientoData.push({
                        x: xMax * 0.02, // Escalar si es necesario
                        y: calidadPromedio,
                        label: segmento,
                        backgroundColor: colors[segmento], // Asignar color
                        pointStyle: 'circle' // Segmentos representados como círculos
                    });
                } else {
                    console.error(`Error al extraer coeficientes para el segmento: ${segmento}`);
                }
            }
        }
    });

    // Solicitar los estados de los jugadores
    socket.emit('solicitarEstadosJugadores');
    socket.on('todosLosEstados', (estados = []) => {
  console.log("Estados de jugadores recibidos:", estados);

  // Si no hay estados, no hacemos nada
  if (!Array.isArray(estados) || estados.length === 0) {
    renderPosicionamientoChart([...posicionamientoData, ...productosData]);
    renderPrecioPorJugador([]);
    return;
  }

  // Procesar productos de los jugadores para posicionamiento (defensivo)
  estados.forEach(estado => {
    const productos = Array.isArray(estado.products) ? estado.products : [];
    productos.forEach(producto => {
      // Fallback: si no hay caracteristicasAjustadas aún, usamos caracteristicas; si tampoco, vacío
      const ajustadas = producto?.caracteristicasAjustadas || producto?.caracteristicas || {};
      const vals = Object.values(ajustadas).map(v => parseFloat(v) || 0);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

      // Fallback de precio: precioPercibido → pvp → precio → 0
      const precioBase = [producto?.precioPercibido, producto?.pvp, producto?.precio]
        .find(v => typeof v === 'number' && isFinite(v)) ?? 0;

      productosData.push({
        x: precioBase * 0.02,
        y: avg,
        label: producto?.nombre || 'Producto',
        backgroundColor: 'rgba(255, 255, 255, 1)', // blanco
        pointStyle: 'rectRot'
      });
    });
  });

  // Renderizar gráficos
  renderPosicionamientoChart([...posicionamientoData, ...productosData]);
  renderPrecioPorJugador(estados);
});


    function renderPosicionamientoChart(data) {
        const ctx = document.getElementById('posicionamientoChart').getContext('2d');

        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: data.map(d => ({
                    label: d.label,
                    data: [{ x: d.x, y: d.y }],
                    backgroundColor: d.backgroundColor,
                    borderColor: d.backgroundColor,
                    pointRadius: 6,
                    pointStyle: d.pointStyle
                }))
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false // Ocultar la leyenda
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const dataset = context.dataset;
                                const punto = dataset.data[context.dataIndex];
                                return `${dataset.label}: (Precio: ${punto.x.toFixed(2)}, Calidad: ${punto.y.toFixed(2)})`;
                            }
                        }
                    },
                    datalabels: {
                        display: true, // Mostrar etiquetas
                        anchor: 'end',
                        align: 'end',
                        color: 'white',
                        font: {
                            weight: 'bold'
                        },
                        formatter: (value, context) => context.dataset.label // Mostrar el nombre del segmento o producto
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Precio (X)',
                            color: 'white',
                            font: {
                                weight: 'bold'
                            }
                        },
                        min: 0,
                        max: 20,
                        ticks: {
                            stepSize: 1,
                            color: 'white'
                        },
                        grid: {
                            color: (ctx) => {
                                return ctx.tick.value === 10 ? 'white' : 'rgba(255, 255, 255, 0.2)';
                            },
                            lineWidth: (ctx) => {
                                return ctx.tick.value === 10 ? 2 : 1;
                            },
                            borderColor: 'white'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Calidad (Y)',
                            color: 'white',
                            font: {
                                weight: 'bold'
                            }
                        },
                        min: 0,
                        max: 20,
                        ticks: {
                            stepSize: 1,
                            color: 'white'
                        },
                        grid: {
                            color: (ctx) => {
                                return ctx.tick.value === 10 ? 'white' : 'rgba(255, 255, 255, 0.2)';
                            },
                            lineWidth: (ctx) => {
                                return ctx.tick.value === 10 ? 2 : 1;
                            },
                            borderColor: 'white'
                        }
                    }
                }
            }
        });
    }

    const renderPrecioPorJugador = (jugadores) => {
        const container = document.getElementById('precios-container');
        container.innerHTML = ''; // Limpiar contenido previo
    
        // Crear un único canvas dentro de su contenedor
        const chartContainer = document.createElement('div');
        chartContainer.classList.add('chart-item');
        chartContainer.style.width = '100%'; // Ocupar todo el ancho disponible
        chartContainer.style.maxWidth = 'none'; // Eliminar límites de ancho
        chartContainer.style.height = '800px'; // Incrementar la altura para hacerlo más grande
    
        const canvas = document.createElement('canvas');
        canvas.id = 'graficoPrecios';
        canvas.style.width = '100%'; // Asegurar que el canvas ocupe todo el ancho
        canvas.style.height = '100%'; // Ajustar la altura al contenedor
        chartContainer.appendChild(canvas);
        container.appendChild(chartContainer);
    
       
    
        // Colores predefinidos
        const predefinedColors = [
            'rgba(54, 162, 235, 1)', // Azul
            'rgba(255, 206, 86, 1)', // Amarillo
            'rgba(75, 192, 192, 1)', // Verde
            'rgba(255, 99, 132, 1)', // Rojo
            'rgba(153, 102, 255, 1)', // Púrpura
            'rgba(255, 159, 64, 1)', // Naranja
            'rgba(201, 203, 207, 1)' // Gris claro
        ];
    const productos = [];
        // Recolectar todos los productos únicos
        jugadores.forEach((jugador) => {
            jugador.products.forEach((producto) => {
                if (!productos.includes(producto.nombre) && producto.pvp > 0) {
                    productos.push(producto.nombre); // Agregar productos únicos con PVP mayor a 0
                }
            });
        });
    
       // 1. Recolectar todos los productos únicos
    
    jugadores.forEach((jugador) => {
        jugador.products.forEach((producto) => {
            if (!productos.includes(producto.nombre)) {
                productos.push(producto.nombre);
            }
        });
    });

    // 2. Crear datasets por jugador
    const datasets = jugadores.map((jugador, index) => {
        const color = predefinedColors[index % predefinedColors.length];
        const data = productos.map(nombreBuscado => {
            const producto = jugador.products.find(p => p.nombre === nombreBuscado);
            return producto?.pvp ?? producto?.precioPercibido ?? producto?.precio ?? null;
        });

        return {
            label: jugador.nombre || jugador.playerName || `Jugador ${index + 1}`,
            data: data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
        };
    });

    // 3. Crear gráfico
    new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: productos, // eje X: nombre de producto
            datasets: datasets  // una barra por jugador por producto
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: 'white'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const value = context.raw;
                            return value !== null ? `${context.dataset.label}: PVP ${value.toFixed(2)}` : null;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Productos',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'PVP',
                        color: 'white'
                    },
                    ticks: {
                        color: 'white',
                        beginAtZero: true
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            }
        }
    });
};
    
    
    
    

    // Solicitar resultados cuando el cliente se conecte
    socket.on('connect', () => {
        console.log("Conectado al servidor. Solicitando resultados...");
        socket.emit('solicitarResultados'); // Solicita los resultados al servidor
    });

    // Escuchar los resultados finales enviados por el servidor
    socket.on('resultadosFinales', (resultadosFinales) => {
        console.log("Resultados finales recibidos:", resultadosFinales);
        const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];
        const cuotasPorCanal = {};
    
        // Inicializar estructura
        canales.forEach(canal => {
            cuotasPorCanal[canal] = {};
        });
    
        // Calcular cuotas
        resultadosFinales.forEach(({ jugador, canal, unidadesVendidas }) => {
    if (!canal || !jugador || isNaN(parseFloat(unidadesVendidas))) return;
    if (!cuotasPorCanal[canal][jugador]) {
        cuotasPorCanal[canal][jugador] = 0;
    }
    cuotasPorCanal[canal][jugador] += parseFloat(unidadesVendidas);
});

    
        console.log("Cuotas calculadas por canal:", cuotasPorCanal);
    
        // Crear gráficos
        renderCuotasPorCanal(canales, cuotasPorCanal);
    });
    
    function renderCuotasPorCanal(canales, cuotasPorCanal) {
        // Colores predefinidos para los jugadores
        const predefinedColors = [
            'rgba(28, 13, 224, 0.79)', // Azul
            'rgba(206, 160, 44, 0.73)', // Amarillo
            'rgba(60, 223, 223, 0.84)', // Verde
            'rgba(255, 99, 132, 0.6)', // Rojo
            'rgba(124, 64, 243, 0.72)', // Púrpura
            'rgba(235, 125, 15, 0.6)', // Naranja
            'rgba(35, 118, 212, 0.93)' // Gris claro
        ];
    
        canales.forEach((canal, index) => {
            const canalId = `canal${index + 1}Chart`;
            const container = document.getElementById(canalId);
    
            if (!container) {
                console.error(`No se encontró el elemento <canvas> con ID ${canalId}.`);
                return;
            }
    
            const totalDemanda = Object.values(cuotasPorCanal[canal]).reduce((a, b) => a + b, 0);
    
            if (totalDemanda === 0) {
                console.warn(`No hay datos para el canal ${canal}.`);
                return;
            }
    
            const labels = Object.keys(cuotasPorCanal[canal]);
            const data = labels.map(jugador => (cuotasPorCanal[canal][jugador] / totalDemanda) * 100);
    
            // Asignar colores a los jugadores
            const backgroundColors = labels.map((_, index) => predefinedColors[index % predefinedColors.length]);
            const borderColors = labels.map((_, index) => predefinedColors[index % predefinedColors.length].replace('0.6', '1')); // Versión sólida del color
    
            console.log(`Datos para el gráfico del canal ${canal}:`, { labels, data });
    
            try {
                new Chart(container.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: `Cuota de Canal (${canal})`,
                            data: data,
                            backgroundColor: backgroundColors,
                            borderColor: borderColors,
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false // Ocultar la leyenda
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => `${context.raw.toFixed(2)}%` // Mostrar dos decimales en el tooltip
                                }
                            },
                            datalabels: {
                                anchor: 'end',
                                align: 'start',
                                color: 'white',
                                formatter: (value) => `${value.toFixed(2)}%` // Formato con dos decimales
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Jugadores',
                                    color: 'white',
                                    font: { weight: 'bold' }
                                },
                                ticks: { color: 'white' },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.2)',
                                    borderColor: 'white'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Cuota (%)',
                                    color: 'white',
                                    font: { weight: 'bold' }
                                },
                                ticks: { color: 'white', beginAtZero: true },
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.2)',
                                    borderColor: 'white'
                                }
                            }
                        }
                    },
                    plugins: [ChartDataLabels] // Activar el plugin de datalabels
                });
            } catch (error) {
                console.error(`Error al crear el gráfico para ${canal}:`, error);
            }
        });
    }
    
    
    
});    