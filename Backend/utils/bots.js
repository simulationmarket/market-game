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

/* ======================== PRIMERA RONDA ======================== */
function tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData) {
  const decisiones = { products: [], canalesDistribucion: {} };
  const productos = gameState.products || [];
  const presupuestoWrapper = { valor: gameState.budget || 0 };

  productos.forEach((producto, index) => {
    const segmentoObjetivo = asignarSegmentoPorProducto(producto, marketData);
    producto.segmentoObjetivo = segmentoObjetivo;
    console.log(`🧠 Bot ${nombreBot} - Producto ${index} → segmento ${segmentoObjetivo}`);

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

  // Guardar presupuesto restante
  gameState.budget = presupuestoWrapper.valor;
  return decisiones;
}

/* ======================== RONDAS POSTERIORES ======================== */
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

    const publicidad = decidirPublicidad(producto, resultadosAnteriores, presupuestoWrapper);

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

  gameState.budget = presupuestoWrapper.valor;
  return decisiones;
}

/* ======================== LÓGICA DE APOYO ======================== */

// Reevaluar segmento según distancia al ideal
function reelegirSegmentoObjetivo(producto, segmentosIdeales) {
  let mejorSegmento = null, menorDiferencia = Infinity;
  for (const nombreSegmento in segmentosIdeales) {
    const ideal = segmentosIdeales[nombreSegmento].productoIdeal;
    let diff = 0;
    for (const k in ideal) {
      if (k === 'promedio') continue;
      const vProd = producto.caracteristicas?.[k] || 0;
      diff += Math.abs(vProd - ideal[k]);
    }
    if (diff < menorDiferencia) { menorDiferencia = diff; mejorSegmento = nombreSegmento; }
  }
  return mejorSegmento;
}

// Demanda esperada para el producto del bot
function estimarDemandaEsperada(producto, segmento, resultadosCache, nombreBot, rondaActual, marketData) {
  if (rondaActual === 0) return 0;

  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];

  const demandaTotalSegmento = resultados
    .filter(r => r.segmento === segmento)
    .reduce((acc, r) => acc + Number(r.demanda || 0), 0);

  const ventasBot = resultados
    .filter(r => r.jugador === nombreBot && r.producto === producto.nombre)
    .reduce((sum, r) => sum + Number(r.unidadesVendidas || 0), 0);

  const cuotaBot = demandaTotalSegmento > 0 ? ventasBot / demandaTotalSegmento : 0;

  const segData = marketData.segmentos[segmento];
  const pct = segData[`demandaAno${rondaActual + 1}`] ?? segData.demandaAno1;
  const demandaTeorica = segData.usuariosPotenciales * (pct / 100);

  const demandaEstim = demandaTeorica * cuotaBot;
  return Math.round(demandaEstim);
}

function decidirUnidadesAFabricar(producto, demandaEstimada, stockPrevio, dificultad, presupuestoWrapper) {
  const costeUnitario = producto.costeUnitarioEst || 1000;
  const deficit = Math.max(0, demandaEstimada - stockPrevio);

  // Colchón según dificultad
  let margen = 0;
  if (dificultad === 'facil') margen = 0.20;
  if (dificultad === 'normal') margen = 0.10;
  if (dificultad === 'dificil') margen = 0.02;

  const unidadesDeseadas = Math.ceil(deficit * (1 + margen));
  const unidadesPosibles = Math.floor(presupuestoWrapper.valor / costeUnitario);

  const unidadesFabricar = Math.min(unidadesDeseadas, unidadesPosibles);
  presupuestoWrapper.valor -= unidadesFabricar * costeUnitario;
  return unidadesFabricar;
}

function decidirPrecio(producto, segmento, resultadosAnteriores, dificultad) {
  const fn = segmento.funcionSensibilidad;
  if (typeof fn !== 'function') return 1000;

  const interesProducto = calcularInteresProductoParaSegmento(producto, segmento);
  const precioIdeal = calcularPrecioOptimo(segmento);

  const pasos = 20, minP = precioIdeal * 0.8, maxP = precioIdeal * 1.2;
  let bestP = precioIdeal, bestScore = -Infinity;

  for (let i = 0; i <= pasos; i++) {
    const p = minP + i * ((maxP - minP) / pasos);
    const interesPrecio = calcularInteresPrecio({ precioAjustado: p }, fn, interesProducto);
    const score = interesProducto + interesPrecio;
    if (score > bestScore) { bestScore = score; bestP = p; }
  }

  let error = 0;
  if (dificultad === 'facil')   error = (Math.random() * 0.20) - 0.10;
  if (dificultad === 'normal')  error = (Math.random() * 0.10) - 0.05;
  if (dificultad === 'dificil') error = (Math.random() * 0.04) - 0.02;

  return Math.round(Math.max(100, bestP * (1 + error)));
}

// Calidad (una sola versión, sin overrides)
function decidirCalidadPorSegmento(segmentoObjetivo, marketData, dificultad) {
  const promedioIdeal = marketData.segmentos[segmentoObjetivo].productoIdeal.promedio || 5;
  let error = 0;
  if (dificultad === 'facil')   error = (Math.random() * 0.15) - 0.075; // ±7.5%
  if (dificultad === 'normal')  error = (Math.random() * 0.10) - 0.05;  // ±5%
  if (dificultad === 'dificil') error = (Math.random() * 0.05) - 0.025; // ±2.5%
  const calidad = Math.round(promedioIdeal * (1 + error));
  return Math.max(1, Math.min(20, calidad));
}

// Posicionamiento por precio óptimo
function decidirPosicionamientoPrecio(segmento, marketData) {
  const precioOptimo = calcularPrecioOptimo(segmento);
  const pos = Math.round(precioOptimo / 50);
  return Math.max(1, Math.min(20, pos));
}

function decidirPublicidad(producto, resultadosAnteriores, presupuestoWrapper) {
  const nombre = producto.nombre;
  let ventasPrev = 0, gastoPrev = 0;

  const ultima = resultadosAnteriores[resultadosAnteriores.length - 1];
  if (ultima?.productos) {
    const r = ultima.productos.find(p => p.producto === nombre);
    if (r) { ventasPrev = r.unidadesVendidas || 0; gastoPrev = r.publicidad || 0; }
  }

  let gasto = 100000;
  if (ventasPrev === 0) gasto = Math.min(50000, presupuestoWrapper.valor * 0.05);
  else if (ventasPrev > 0 && gastoPrev > 0) gasto = Math.min(150000, gastoPrev * 1.2);

  gasto = Math.min(gasto, presupuestoWrapper.valor);
  presupuestoWrapper.valor -= gasto;
  return gasto;
}

function decidirCanalesDistribucion(
  productos, presupuestoWrapper, resultadosCache, marketData, dificultad, nombreBot
) {
  const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];

  // % de marketing
  const marketingPct = 0.10 + Math.random() * 0.05; // 10–15%
  const presupuestoCanales = Math.min(Math.round(presupuestoWrapper.valor * marketingPct), presupuestoWrapper.valor);

  // Demanda del BOT por canal (robusto a cache vacío)
  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];
  const dem = canales.reduce((o, c) => (o[c] = 0, o), {});
  resultados
    .filter(r => r.jugador === nombreBot)
    .forEach(r => { if (dem[r.canal] != null) dem[r.canal] += Number(r.unidadesVendidas || 0); });
  const sumDem = canales.reduce((s, c) => s + dem[c], 0) || 1;

  // Prioridad por canales según segmentos objetivo
  const pri = canales.reduce((o, c) => (o[c] = 0, o), {});
  productos.forEach(p => {
    const prio = marketData.segmentos[p.segmentoObjetivo]?.prioridadCanales || {};
    canales.forEach(c => pri[c] += prio[c] || 0);
  });
  const sumPri = canales.reduce((s, c) => s + pri[c], 0) || 1;

  // Score combinado
  const pesoDem = 0.7, pesoPri = 0.3;
  const score = {};
  canales.forEach(c => {
    const normDem = dem[c] / sumDem;
    const normPri = pri[c] / sumPri;
    score[c] = normDem * pesoDem + normPri * pesoPri;
  });

  // Normalizar
  const sumScore = canales.reduce((s, c) => s + score[c], 0) || 1;
  canales.forEach(c => score[c] /= sumScore);

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

  // Ajuste a presupuesto
  let gastoTotal = canales.reduce((s, c) => s + unidadesPorCanal[c] * costePorUnidad[c], 0);
  let diff = presupuestoCanales - gastoTotal;
  while (true) {
    let asignado = false;
    for (const canal of canales) {
      const coste = costePorUnidad[canal];
      if (diff >= coste) { unidadesPorCanal[canal]++; diff -= coste; asignado = true; }
    }
    if (!asignado) break;
  }

  presupuestoWrapper.valor -= canales.reduce((sum, c) => sum + unidadesPorCanal[c] * costePorUnidad[c], 0);
  return unidadesPorCanal;
}

/* ======================== PRIMERA RONDA (extras) ======================== */

function decidirProduccionPrimeraRonda(producto, presupuestoWrapper, segmentoObjetivo, marketData, dificultad) {
  const segmento = marketData.segmentos[segmentoObjetivo];
  const demanda = segmento.usuariosPotenciales * (segmento.demandaAno1 / 100);
  const cuotaEsperada = demanda / 3;

  // ¡Corregido! error simétrico
  let error = 0;
  if (dificultad === 'facil')   error = (Math.random() * 0.30) - 0.15; // ±15%
  if (dificultad === 'normal')  error = (Math.random() * 0.20) - 0.10; // ±10%
  if (dificultad === 'dificil') error = (Math.random() * 0.10) - 0.05; // ±5%

  const unidadesObjetivo = Math.max(0, Math.floor(cuotaEsperada * (1 + error)));
  const costeUnitario = producto.costeUnitarioEst || 1000;
  const maxUnidades = Math.floor(presupuestoWrapper.valor / costeUnitario);

  const unidadesFabricar = Math.min(unidadesObjetivo, maxUnidades);
  presupuestoWrapper.valor -= unidadesFabricar * costeUnitario;

  return unidadesFabricar;
}

function decidirPosicionamientoPrecioPrimeraRonda(segmentoObjetivo, marketData) {
  const precioOptimo = calcularPrecioOptimo(marketData.segmentos[segmentoObjetivo]);
  const pos = Math.round(precioOptimo / 50);
  return Math.max(1, Math.min(20, pos));
}

function decidirPublicidadPrimeraRonda(presupuestoWrapper) {
  const gasto = Math.min(100000, presupuestoWrapper.valor);
  presupuestoWrapper.valor -= gasto;
  return gasto;
}

function decidirCanalesDistribucionPrimeraRonda(presupuestoWrapper) {
  const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];
  const costeUnidad = { granDistribucion: 75000, minoristas: 115000, online: 150000, tiendaPropia: 300000 };
  const unidades = {};
  canales.forEach(canal => {
    const coste = costeUnidad[canal];
    const unidadesPosibles = Math.floor(presupuestoWrapper.valor / coste);
    const unidadesAsignadas = Math.min(unidadesPosibles, 10);
    unidades[canal] = unidadesAsignadas;
    presupuestoWrapper.valor -= unidadesAsignadas * coste;
  });
  return unidades;
}

/* ======================== AUXILIARES ======================== */

function calcularInteresProductoParaSegmento(producto, segmento) {
  let interesTotal = 0, num = 0;
  for (const [car, ideal] of Object.entries(segmento.productoIdeal || {})) {
    const valAdj = parseFloat(producto.caracteristicasAjustadas?.[car]) || 0;
    if (ideal > 0) {
      const exceso = valAdj / ideal, umbral = 1.13, exp = 3.5, maxPremio = 10 * umbral;
      let interes = 0;
      if (exceso < 1)      interes = 10 * Math.pow(exceso, exp);
      else if (exceso <= umbral) interes = 10 * exceso;
      else {
        const desajuste = (exceso - umbral) / umbral;
        const factor = Math.max(0, 1 - desajuste);
        interes = maxPremio * Math.pow(factor, exp);
      }
      interes = Math.max(0, parseFloat(interes.toFixed(2)));
      interesTotal += interes; num++;
    }
  }
  return num > 0 ? parseFloat((interesTotal / num).toFixed(2)) : 0;
}

function calcularInteresPrecio(producto, funcionSensibilidad, interesProducto) {
  const pa = producto.precioAjustado;
  if (typeof pa !== 'number' || isNaN(pa) || pa < 0) return 0;
  if (typeof funcionSensibilidad !== 'function') return 0;
  if (typeof interesProducto !== 'number' || isNaN(interesProducto) || interesProducto <= 0) return 0;

  const maxAjusteEuros = 30, maxAjustePct = 0.10;
  let factor = 10 / interesProducto;
  factor = Math.max(1 - maxAjustePct, Math.min(factor, 1 + maxAjustePct));

  const precioAjustado = pa * factor;
  const diff = Math.max(-maxAjusteEuros, Math.min(precioAjustado - pa, maxAjusteEuros));
  const precioPercibido = pa + diff;
  producto.precioPercibido = precioPercibido;

  const demanda = funcionSensibilidad(precioPercibido);
  const interes = Math.max(0, Math.min(10, demanda / 10));
  producto.interesPrecio = interes;
  return interes;
}

function asignarSegmentoPorProducto(producto, marketData) {
  const segs = marketData.segmentos;
  let mejor = null, menor = Infinity;
  for (const nombre in segs) {
    const ideal = segs[nombre].productoIdeal;
    let d = 0;
    for (const k in ideal) {
      if (k === 'promedio') continue;
      d += Math.abs((producto.caracteristicas?.[k] || 0) - ideal[k]);
    }
    if (d < menor) { menor = d; mejor = nombre; }
  }
  return mejor;
}

function calcularPrecioOptimo(segmento) {
  const fn = segmento.funcionSensibilidad;
  let maxVentas = -Infinity, mejorPrecio = 0;
  for (let precio = 100; precio <= 2000; precio += 10) {
    const ventas = fn(precio);
    if (ventas > maxVentas) { maxVentas = ventas; mejorPrecio = precio; }
  }
  return mejorPrecio;
}

function ajustarPrecioPorDificultad(precioOptimo, dificultad) {
  let error = 0;
  if (dificultad === 'facil') error = (Math.random() * 0.20) - 0.10;
  if (dificultad === 'normal') error = (Math.random() * 0.10) - 0.05;
  if (dificultad === 'dificil') error = (Math.random() * 0.04) - 0.02;
  return Math.max(50, Math.round(precioOptimo + (precioOptimo * error)));
}

module.exports = { tomarDecisionesBot };
