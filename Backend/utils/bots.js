// backend/Utils/Bots.js

function tomarDecisionesBot(nombreBot, dificultad, gameState, marketData, resultadosCache) {
  const esPrimeraRonda = gameState.round === 0;

  if (esPrimeraRonda) {
    return tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData);
  }

  return tomarDecisionesRondasPosteriores(
    nombreBot,
    dificultad,
    gameState,
    marketData,
    resultadosCache
  );
}

function tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData) {
  const decisiones = {
    products: [],
    canalesDistribucion: {}
  };

  const productos = gameState.products || [];
  const presupuestoWrapper = { valor: gameState.budget || 0 };

  productos.forEach((producto, index) => {
    const segmentoObjetivo = asignarSegmentoPorProducto(producto, marketData);
    producto.segmentoObjetivo = segmentoObjetivo;
    console.log(`🧠 Bot ${nombreBot} - Producto ${index} se dirige al segmento: ${segmentoObjetivo}`);

    const precioOptimo = calcularPrecioOptimo(marketData.segmentos[segmentoObjetivo]);
    const precioFinal = ajustarPrecioPorDificultad(precioOptimo, dificultad);
    const publicidad = decidirPublicidadPrimeraRonda(presupuestoWrapper);
    const calidad = decidirCalidadPorSegmento(segmentoObjetivo, marketData, dificultad);
    const posicionamientoPrecio = decidirPosicionamientoPrecioPrimeraRonda(segmentoObjetivo, marketData);
    const unidadesFabricar = decidirProduccionPrimeraRonda(producto, presupuestoWrapper, segmentoObjetivo, marketData, dificultad);

    decisiones.products.push({
      caracteristicas: producto.caracteristicas,
      precio: precioFinal,
      calidad,
      posicionamientoPrecio,
      publicidad,
      unidadesFabricar,
      costeUnitarioEst: producto.costeUnitarioEst || 1000
    });
  });

  decisiones.canalesDistribucion = decidirCanalesDistribucionPrimeraRonda(presupuestoWrapper);

  // Actualizar presupuesto restante en gameState
  gameState.budget = presupuestoWrapper.valor;

  return decisiones;
}

// ======================== 🔁 RONDAS POSTERIORES ==========================
function tomarDecisionesRondasPosteriores(
  nombreBot, dificultad, gameState, marketData, resultadosCache
) {
  const decisiones = { products: [], canalesDistribucion: {} };
  const productos = gameState.products || [];
  const presupuestoWrapper = { valor: gameState.budget || 0 };
  const rondaActual = gameState.round;
  const preciosPercibidos = gameState.preciosPercibidos || {};
  const resultadosAnteriores = gameState.roundsHistory || [];

  productos.forEach(producto => {
    const segmentoObjetivo = reelegirSegmentoObjetivo(producto, marketData.segmentos);
    producto.segmentoObjetivo = segmentoObjetivo;

    const demandaEstimada = estimarDemandaEsperada(
      producto,
      segmentoObjetivo,
      resultadosCache,
      nombreBot,
      rondaActual,
      marketData
    );

    const stockPrevio = producto.stock || 0;
    const calidad = decidirCalidadPorSegmento(segmentoObjetivo, marketData, dificultad);

    const precio = decidirPrecio(
      producto,
      marketData.segmentos[segmentoObjetivo],
      resultadosAnteriores,
      dificultad,
      preciosPercibidos
    );

    const posicionamientoPrecio = decidirPosicionamientoPrecio(
      marketData.segmentos[segmentoObjetivo],
      marketData
    );

    const publicidad = decidirPublicidad(
      producto,
      resultadosAnteriores,
      presupuestoWrapper
    );

    const unidadesFabricar = decidirUnidadesAFabricar(
      producto,
      demandaEstimada,
      stockPrevio,
      dificultad,
      presupuestoWrapper
    );

    decisiones.products.push({
      caracteristicas: producto.caracteristicas,
      precio,
      calidad,
      posicionamientoPrecio,
      publicidad,
      unidadesFabricar,
      costeUnitarioEst: producto.costeUnitarioEst || 1000
    });
  });

  decisiones.canalesDistribucion = decidirCanalesDistribucion(
    productos,
    presupuestoWrapper,
    resultadosCache,
    marketData,
    dificultad,
    nombreBot
  );

  // Guardar presupuesto restante
  gameState.budget = presupuestoWrapper.valor;

  return decisiones;
}

// ======================== 🔩 FUNCIONES A IMPLEMENTAR ==========================

// 🧠 Paso 1: Reevaluar segmento objetivo según atributos del producto
function reelegirSegmentoObjetivo(producto, segmentosIdeales) {
  let mejorSegmento = null;
  let menorDiferencia = Infinity;

  for (const nombreSegmento in segmentosIdeales) {
    const productoIdeal = segmentosIdeales[nombreSegmento].productoIdeal;
    let diferenciaTotal = 0;

    for (const caracteristica in productoIdeal) {
      if (caracteristica === "promedio") continue;
      const valorProducto = producto.caracteristicas?.[caracteristica] || 0;
      const valorIdeal = productoIdeal[caracteristica];
      diferenciaTotal += Math.abs(valorProducto - valorIdeal);
    }

    if (diferenciaTotal < menorDiferencia) {
      menorDiferencia = diferenciaTotal;
      mejorSegmento = nombreSegmento;
    }
  }

  return mejorSegmento;
}

function estimarDemandaEsperada(producto, segmento, resultadosCache, nombreBot, rondaActual, marketData) {
  if (rondaActual === 0) return 0;

  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];

  const demandaTotalSegmento = resultados
    .filter(r => r.segmento === segmento)
    .reduce((acc, r) => acc + Number(r.demanda || 0), 0);

  const ventasBot = resultados
    .filter(r =>
      r.jugador  === nombreBot &&
      r.producto === producto.nombre
    )
    .reduce((sum, r) => sum + Number(r.unidadesVendidas || 0), 0);

  const cuotaBot = demandaTotalSegmento > 0
    ? ventasBot / demandaTotalSegmento
    : 0;

  const segmentoData = marketData.segmentos[segmento];
  const porcentajeDemanda = segmentoData[`demandaAno${rondaActual + 1}`] ?? segmentoData.demandaAno1;
  const demandaTeorica = segmentoData.usuariosPotenciales * (porcentajeDemanda / 100);

  const demandaEstimBot = demandaTeorica * cuotaBot;

  // Logs de depuración (puedes silenciarlos en prod)
  console.log(`📊 [Estimación Demanda] Producto: ${producto.nombre}`);
  console.log(`   Segmento: ${segmento}`);
  console.log(`   Ronda actual: ${rondaActual}`);
  console.log(`   Demanda total del segmento en ronda ${rondaActual - 1}: ${demandaTotalSegmento}`);
  console.log(`   Ventas del bot en ese segmento: ${ventasBot}`);
  console.log(`   Cuota del bot: ${cuotaBot.toFixed(4)}`);
  console.log(`   Usuarios potenciales: ${segmentoData.usuariosPotenciales}`);
  console.log(`   Porcentaje demanda año ${rondaActual + 1}: ${porcentajeDemanda}`);
  console.log(`   Demanda teórica: ${demandaTeorica}`);
  console.log(`   → Demanda estimada para el bot: ${demandaEstimBot}`);

  return Math.round(demandaEstimBot);
}

function decidirUnidadesAFabricar(producto, demandaEstimada, stockPrevio, dificultad, presupuestoWrapper) {
  const costeUnitario = producto.costeUnitarioEst || 1000;
  const deficit = Math.max(0, demandaEstimada - stockPrevio);

  // Margen según dificultad
  let margen = 0;
  if (dificultad === 'facil') margen = 0.20;
  if (dificultad === 'normal') margen = 0.10;
  if (dificultad === 'dificil') margen = 0.02;

  const unidadesDeseadas = Math.ceil(deficit * (1 + margen));
  const unidadesPosibles = Math.floor(presupuestoWrapper.valor / costeUnitario);

  const unidadesFabricar = Math.min(unidadesDeseadas, unidadesPosibles);
  const costeTotal = unidadesFabricar * costeUnitario;

  presupuestoWrapper.valor -= costeTotal;

  return unidadesFabricar;
}

function decidirPrecio(producto, segmento, resultadosAnteriores, dificultad) {
  const funcionSensibilidad = segmento.funcionSensibilidad;
  if (typeof funcionSensibilidad !== 'function') return 1000;

  // Calcular interés del producto según sus características vs. el segmento
  const interesProducto = calcularInteresProductoParaSegmento(producto, segmento);

  // Precio ideal según el segmento
  const precioIdeal = calcularPrecioOptimo(segmento);

  // Buscar el mejor precio entre ±20%
  const pasos = 20;
  const minPrecio = precioIdeal * 0.8;
  const maxPrecio = precioIdeal * 1.2;
  let mejorPrecio = precioIdeal;
  let mejorInteres = -Infinity;

  for (let i = 0; i <= pasos; i++) {
    const precio = minPrecio + i * ((maxPrecio - minPrecio) / pasos);

    const interesPrecio = calcularInteresPrecio(
      { precioAjustado: precio },
      funcionSensibilidad,
      interesProducto
    );

    const interesTotal = interesProducto + interesPrecio;

    if (interesTotal > mejorInteres) {
      mejorInteres = interesTotal;
      mejorPrecio = precio;
    }
  }

  // Error según dificultad
  let error = 0;
  if (dificultad === 'facil')   error = (Math.random() * 0.20) - 0.10;
  if (dificultad === 'normal')  error = (Math.random() * 0.10) - 0.05;
  if (dificultad === 'dificil') error = (Math.random() * 0.04) - 0.02;

  const precioFinal = mejorPrecio * (1 + error);

  return Math.round(Math.max(100, precioFinal));
}

// Calidad decidida en base al promedio ideal del segmento, con error según dificultad
function decidirCalidadPorSegmento(segmentoObjetivo, marketData, dificultad) {
  const promedioIdeal = marketData.segmentos[segmentoObjetivo].productoIdeal.promedio || 5;

  let error = 0;
  if (dificultad === 'facil')   error = (Math.random() * 0.15) - 0.075;  // ±7.5%
  if (dificultad === 'normal')  error = (Math.random() * 0.10) - 0.05;   // ±5%
  if (dificultad === 'dificil') error = (Math.random() * 0.05) - 0.025;  // ±2.5%

  const calidad = Math.round(promedioIdeal * (1 + error));
  return Math.max(1, Math.min(20, calidad));
}

// Posicionamiento basado en el precio óptimo del segmento
function decidirPosicionamientoPrecio(segmento, marketData) {
  const precioOptimo = calcularPrecioOptimo(segmento);
  const posicionamiento = Math.round(precioOptimo / 50);  // 1000 → 20 aprox.
  return Math.max(1, Math.min(20, posicionamiento));
}

function decidirPublicidad(producto, resultadosAnteriores, presupuestoWrapper) {
  const nombre = producto.nombre;
  let ventasAnteriores = 0;
  let gastoAnterior = 0;

  // Buscar el resultado del producto en la última ronda
  const ultimaRonda = resultadosAnteriores[resultadosAnteriores.length - 1];
  if (ultimaRonda && ultimaRonda.productos) {
    const resultado = ultimaRonda.productos.find(p => p.producto === nombre);
    if (resultado) {
      ventasAnteriores = resultado.unidadesVendidas || 0;
      gastoAnterior = resultado.publicidad || 0;
    }
  }

  let gastoPublicidad = 100000;

  // Ajuste según histórico
  if (ventasAnteriores === 0) {
    gastoPublicidad = Math.min(50000, presupuestoWrapper.valor * 0.05);
  } else if (ventasAnteriores > 0 && gastoAnterior > 0) {
    gastoPublicidad = Math.min(150000, gastoAnterior * 1.2);
  }

  gastoPublicidad = Math.min(gastoPublicidad, presupuestoWrapper.valor);
  presupuestoWrapper.valor -= gastoPublicidad;

  return gastoPublicidad;
}

function decidirCanalesDistribucion(
  productos,
  presupuestoWrapper,
  resultadosCache,
  marketData,
  dificultad,
  nombreBot
) {
  const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];

  // 1) % de marketing
  const minPct = 0.10;
  const maxPct = 0.15;
  const marketingPct = minPct + Math.random() * (maxPct - minPct);
  const presupuestoCanales = Math.min(Math.round(presupuestoWrapper.valor * marketingPct), presupuestoWrapper.valor);

  // 2) Demanda del BOT por canal
  const dem = canales.reduce((o, c) => (o[c] = 0, o), {});
  (Array.isArray(resultadosCache) ? resultadosCache : [])
    .filter(r => r.jugador === nombreBot)
    .forEach(r => {
      if (dem[r.canal] !== undefined) {
        dem[r.canal] += Number(r.unidadesVendidas || 0);
      }
    });
  const sumDem = canales.reduce((s, c) => s + dem[c], 0) || 1;

  // 3) Prioridad por canal desde los segmentos objetivo
  const pri = canales.reduce((o, c) => (o[c] = 0, o), {});
  productos.forEach(p => {
    const prio = marketData.segmentos[p.segmentoObjetivo]?.prioridadCanales || {};
    canales.forEach(c => pri[c] += prio[c] || 0);
  });
  const sumPri = canales.reduce((s, c) => s + pri[c], 0) || 1;

  // 4) Score combinado
  const pesoDem = 0.7, pesoPri = 0.3;
  const score = {};
  canales.forEach(c => {
    const normDem = dem[c] / sumDem;
    const normPri = pri[c] / sumPri;
    score[c] = normDem * pesoDem + normPri * pesoPri;
  });

  // 5) Normalizar score
  const sumScore = canales.reduce((s, c) => s + score[c], 0) || 1;
  canales.forEach(c => score[c] /= sumScore);

  // 6) Reparto inicial (en “unidades de presencia”)
  const costePorUnidad = {
    granDistribucion: 75000,
    minoristas: 115000,
    online: 150000,
    tiendaPropia: 300000
  };

  const unidadesPorCanal = {};
  canales.forEach(c => {
    const gasto = Math.round(score[c] * presupuestoCanales);
    unidadesPorCanal[c] = Math.floor(gasto / costePorUnidad[c]);
  });

  // 7) Ajuste final
  let gastoTotal = canales.reduce((s, c) => s + unidadesPorCanal[c] * costePorUnidad[c], 0);
  let diff = presupuestoCanales - gastoTotal;

  while (true) {
    let asignado = false;
    for (const canal of canales) {
      const coste = costePorUnidad[canal];
      if (diff >= coste) {
        unidadesPorCanal[canal]++;
        diff -= coste;
        asignado = true;
      }
    }
    if (!asignado) break;
  }

  // Restar del presupuesto global usado
  const gastoFinal = canales.reduce((sum, c) => sum + unidadesPorCanal[c] * costePorUnidad[c], 0);
  presupuestoWrapper.valor -= gastoFinal;

  return unidadesPorCanal;
}

// ======================== FUNCIONES PRIMERA RONDA ==========================
function decidirProduccionPrimeraRonda(producto, presupuestoWrapper, segmentoObjetivo, marketData, dificultad) {
  const segmento = marketData.segmentos[segmentoObjetivo];
  const demanda = segmento.usuariosPotenciales * (segmento.demandaAno1 / 100);
  const cuotaEsperada = demanda / 3;

  let error = 0;
  if (dificultad === 'facil') error = (Math.random() * 0.15) - 0.5;
  if (dificultad === 'normal') error = (Math.random() * 0.10) - 0.5;
  if (dificultad === 'dificil') error = (Math.random() * 0.05) - 0.05;

  let unidadesObjetivo = Math.floor(cuotaEsperada * (1 + error));
  const costeUnitario = producto.costeUnitarioEst || 1000;
  const maxUnidades = Math.floor(presupuestoWrapper.valor / costeUnitario);

  const unidadesFabricar = Math.min(unidadesObjetivo, maxUnidades);
  const costeTotal = unidadesFabricar * costeUnitario;

  presupuestoWrapper.valor -= costeTotal;

  return unidadesFabricar;
}

function decidirCalidadPorSegmentoPrimeraRonda(segmentoObjetivo, marketData, dificultad) {
  const promedioIdeal = marketData.segmentos[segmentoObjetivo].productoIdeal.promedio || 5;

  let error = 0;
  if (dificultad === 'facil') error = (Math.random() * 0.15 * 2) - 0.15;
  if (dificultad === 'normal') error = (Math.random() * 0.10 * 2) - 0.10;
  if (dificultad === 'dificil') error = (Math.random() * 0.05 * 2) - 0.05;

  const calidad = Math.round(promedioIdeal * (1 + error));
  return Math.max(1, Math.min(20, calidad));
}

function decidirPosicionamientoPrecioPrimeraRonda(segmentoObjetivo, marketData) {
  const precioOptimo = calcularPrecioOptimo(marketData.segmentos[segmentoObjetivo]);
  const posicionamiento = Math.round(precioOptimo / 50);
  return Math.max(1, Math.min(20, posicionamiento));
}

function decidirPublicidadPrimeraRonda(presupuestoWrapper) {
  const gastoPublicidad = Math.min(100000, presupuestoWrapper.valor);
  presupuestoWrapper.valor -= gastoPublicidad;
  return gastoPublicidad;
}

function decidirCanalesDistribucionPrimeraRonda(presupuestoWrapper) {
  const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];
  const costeUnidad = {
    granDistribucion: 75000,
    minoristas: 115000,
    online: 150000,
    tiendaPropia: 300000
  };

  const unidades = {};
  // Estrategia sencilla: distribuir igual entre canales hasta agotar
  canales.forEach(canal => {
    const coste = costeUnidad[canal];
    const unidadesPosibles = Math.floor(presupuestoWrapper.valor / coste);
    const unidadesAsignadas = Math.min(unidadesPosibles, 10); // máx. 10 por canal por ahora
    unidades[canal] = unidadesAsignadas;
    presupuestoWrapper.valor -= unidadesAsignadas * coste;
  });

  return unidades;
}

// ======================== AUXILIARES ==========================
function calcularInteresProductoParaSegmento(producto, segmento) {
  let interesTotal = 0;
  let numCaracteristicas = 0;

  for (const [caracteristica, valorIdeal] of Object.entries(segmento.productoIdeal || {})) {
    const valorAjustado = parseFloat(producto.caracteristicasAjustadas?.[caracteristica]) || 0;

    if (valorIdeal > 0) {
      const excesoRelativo = valorAjustado / valorIdeal;
      const umbral = 1.13;
      const exp = 3.5;
      const maxPremio = 10 * umbral;

      let interes = 0;
      if (excesoRelativo < 1) {
        interes = 10 * Math.pow(excesoRelativo, exp);
      } else if (excesoRelativo <= umbral) {
        interes = 10 * excesoRelativo;
      } else {
        const desajuste = (excesoRelativo - umbral) / umbral;
        const factor = Math.max(0, 1 - desajuste);
        interes = maxPremio * Math.pow(factor, exp);
      }

      interes = Math.max(0, parseFloat(interes.toFixed(2)));
      interesTotal += interes;
      numCaracteristicas++;
    }
  }

  return numCaracteristicas > 0
    ? parseFloat((interesTotal / numCaracteristicas).toFixed(2))
    : 0;
}

function calcularInteresPrecio(producto, funcionSensibilidad, interesProducto) {
  const pa = producto.precioAjustado;
  if (typeof pa !== "number" || isNaN(pa) || pa < 0) return 0;
  if (typeof funcionSensibilidad !== "function") return 0;
  if (typeof interesProducto !== "number" || isNaN(interesProducto) || interesProducto <= 0) return 0;

  const maxAjusteEuros = 30;
  const maxAjustePorcentaje = 0.10;

  let factor = 10 / interesProducto;
  factor = Math.max(1 - maxAjustePorcentaje, Math.min(factor, 1 + maxAjustePorcentaje));

  const precioAjustado = pa * factor;
  const diferencia = precioAjustado - pa;
  const diferenciaLimitada = Math.max(-maxAjusteEuros, Math.min(diferencia, maxAjusteEuros));

  const precioPercibido = pa + diferenciaLimitada;
  producto.precioPercibido = precioPercibido;

  const demanda = funcionSensibilidad(precioPercibido);
  const interes = Math.max(0, Math.min(10, demanda / 10));

  producto.interesPrecio = interes;

  return interes;
}

function asignarSegmentoPorProducto(producto, marketData) {
  const segmentos = marketData.segmentos;
  let mejorSegmento = null;
  let menorDiferencia = Infinity;

  for (const nombreSegmento in segmentos) {
    const productoIdeal = segmentos[nombreSegmento].productoIdeal;
    let diferenciaTotal = 0;

    for (const caracteristica in productoIdeal) {
      if (caracteristica === "promedio") continue;
      const valorProducto = producto.caracteristicas?.[caracteristica] || 0;
      const valorIdeal = productoIdeal[caracteristica];
      diferenciaTotal += Math.abs(valorProducto - valorIdeal);
    }

    if (diferenciaTotal < menorDiferencia) {
      menorDiferencia = diferenciaTotal;
      mejorSegmento = nombreSegmento;
    }
  }

  return mejorSegmento;
}

function calcularPrecioOptimo(segmento) {
  const fn = segmento.funcionSensibilidad;
  let maxVentas = -Infinity;
  let mejorPrecio = 0;

  for (let precio = 100; precio <= 2000; precio += 10) {
    const ventas = fn(precio);
    if (ventas > maxVentas) {
      maxVentas = ventas;
      mejorPrecio = precio;
    }
  }

  return mejorPrecio;
}

function ajustarPrecioPorDificultad(precioOptimo, dificultad) {
  let error = 0;
  if (dificultad === 'facil') error = (Math.random() * 0.2) - 0.10;
  if (dificultad === 'normal') error = (Math.random() * 0.1) - 0.05;
  if (dificultad === 'dificil') error = (Math.random() * 0.04) - 0.02;
  return Math.max(50, Math.round(precioOptimo + (precioOptimo * error)));
}

module.exports = {
  tomarDecisionesBot
};
