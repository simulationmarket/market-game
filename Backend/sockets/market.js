const math = require('mathjs');
function convertirCadenaAFuncion(cadena) {
    const expresion = cadena.replace('y =', '').trim();
    return new Function('x', `return ${expresion};`);
}
    
    // Estado inicial del mercado con todos los segmentos
    const marketData = {
        segmentos: {
            profesionales: {
                usuariosPotenciales: 12000000,
                demandaAno1: 5,
                get unidades() {
                    return this.usuariosPotenciales * (this.demandaAno1 / 100);
                },
                get poblacionEsperada() {
                    return this.usuariosPotenciales * 1.02; // Incremento del 2%
                },
                demandaEsperada: 5, // Este valor dependerá de las decisiones de los jugadores
                funcionSensibilidad: convertirCadenaAFuncion('y = -0.0159*(x**2) + 23.665*x - 8696.6'),
                productoIdeal: {
                    pantalla: 17,
                    procesador: 17,
                    bateria: 20,
                    placaBase: 16,
                    ergonomia: 15,
                    acabados: 14,
                    color: 15,
                    promedio: 15.71
                },
                costeProducto: {
                    pantalla: 61,
                    procesador: 38,
                    bateria: 75,
                    placaBase: 40,
                    ergonomia: 22,
                    acabados: 20,
                    color: 46,
                    ideal: 302
                },
                canalPreferencias: {
                    granDistribucion: 15,
                    minoristas: 60,
                    online: 10,
                    tiendaPropia: 15
                },

                historial: [] // Historial del segmento
            },
            altosIngresos: {
                usuariosPotenciales: 13000000,
                demandaAno1: 5,
                get unidades() {
                    return this.usuariosPotenciales * (this.demandaAno1 / 100);
                },
                get poblacionEsperada() {
                    return this.usuariosPotenciales * 1.02; // Incremento del 2%
                },
                demandaEsperada: 5, // Este valor dependerá de las decisiones de los jugadores
                funcionSensibilidad: convertirCadenaAFuncion('y = -0.017*(x**2) + 21.218*x - 6519.2'),
                productoIdeal: {
                    pantalla: 13,
                    procesador: 9,
                    bateria: 10,
                    placaBase: 7,
                    ergonomia: 11,
                    acabados: 16,
                    color: 16,
                    promedio: 12.43
                },
                costeProducto: {
                    pantalla: 56,
                    procesador: 27,
                    bateria: 60,
                    placaBase: 15,
                    ergonomia: 22,
                    acabados: 20,
                    color: 49,
                    ideal: 249
                },
                canalPreferencias: {
                    granDistribucion: 5,
                    minoristas: 10,
                    online: 35,
                    tiendaPropia: 50
                },
                historial: [] // Historial del segmento
            },
            granConsumidor: {
                usuariosPotenciales: 33000000,
                demandaAno1: 5,
                get unidades() {
                    return this.usuariosPotenciales * (this.demandaAno1 / 100);
                },
                get poblacionEsperada() {
                    return this.usuariosPotenciales * 1.02; // Incremento del 2%
                },
                demandaEsperada: 5, // Este valor dependerá de las decisiones de los jugadores
                funcionSensibilidad: convertirCadenaAFuncion('y = -0.0118*(x**2) + 6.5381*x - 802.5'),
                productoIdeal: {
                    pantalla: 8,
                    procesador: 6,
                    bateria: 7,
                    placaBase: 7,
                    ergonomia: 9,
                    acabados: 8,
                    color: 8,
                    promedio: 7.57
                },
                costeProducto: {
                    pantalla: 48,
                    procesador: 20,
                    bateria: 35,
                    placaBase: 15,
                    ergonomia: 18,
                    acabados: 20,
                    color: 31,
                    ideal: 187
                },
                canalPreferencias: {
                    granDistribucion: 15,
                    minoristas: 40,
                    online: 25,
                    tiendaPropia: 20
                },
                historial: [] // Historial del segmento
            },
            bajosIngresos: {
                usuariosPotenciales: 72000000,
                demandaAno1: 5,
                get unidades() {
                    return this.usuariosPotenciales * (this.demandaAno1 / 100);
                },
                get poblacionEsperada() {
                    return this.usuariosPotenciales * 1.02; // Incremento del 2%
                },
                demandaEsperada: 5, // Este valor dependerá de las decisiones de los jugadores
                funcionSensibilidad: convertirCadenaAFuncion('y = -0.027*(x**2) + 7.6114*x - 437.54'),
                productoIdeal: {
                    pantalla: 3,
                    procesador: 2,
                    bateria: 3,
                    placaBase: 2,
                    ergonomia: 2,
                    acabados: 2,
                    color: 2,
                    promedio: 2.29

                },
                costeProducto: {
                    pantalla: 27,
                    procesador: 15,
                    bateria: 35,
                    placaBase: 15,
                    ergonomia: 11,
                    acabados: 10,
                    color: 14,
                    ideal: 127
                },
                canalPreferencias: {
                    granDistribucion: 40,
                    minoristas: 25,
                    online: 25,
                    tiendaPropia: 10
                },
                historial: [] // Historial del segmento
            },
            innovadores: {
                usuariosPotenciales: 25000000,
                demandaAno1: 5,
                get unidades() {
                    return this.usuariosPotenciales * (this.demandaAno1 / 100);
                },
                get poblacionEsperada() {
                    return this.usuariosPotenciales * 1.02; // Incremento del 2%
                },
                demandaEsperada: 5, // Este valor dependerá de las decisiones de los jugadores
                funcionSensibilidad: convertirCadenaAFuncion('y = -0.0343*(x**2) + 27.429*x - 5386.9'),
                productoIdeal: {
                    pantalla: 13,
                    procesador: 11,
                    bateria: 12,
                    placaBase: 15,
                    ergonomia: 16,
                    acabados: 15,
                    color: 12,
                    promedio: 13.43
                },
                costeProducto: {
                    pantalla: 50,
                    procesador: 27,
                    bateria: 60,
                    placaBase: 40,
                    ergonomia: 24,
                    acabados: 20,
                    color: 42,
                    ideal: 263
                },
                canalPreferencias: {
                    granDistribucion: 5,
                    minoristas: 15,
                    online: 50,
                    tiendaPropia: 30
                },
                historial: [] // Historial del segmento
            }
        }
    }; 
    
    //Actualizar mercado
    function actualizarMercado(marketData, rondaActual, resultadosCache, players) {
        console.log(`Actualizando el mercado para la ronda ${rondaActual}...`);
    
        if (!resultadosCache || !Array.isArray(resultadosCache)) {
            console.error("Error: resultadosCache no es válido o está vacío.");
            return;
        }
    
        registrarHistorial(marketData, rondaActual);
        actualizarUsuariosPotenciales(marketData);
        ajustarDemandaAno1(marketData, resultadosCache);
        ajustarPreferenciasDeCanal(marketData, resultadosCache);
        actualizarProductoIdeal(marketData, resultadosCache, players);
        actualizarFuncionesSensibilidad(marketData, resultadosCache); // NUEVA FUNCIÓN
    }

// Función para registrar el estado actual de cada segmento en su historial
function registrarHistorial(marketData, rondaActual) {
    for (const segmento in marketData.segmentos) {
        if (marketData.segmentos.hasOwnProperty(segmento)) {
            const datosSegmento = marketData.segmentos[segmento];

            // Crear una copia del estado actual relevante para guardar en el historial
            const snapshot = {
                ronda: rondaActual,
                usuariosPotenciales: datosSegmento.usuariosPotenciales,
                demandaAno1: datosSegmento.demandaAno1,
                demandaEsperada: datosSegmento.demandaEsperada,
                canalPreferencias: { ...datosSegmento.canalPreferencias }, // Copia profunda
                productoIdeal: { ...datosSegmento.productoIdeal }, // Copia profunda
                funcionSensibilidad: datosSegmento.funcionSensibilidad.toString() // Guardar como cadena
            };

            // Agregar la instantánea al historial
            datosSegmento.historial.push(snapshot);

            console.log(`Historial actualizado para el segmento ${segmento}:`, snapshot);
        }
    }
}
    
    function actualizarUsuariosPotenciales(marketData) {
        for (const segmento in marketData.segmentos) {
            if (marketData.segmentos.hasOwnProperty(segmento)) {
                const datosSegmento = marketData.segmentos[segmento];
    
                // Variación aleatoria entre 0.5% y 2%
                const variacionPorcentaje = Math.random() * (2 - 0.5) + 0.5;
                const factorIncremento = 1 + variacionPorcentaje / 100;
                datosSegmento.usuariosPotenciales = Math.round(datosSegmento.usuariosPotenciales * factorIncremento);
    
                console.log(
                    `Segmento ${segmento} actualizado: Usuarios Potenciales: ${datosSegmento.usuariosPotenciales} (+${variacionPorcentaje.toFixed(2)}%)`
                );
            }
        }
    }
    
    function ajustarDemandaAno1(marketData, resultadosCache) {
        const coberturaPorSegmento = calcularCoberturaPorSegmento(marketData, resultadosCache);
    
        for (const segmento in marketData.segmentos) {
            if (marketData.segmentos.hasOwnProperty(segmento)) {
                const datosSegmento = marketData.segmentos[segmento];
                const coberturaDemanda = coberturaPorSegmento[segmento.toLowerCase()]?.cobertura || 0;
    
                console.log(`Cobertura para ${segmento}: ${coberturaDemanda}%`);
    
                let factorCambio = 1;
    
                if (coberturaDemanda <= 30) {
                    factorCambio = 1 - (Math.random() * (10 - 5) + 5) / 100;
                } else if (coberturaDemanda > 30 && coberturaDemanda <= 60) {
                    factorCambio = 1 + (Math.random() * 10 - 5) / 100;
                } else if (coberturaDemanda > 60) {
                    factorCambio = 1 + (Math.random() * (10 - 5) + 5) / 100;
                }
    
                datosSegmento.demandaAno1 *= factorCambio;
                datosSegmento.demandaAno1 = parseFloat(datosSegmento.demandaAno1.toFixed(1));
    
                console.log(
                    `Segmento ${segmento} actualizado: Demanda Año 1: ${datosSegmento.demandaAno1} (Cobertura: ${coberturaDemanda}%, Factor: ${factorCambio.toFixed(2)})`
                );
            }
        }
    }
    
    
    function ajustarPreferenciasDeCanal(marketData, resultadosCache) {
        for (const segmento in marketData.segmentos) {
            if (marketData.segmentos.hasOwnProperty(segmento)) {
                const datosSegmento = marketData.segmentos[segmento];
                const preferenciasAnteriores = { ...datosSegmento.canalPreferencias }; // Clonamos las preferencias iniciales
    
                // Estructuras para calcular satisfacción y demanda total por canal
                const satisfaccionCanales = {};
                const demandaEsperadaPorCanal = {};
                let seRegistraronVentas = false; // Bandera para verificar ventas en el segmento
                let todaDemandaCubierta = true; // Bandera para verificar si toda la demanda fue cubierta
    
                // Inicializar satisfacción y demanda esperada por canal según preferencias previas
                for (const canal in preferenciasAnteriores) {
                    if (preferenciasAnteriores.hasOwnProperty(canal)) {
                        satisfaccionCanales[canal] = 0;
                        demandaEsperadaPorCanal[canal] =
                            (preferenciasAnteriores[canal] / 100) *
                            datosSegmento.usuariosPotenciales *
                            (datosSegmento.demandaAno1 / 100); // Basada en preferencias y datos actuales
                    }
                }
    
                console.log(
                    `Segmento ${segmento} - Demanda esperada por canal:`,
                    demandaEsperadaPorCanal
                );
    
                // Acumular unidades vendidas desde resultadosCache
                resultadosCache.forEach(({ canal, segmento: segmentoResultado, unidadesVendidas }) => {
                    if (segmento === segmentoResultado && satisfaccionCanales[canal] !== undefined) {
                        const ventas = parseFloat(unidadesVendidas) || 0;
                        satisfaccionCanales[canal] += ventas;
                        if (ventas > 0) {
                            seRegistraronVentas = true; // Se registraron ventas en este segmento
                        }
                    }
                });
    
                console.log(
                    `Segmento ${segmento} - Satisfacción por canal (unidades vendidas):`,
                    satisfaccionCanales
                );
    
                // Verificar si toda la demanda fue cubierta para cada canal
                for (const canal in satisfaccionCanales) {
                    if (demandaEsperadaPorCanal[canal] > 0) {
                        const cobertura =
                            (satisfaccionCanales[canal] / demandaEsperadaPorCanal[canal]) * 100;
                        if (cobertura < 100) {
                            todaDemandaCubierta = false; // Si algún canal no cubrió toda su demanda, cambia la bandera
                        }
                    }
                }
    
                console.log(`Segmento ${segmento} - Toda la demanda cubierta:`, todaDemandaCubierta);
    
                // Si no se registraron ventas o toda la demanda fue cubierta, no ajustamos preferencias
                if (!seRegistraronVentas || todaDemandaCubierta) {
                    console.log(
                        `Segmento ${segmento} - No se registraron cambios en preferencias (ventas: ${seRegistraronVentas}, toda demanda cubierta: ${todaDemandaCubierta}).`
                    );
                    continue;
                }
    
                // Calcular satisfacción de cada canal basado en la cobertura
                for (const canal in satisfaccionCanales) {
                    if (demandaEsperadaPorCanal[canal] > 0) {
                        satisfaccionCanales[canal] =
                            (satisfaccionCanales[canal] / demandaEsperadaPorCanal[canal]) * 100;
                    } else {
                        satisfaccionCanales[canal] = 0; // Si no hay demanda esperada, satisfacción es 0
                    }
                }
    
                console.log(`Segmento ${segmento} - Cobertura por canal:`, satisfaccionCanales);
    
                // Ordenar canales por nivel de satisfacción
                const canalesOrdenados = Object.entries(satisfaccionCanales).sort((a, b) => b[1] - a[1]);
    
                // Ajustar preferencias de canal según niveles de satisfacción
                if (canalesOrdenados.length > 0) {
                    datosSegmento.canalPreferencias[canalesOrdenados[0][0]] += 2;
                }
                if (canalesOrdenados.length > 1) {
                    datosSegmento.canalPreferencias[canalesOrdenados[1][0]] += 1;
                }
                if (canalesOrdenados.length > 2) {
                    datosSegmento.canalPreferencias[canalesOrdenados[2][0]] -= 1;
                }
                if (canalesOrdenados.length > 3) {
                    datosSegmento.canalPreferencias[canalesOrdenados[3][0]] -= 2;
                }
    
                // Normalizar las preferencias para que sumen 100%
                const sumaPreferencias = Object.values(datosSegmento.canalPreferencias).reduce((a, b) => a + b, 0);
                for (const canal in datosSegmento.canalPreferencias) {
                    if (datosSegmento.canalPreferencias.hasOwnProperty(canal)) {
                        datosSegmento.canalPreferencias[canal] = parseFloat(
                            ((datosSegmento.canalPreferencias[canal] / sumaPreferencias) * 100).toFixed(1)
                        );
                    }
                }
    
                console.log(
                    `Segmento ${segmento} actualizado: Preferencias de Canal:`,
                    datosSegmento.canalPreferencias
                );
            }
        }
    }
    
    function actualizarProductoIdeal(marketData, resultadosCache, players) {
        if (!players || typeof players !== 'object') {
            console.error("Error: 'players' no es válido o está vacío.");
            return;
        }
    
        console.log("Actualizando el producto ideal para cada segmento...");
        const normalizedPlayers = Object.fromEntries(
            Object.entries(players).map(([key, value]) => [key.trim().toLowerCase(), value])
        );
    
        // Iterar por cada segmento en el mercado
        for (const segmento in marketData.segmentos) {
            if (marketData.segmentos.hasOwnProperty(segmento)) {
                console.log(`Procesando el segmento: ${segmento}`);
                const datosSegmento = marketData.segmentos[segmento];
    
                // Imprimir el producto ideal antes de la actualización
                console.log(`Segmento ${segmento}: Producto ideal antes de la actualización:`, JSON.stringify(datosSegmento.productoIdeal));
    
                // Preparar acumuladores
                const sumaCaracteristicas = {};
                let totalVentas = 0;
    
                // Filtrar ventas relacionadas con este segmento
                const ventasSegmento = resultadosCache.filter(
                    resultado => resultado.segmento.toLowerCase() === segmento.toLowerCase()
                );
    
            
    
                // Procesar cada venta en el segmento
                ventasSegmento.forEach(({ producto, unidadesVendidas, jugador }) => {
                    const unidades = parseFloat(unidadesVendidas); // Convertir a número
    
                    if (unidades <= 0) {
                        console.warn(`Venta ignorada: Producto ${producto} del jugador ${jugador} tiene ${unidades} unidades vendidas.`);
                        return; // Ignorar esta venta
                    }
    
                    // Normalizar nombre del jugador
                    const nombreJugador = jugador?.trim()?.toLowerCase();
                    if (!nombreJugador || !normalizedPlayers[nombreJugador]) {
                        console.warn(`Jugador no encontrado en 'players': ${jugador}`);
                        return; // Saltar esta venta si no se encuentra el jugador
                    }
    
                    const playerData = normalizedPlayers[nombreJugador];
                    const productoData = playerData.gameState.products.find(p => p.nombre === producto);
    
                    if (productoData && productoData.caracteristicas) {
                        // Acumular características ponderadas por las ventas
                        for (const [caracteristica, valor] of Object.entries(productoData.caracteristicas)) {
                            sumaCaracteristicas[caracteristica] =
                                (sumaCaracteristicas[caracteristica] || 0) + valor * unidades;
                        }
                        totalVentas += unidades;
                    } else {
                        console.warn(`Producto ${producto} no encontrado para el jugador ${jugador}.`);
                    }
                });
    
                // Si hay ventas, calcular el promedio y actualizar el producto ideal
                if (totalVentas > 0) {
                    console.log(`Segmento ${segmento}: Total de unidades vendidas: ${totalVentas}`);
                    console.log(`Segmento ${segmento}: Características acumuladas:`, sumaCaracteristicas);
    
                    // Calcular el promedio ponderado de las características compradas
                    const promedioComprado = {};
                    for (const [caracteristica, suma] of Object.entries(sumaCaracteristicas)) {
                        promedioComprado[caracteristica] = suma / totalVentas;
                    }
    
                    // Actualizar el producto ideal del segmento
                    for (const caracteristica in datosSegmento.productoIdeal) {
                        if (promedioComprado[caracteristica] !== undefined) {
                            datosSegmento.productoIdeal[caracteristica] =
                                (datosSegmento.productoIdeal[caracteristica] * 0.95) +
                                (promedioComprado[caracteristica] * 0.05);
                        }
                    }
    
                    // Imprimir el producto ideal después de la actualización
                    console.log(`Segmento ${segmento}: Nuevo producto ideal:`, JSON.stringify(datosSegmento.productoIdeal));
                } else {
                    console.log(`Segmento ${segmento}: No hubo ventas registradas.`);
                }
            }
        }
    }
    
    
    function actualizarFuncionesSensibilidad(marketData, resultadosCache) {
        console.log("Actualizando las funciones de sensibilidad para cada segmento...");
    
        for (const segmento in marketData.segmentos) {
            if (marketData.segmentos.hasOwnProperty(segmento)) {
                const datosSegmento = marketData.segmentos[segmento];
    
                console.log(`\nProcesando segmento: ${segmento}`);
    
                if (!datosSegmento.funcionSensibilidad) {
                    console.warn(`El segmento ${segmento} no tiene una función de sensibilidad definida.`);
                    continue;
                }
    
                const puntos = [0, 1, 2];
                const y_vals = puntos.map(x => datosSegmento.funcionSensibilidad(x));
                const x_vals = puntos.map(x => [x ** 2, x, 1]);
    
                let coeficientes = { a: 0, b: 0, c: 0 };
                let precioIdealPrevio = 500;
                let sensibilidadMaxima = 0;
    
                try {
                    const inv_x_vals = math.inv(x_vals);
                    const resultado = math.multiply(inv_x_vals, y_vals);
                    coeficientes = { a: resultado[0], b: resultado[1], c: resultado[2] };
    
                    console.log(`Coeficientes extraídos: a = ${coeficientes.a.toFixed(4)}, b = ${coeficientes.b.toFixed(4)}, c = ${coeficientes.c.toFixed(4)}`);
    
                    if (coeficientes.a !== 0) {
                        precioIdealPrevio = -coeficientes.b / (2 * coeficientes.a);
                        sensibilidadMaxima = coeficientes.a * Math.pow(precioIdealPrevio, 2) + coeficientes.b * precioIdealPrevio + coeficientes.c;
                        console.log(`Precio ideal previo (x_max): ${precioIdealPrevio.toFixed(2)}, Sensibilidad máxima (y_max): ${sensibilidadMaxima.toFixed(2)}`);
                    } else {
                        console.warn("Coeficiente 'a' es cero, no se puede calcular el máximo.");
                    }
                } catch (error) {
                    console.warn(`Error al calcular coeficientes para el segmento ${segmento}: ${error.message}`);
                    continue;
                }
    
                const ventasSegmento = resultadosCache.filter(
                    resultado => resultado.segmento.toLowerCase() === segmento.toLowerCase()
                );
    
                let totalUnidadesVendidas = ventasSegmento.reduce(
                    (acc, { unidadesVendidas }) => acc + parseFloat(unidadesVendidas || 0),
                    0
                );
    
                let totalDemanda = ventasSegmento.reduce(
                    (acc, { demanda }) => acc + parseFloat(demanda || 0),
                    0
                );
    
                let coberturaDemanda = totalDemanda > 0 ? totalUnidadesVendidas / totalDemanda : 0;
    
                console.log(`Total demanda: ${totalDemanda}, Total unidades vendidas: ${totalUnidadesVendidas}, Cobertura: ${coberturaDemanda.toFixed(2)}`);
    
                if (totalUnidadesVendidas > 0) {
                    // Calcular el precio promedio ponderado de los productos vendidos
                    let precioPromedioPonderado = ventasSegmento.reduce(
                        (acc, { precio, unidadesVendidas }) => acc + parseFloat(precio || 0) * parseFloat(unidadesVendidas || 0),
                        0
                    ) / totalUnidadesVendidas;
    
                    console.log(`Precio promedio ponderado: ${precioPromedioPonderado.toFixed(2)}`);
    
                    // Calcular el precio combinado
                    const precioCombinado = (0.9 * precioIdealPrevio) + (0.1 * precioPromedioPonderado);
                    console.log(`Precio combinado calculado: ${precioCombinado.toFixed(2)}`);
    
                    // Recalcular b y c con el nuevo precio máximo
                    const b = -2 * coeficientes.a * precioCombinado;
                    const c = sensibilidadMaxima - (coeficientes.a * Math.pow(precioCombinado, 2) + b * precioCombinado);
    
                    console.log(`Coeficientes ajustados: a = ${coeficientes.a.toFixed(4)}, b = ${b.toFixed(4)}, c = ${c.toFixed(4)}`);
    
                    // Actualizar la función de sensibilidad
                    datosSegmento.funcionSensibilidad = convertirCadenaAFuncion(
                        `y = ${coeficientes.a.toFixed(4)}*(x**2) + ${b.toFixed(4)}*x + ${c.toFixed(4)}`
                    );
    
                    console.log(`Función de sensibilidad actualizada: ${datosSegmento.funcionSensibilidad.toString()}`);
                } else {
                    // Solo ajustar 'a' si no hay ventas
                    let a = coeficientes.a;
                    if (coberturaDemanda < 0.33) {
                        a *= 0.9;
                        console.log("Curva ensanchada (Cobertura < 33%)");
                    } else if (coberturaDemanda > 0.66) {
                        a *= 1.1;
                        console.log("Curva estrechada (Cobertura > 66%)");
                    }
    
                    const b = -2 * a * precioIdealPrevio;
                    const c = sensibilidadMaxima - (a * Math.pow(precioIdealPrevio, 2) + b * precioIdealPrevio);
    
                    console.log(`Coeficientes ajustados (sin ventas): a = ${a.toFixed(4)}, b = ${b.toFixed(4)}, c = ${c.toFixed(4)}`);
    
                    datosSegmento.funcionSensibilidad = convertirCadenaAFuncion(
                        `y = ${a.toFixed(4)}*(x**2) + ${b.toFixed(4)}*x + ${c.toFixed(4)}`
                    );
    
                    console.log(`Función de sensibilidad actualizada (sin ventas): ${datosSegmento.funcionSensibilidad.toString()}`);
                }
            }
        }
    }
    
    

    function calcularCoberturaPorSegmento(marketData, resultadosCache) {
        const coberturaPorSegmento = {};
    
        // Inicializar la estructura para cada segmento
        for (const segmento in marketData.segmentos) {
            if (marketData.segmentos.hasOwnProperty(segmento)) {
                const datosSegmento = marketData.segmentos[segmento];
                const usuariosPotencialesAnteriores = datosSegmento.usuariosPotenciales; // Usuarios antes de actualizar
                const demandaAno1Anterior = datosSegmento.demandaAno1; // Demanda antes de actualizar
    
                coberturaPorSegmento[segmento.toLowerCase()] = {
                    unidadesVendidas: 0,
                    demandaEsperada: usuariosPotencialesAnteriores * (demandaAno1Anterior / 100), // Basada en la ronda anterior
                    cobertura: 0,
                };
            }
        }
    
        console.log("Cobertura inicial:", coberturaPorSegmento);
    
        // Acumular unidades vendidas desde resultadosCache
        resultadosCache.forEach(({ segmento, unidadesVendidas }) => {
            const segmentoKey = segmento.toLowerCase(); // Normalizar nombres de segmentos
            if (coberturaPorSegmento[segmentoKey]) {
                const unidades = parseFloat(unidadesVendidas) || 0;
                coberturaPorSegmento[segmentoKey].unidadesVendidas += unidades;
                console.log(
                    `Segmento: ${segmentoKey}, Unidades Vendidas Acumuladas: ${coberturaPorSegmento[segmentoKey].unidadesVendidas}`
                );
            } else {
                console.warn(`Segmento no encontrado en coberturaPorSegmento: ${segmento}`);
            }
        });
    
        // Calcular cobertura
        for (const segmento in coberturaPorSegmento) {
            const { unidadesVendidas, demandaEsperada } = coberturaPorSegmento[segmento];
            coberturaPorSegmento[segmento].cobertura = Math.min(
                100,
                demandaEsperada > 0 ? ((unidadesVendidas / demandaEsperada) * 100).toFixed(2) : 0
            );
            console.log(
                `Cobertura Calculada para ${segmento}: Unidades Vendidas = ${unidadesVendidas}, Demanda Esperada = ${demandaEsperada}, Cobertura = ${coberturaPorSegmento[segmento].cobertura}%`
            );
        }
    
        return coberturaPorSegmento;
    }
    

    const handleMarketSockets = (io) => {
        io.on('connection', (socket) => {
            console.log('Nueva conexión de cliente');
    
            socket.on('getMarketData', () => {
                console.log('Enviando datos del mercado');
    
                // Serializar las funciones en marketData.segmentos
                const marketDataSerializado = {
                    ...marketData,
                    segmentos: Object.fromEntries(
                        Object.entries(marketData.segmentos).map(([segmento, datos]) => [
                            segmento,
                            {
                                ...datos,
                                funcionSensibilidad: datos.funcionSensibilidad?.toString() // Convertir función a texto si existe
                            }
                        ])
                    )
                };
    
                // Emitir los datos serializados al cliente
                socket.emit('marketUpdate', marketDataSerializado);
            });
        });
    };
    
    // Exportar ambos: datos y función
    module.exports = {
        marketData,
        actualizarMercado,
        handleMarketSockets,
    };