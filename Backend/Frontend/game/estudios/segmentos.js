const activeCharts = {};

document.addEventListener('DOMContentLoaded', function () {
    const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],  // ✅ permite fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

    // === MULTISALA + nombre del jugador ===
    const params = new URLSearchParams(location.search);
    const partidaId = params.get('partidaId') || localStorage.getItem('partidaId') || 'default';
    const playerName = localStorage.getItem('playerName') || params.get('playerName') || null;

    // Unirse a la sala de la partida (con nombre si lo tenemos)
    socket.emit('joinGame', { partidaId, nombre: playerName });

    // (Opcional) informar el nombre al backend si tienes este listener
    if (playerName) socket.emit('identificarJugador', playerName);

    // Solicitar los datos del mercado para ESTA partida
    socket.emit('getMarketData', { partidaId });

    // Re-emitir al reconectar (útil si el socket se reinicia)
    socket.on('connect', () => {
        socket.emit('joinGame', { partidaId, nombre: playerName });
        if (playerName) socket.emit('identificarJugador', playerName);
        socket.emit('getMarketData', { partidaId });
    });

    // Escuchar la actualización de los datos del mercado
    socket.on("marketUpdate", (marketData) => {
        if (!marketData) return;
        // Si el backend etiqueta por partida, filtra para evitar cruzar partidas
        if (marketData.partidaId && marketData.partidaId !== partidaId) return;

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

        // ========= BARRAS =========
        const createBarChart = (ctxId, dataPoblacionTotal, dataDemanda, label, color) => {
            const canvas = document.getElementById(ctxId);
            if (!canvas) { console.error(`Canvas '${ctxId}' no encontrado.`); return; }
            const ctx = canvas.getContext('2d');
            if (!ctx) { console.error(`No se pudo obtener 2D context para '${ctxId}'.`); return; }

            if (activeCharts[ctxId]) activeCharts[ctxId].destroy();

            activeCharts[ctxId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Población Actual', 'Demanda'],
                    datasets: [{
                        label,
                        data: [dataPoblacionTotal, dataDemanda],
                        backgroundColor: [color, color.replace('1)', '0.6)')],
                        borderColor: color,
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Número de Personas', color: '#fff' },
                            ticks: { color: '#fff' },
                            grid: { color: 'rgba(255,255,255,0.2)' }
                        },
                        x: {
                            ticks: { color: '#fff' },
                            grid: { color: 'rgba(255,255,255,0.2)' }
                        }
                    },
                    plugins: { legend: { labels: { color: '#fff' } } }
                }
            });
        };

        // Crear barras por segmento
        Object.entries(segmentos).forEach(([segmento, datos]) => {
            const demanda = Number(datos.usuariosPotenciales) * (Number(datos.demandaAno1) / 100);
            createBarChart(
                `barChart${segmento.charAt(0).toUpperCase() + segmento.slice(1)}`,
                Number(datos.usuariosPotenciales) || 0,
                Number.isFinite(demanda) ? demanda : 0,
                segmento.charAt(0).toUpperCase() + segmento.slice(1),
                colors[segmento]
            );
        });

        // ========= RADAR =========
        const createRadarChart = (ctxId, data, label, color) => {
            const canvas = document.getElementById(ctxId);
            if (!canvas) { console.error(`Canvas '${ctxId}' no encontrado.`); return; }
            const ctx = canvas.getContext('2d');
            if (!ctx) { console.error(`No se pudo obtener 2D context para '${ctxId}'.`); return; }

            if (activeCharts[ctxId]) activeCharts[ctxId].destroy();

            activeCharts[ctxId] = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['Pantalla', 'Procesador', 'Batería', 'Placa Base', 'Ergonomía', 'Acabados', 'Color'],
                    datasets: [{
                        label,
                        data,
                        backgroundColor: color.replace('1)', '0.2)'),
                        borderColor: color,
                        pointBackgroundColor: color
                    }]
                },
                options: {
                    scales: {
                        r: {
                            beginAtZero: true,
                            pointLabels: { color: '#fff' },
                            ticks: { color: '#fff', backdropColor: 'transparent' },
                            grid: { color: 'rgba(255,255,255,0.2)' }
                        }
                    },
                    plugins: { legend: { labels: { color: '#fff' } } }
                }
            });
        };

        // Crear radars
        const s = segmentos;
        createRadarChart('radarChartProfesionales', [
            s.profesionales.productoIdeal.pantalla,
            s.profesionales.productoIdeal.procesador,
            s.profesionales.productoIdeal.bateria,
            s.profesionales.productoIdeal.placaBase,
            s.profesionales.productoIdeal.ergonomia,
            s.profesionales.productoIdeal.acabados,
            s.profesionales.productoIdeal.color
        ], 'Profesionales', colors.profesionales);

        createRadarChart('radarChartAltosIngresos', [
            s.altosIngresos.productoIdeal.pantalla,
            s.altosIngresos.productoIdeal.procesador,
            s.altosIngresos.productoIdeal.bateria,
            s.altosIngresos.productoIdeal.placaBase,
            s.altosIngresos.productoIdeal.ergonomia,
            s.altosIngresos.productoIdeal.acabados,
            s.altosIngresos.productoIdeal.color
        ], 'Altos Ingresos', colors.altosIngresos);

        createRadarChart('radarChartGranConsumidor', [
            s.granConsumidor.productoIdeal.pantalla,
            s.granConsumidor.productoIdeal.procesador,
            s.granConsumidor.productoIdeal.bateria,
            s.granConsumidor.productoIdeal.placaBase,
            s.granConsumidor.productoIdeal.ergonomia,
            s.granConsumidor.productoIdeal.acabados,
            s.granConsumidor.productoIdeal.color
        ], 'Gran Consumidor', colors.granConsumidor);

        createRadarChart('radarChartBajosIngresos', [
            s.bajosIngresos.productoIdeal.pantalla,
            s.bajosIngresos.productoIdeal.procesador,
            s.bajosIngresos.productoIdeal.bateria,
            s.bajosIngresos.productoIdeal.placaBase,
            s.bajosIngresos.productoIdeal.ergonomia,
            s.bajosIngresos.productoIdeal.acabados,
            s.bajosIngresos.productoIdeal.color
        ], 'Bajos Ingresos', colors.bajosIngresos);

        createRadarChart('radarChartInnovadores', [
            s.innovadores.productoIdeal.pantalla,
            s.innovadores.productoIdeal.procesador,
            s.innovadores.productoIdeal.bateria,
            s.innovadores.productoIdeal.placaBase,
            s.innovadores.productoIdeal.ergonomia,
            s.innovadores.productoIdeal.acabados,
            s.innovadores.productoIdeal.color
        ], 'Innovadores', colors.innovadores);

        // ========= SENSIBILIDAD =========
        // Convierte "y = ..." a función x => ...
        function convertirCadenaAFuncion(equation) {
            try {
                const expr = String(equation).replace(/^\s*y\s*=\s*/i, '').replace(/\^/g, '**').trim();
                return new Function("x", `return ${expr};`);
            } catch (error) {
                console.error("Error al convertir la cadena a función:", error);
                return () => 0;
            }
        }

        // Convierte "function(x){...}" (string) a función
        function stringAFunction(cadena) {
            try {
                return new Function("return " + cadena)();
            } catch (e) {
                return convertirCadenaAFuncion(cadena);
            }
        }

        const createSensitivityChart = (ctxId, equation, label, color) => {
            const canvas = document.getElementById(ctxId);
            if (!canvas) { console.error(`Canvas '${ctxId}' no encontrado.`); return; }
            const ctx = canvas.getContext('2d');
            if (!ctx) { console.error(`No se pudo obtener 2D context para '${ctxId}'.`); return; }

            if (activeCharts[ctxId]) activeCharts[ctxId].destroy();

            // Acepta string de función, string "y = ...", función real, o {a,b,c}
            let sensibilidadFuncion;
            if (typeof equation === "string") {
                sensibilidadFuncion = stringAFunction(equation);
            } else if (typeof equation === "function") {
                sensibilidadFuncion = equation;
            } else if (equation && typeof equation === 'object' &&
                       Number.isFinite(equation.a) && Number.isFinite(equation.b) && Number.isFinite(equation.c)) {
                const { a, b, c } = equation;
                sensibilidadFuncion = (x) => a * x * x + b * x + c;
            } else {
                console.error("Ecuación no válida:", equation);
                return;
            }

            const xValues = [];
            const yValues = [];
            for (let x = 100; x <= 900; x += 10) {
                const y = sensibilidadFuncion(x);
                const yPct = Math.max(0, Math.min(110, Number(y)));
                xValues.push(x);
                yValues.push(Number.isFinite(yPct) ? yPct : 0);
            }

            activeCharts[ctxId] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: xValues,
                    datasets: [{
                        label,
                        data: yValues,
                        backgroundColor: color.replace('1)', '0.2)'),
                        borderColor: color,
                        fill: true
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 110,
                            title: { display: true, text: 'Porcentaje de Demanda (%)', color: '#fff' },
                            ticks: { color: '#fff', callback: (value) => value + '%' },
                            grid: { color: 'rgba(255,255,255,0.2)' }
                        },
                        x: {
                            title: { display: true, text: 'Precio', color: '#fff' },
                            ticks: { color: '#fff', stepSize: 75 },
                            grid: { color: 'rgba(255,255,255,0.2)' }
                        }
                    },
                    plugins: { legend: { labels: { color: '#fff' } } }
                }
            });
        };

        // Crear ecuaciones desde el servidor y graficar
        const sensitivityEquations = {};
        for (const segmento in segmentos) {
            const raw =
                segmentos[segmento].funcionSensibilidad ??
                segmentos[segmento].curvaSensibilidad ??
                segmentos[segmento].sensibilidad ??
                segmentos[segmento].sensibilidadPrecio ??
                segmentos[segmento].curva ??
                null;

            try {
                if (typeof raw === 'function') {
                    sensitivityEquations[segmento] = raw;
                } else if (typeof raw === 'string') {
                    sensitivityEquations[segmento] = new Function("return " + raw)();
                } else if (raw && typeof raw === 'object' &&
                           Number.isFinite(raw.a) && Number.isFinite(raw.b) && Number.isFinite(raw.c)) {
                    const { a, b, c } = raw;
                    sensitivityEquations[segmento] = (x) => a * x * x + b * x + c;
                } else {
                    console.warn(`Función de sensibilidad no válida para ${segmento}:`, raw);
                    sensitivityEquations[segmento] = () => 0;
                }
            } catch (error) {
                console.error(`Error al procesar la función de sensibilidad para el segmento ${segmento}:`, error);
                sensitivityEquations[segmento] = () => 0;
            }
        }

        // Pintar curvas
        createSensitivityChart('sensitivityChartProfesionales', sensitivityEquations.profesionales, 'Profesionales', colors.profesionales);
        createSensitivityChart('sensitivityChartAltosIngresos',   sensitivityEquations.altosIngresos, 'Altos Ingresos', colors.altosIngresos);
        createSensitivityChart('sensitivityChartGranConsumidor',  sensitivityEquations.granConsumidor, 'Gran Consumidor', colors.granConsumidor);
        createSensitivityChart('sensitivityChartBajosIngresos',   sensitivityEquations.bajosIngresos, 'Bajos Ingresos', colors.bajosIngresos);
        createSensitivityChart('sensitivityChartInnovadores',     sensitivityEquations.innovadores, 'Innovadores', colors.innovadores);
    });
});
