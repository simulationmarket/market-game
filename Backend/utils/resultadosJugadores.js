const { eventEmitter } = require('./calculos'); // Importar eventEmitter
const { calcularCosteReal } = require('./calculos'); // Importar calcularCosteReal si es necesario

const costeCanales = {
    granDistribucion: 75000,
    minoristas: 115000,
    online: 150000,
    tiendaPropia: 300000
};

function generarResultados(playersData, marketData, resultadosFinales,) {
    if (!Array.isArray(resultadosFinales)) {
        console.error("Error: resultadosFinales no es un array válido:", resultadosFinales);
        return [];
    }

    console.log("Procesando resultados finales:", resultadosFinales.filter(data => parseFloat(data.unidadesNetas) > 0));

    const resultados = [];

    // Inicialización de métricas acumulativas
    const facturacionBrutaPorJugador = {};
    const devolucionesPorJugador = {};
    const facturacionNetaPorJugador = {};
    const costeVentasPorJugador = {};
    const margenBrutoPorJugador = {};
    const gastosPublicitariosPorJugador = {};
    const gastosComercialesPorJugador = {};
    const gastosOperativosPorJugador = {};
    const gastosFinancierosPorJugador = {};
    const baiiPorJugador = {};
    const baiPorJugador = {};
    const impuestosPorJugador = {};
    const resultadoNetoPorJugador = {};
    const costeAlmacenajePorJugador = {};

    resultadosFinales.forEach(data => {
        const jugador = data.jugador;
    
        // Inicializar acumuladores para el jugador
        facturacionBrutaPorJugador[jugador] = facturacionBrutaPorJugador[jugador] || 0;
        devolucionesPorJugador[jugador] = devolucionesPorJugador[jugador] || 0;
        facturacionNetaPorJugador[jugador] = facturacionNetaPorJugador[jugador] || 0;
        costeVentasPorJugador[jugador] = costeVentasPorJugador[jugador] || 0;
        margenBrutoPorJugador[jugador] = margenBrutoPorJugador[jugador] || 0;
    
        // Datos esenciales
        const unidadesVendidas = parseFloat(data.unidadesVendidas) || 0;
        const unidadesDevueltas = parseFloat(data.unidadesDevueltas) || 0;
        const precio = parseFloat(data.precio) || 0;
    
        // Recalcular unidades netas para consistencia
        const unidadesNetasCalculadas = unidadesVendidas - unidadesDevueltas;
        const unidadesNetas = (parseFloat(data.unidadesNetas) === unidadesNetasCalculadas) 
            ? parseFloat(data.unidadesNetas) 
            : unidadesNetasCalculadas;
    
        // Facturación Bruta
        const facturacionBruta = unidadesVendidas * precio;
        facturacionBrutaPorJugador[jugador] += facturacionBruta;
    
        // Devoluciones
        const devoluciones = unidadesDevueltas * precio;
        devolucionesPorJugador[jugador] += devoluciones;
    
        // Facturación Neta
        const facturacionNeta = facturacionBruta - devoluciones;
        facturacionNetaPorJugador[jugador] += facturacionNeta;
    
        // Coste Unitario Real
        const productoData = playersData[jugador]?.gameState?.products?.find(p => p.nombre === data.producto) || {};
        const costeUnitarioEst = parseFloat(data.costeUnitarioEst || productoData.costeUnitarioEst || 0);
        const unidadesFabricar = parseFloat(data.unidadesFabricar || productoData.unidadesFabricar || 0);
        const costeUnitarioReal = calcularCosteReal(costeUnitarioEst, unidadesFabricar);
    
        // Coste de Ventas
        const stockPrevio    = parseFloat(productoData.stock || 0);
        const unidadesCoste  = Math.max(0, unidadesVendidas);
        const costeVentas    = unidadesCoste * costeUnitarioReal;
        costeVentasPorJugador[jugador] += costeVentas;


    
        // Margen Bruto por Producto
        const margenBrutoProducto = facturacionNeta - costeVentas;
    
        // Acumular Margen Bruto por Jugador
        margenBrutoPorJugador[jugador] += margenBrutoProducto;
    
        if (unidadesVendidas > 0) {
            const demanda = parseFloat(data.demanda) || 0;
            const unidadesRecibidas = parseFloat(data.unidadesRecibidas) || 0;
            const excedente = unidadesRecibidas - unidadesVendidas;
            const totalesNoVendidas = Math.max(0, demanda - unidadesVendidas);
    
            resultados.push({
                jugador,
                producto: data.producto,
                canal: data.canal,
                segmento: data.segmento,
                demanda,
                unidadesRecibidas,
                unidadesVendidas,
                excedente,
                porcentajeDevoluciones: parseFloat(data.porcentajeDevoluciones) || 0,
                unidadesDevueltas,
                unidadesNetas,
                totalesNoVendidas,
                facturacionBruta,
                facturacionNeta,
                costeVentasProducto: costeVentas,
                margenBrutoProducto
            });

        }
        
    });


    Object.keys(playersData).forEach(playerName => {
        const player = playersData[playerName];
        const canalesDistribucion = player?.gameState?.canalesDistribucion || {};
    
        // Inicializar gastos comerciales para el jugador
        gastosComercialesPorJugador[playerName] = 0;
    
        // Calcular gastos comerciales por canal
        Object.entries(canalesDistribucion).forEach(([canal, unidades]) => {
            const costeCanal = costeCanales[canal] || 0; // Asegurar coste del canal
            const unidadesDistribuidas = parseFloat(unidades) || 0; // Asegurar que unidades sea numérico
            gastosComercialesPorJugador[playerName] += costeCanal * unidadesDistribuidas;
        });
    
        // Inicializar gastos financieros y calcular
        gastosFinancierosPorJugador[playerName] = 0;
        player?.gameState?.loans?.forEach(loan => {
            const amortizacionCuota = loan.amount / loan.term;
            const interesCuota = amortizacionCuota * loan.interestRate;
            gastosFinancierosPorJugador[playerName] += amortizacionCuota + interesCuota;
        });
    
        // Inicializar gastos publicitarios y calcular
    gastosPublicitariosPorJugador[playerName] = 0;

    // Acceder a los productos desde gameState.products
    const productos = player?.gameState?.products || [];

    // Iterar sobre los productos y calcular los gastos publicitarios
    productos.forEach(producto => {
    if (!producto.nombre) {
        console.warn(`Un producto del jugador ${playerName} no tiene un nombre definido.`);
        return;
    }

    // Obtener el presupuesto publicitario del producto
    const presupuestoPublicidad = parseFloat(producto.publicidad || 0);

    if (isNaN(presupuestoPublicidad)) {
        console.error(`El presupuesto publicitario del producto ${producto.nombre} no es válido para el jugador ${playerName}.`);
        return;
    }

    // Sumar al total de gastos publicitarios del jugador
    gastosPublicitariosPorJugador[playerName] += presupuestoPublicidad;

    // Depuración: Mostrar el presupuesto asignado por producto
    console.log(`Jugador: ${playerName}, Producto: ${producto.nombre}, Presupuesto Publicitario: ${presupuestoPublicidad}`);
    });

    // Mostrar el total acumulado de gastos publicitarios para el jugador
    console.log(`Gastos Publicitarios Totales para el jugador ${playerName}: ${gastosPublicitariosPorJugador[playerName]}`);
        
        //Incializar coste de almacenaje
        
        let costeAlmacenaje = 0; // Coste total de almacenaje para el jugador
    
        productos.forEach(producto => {
            // Buscar todos los resultados correspondientes al producto
            const resultadosProducto = resultadosFinales.filter(res =>
                res.jugador === playerName && res.producto.trim().toLowerCase() === producto.nombre.trim().toLowerCase()
            );
    
            if (resultadosProducto.length > 0) {
                // Sumar excedentes de todos los canales para el producto
                const excedenteTotal = resultadosProducto.reduce((sum, res) => sum + parseFloat(res.excedente || 0), 0);
                const costeProducto = excedenteTotal * 20; // Coste de almacenaje por unidad (7)
                costeAlmacenaje += costeProducto; // Acumular el coste
    
                // Actualizar el stock con el excedente total para la próxima ronda
                producto.stock = excedenteTotal;
    
                // Depuración
                console.log(`Jugador: ${playerName}, Producto: ${producto.nombre}, Excedente Total: ${excedenteTotal}, Coste Almacenaje: ${costeProducto}, Stock Actualizado: ${producto.stock}`);
            } else {
                console.warn(`No se encontraron resultados para el producto ${producto.nombre} del jugador ${playerName}`);
            }
        });
    
        // Añadir el coste de almacenaje a los gastos operativos
        gastosOperativosPorJugador[playerName] =
            (gastosPublicitariosPorJugador[playerName] || 0) +
            (gastosComercialesPorJugador[playerName] || 0) +
            costeAlmacenaje;
    
        // Calcular BAII, BAI, impuestos, y resultado neto
        baiiPorJugador[playerName] =
            margenBrutoPorJugador[playerName] - gastosOperativosPorJugador[playerName];
        baiPorJugador[playerName] =
            baiiPorJugador[playerName] - gastosFinancierosPorJugador[playerName];
        impuestosPorJugador[playerName] =
            baiPorJugador[playerName] > 0 ? baiPorJugador[playerName] * 0.15 : 0;
        resultadoNetoPorJugador[playerName] =
            baiPorJugador[playerName] - impuestosPorJugador[playerName];
    
        // Actualizar el presupuesto para la siguiente ronda
        player.gameState.budget += resultadoNetoPorJugador[playerName];
    
        // Asegurarse de que roundsHistory está definido
        if (!player.gameState.roundsHistory) {
            player.gameState.roundsHistory = [];
        }
    
        // Calcular el valor de la acción
        const presupuestosAnteriores = player.gameState.roundsHistory.slice(-5).map(r => r.resultadoNeto || 0);
        while (presupuestosAnteriores.length < 5) {
            presupuestosAnteriores.unshift(0); // Añadir 0 si no hay suficientes rondas anteriores
        }
        const sumaPresupuestos = presupuestosAnteriores.reduce((sum, val) => sum + val, 0);
        const valorActualizado = calcularValorAccion(presupuestosAnteriores);
        player.gameState.valorAccion = valorActualizado / 10000000;
    
        // Restablecer el estado de preparación para la siguiente ronda
        player.prepared = false;
    
        player.gameState.roundsHistory.push({
            round: player.gameState.round, // Número de ronda
            facturacionBruta: facturacionBrutaPorJugador[playerName],
            facturacionNeta: facturacionNetaPorJugador[playerName],
            devoluciones: devolucionesPorJugador[playerName],
            costeVentas: costeVentasPorJugador[playerName],
            margenBruto: margenBrutoPorJugador[playerName],
            gastosComerciales: gastosComercialesPorJugador[playerName],
            gastosOperativos: gastosOperativosPorJugador[playerName],
            costeAlmacenaje: costeAlmacenaje, // Nuevo campo para el coste de almacenaje
            baii: baiiPorJugador[playerName],
            gastosFinancieros: gastosFinancierosPorJugador[playerName],
            bai: baiPorJugador[playerName],
            impuestos: impuestosPorJugador[playerName],
            resultadoNeto: resultadoNetoPorJugador[playerName],
            valorAccion: player.gameState.valorAccion,
            decisiones: {
                products: (player.gameState.roundDecisions?.products || []).map(product => ({
                    caracteristicas: product.caracteristicas ? { ...product.caracteristicas } : {},
                    precio: parseFloat(product.precio || 0),
                    posicionamientoCalidad: parseFloat(product.posicionamientoCalidad || 0),
                    posicionamientoPrecio: parseFloat(product.posicionamientoPrecio || 0),
                    presupuestoPublicidad: parseFloat(product.presupuestoPublicidad || 0), // Ajuste clave
                    stock: parseFloat(product.stock || 0),
                    unidadesFabricar: parseFloat(product.unidadesFabricar || 0),
                })),
                canalesDistribucion: {
                    ...player.gameState.roundDecisions?.canalesDistribucion,
                },
            },
        });
        

        eventEmitter.emit('resultadosCompletosGenerados', resultados);
        return resultados;
        
    });
    
    

    mostrarResultadosPorPartidas(
        playersData,
        facturacionBrutaPorJugador,
        facturacionNetaPorJugador,
        devolucionesPorJugador,
        costeVentasPorJugador,
        margenBrutoPorJugador,
        gastosComercialesPorJugador,
        gastosPublicitariosPorJugador, // Añadido explícitamente
        costeAlmacenajePorJugador, // Añadido explícitamente
        gastosOperativosPorJugador,
        baiiPorJugador,
        gastosFinancierosPorJugador,
        baiPorJugador,
        impuestosPorJugador,
        resultadoNetoPorJugador
    );
    
    incrementarRonda(playersData);
    
    if (eventEmitter && typeof eventEmitter.emit === 'function') {
        console.log("Emitiendo evento 'resultadosProcesados' con los datos procesados.");
        eventEmitter.emit('resultadosProcesados', playersData, resultadosFinales);
    } else {
        console.error("Error: eventEmitter no está definido o no es válido.");
    }
    
    
    return resultados;
    }
    
    function mostrarResultadosPorPartidas(
        playersData,
        facturacionBrutaPorJugador,
        facturacionNetaPorJugador,
        devolucionesPorJugador,
        costeVentasPorJugador,
        margenBrutoPorJugador,
        gastosComercialesPorJugador,
        gastosPublicitariosPorJugador, // Añadido explícitamente
        costeAlmacenajePorJugador, // Añadido explícitamente
        gastosOperativosPorJugador,
        baiiPorJugador,
        gastosFinancierosPorJugador,
        baiPorJugador,
        impuestosPorJugador,
        resultadoNetoPorJugador
    ) {
    
        const partidas = {
            'Facturación Bruta': facturacionBrutaPorJugador,
            'Devoluciones': devolucionesPorJugador,
            'Facturación Neta': facturacionNetaPorJugador,
            'Coste Ventas': costeVentasPorJugador,
            'Margen Bruto': margenBrutoPorJugador,
            'G. Comerciales': gastosComercialesPorJugador, // Componente de operativos
            'G. Publicitarios': gastosPublicitariosPorJugador, // Componente de operativos
            'Coste de Almacenaje': costeAlmacenajePorJugador, // Componente de operativos
            'G. Operativos': gastosOperativosPorJugador, // Suma de los tres anteriores
            BAII: baiiPorJugador,
            'G. Financieros': gastosFinancierosPorJugador,
            BAI: baiPorJugador,
            Impuestos: impuestosPorJugador,
            'Resultado Neto': resultadoNetoPorJugador,
        };
        const resultadosTabla = Object.entries(partidas).map(([partida, datosJugadores]) => {
            const fila = { Partida: partida };
            Object.keys(playersData).forEach(jugador => {
                fila[jugador] = datosJugadores[jugador]?.toFixed(2) || '0.00';
            });
            return fila;
        });
    
        console.table(resultadosTabla);
    }
    


function incrementarRonda(playersData) {
    Object.keys(playersData).forEach(playerName => {
        const player = playersData[playerName];

        if (!player || !player.gameState) {
            console.warn(`El jugador ${playerName} no tiene un estado de juego válido.`);
            return;
        }

        

        // Actualizar préstamos (loans)
        if (Array.isArray(player.gameState.loans)) {
            console.log(`Loans antes de actualizar para ${playerName}:`, player.gameState.loans);
            player.gameState.loans = player.gameState.loans.map(loan => {
                if (loan.remainingRounds > 0) {
                    console.log(`Reduciendo remainingRounds de ${loan.remainingRounds} para el préstamo:`, loan);
                    loan.remainingRounds -= 1;
                } else {
                    console.warn(`El préstamo ya no tiene rondas restantes o no es válido:`, loan);
                }
                return loan;
            });
            console.log(`Loans después de actualizar para ${playerName}:`, player.gameState.loans);
        } else {
            console.warn(`No se encontraron préstamos válidos para ${playerName}.`);
        }

        // Actualizar proyectos (projects)
        if (Array.isArray(player.gameState.projects)) {
            console.log(`Projects antes de actualizar para ${playerName}:`, player.gameState.projects);
            player.gameState.projects = player.gameState.projects.map(project => {
                if (project.tiempoRestante > 0) {
                    project.tiempoRestante -= 1;
                }
                return project;
            });
            console.log(`Projects después de actualizar para ${playerName}:`, player.gameState.projects);
        } else {
            console.warn(`No se encontraron proyectos válidos para ${playerName}.`);
        }
    });
}



function calcularValorAccion(presupuestosAnteriores) {
    const n = presupuestosAnteriores.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = presupuestosAnteriores.reduce((acc, val) => acc + val, 0);
    const sumXY = presupuestosAnteriores.reduce((acc, val, idx) => acc + (idx * val), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    const intercept = (sumY - slope * sumX) / n;
    const projection = Array.from({ length: 5 }, (_, i) => slope * (n + i) + intercept);
    return projection.reduce((acc, val, i) => acc + val * Math.pow(1 + 0.17, -(i + 1)), 0);
}

if (eventEmitter && typeof eventEmitter.on === 'function') {
    eventEmitter.on('calculosRealizados', (playersData, marketData, resultadosFinales) => {
        
        generarResultados(playersData, marketData, resultadosFinales);
    });
} else {
    console.error("Error: eventEmitter no está definido o no es válido.");
}

module.exports =  generarResultados ;
