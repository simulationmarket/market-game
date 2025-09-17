const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
console.log("Exportando eventEmitter desde calculos:", eventEmitter);

function iniciarCalculos(playersData, marketData, meta = {}) {
    console.log("Iniciando cálculos...");

    // **1. Validar datos de entrada**
    if (!playersData || typeof playersData !== 'object') {
        console.error("Error: playersData no válido:", playersData);
        return;
    }

    if (!marketData || typeof marketData !== 'object') {
        console.error("Error: marketData no válido:", marketData);
        return;
    }

    // **2. Procesar jugadores**
    for (const [playerName, playerData] of Object.entries(playersData)) {
        console.log(`\n--- Procesando datos de ${playerName} ---`);

        const productos = playerData.gameState?.products || [];
        if (!Array.isArray(productos)) {
            console.error(`Error: productos no válidos para ${playerName}`);
            continue;
        }

        productos.forEach(product => {
            console.log(`Procesando producto: ${product.nombre}`);
            calcularPromedioCaracteristicas(product.caracteristicas, product);
        });
    }

    // **3. Mostrar datos iniciales**
    console.log("Datos iniciales de playersData:", playersData); 
    console.log("Datos iniciales de marketData:", marketData);

    // **4. Ejecutar cálculos principales**
    try {
        calcularRatioPosicionamiento(playersData);
        calcularEfectoPosicionamiento(playersData);
        calcularAjustePrecio(playersData);
        calcularInteresProductoSegmento(playersData, marketData);
         for (const [segmentoNombre, segmento] of Object.entries(marketData.segmentos || {})) {
      for (const playerData of Object.values(playersData)) {
        for (const producto of playerData.gameState?.products || []) {
          const interesProd = producto.interesPorSegmento?.[segmentoNombre]?.interesPromedio || 0;
          // Esta llamada muta producto.precioPercibido
          calcularInteresPrecio(producto, segmento.funcionSensibilidad, interesProd);
        }
      }
    }
        mostrarEfectoPosicionamientoEnConsola(playersData);
        renderProductInterestNote(playersData, marketData);
        mostrarPriceInterestNote(playersData, marketData);
        renderFinalInterestNote(playersData, marketData);

// **5. Calcular unidades y ventas**
const unidadesPorSegmento = calcularUnidadesTotalesPorSegmento(marketData);
mostrarUnidadesTotalesPorSegmento(unidadesPorSegmento);

const presenciasPorProducto = renderChannelPresence(playersData);

// ⬇️ NUEVO: tramos por canal **y por segmento** (lineal)
// Usa exactamente los mismos canales que renderChannelPresence
const tramosPorCanal = calcularTramosPorCanalPorSegmento(
  presenciasPorProducto,
  marketData,
  unidadesPorSegmento,
  playersData,
  { umbralDefault: 3, canales: ['granDistribucion','minoristas','online','tiendaPropia'] }
);

// (Opcional para depurar)
// mostrarTramosPorCanalEnConsola_v2(tramosPorCanal);

// ⬇️ NUEVO: reparto que entiende el lineal (canal → segmento → tramos)
const { resultadosDetallados, descartesDetallados } =
  calcularRepartoUnidades_vLineal(tramosPorCanal, playersData, marketData);

// Mostrar el reparto (usa el array, no el objeto completo)
mostrarRepartoPorTramoEnConsola(resultadosDetallados);

// (Opcional) Ver los descartes por falta de interés
if (Array.isArray(descartesDetallados) && descartesDetallados.length) {
  
  descartesDetallados.forEach(d => {
    
  });
}

const ventasConsolidadas =
  consolidarVentas(resultadosDetallados) || { porProducto: {}, porSegmento: {}, porCanal: {} };
mostrarVentasPorCanalSegmentoEnConsola(ventasConsolidadas);

const ventasDisponibilidad =
  calcularVentasPorUnidadesDisponibles(playersData, ventasConsolidadas.porProducto || {});
mostrarVentasPorUnidadesDisponiblesEnConsola(ventasDisponibilidad);

// Asegúrate de pasar el array de resultados, no el objeto
const demandaPorSegmentoCanal = calcularDemandaPorSegmentoCanal(resultadosDetallados) || {};
mostrarDemandaPorSegmentoCanal(demandaPorSegmentoCanal, playersData);

const resultadosReparto =
  calcularRepartoVentasProporcional(playersData, ventasDisponibilidad, demandaPorSegmentoCanal);
mostrarRepartoVentasProporcionalEnConsola(resultadosReparto);


        // **6. Calcular costes reales**
        for (const player of Object.values(playersData)) {
            const products = player.gameState?.products || [];
            products.forEach(product => {
                const costeUnitarioEst = product?.costeUnitarioEst;
                const unidadesFabricar = product?.unidadesFabricar;

                if (costeUnitarioEst === undefined || unidadesFabricar === undefined) {
                    console.error(`Error: Datos incompletos para el producto ${product.nombre}`, {
                        costeUnitarioEst,
                        unidadesFabricar
                    });
                    return; // Evita llamar a calcularCosteReal si faltan datos
                }

                const costeReal = calcularCosteReal(costeUnitarioEst, unidadesFabricar);
                product.costeUnitarioReal = costeReal;
                console.log(`Coste Real para ${product.nombre}: ${costeReal}`);
            });
        }

        // **7. Aplicar penalizaciones y mostrar resultados**
        const penalizacionPorProducto = calcularPenalizacionPorInteres(playersData);
        const resultadosFinales = aplicarPenalizacionEnVentas(resultadosReparto, penalizacionPorProducto);

        // Mostrar resultados en consola
        mostrarResultadosFinales(resultadosFinales);
        console.log('Cálculos completados y resultados mostrados en consola.');

        // **8. Emitir evento para `resultadosJugadores.js`**
        eventEmitter.emit('calculosRealizados', playersData, marketData, resultadosFinales, meta);
            if (meta && meta.partidaId) {
            eventEmitter.emit(`calculosRealizados:${meta.partidaId}`, playersData, marketData, resultadosFinales, meta);
            }

        // Retornar los resultados finales para cualquier uso adicionalnode
        return resultadosFinales;

    } catch (error) {
        console.error("Error durante los cálculos:", error);
    }
}

module.exports = { iniciarCalculos, eventEmitter };


// Función para calcular el Ratio de Posicionamiento en publicidad
function calcularRatioPosicionamiento(playersData) {
    let maxPublicidad = 0;

    // Encontrar el presupuesto de publicidad más alto
    for (const playerData of Object.values(playersData)) {
        const productos = playerData.gameState?.products || [];
        productos.forEach(product => {
            if (product.publicidad > maxPublicidad) {
                maxPublicidad = product.publicidad;
            }
        });
    }

    // Verificar si maxPublicidad es válido
    if (maxPublicidad === 0) {
        console.warn("Advertencia: No hay presupuesto de publicidad en los productos.");
        return;
    }

    // Calcular y asignar el Ratio de Posicionamiento para cada producto
    for (const playerData of Object.values(playersData)) {
        const productos = playerData.gameState?.products || [];
        productos.forEach(product => {
            product.ratioPosicionamiento = ((product.publicidad / maxPublicidad) * 100).toFixed(2);
            console.log(`Producto: ${product.nombre}, Ratio de Posicionamiento: ${product.ratioPosicionamiento}`);
        });
    }
}

function calcularPromedioCaracteristicas(caracteristicas, producto) {
    if (!caracteristicas || typeof caracteristicas !== 'object' || Object.keys(caracteristicas).length === 0) {
        console.error("Error: Características no válidas o vacías", caracteristicas);
        producto.posicionamientoProductoReal = "0.00";
        return producto.posicionamientoProductoReal;
    }

    // Convertir a números
    const valores = Object.values(caracteristicas).map(v => Number(v));

    // Validar que la conversión ha funcionado
    if (!valores.every(val => !isNaN(val))) {
        console.error("Error: Características contienen valores no convertibles a número", valores);
        producto.posicionamientoProductoReal = "0.00";
        return producto.posicionamientoProductoReal;
    }

    const suma = valores.reduce((acc, val) => acc + val, 0);
    const promedio = suma / valores.length;

    producto.posicionamientoProductoReal = promedio.toFixed(2);
    producto.promedioCaracteristicas = promedio;

    console.log(`
        Producto: ${producto.nombre}
        Posicionamiento Producto Real: ${producto.posicionamientoProductoReal}
    `);

    return producto.posicionamientoProductoReal;
}



function calcularEfectoPosicionamiento(playersData) {
    for (const playerData of Object.values(playersData)) {
        // Acceso seguro a los productos
        const productos = playerData.gameState?.products || [];
        productos.forEach(product => {
            // Validar existencia de características
            if (!product.caracteristicas || typeof product.caracteristicas !== 'object') {
                console.error(`Error: Características no válidas para el producto ${product.nombre}`, product.caracteristicas);
                return;
            }

            // Obtener o calcular `posicionamientoProductoReal`
            const promedioCaracteristicas = parseFloat(
                product.posicionamientoProductoReal || calcularPromedioCaracteristicas(product.caracteristicas, product)
            );
            if (isNaN(promedioCaracteristicas)) {
                console.error(`Error: Promedio de características no válido para el producto ${product.nombre}`, {
                    posicionamientoProductoReal: product.posicionamientoProductoReal,
                    caracteristicas: product.caracteristicas
                });
                return;
            }
            product.promedioCaracteristicas = promedioCaracteristicas;

            // Validar `calidad` y `ratioPosicionamiento`
            const calidad = parseFloat(product.calidad);
            const ratioPosicionamiento = parseFloat(product.ratioPosicionamiento);
            if (isNaN(calidad) || isNaN(ratioPosicionamiento)) {
                console.error(`Error: Calidad o ratioPosicionamiento no válidos para el producto ${product.nombre}`, {
                    calidad: product.calidad,
                    ratioPosicionamiento: product.ratioPosicionamiento
                });
                return;
            }

            // Calcular el efecto de posicionamiento
            product.efectoPosicionamiento = (
                (calidad - promedioCaracteristicas) * (ratioPosicionamiento / 100)
            ).toFixed(2);

            // Ajustar características basadas en el efecto de posicionamiento
            product.caracteristicasAjustadas = {};
            for (const [key, value] of Object.entries(product.caracteristicas)) {
                const valorNumerico = parseFloat(value);
                if (isNaN(valorNumerico)) {
                    console.error(`Error: Valor no numérico en características de ${product.nombre}:`, { [key]: value });
                    product.caracteristicasAjustadas[key] = "0.00";
                } else {
                    product.caracteristicasAjustadas[key] = (valorNumerico + parseFloat(product.efectoPosicionamiento)).toFixed(2);
                }
            }

            
            
        });
    }
}


// Función para renderizar el efecto de posicionamiento en la consola
function mostrarEfectoPosicionamientoEnConsola(playersData) {
    console.log("Rendering positioning effect and adjusted characteristics...");

    for (const [playerName, playerData] of Object.entries(playersData)) {
        console.log(`\nEfecto de Posicionamiento de ${playerName}:`);

        // Acceso seguro a los productos
        const productos = playerData.gameState?.products || [];
        if (productos.length === 0) {
            console.warn(`No hay productos para el jugador ${playerName}.`);
            continue;
        }

        // Renderizar tabla de efecto de posicionamiento
        

        productos.forEach(product => {
            console.log(
                `${(product.nombre || "N/A").padEnd(15)} | ${(product.ratioPosicionamiento || "N/A").toString().padEnd(22)} | ${(product.promedioCaracteristicas || "N/A").toString().padEnd(27)} | ${(product.calidad || "N/A").toString().padEnd(7)} | ${(product.efectoPosicionamiento || "N/A")}`
            );
        });

        console.log("\nCaracterísticas Ajustadas:");

        

        productos.forEach(product => {
            const ajustadas = product.caracteristicasAjustadas || {};
            console.log(
                `${(product.nombre || "N/A").padEnd(15)} | ${(ajustadas.pantalla || "N/A").padEnd(9)} | ${(ajustadas.procesador || "N/A").padEnd(10)} | ${(ajustadas.bateria || "N/A").padEnd(8)} | ${(ajustadas.placaBase || "N/A").padEnd(11)} | ${(ajustadas.ergonomia || "N/A").padEnd(9)} | ${(ajustadas.acabados || "N/A").padEnd(8)} | ${(ajustadas.color || "N/A").padEnd(5)}`
            );
        });
    }
}


function calcularAjustePrecio(playersData) {
    for (const [playerName, playerData] of Object.entries(playersData)) {
        console.log(`Procesando datos del jugador: ${playerName}`);

        const productos = playerData.gameState?.products || [];
        
        productos.forEach(product => {
            console.log("Producto recibido:", product);

            // Validaciones de precio
            if (product.precio === undefined || isNaN(product.precio)) {
                console.error(`Error: Precio no válido para el producto ${product.nombre}`, { precio: product.precio });
                product.pvp = 0; 
                product.precioPosicionado = 0;
                product.precioAjustado = 0; // Asegurarse de no asignar 'N/A'
                return;
            }

            // Asignar PVP (Precio de lista)
            product.pvp = product.precio;

            if (product.posicionamientoPrecio === undefined || isNaN(product.posicionamientoPrecio)) {
                console.error(`Error: Posicionamiento Precio no válido para el producto ${product.nombre}`, { posicionamientoPrecio: product.posicionamientoPrecio });
                product.precioPosicionado = 0;
                product.precioAjustado = 0;
                return;
            }

            if (product.ratioPosicionamiento === undefined || isNaN(product.ratioPosicionamiento)) {
                console.error(`Error: Ratio de Posicionamiento no válido para el producto ${product.nombre}`, { ratioPosicionamiento: product.ratioPosicionamiento });
                product.precioAjustado = 0;
                return;
            }

            // Convertir `ratioPosicionamiento` a número si es necesario
            const ratioPosicionamiento = parseFloat(product.ratioPosicionamiento);

            // Calcular precio posicionado
            product.precioPosicionado = parseFloat((product.posicionamientoPrecio / 0.02).toFixed(2));

            // Log para ver qué valores se están usando para los cálculos
            console.log(`Producto: ${product.nombre}`);
            console.log(`  Precio: ${product.pvp}`); // Ver el precio
            console.log(`  Precio Posicionado: ${product.precioPosicionado}`); // Ver el precio posicionado

            // Calcular el precio ajustado
            try {
                product.precioAjustado = parseFloat((
                    product.pvp - ((product.pvp - product.precioPosicionado) * ratioPosicionamiento / 100)
                ).toFixed(2));

                // Log para depuración
                console.log(`  Precio Ajustado: ${product.precioAjustado}`);

            } catch (error) {
                console.error(`Error al calcular precios para el producto ${product.nombre}:`, error);
                product.precioAjustado = 0; // Valor predeterminado seguro
            }
        });
    }
}



function calcularInteresProductoSegmento(playersData, marketData) {
    for (const playerData of Object.values(playersData)) {
        // Acceso seguro a los productos
        const productos = playerData.gameState?.products || [];
        
        productos.forEach(product => {
            product.interesPorSegmento = {}; // Inicializar el objeto de interés por segmento

            for (const [segmentoNombre, segmento] of Object.entries(marketData.segmentos || {})) {
                let interesTotal = 0; // Suma de las notas de interés para cada característica
                let promedioProducto = 0;
                let promedioSegmento = 0;
                const notasInteres = {}; // Guardar notas de interés por característica

                let numCaracteristicas = 0;
                for (const [caracteristica, valorIdeal] of Object.entries(segmento.productoIdeal || {})) {
                    // Validar que la característica ajustada exista
                    if (product.caracteristicasAjustadas?.hasOwnProperty(caracteristica)) {
                        const valorAjustado = parseFloat(product.caracteristicasAjustadas[caracteristica]) || 0;

                        // Calcular el interés por característica
                        let interesCaracteristica = 0;
                        if (valorIdeal > 0) {
                        const excesoRelativo = valorAjustado / valorIdeal;
                        const umbral       = 1.13;           // +13 %
                        const exp          = 3.5;            // exponente para penalizar
                        const maxPremio    = 10 * umbral;    // 11.3

                        if (excesoRelativo < 1) {
                        interesCaracteristica = 10 * Math.pow(excesoRelativo, exp);
                        } else if (excesoRelativo <= umbral) {
                        interesCaracteristica = 10 * excesoRelativo;
                        } else {
                        const desajuste = (excesoRelativo - umbral) / umbral;
                        const factor = Math.max(0, 1 - desajuste);
                        interesCaracteristica = maxPremio * Math.pow(factor, exp);
                        }

                        // Clamp final a 0 mínimo y redondear
                        interesCaracteristica = Math.max(0, interesCaracteristica);
                        interesCaracteristica = parseFloat(interesCaracteristica.toFixed(2));

                        }
                        

                        // Agregar los datos al cálculo total de interés y promedios
                        notasInteres[caracteristica] = interesCaracteristica;
                        interesTotal += interesCaracteristica;
                        promedioProducto += valorAjustado;
                        promedioSegmento += parseFloat(valorIdeal) || 0;
                        numCaracteristicas++;
                    }
                }

                // Calcular los promedios de interés y características si hay características válidas
                const interesPromedio = numCaracteristicas > 0 ? parseFloat((interesTotal / numCaracteristicas).toFixed(2)) : 0;
                promedioProducto = numCaracteristicas > 0 ? parseFloat((promedioProducto / numCaracteristicas).toFixed(2)) : 0;
                promedioSegmento = numCaracteristicas > 0 ? parseFloat((promedioSegmento / numCaracteristicas).toFixed(2)) : 0;

                // Guardar los promedios y las notas de interés para cada segmento
                product.interesPorSegmento[segmentoNombre] = {
                    notasInteres,
                    promedioProducto,
                    promedioSegmento,
                    interesPromedio
                };

                
            }
        });
    }
}






// Función para calcular la nota de interés en precio usando la función de sensibilidad
function calcularInteresPrecio(producto, funcionSensibilidad, interesProducto) {
  // Validaciones mínimas
  const pa = producto.precioAjustado;
  if (typeof pa !== "number" || isNaN(pa) || pa < 0) return 0;
  if (typeof funcionSensibilidad !== "function")       return 0;
  if (typeof interesProducto !== "number"  
      || isNaN(interesProducto) || interesProducto <= 0) return 0;

 const maxAjusteEuros = 30;
const maxAjustePorcentaje = 0.10; // ±10 %

// 1) Calcular factor de compensación
let factor = 10 / interesProducto;

// 2) Limitar el factor entre [0.90, 1.10]
factor = Math.max(1 - maxAjustePorcentaje, Math.min(factor, 1 + maxAjustePorcentaje));

// 3) Calcular precio percibido provisional
const precioAjustado = pa * factor;

// 4) Limitar diferencia máxima a ±30 €
const diferencia = precioAjustado - pa;
const diferenciaLimitada = Math.max(-maxAjusteEuros, Math.min(diferencia, maxAjusteEuros));

// 5) Precio percibido final
const precioPercibido = pa + diferenciaLimitada;
producto.precioPercibido = precioPercibido;

  // 3) Calculamos la demanda y normalizamos a 0–10
  const demanda = funcionSensibilidad(precioPercibido);
  const interes = Math.max(0, Math.min(10, demanda / 10));

  // (Opcional) guardarlo también
  producto.interesPrecio = interes;

  return interes;
}


// Función para renderizar la nota de interés en precio en la consola
function mostrarPriceInterestNote(playersData, marketData) {
    console.log("Rendering interest notes in price for all players...");

    for (const [playerName, playerData] of Object.entries(playersData)) {
        console.log(`\nNota de Interés en Precio de ${playerName}:`);

        // Acceso seguro a los productos
        const productos = playerData.gameState?.products || [];
        if (productos.length === 0) {
            console.warn(`No hay productos para el jugador ${playerName}.`);
            continue;
        }

        productos.forEach(product => {
            console.log(`\nProducto: ${product.nombre || "N/A"}`);
            console.log(`Precio Ajustado: ${product.precioAjustado || "N/A"}`);

            console.log("Interés en Precio por Segmento:");
            console.log("  Segmento          | Interés en Precio");
            console.log("  ------------------------------------");

            // Imprimir el interés en precio para cada segmento
            Object.entries(marketData.segmentos || {}).forEach(([segmentoNombre, segmento]) => {
            const funcionSensibilidad = segmento.funcionSensibilidad;
         if (typeof funcionSensibilidad !== 'function') return;

        const interesProducto = product.interesPorSegmento?.[segmentoNombre]?.interesPromedio || 0;
        const interesPrecio   = calcularInteresPrecio(
        product,      // precio nominal
        funcionSensibilidad,         // curva del segmento
        interesProducto              // nota de producto
    );

    
});
        });
    }
}



// Función para calcular la nota de interés final y renderizarla en la consola
function renderFinalInterestNote(playersData, marketData) {
    console.log("Rendering final interest notes for all players...");

    for (const [playerName, playerData] of Object.entries(playersData)) {
        console.log(`\nNota de Interés Final de ${playerName}:`);

        // Acceso seguro a los productos
        const productos = playerData.gameState?.products || [];
        if (productos.length === 0) {
            console.warn(`No hay productos para el jugador ${playerName}.`);
            continue;
        }

        productos.forEach(product => {
            console.log(`\nProducto: ${product.nombre || "N/A"}`);

            // Interés en Producto por cada segmento
            console.log("Interés en Producto por Segmento:");
            console.log("  Segmento          | Interés en Producto");
            console.log("  ---------------------------------------");

            Object.keys(marketData.segmentos || {}).forEach(segmentoNombre => {
                const interesProducto = product.interesPorSegmento?.[segmentoNombre]?.interesPromedio || 0;
                console.log(`  ${segmentoNombre.padEnd(17)} | ${interesProducto.toFixed(2)}`);
            });

            // Interés en Precio por cada segmento
            console.log("\nInterés en Precio por Segmento:");
            console.log("  Segmento          | Interés en Precio");
            console.log("  -------------------------------------");

            Object.keys(marketData.segmentos || {}).forEach(segmentoNombre => {
                const funcionSensibilidad = marketData.segmentos?.[segmentoNombre]?.funcionSensibilidad;
                const interesProducto = product.interesPorSegmento?.[segmentoNombre]?.interesPromedio || 0;
                const interesPrecio   = calcularInteresPrecio(
                product,   // precio nominal
                funcionSensibilidad,      // curva del segmento
                interesProducto           // nota de producto
);
                console.log(`  ${segmentoNombre.padEnd(17)} | ${interesPrecio.toFixed(2)}`);
            });

            // Interés Final por cada segmento
            console.log("\nInterés Final por Segmento:");
            console.log("  Segmento          | Interés Final");
            console.log("  --------------------------------");

            Object.keys(marketData.segmentos || {}).forEach(segmentoNombre => {
                const interesProducto = product.interesPorSegmento?.[segmentoNombre]?.interesPromedio || 0;
                const funcionSensibilidad = marketData.segmentos?.[segmentoNombre]?.funcionSensibilidad;
                const interesPrecio = calcularInteresPrecio(
                    product,
                    funcionSensibilidad,
                    interesProducto          // <-- tercer argumento
                );
                const interesFinal = (interesProducto + interesPrecio) / 2;
                console.log(`  ${segmentoNombre.padEnd(17)} | ${interesFinal.toFixed(2)}`);
            });
        });
    }
}



// Función para renderizar la presencia en canales de distribución con lag Koyck (α=0.5)
// y normalizar contra el líder suavizado (100 %)
function renderChannelPresence(playersData) {
    console.log("Rendering channel presence data for all players...");

    const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];
    const α = 0.5;

    // 0) Construir maxUnitsByRound: para cada ronda y canal, máxima inversión "cruda"
    const maxUnitsByRound = {};
    for (const playerData of Object.values(playersData)) {
        // historial cerrado
        (playerData.gameState.roundsHistory || []).forEach(entry => {
            const rnd = entry.round;
            if (!maxUnitsByRound[rnd]) maxUnitsByRound[rnd] = {};
            canales.forEach(canal => {
                const u = entry.decisiones.canalesDistribucion[canal] || 0;
                maxUnitsByRound[rnd][canal] = Math.max(
                    maxUnitsByRound[rnd][canal] || 0,
                    u
                );
            });
        });
        // ronda actual
        const curr = playerData.gameState;
        const rnd = curr.round;
        if (!maxUnitsByRound[rnd]) maxUnitsByRound[rnd] = {};
        canales.forEach(canal => {
            const u = curr.canalesDistribucion[canal] || 0;
            maxUnitsByRound[rnd][canal] = Math.max(
                maxUnitsByRound[rnd][canal] || 0,
                u
            );
        });
    }

    // 1) Calcular smoothedStock[playerName][canal] aplicando Koyck
    const smoothedStock = {};
    for (const [playerName, playerData] of Object.entries(playersData)) {
        smoothedStock[playerName] = {};

        // fusionar historial cerrado + ronda actual
        const fullHistory = [
            ...(playerData.gameState.roundsHistory || []),
            {
                round: playerData.gameState.round,
                decisiones: {
                    canalesDistribucion: { ...playerData.gameState.canalesDistribucion }
                }
            }
        ].sort((a, b) => a.round - b.round);

        canales.forEach(canal => {
            let S_prev = null;
            fullHistory.forEach(entry => {
                const unidades   = entry.decisiones.canalesDistribucion[canal] || 0;
                const maxUnids   = maxUnitsByRound[entry.round][canal] || 1;
                const presRaw = (Math.sqrt(unidades) / Math.sqrt(maxUnids)) * 100;
                const S = (S_prev === null)
                    ? presRaw
                    : α * presRaw + (1 - α) * S_prev;
                S_prev = S;
            });
            smoothedStock[playerName][canal] = S_prev;
        });
    }

    // 2) Normalizar contra el líder suavizado ⇒ 100 %
    const maxUnitsInChannel = {};
    canales.forEach(canal => {
        maxUnitsInChannel[canal] = Math.max(
            ...Object.values(smoothedStock).map(ps => ps[canal] || 0),
            1 // evitar división por cero
        );
    });
    console.log("Máximos suavizados por canal (se usan como 100%):", maxUnitsInChannel);

    // 3) Construir presenciasPorProducto con los % normalizados
    const presenciasPorProducto = {};
    for (const [playerName, playerData] of Object.entries(playersData)) {
        console.log(`\nPresencia en Canales de ${playerName}:`);
        presenciasPorProducto[playerName] = {};

        const productos = playerData.gameState?.products || [];
        if (productos.length === 0) {
            console.warn(`No hay productos para el jugador ${playerName}.`);
            continue;
        }

        productos.forEach(product => {
            const presenceData = canales.reduce((result, canal) => {
                const S_T    = smoothedStock[playerName][canal] || 0;
                const denom  = maxUnitsInChannel[canal];
                const pres   = (S_T / denom) * 100;
                result[canal] = parseFloat(pres.toFixed(2));
                return result;
            }, {});

            presenciasPorProducto[playerName][product.nombre] = presenceData;

            // logging estructurado
            console.log(`Producto: ${product.nombre}`);
            console.log("Presencia en canales:");
            console.log("  Canal              | Presencia (%)");
            console.log("  ---------------------------------");
            Object.entries(presenceData).forEach(([canal, presencia]) => {
                console.log(`  ${canal.padEnd(18)} | ${presencia.toFixed(2).padStart(8)}%`);
            });
        });
    }

    return presenciasPorProducto;
}





// Función para calcular las unidades totales por segmento
function calcularUnidadesTotalesPorSegmento(marketData) {
    // Crear un objeto para almacenar las unidades totales por segmento
    const unidadesPorSegmento = {};

    // Validar que `marketData.segmentos` sea un objeto
    if (!marketData || typeof marketData.segmentos !== 'object') {
        console.error("Error: marketData.segmentos no es válido.");
        return unidadesPorSegmento; // Retorna vacío si los datos no son válidos
    }

    // Calcular unidades para cada segmento
    for (const [segmentoNombre, datosSegmento] of Object.entries(marketData.segmentos)) {
        // Validación de datos
        const usuariosPotenciales = datosSegmento.usuariosPotenciales || 0;
        const demandaAno1 = datosSegmento.demandaAno1 || 0;

        if (usuariosPotenciales <= 0 || demandaAno1 <= 0) {
            console.warn(`Advertencia: Datos no válidos para el segmento ${segmentoNombre}`);
        }

        // Calcular unidades y redondear
        const unidades = Math.round((usuariosPotenciales * demandaAno1) / 100);
        unidadesPorSegmento[segmentoNombre] = unidades;
    }

    return unidadesPorSegmento;
}

// Función para mostrar las unidades totales por segmento en la consola
function mostrarUnidadesTotalesPorSegmento(unidadesPorSegmento) {
    console.log("Mostrando unidades totales por segmento...");

    // Validar si `unidadesPorSegmento` es un objeto válido
    if (!unidadesPorSegmento || typeof unidadesPorSegmento !== 'object' || Object.keys(unidadesPorSegmento).length === 0) {
        console.warn("Advertencia: No hay datos de unidades por segmento para mostrar.");
        return;
    }

    // Encabezado de la tabla en la consola
    const headers = ["Segmento".padEnd(20), "Unidades"];
    console.log(headers.join("\t"));
    console.log("-".repeat(30));

    // Fila de datos: muestra cada segmento con sus unidades
    Object.entries(unidadesPorSegmento).forEach(([segmento, unidades]) => {
        console.log(`${segmento.padEnd(20)}\t${Math.round(unidades).toString().padStart(10)}`);
    });
}


// Función para calcular tramos de presencia por canal
function calcularTramosPorCanalPorSegmento(
  presenciasPorProducto,
  marketData,
  unidadesPorSegmento,
  playersData,
  { umbralDefault = 3, umbralPorSegmento = {}, canales = ['granDistribucion','minoristas','online','tiendaPropia','offline'] } = {}
) {
  // índice nombre → producto (+ playerName por si luego quieres)
  const productosIndex = Object.entries(playersData || {})
    .flatMap(([playerName, playerData]) => (playerData.gameState?.products || []).map(p => ({ ...p, playerName })))
    .reduce((acc, p) => (acc[p.nombre] = p, acc), {});

  const tramosPorCanal = {};

  for (const canal of canales) {
    // presencias en este canal (sin filtrar aún por segmento)
    const presencias = [];
    for (const [jugador, productos] of Object.entries(presenciasPorProducto || {})) {
      for (const [producto, data] of Object.entries(productos || {})) {
        const val = data?.[canal];
        if (typeof val === 'number') presencias.push({ jugador, producto, presencia: val });
      }
    }

    tramosPorCanal[canal] = {};

    // “lineal” por segmento
    for (const [segmento, udsSeg] of Object.entries(unidadesPorSegmento || {})) {
      const prefCanal = (marketData.segmentos?.[segmento]?.canalPreferencias?.[canal] || 0) / 100;
      const udsSegCanal = +(udsSeg * prefCanal).toFixed(2);
      const umbral = umbralPorSegmento[segmento] ?? umbralDefault;

      // 1) filtrar por **interés final** usando tus datos existentes
      const candidatos = presencias.filter(p => {
        const prod = productosIndex[p.producto];
        if (!prod) return false;

        const interesProducto = Math.max(0, prod.interesPorSegmento?.[segmento]?.interesPromedio || 0);
        const fnSens = marketData.segmentos?.[segmento]?.funcionSensibilidad;
        const interesPrecio = Math.max(0, calcularInteresPrecio(prod, typeof fnSens === 'function' ? fnSens : () => 0, interesProducto));
        const interesFinal = (interesProducto + interesPrecio) / 2;

        // (Opcional) cachear para reutilizar luego en el reparto
        prod.interesFinalPorSegmento ||= {};
        if (typeof prod.interesFinalPorSegmento[segmento] !== 'number') {
          prod.interesFinalPorSegmento[segmento] = interesFinal;
        }

        return interesFinal >= umbral;
      });

      if (!candidatos.length || udsSegCanal <= 0) {
        tramosPorCanal[canal][segmento] = [];
        continue;
      }

      // 2) renormalizar presencia **entre los elegibles de este segmento**
      const maxPres = Math.max(...candidatos.map(p => p.presencia), 1);
      const elegibles = candidatos.map(p => ({ ...p, presencia: (p.presencia / maxPres) * 100 }));

      // 3) cortes únicos del lineal (segmento+canal)
      const valoresUnicos = [0, ...Array.from(new Set(elegibles.map(p => Math.round(p.presencia))))].sort((a,b)=>a-b);

      // 4) construir tramos del lineal
      const tramos = [];
      for (let i = 0; i < valoresUnicos.length - 1; i++) {
        const inicio = valoresUnicos[i];
        const fin    = valoresUnicos[i+1];
        const tramoPorcentaje = fin - inicio;

        const productosEnTramo = elegibles.filter(p => p.presencia > inicio).map(p => p.producto);
        if (!productosEnTramo.length) continue;

        tramos.push({
          tramoRango: `${inicio}% - ${fin}%`,
          tramoPorcentaje,
          productos: productosEnTramo,                   // ya filtrados por interés en ESTE segmento
          unidadesTramo: +((tramoPorcentaje / 100) * udsSegCanal).toFixed(2)
        });
      }

      tramosPorCanal[canal][segmento] = tramos;
    }
  }

  return tramosPorCanal;
}

// Función para mostrar los tramos por canal en la consola
function mostrarTramosPorCanalEnConsola(tramosPorCanal) {
    console.log("Mostrando tramos por canal...");

    Object.entries(tramosPorCanal || {}).forEach(([canal, tramos]) => {
        console.log(`\nTramos de Reparto en ${canal.charAt(0).toUpperCase() + canal.slice(1)}:`);

        // Verificar que haya tramos en el canal actual
        if (tramos && tramos.length > 0) {
            // Encabezado de la tabla en consola con padding
            const segmentos = Object.keys(tramos[0].unidadesPorSegmento || {});
            const headers = [
                "Rango de Tramo".padEnd(20),
                "Productos".padEnd(30),
                ...segmentos.map(segmento => segmento.padEnd(20))
            ];
            console.log(headers.join(""));

            console.log("-".repeat(headers.join("").length)); // Separador

            // Filas de datos de los tramos
            tramos.forEach(tramo => {
                const row = [
                    tramo.tramoRango.padEnd(20),                        // Rango del Tramo (ej. "0% - 20%")
                    (tramo.productos || []).join(', ').padEnd(30),      // Productos que compiten en el tramo
                    ...segmentos.map(segmento => {
                        const unidades = tramo.unidadesPorSegmento?.[segmento] || 0;
                        return unidades.toFixed(2).padStart(20);        // Unidades por cada segmento
                    })
                ];
                console.log(row.join(""));
            });
        } else {
            console.log("No hay tramos para este canal.");
        }
    });

    console.log("\nFin de los tramos por canal.\n");
}



function calcularRepartoUnidades_vLineal(tramosPorCanal, playersData, marketData) {
  const resultadosDetallados = [];
  const descartesDetallados = [];

  const productosPorNombre = Object.entries(playersData || {})
    .flatMap(([playerName, playerData]) => (playerData.gameState?.products || []).map(product => ({ ...product, playerName })))
    .reduce((acc, producto) => (acc[producto.nombre] = producto, acc), {});

  Object.entries(tramosPorCanal || {}).forEach(([canal, porSegmento]) => {
    Object.entries(porSegmento || {}).forEach(([segmento, tramos]) => {
      (tramos || []).forEach((tramo, index) => {
        const unidadesTramoSegmento = tramo?.unidadesTramo || 0;
        if (unidadesTramoSegmento <= 0) return;

        const productosConInteres = (tramo.productos || [])
          .map(nombre => {
            const prod = productosPorNombre[nombre];
            if (!prod) return null;

            // usar caché si existe; si no, recomputar con tu función
            let interesFinal = prod.interesFinalPorSegmento?.[segmento];
            if (typeof interesFinal !== 'number') {
              const ip = Math.max(0, prod.interesPorSegmento?.[segmento]?.interesPromedio || 0);
              const fn = marketData.segmentos?.[segmento]?.funcionSensibilidad;
              const iprecio = Math.max(0, calcularInteresPrecio(prod, typeof fn === 'function' ? fn : () => 0, ip));
              interesFinal = Math.max(0, Math.min(10, (ip + iprecio) / 2));
            }

            return { nombre, playerName: prod.playerName, interesFinal };
          })
          .filter(Boolean);

        if (!productosConInteres.length) {
          descartesDetallados.push({
            canal, tramo: `Tramo ${index + 1}`, segmento,
            porcentajeDescartado: 100,
            unidadesDescartadas: +unidadesTramoSegmento.toFixed(2)
          });
          return;
        }

        // FIX 1: quitar un paréntesis al final
        const umbrales = productosConInteres.map(p =>
          Math.min(100, Math.max(0, Math.floor(p.interesFinal * 10)))
        );

        const maxScore = umbrales.length ? Math.max(...umbrales) : 0;
        const puntosCorte = Array.from(new Set([0, ...umbrales, maxScore])).sort((a, b) => a - b);

        const pesos = {};
        let descartePct = 0;

        for (let k = 0; k < puntosCorte.length - 1; k++) {
          const inicio = puntosCorte[k], fin = puntosCorte[k + 1], ancho = Math.max(0, fin - inicio);
          if (ancho <= 0) continue;

          const elegibles = productosConInteres.filter(p => {
            const score = Math.floor(p.interesFinal * 10);
            if (score <= 0) return false;
            return (inicio === 0) ? score > 0 : score > inicio;
          });

          if (!elegibles.length) { descartePct += ancho; continue; }
          const aporte = ancho / elegibles.length;
          elegibles.forEach(p => { pesos[p.nombre] = (pesos[p.nombre] || 0) + aporte; });
        }

        const sumaPesos = Object.values(pesos).reduce((a, b) => a + b, 0);
        const unidadesDescartadas = (descartePct / 100) * unidadesTramoSegmento;
        const unidadesAsignables  = (sumaPesos   / 100) * unidadesTramoSegmento;

        if (descartePct > 0) {
          descartesDetallados.push({
            canal, tramo: `Tramo ${index + 1}`, segmento,
            porcentajeDescartado: +descartePct.toFixed(2),
            unidadesDescartadas: +unidadesDescartadas.toFixed(2)
          });
        }
        if (sumaPesos <= 0 || unidadesAsignables <= 0) return;

        Object.entries(pesos).forEach(([nombreProducto, pesoPct]) => {
          const prod = productosConInteres.find(p => p.nombre === nombreProducto);
          const fraccion = pesoPct / sumaPesos;
          const unidadesAsignadas = +(fraccion * unidadesAsignables).toFixed(2);

          resultadosDetallados.push({
            jugador: prod.playerName,
            canal,
            tramo: `Tramo ${index + 1}`,
            porcentajeTramo: tramo.tramoPorcentaje,
            producto: prod.nombre,
            segmento,
            unidadesAsignadas
          });
        });
      });
    });
  }); // FIX 2: cerrar el forEach externo correctamente (era '};')

  return { resultadosDetallados, descartesDetallados };
}





// Función para mostrar el reparto de unidades por tramo en la consola
function mostrarRepartoPorTramoEnConsola(resultadosDetallados) {
    console.log("Mostrando reparto de unidades por tramo en la consola...");

    if (!Array.isArray(resultadosDetallados) || resultadosDetallados.length === 0) {
        console.warn("Advertencia: No hay resultados detallados para mostrar.");
        return;
    }

    // Agrupar resultados por canal y tramo
    const resultadosAgrupados = resultadosDetallados.reduce((acc, item) => {
        const { canal, tramo, porcentajeTramo } = item;

        if (!acc[canal]) {
            acc[canal] = {};
        }
        if (!acc[canal][tramo]) {
            acc[canal][tramo] = { porcentajeTramo, productos: [] };
        }
        acc[canal][tramo].productos.push(item);

        return acc;
    }, {});

    // Obtener segmentos dinámicamente a partir de los resultados
    const segmentos = [...new Set(resultadosDetallados.map(item => item.segmento))];
    const headers = ["Producto".padEnd(15), ...segmentos.map(s => s.padEnd(15))];

    // Mostrar datos por canal y tramo
    Object.entries(resultadosAgrupados).forEach(([canal, tramos]) => {
        console.log(`\nReparto de Unidades en ${canal.charAt(0).toUpperCase() + canal.slice(1)}:`);

        Object.entries(tramos).forEach(([tramo, data]) => {
            console.log(`\n ${tramo} (${data.porcentajeTramo.toFixed(2)}% del total)`);

            // Encabezado de la tabla
            console.log(headers.join(""));
            console.log("-".repeat(headers.join("").length));

            // Agrupar productos y unidades asignadas por segmento
            const productosAgrupados = data.productos.reduce((prodAcc, { producto, segmento, unidadesAsignadas }) => {
                if (!prodAcc[producto]) {
                    prodAcc[producto] = { producto, unidadesPorSegmento: {} };
                }
                prodAcc[producto].unidadesPorSegmento[segmento] = unidadesAsignadas;
                return prodAcc;
            }, {});

            // Mostrar filas de productos con unidades asignadas por segmento
            Object.values(productosAgrupados).forEach(({ producto, unidadesPorSegmento }) => {
                const row = [
                    producto.padEnd(15),
                    ...segmentos.map(segmento => (unidadesPorSegmento[segmento] || 0).toFixed(2).padStart(15))
                ];
                console.log(row.join(""));
            });
        });
    });

    console.log("\nFin del reparto de unidades.\n");
}



// Función para consolidar ventas por canal, producto y segmento
function consolidarVentas(resultadosDetallados) {
    const ventasConsolidadas = {
        porProducto: {} // Estructura para almacenar demanda total por producto
    };

    if (!Array.isArray(resultadosDetallados) || resultadosDetallados.length === 0) {
        console.warn("Advertencia: No hay datos de resultados detallados para consolidar.");
        return ventasConsolidadas;
    }

    resultadosDetallados.forEach(({ canal, producto, segmento, unidadesAsignadas, jugador }) => {
        if (!canal || !producto || !segmento || !unidadesAsignadas) {
            console.warn("Advertencia: Registro incompleto en resultadosDetallados:", {
                canal,
                producto,
                segmento,
                unidadesAsignadas
            });
            return;
        }

        // Inicializar datos del canal si no existe
        if (!ventasConsolidadas[canal]) {
            ventasConsolidadas[canal] = {
                productos: {},
                segmentos: {
                    profesionales: 0,
                    altosIngresos: 0,
                    granConsumidor: 0,
                    bajosIngresos: 0,
                    innovadores: 0,
                    total: 0
                }
            };
        }

        // Inicializar datos del producto en el canal si no existe
        if (!ventasConsolidadas[canal].productos[producto]) {
            ventasConsolidadas[canal].productos[producto] = {
                jugador,
                profesionales: 0,
                altosIngresos: 0,
                granConsumidor: 0,
                bajosIngresos: 0,
                innovadores: 0,
                total: 0
            };
        }

        // Sumar unidades asignadas al producto y segmento en el canal
        ventasConsolidadas[canal].productos[producto][segmento] += unidadesAsignadas;
        ventasConsolidadas[canal].productos[producto].total += unidadesAsignadas;

        // Sumar unidades al segmento general del canal
        ventasConsolidadas[canal].segmentos[segmento] += unidadesAsignadas;
        ventasConsolidadas[canal].segmentos.total += unidadesAsignadas;

        // Inicializar datos del producto en la sección general por producto si no existe
        if (!ventasConsolidadas.porProducto[producto]) {
            ventasConsolidadas.porProducto[producto] = { total: 0 };
        }

        // Sumar unidades asignadas al total por producto
        ventasConsolidadas.porProducto[producto].total += unidadesAsignadas;
    });

    return ventasConsolidadas;
}





// Paso 1: Calcular ventas por unidades disponibles
function calcularVentasPorUnidadesDisponibles(playersData, ventasPorProducto) {
    const ventasDisponibilidad = [];

    // Validar que playersData sea un objeto
    if (typeof playersData !== "object" || playersData === null) {
        console.warn("Advertencia: Se esperaba un objeto para playersData, pero se recibió:", playersData);
        return ventasDisponibilidad; // Retornar un arreglo vacío si playersData no es válido
    }

    for (const [playerName, playerData] of Object.entries(playersData)) {
        const products = playerData.gameState?.products || [];

        // Verificar que products sea un arreglo
        if (!Array.isArray(products)) {
            console.warn(`Advertencia: Se esperaba un arreglo para los productos de ${playerName}, pero se recibió:`, products);
            continue; // Omitir esta iteración si products no es un arreglo
        }

        products.forEach(product => {
            const unidadesTotalesDisponibles = (product.stock || 0) + (product.unidadesFabricar || 0);
            const unidadesDemandadas = ventasPorProducto[product.nombre]?.total || 0;

            const ventasEfectivas = Math.min(unidadesTotalesDisponibles, unidadesDemandadas);
            const excedente = unidadesTotalesDisponibles - ventasEfectivas;

            ventasDisponibilidad.push({
                jugador: playerName,
                producto: product.nombre || "Producto desconocido",
                unidadesDisponibles: unidadesTotalesDisponibles,
                unidadesDemandadas,
                ventasEfectivas,
                excedente,
                precio: product.precio || 0
            });
        });
    }

    return ventasDisponibilidad;
}



// Función para mostrar ventas por unidades disponibles en la consola
function mostrarVentasPorUnidadesDisponiblesEnConsola(ventasDisponibilidad) {
    console.log("Ventas por Unidades Disponibles:\n");

    if (!Array.isArray(ventasDisponibilidad) || ventasDisponibilidad.length === 0) {
        console.warn("Advertencia: No hay datos de ventas por unidades disponibles para mostrar.");
        return;
    }

    // Encabezado de la tabla con padding
    const headers = ["Jugador", "Producto", "Unidades Disponibles", "Unidades Demandadas", "Ventas Efectivas", "Excedente"];
    console.log(headers.map(header => header.padEnd(22)).join(""));
    console.log("-".repeat(headers.length * 22)); // Línea de separación

    // Totales generales
    let totalUnidadesDisponibles = 0;
    let totalUnidadesDemandadas = 0;
    let totalVentasEfectivas = 0;
    let totalExcedente = 0;

    // Agregar filas con los datos de ventas por disponibilidad
    ventasDisponibilidad.forEach(data => {
        const row = [
            (data.jugador || "Desconocido").padEnd(22),
            (data.producto || "Producto desconocido").padEnd(22),
            (data.unidadesDisponibles || 0).toLocaleString().padStart(22),
            (data.unidadesDemandadas || 0).toLocaleString().padStart(22),
            (data.ventasEfectivas || 0).toLocaleString().padStart(22),
            (data.excedente || 0).toLocaleString().padStart(22)
        ];
        console.log(row.join(""));

        // Acumular los totales
        totalUnidadesDisponibles += data.unidadesDisponibles || 0;
        totalUnidadesDemandadas += data.unidadesDemandadas || 0;
        totalVentasEfectivas += data.ventasEfectivas || 0;
        totalExcedente += data.excedente || 0;
    });

    console.log("-".repeat(headers.length * 22)); // Línea de separación

    // Fila de totales
    const totalRow = [
        "Total".padEnd(44), // Combina espacio para "Jugador" y "Producto"
        totalUnidadesDisponibles.toLocaleString().padStart(22),
        totalUnidadesDemandadas.toLocaleString().padStart(22),
        totalVentasEfectivas.toLocaleString().padStart(22),
        totalExcedente.toLocaleString().padStart(22)
    ];
    console.log(totalRow.join(""));
    console.log("\n");
}



function calcularDemandaPorSegmentoCanal(resultadosDetallados) {
    // Validación inicial
    if (!Array.isArray(resultadosDetallados) || resultadosDetallados.length === 0) {
        console.warn("Advertencia: No hay resultados detallados para calcular la demanda.");
        return {};
    }

    // Reducir para consolidar la demanda
    const demandaPorJugador = resultadosDetallados.reduce((acc, item) => {
        const { jugador, producto, canal, segmento, unidadesAsignadas } = item;

        // Validación de datos necesarios
        if (!jugador || !producto || !canal || !segmento || unidadesAsignadas == null) {
            console.warn("Advertencia: Registro incompleto en resultadosDetallados:", item);
            return acc;
        }

        // Estructura de datos anidada
        acc[jugador] = acc[jugador] || {};
        acc[jugador][producto] = acc[jugador][producto] || {};
        acc[jugador][producto][canal] = acc[jugador][producto][canal] || {
            profesionales: 0,
            altosIngresos: 0,
            granConsumidor: 0,
            bajosIngresos: 0,
            innovadores: 0,
            totalCanal: 0
        };

        // Incrementar valores
        acc[jugador][producto][canal][segmento] += unidadesAsignadas;
        acc[jugador][producto][canal].totalCanal += unidadesAsignadas;

        return acc;
    }, {});

    return demandaPorJugador;
}





function calcularRepartoVentasProporcional(playersData, ventasDisponibilidad, demandaPorSegmentoCanal) {
    const resultadosReparto = [];

    if (!Array.isArray(ventasDisponibilidad) || ventasDisponibilidad.length === 0) {
        console.warn("Advertencia: No hay datos de ventas por disponibilidad para calcular el reparto.");
        return resultadosReparto;
    }

    ventasDisponibilidad.forEach(({ jugador, producto, unidadesDisponibles, unidadesDemandadas }) => {
        const demandaProducto = demandaPorSegmentoCanal[jugador]?.[producto];
        if (!demandaProducto) {
            console.warn(`Demanda no encontrada para jugador ${jugador}, producto ${producto}`);
            return;
        }

        const totalDemandaProducto = unidadesDemandadas || 0;
        console.log(`Procesando: ${jugador} - ${producto} | Unidades Disponibles: ${unidadesDisponibles} | Demanda Total Producto: ${totalDemandaProducto}`);

        // Obtener el precio del producto desde playersData
        const precio = playersData[jugador]?.gameState?.products?.find(p => p.nombre === producto)?.precio;
        if (precio === undefined) {
            console.warn(`Advertencia: No se encontró precio para el producto ${producto} del jugador ${jugador}`);
        }

        // Desglosar por canal y segmento
        Object.entries(demandaProducto).forEach(([canal, demandaSegmento]) => {
            if (canal === "Total Segmento") return;

            const demandaCanal = demandaSegmento.totalCanal || 0;
            const fraccionDemandaCanal = totalDemandaProducto > 0 ? (demandaCanal / totalDemandaProducto) : 0;
            const unidadesRecibidasCanal = unidadesDisponibles * fraccionDemandaCanal;

            Object.entries(demandaSegmento).forEach(([segmento, demanda]) => {
                if (segmento === "totalCanal") return;

                // Fracción de la demanda por segmento
                const fraccionDemandaSegmento = demandaCanal > 0 ? (demanda / demandaCanal) : 0;
                const unidadesRecibidas = unidadesRecibidasCanal * fraccionDemandaSegmento;
                const unidadesNoVendidas = Math.max(demanda - unidadesRecibidas, 0);

                resultadosReparto.push({
                    jugador,
                    producto,
                    canal,
                    segmento,
                    demanda: demanda.toFixed(2),
                    fraccionDemanda: fraccionDemandaSegmento.toFixed(4),
                    unidadesRecibidas: unidadesRecibidas.toFixed(2),
                    unidadesNoVendidas: unidadesNoVendidas.toFixed(2),
                    precio: precio || 0 // Incluir precio o usar 0 si está indefinido
                });
            });
        });
    });

    return resultadosReparto;
}




function calcularPenalizacionPorInteres(playersData) {
    const penalizacionPorProducto = {};

    if (!playersData || typeof playersData !== "object") {
        console.warn("Advertencia: `playersData` debe ser un objeto válido.");
        return penalizacionPorProducto;
    }

    for (const [playerName, playerData] of Object.entries(playersData)) {
        const products = playerData.gameState?.products || [];

        if (!Array.isArray(products)) {
            console.warn(`Advertencia: Se esperaba un arreglo para los productos de ${playerName}, pero se recibió:`, products);
            continue;
        }

        penalizacionPorProducto[playerName] = {};

        products.forEach(product => {
            const efectoPosicionamiento = parseFloat(product.efectoPosicionamiento) || 0;
            const precio = parseFloat(product.precio) || 0;
            const precioAjustado = parseFloat(product.precioAjustado) || 0;

            let penalizacionPosicionamiento = 0;
            if (efectoPosicionamiento > 1) {
                penalizacionPosicionamiento = ((efectoPosicionamiento - 1) * 10).toFixed(2);
            }

            let penalizacionPrecio = 0;
            if (precio > precioAjustado) {
                const diferenciaPrecio = ((precio - precioAjustado) / precio) * 100;
                if (diferenciaPrecio > 10) {
                    penalizacionPrecio = (diferenciaPrecio).toFixed(2);
                }
            }

            const penalizacionTotal = parseFloat(penalizacionPosicionamiento) + parseFloat(penalizacionPrecio);
            penalizacionPorProducto[playerName][product.nombre || "Producto desconocido"] = penalizacionTotal.toFixed(2);
        });
    }

    return penalizacionPorProducto;
}

function aplicarPenalizacionEnVentas(resultadosReparto, penalizacionPorProducto) {
    const resultadosFinales = [];

    if (!Array.isArray(resultadosReparto) || resultadosReparto.length === 0) {
        console.warn("Advertencia: No hay resultados de reparto para procesar penalizaciones.");
        return resultadosFinales;
    }

    resultadosReparto.forEach(data => {
        const penalizacion = parseFloat(penalizacionPorProducto[data.jugador]?.[data.producto] || 0) / 100;

        // Validar datos
        const unidadesRecibidas = parseFloat(data.unidadesRecibidas || 0);
        const demanda = parseFloat(data.demanda || 0);

        if (isNaN(unidadesRecibidas) || isNaN(demanda)) {
            console.error(`Datos inválidos para jugador ${data.jugador}, producto ${data.producto}`);
            return;
        }

        // Cálculo de unidades vendidas
        const unidadesVendidas = Math.min(unidadesRecibidas, demanda);

        // Cálculo de unidades devueltas
        const unidadesDevueltas = unidadesVendidas * penalizacion;

        // Cálculo de unidades netas (vendidas menos devueltas)
        const unidadesNetas = unidadesVendidas - unidadesDevueltas;

        // Cálculo de totales no vendidas (demanda no satisfecha)
        const totalesNoVendidas = Math.max(demanda - unidadesVendidas, 0);

        // Cálculo de excedente (recibidas menos vendidas)
        const excedente = unidadesRecibidas - unidadesVendidas;

        resultadosFinales.push({
            ...data,
            porcentajeDevoluciones: (penalizacion * 100).toFixed(2),
            unidadesVendidas: unidadesVendidas.toFixed(2),
            unidadesDevueltas: unidadesDevueltas.toFixed(2),
            unidadesNetas: unidadesNetas.toFixed(2),
            totalesNoVendidas: totalesNoVendidas.toFixed(2),
            excedente: excedente.toFixed(2)
        });
    });

    
    return resultadosFinales;
}



function mostrarResultadosFinales(resultadosFinales) {
    const colWidths = {
        jugador: 12,
        producto: 12,
        canal: 15,
        segmento: 15,
        demanda: 12, // Nueva columna
        unidadesRecibidas: 18,
        unidadesVendidas: 18,
        excedente: 18,
        porcentajeDevoluciones: 18,
        unidadesDevueltas: 18,
        unidadesNetas: 18,
        totalesNoVendidas: 18,
        
    };

    
        
    

    resultadosFinales.forEach(data => {
        const costeUnitarioReal = calcularCosteReal(data.costeUnitario || 0, data.unidadesFabricar || 0);
        const costeVentas = costeUnitarioReal * (parseFloat(data.unidadesNetas) || 0);

        const row = [
            data.jugador.padEnd(colWidths.jugador),
            data.producto.padEnd(colWidths.producto),
            data.canal.padEnd(colWidths.canal),
            data.segmento.padEnd(colWidths.segmento),
            parseFloat(data.demanda || 0).toFixed(2).padStart(colWidths.demanda), // Mostrar la demanda
            parseFloat(data.unidadesRecibidas).toFixed(2).padStart(colWidths.unidadesRecibidas),
            parseFloat(data.unidadesVendidas).toFixed(2).padStart(colWidths.unidadesVendidas),
            parseFloat(data.excedente).toFixed(2).padStart(colWidths.excedente),
            parseFloat(data.porcentajeDevoluciones).toFixed(2).padStart(colWidths.porcentajeDevoluciones),
            parseFloat(data.unidadesDevueltas).toFixed(2).padStart(colWidths.unidadesDevueltas),
            parseFloat(data.unidadesNetas).toFixed(2).padStart(colWidths.unidadesNetas),
            parseFloat(data.totalesNoVendidas).toFixed(2).padStart(colWidths.totalesNoVendidas),
            costeUnitarioReal.toFixed(2).padStart(colWidths.costeUnitarioReal),
            costeVentas.toFixed(2).padStart(colWidths.costeVentas)
        ];
        console.log(row.join(" "));
    });
}


function calcularCosteReal(costeUnitarioEst, unidadesFabricar) {
    if (typeof costeUnitarioEst !== "number" || typeof unidadesFabricar !== "number") {
        return 0;
    }
    const bonificacion = Math.min(5.5, Math.floor(unidadesFabricar / 78000) * 0.67);
    return costeUnitarioEst * (1 - bonificacion / 100);
}

module.exports = {
    iniciarCalculos,
    calcularPenalizacionPorInteres,
    aplicarPenalizacionEnVentas,
    mostrarResultadosFinales,
    calcularCosteReal,
    eventEmitter // Aquí se exporta correctamente
};
