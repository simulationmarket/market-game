// utils/resultadosJugadores.js
const { eventEmitter } = require('./calculos'); // Importar eventEmitter
const { calcularCosteReal } = require('./calculos'); // Importar calcularCosteReal si es necesario

const costeCanales = {
  granDistribucion: 75000,
  minoristas: 115000,
  online: 150000,
  tiendaPropia: 300000
};

function generarResultados(playersData, marketData, resultadosFinales, meta = {}) {
  if (!Array.isArray(resultadosFinales)) {
    console.error("Error: resultadosFinales no es un array válido:", resultadosFinales);
    return [];
  }

  console.log(
    "Procesando resultados finales:",
    resultadosFinales.filter(data => parseFloat(data.unidadesNetas) > 0)
  );

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
  const costeAlmacenajePorJugador = {}; // ← ahora se rellena correctamente

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
    const unidadesCoste = Math.max(0, unidadesVendidas);
    const costeVentas = unidadesCoste * costeUnitarioReal;
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
    const productos = player?.gameState?.products || [];

    // Gastos comerciales por canal
    gastosComercialesPorJugador[playerName] = 0;
    Object.entries(canalesDistribucion).forEach(([canal, unidades]) => {
      const costeCanal = costeCanales[canal] || 0;
      const unidadesDistribuidas = parseFloat(unidades) || 0;
      gastosComercialesPorJugador[playerName] += costeCanal * unidadesDistribuidas;
    });

    // Gastos financieros
    gastosFinancierosPorJugador[playerName] = 0;
    player?.gameState?.loans?.forEach(loan => {
      const amortizacionCuota = loan.amount / loan.term;
      const interesCuota = amortizacionCuota * loan.interestRate;
      gastosFinancierosPorJugador[playerName] += amortizacionCuota + interesCuota;
    });

    // Gastos publicitarios (sumar por producto)
    gastosPublicitariosPorJugador[playerName] = 0;
    productos.forEach(producto => {
      if (!producto?.nombre) {
        console.warn(`Un producto del jugador ${playerName} no tiene un nombre definido.`);
        return;
      }
      const presupuestoPublicidad = parseFloat(producto.publicidad || 0);
      if (isNaN(presupuestoPublicidad)) {
        console.error(`El presupuesto publicitario del producto ${producto.nombre} no es válido para el jugador ${playerName}.`);
        return;
      }
      gastosPublicitariosPorJugador[playerName] += presupuestoPublicidad;
      console.log(`Jugador: ${playerName}, Producto: ${producto.nombre}, Presupuesto Publicitario: ${presupuestoPublicidad}`);
    });
    console.log(`Gastos Publicitarios Totales para el jugador ${playerName}: ${gastosPublicitariosPorJugador[playerName]}`);

    // Coste de almacenaje (por excedente total de cada producto)
    let costeAlmacenaje = 0;
    productos.forEach(producto => {
      const resultadosProducto = resultadosFinales.filter(res =>
        res.jugador === playerName &&
        res.producto?.trim()?.toLowerCase() === producto.nombre?.trim()?.toLowerCase()
      );

      if (resultadosProducto.length > 0) {
        const excedenteTotal = resultadosProducto.reduce((sum, res) => sum + parseFloat(res.excedente || 0), 0);
        const costeProducto = excedenteTotal * 20; // coste por unidad
        costeAlmacenaje += costeProducto;
        producto.stock = excedenteTotal;
        console.log(`Jugador: ${playerName}, Producto: ${producto.nombre}, Excedente Total: ${excedenteTotal}, Coste Almacenaje: ${costeProducto}, Stock Actualizado: ${producto.stock}`);
      } else {
        console.warn(`No se encontraron resultados para el producto ${producto.nombre} del jugador ${playerName}`);
      }
    });
    costeAlmacenajePorJugador[playerName] = costeAlmacenaje; // ← ¡ahora sí!

    // Operativos = publicitarios + comerciales + almacenaje
    gastosOperativosPorJugador[playerName] =
      (gastosPublicitariosPorJugador[playerName] || 0) +
      (gastosComercialesPorJugador[playerName] || 0) +
      costeAlmacenaje;

    // BAII, BAI, impuestos, resultado neto
    baiiPorJugador[playerName] =
      (margenBrutoPorJugador[playerName] || 0) - (gastosOperativosPorJugador[playerName] || 0);
    gastosFinancierosPorJugador[playerName] ||= 0;
    baiPorJugador[playerName] =
      baiiPorJugador[playerName] - gastosFinancierosPorJugador[playerName];
    impuestosPorJugador[playerName] =
      baiPorJugador[playerName] > 0 ? baiPorJugador[playerName] * 0.15 : 0;
    resultadoNetoPorJugador[playerName] =
      baiPorJugador[playerName] - impuestosPorJugador[playerName];

    // Presupuesto siguiente ronda
    player.gameState.budget += resultadoNetoPorJugador[playerName];

    // Asegura roundsHistory
    if (!player.gameState.roundsHistory) {
      player.gameState.roundsHistory = [];
    }

    // Valor de la acción (manteniendo tu fórmula)
    const presupuestosAnteriores = player.gameState.roundsHistory.slice(-5).map(r => r.resultadoNeto || 0);
    while (presupuestosAnteriores.length < 5) presupuestosAnteriores.unshift(0);
    const valorActualizado = calcularValorAccion(presupuestosAnteriores);
    player.gameState.valorAccion = valorActualizado / 10000000;

    // Restablecer preparación
    player.prepared = false;

    // Guarda snapshot de la ronda
    player.gameState.roundsHistory.push({
      round: player.gameState.round,
      facturacionBruta: facturacionBrutaPorJugador[playerName] || 0,
      facturacionNeta: facturacionNetaPorJugador[playerName] || 0,
      devoluciones: devolucionesPorJugador[playerName] || 0,
      costeVentas: costeVentasPorJugador[playerName] || 0,
      margenBruto: margenBrutoPorJugador[playerName] || 0,
      gastosComerciales: gastosComercialesPorJugador[playerName] || 0,
      gastosOperativos: gastosOperativosPorJugador[playerName] || 0,
      costeAlmacenaje: costeAlmacenaje, // campo ya presente
      baii: baiiPorJugador[playerName] || 0,
      gastosFinancieros: gastosFinancierosPorJugador[playerName] || 0,
      bai: baiPorJugador[playerName] || 0,
      impuestos: impuestosPorJugador[playerName] || 0,
      resultadoNeto: resultadoNetoPorJugador[playerName] || 0,
      valorAccion: player.gameState.valorAccion,
      decisiones: {
        products: (player.gameState.roundDecisions?.products || []).map(product => ({
          caracteristicas: product.caracteristicas ? { ...product.caracteristicas } : {},
          precio: parseFloat(product.precio || 0),
          posicionamientoCalidad: parseFloat(product.posicionamientoCalidad || 0),
          posicionamientoPrecio: parseFloat(product.posicionamientoPrecio || 0),
          presupuestoPublicidad: parseFloat(product.presupuestoPublicidad || 0),
          stock: parseFloat(product.stock || 0),
          unidadesFabricar: parseFloat(product.unidadesFabricar || 0),
        })),
        canalesDistribucion: {
          ...player.gameState.roundDecisions?.canalesDistribucion,
        },
      },
    });
  });

  // Emitir resultados completos (genérico + namespaced si hay partidaId)
  eventEmitter.emit('resultadosCompletosGenerados', resultados);
  if (meta?.partidaId) {
    eventEmitter.emit(`resultadosCompletosGenerados:${meta.partidaId}`, resultados);
  }

  mostrarResultadosPorPartidas(
    playersData,
    facturacionBrutaPorJugador,
    facturacionNetaPorJugador,
    devolucionesPorJugador,
    costeVentasPorJugador,
    margenBrutoPorJugador,
    gastosComercialesPorJugador,
    gastosPublicitariosPorJugador,
    costeAlmacenajePorJugador,
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
    eventEmitter.emit('resultadosProcesados', playersData, resultadosFinales, meta);
    if (meta?.partidaId) {
      eventEmitter.emit(`resultadosProcesados:${meta.partidaId}`, playersData, resultadosFinales, meta);
    }
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
  gastosPublicitariosPorJugador,
  costeAlmacenajePorJugador,
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
    'G. Comerciales': gastosComercialesPorJugador,
    'G. Publicitarios': gastosPublicitariosPorJugador,
    'Coste de Almacenaje': costeAlmacenajePorJugador, // ← ahora muestra valores reales
    'G. Operativos': gastosOperativosPorJugador,
    BAII: baiiPorJugador,
    'G. Financieros': gastosFinancierosPorJugador,
    BAI: baiPorJugador,
    Impuestos: impuestosPorJugador,
    'Resultado Neto': resultadoNetoPorJugador,
  };
  const resultadosTabla = Object.entries(partidas).map(([partida, datosJugadores]) => {
    const fila = { Partida: partida };
    Object.keys(playersData).forEach(jugador => {
      const val = datosJugadores[jugador];
      fila[jugador] = (typeof val === 'number') ? val.toFixed(2) : '0.00';
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
        if (project.tiempoRestante > 0) project.tiempoRestante -= 1;
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

// Listener retrocompatible: procesa en el genérico (se emite ANTES que el namespaced)
if (eventEmitter && typeof eventEmitter.on === 'function') {
  eventEmitter.on('calculosRealizados', (playersData, marketData, resultadosFinales, meta) => {
    generarResultados(playersData, marketData, resultadosFinales, meta);
  });
} else {
  console.error("Error: eventEmitter no está definido o no es válido.");
}

module.exports = generarResultados;
