// backend/Utils/Bots.js
// Solo se actualiza este archivo (bots). No requiere cambios en calculos.js.
const { calcularCosteReal } = require('./calculos');

/**
 * Punto de entrada: devuelve un objeto de decisiones para el jugador-bot.
 */
function tomarDecisionesBot(nombreBot, dificultad, gameState, marketData, resultadosCache) {
  const esPrimeraRonda = (Number(gameState.round) || 0) === 0;
  if (esPrimeraRonda) {
    return tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData, resultadosCache);
  }
  return tomarDecisionesRondasPosteriores(
    nombreBot, dificultad, gameState, marketData, resultadosCache
  );
}

/* ======================================================================== */
/* ======================  RONDA 0 (ARRANQUE)  ============================ */
/* ======================================================================== */

function tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData, resultadosCache) {
  const decisiones = { products: [], canalesDistribucion: {} };
  const productos = Array.isArray(gameState.products) ? gameState.products : [];
  const presupuestoWrapper = { valor: Number(gameState.budget || 0) };

  // 1) Segmentos objetivo preliminares para detectar competidores
  const segmentosObjetivo = productos.map(p => asignarSegmentoPorProducto(p, marketData.segmentos || {}));

  // 2) Reservar pools según competidores (0 → bajo; ≥1 → alto)
  const comp = hayCompetidoresEnSegmentos(resultadosCache, segmentosObjetivo, nombreBot);
  const { poolPublicidad, poolCanales } = reservarPoolsPorCompetencia(presupuestoWrapper, comp);

  // 3) Decisiones por producto
  let productosRestantes = Math.max(1, productos.length);
  productos.forEach((producto, idx) => {
    const segmentoObjetivo = segmentosObjetivo[idx];
    producto.segmentoObjetivo = segmentoObjetivo;

    const precioRef = calcularPrecioOptimo(marketData.segmentos[segmentoObjetivo]);
    const precio = aplicarRuidoDificultad(precioRef, dificultad);

    const calidad = decidirCalidadPorSegmento(segmentoObjetivo, marketData, dificultad, producto);
    const posicionamientoPrecio = Math.max(1, Math.round(precio / 50)); // compatible con calculos.js

    // Publicidad desde pool (reparto igualitario por producto)
    const publicidad = asignarPublicidadDesdePool(poolPublicidad, productosRestantes);
    productosRestantes--;

    const unidadesFabricar = decidirProduccionPrimeraRonda(
      producto, presupuestoWrapper, segmentoObjetivo, marketData, dificultad
    );

    decisiones.products.push({
      caracteristicas: producto.caracteristicas,
      precio,
      calidad,
      posicionamientoPrecio,
      publicidad,
      unidadesFabricar,
      costeUnitarioEst: Number(producto.costeUnitarioEst || 1000)
    });
  });

  // 4) Canales: gastar el pool fijo y retornar sobrante al budget
  const resCanales = decidirCanalesDistribucionConPool(
    poolCanales.valor, productos, resultadosCache, marketData, dificultad, nombreBot
  );
  decisiones.canalesDistribucion = resCanales.unidades;
  presupuestoWrapper.valor += resCanales.sobrante; // devolver lo no gastado

  // Guardar presupuesto restante en gameState y normalizar a roundDecisions
  gameState.budget = presupuestoWrapper.valor;
  const normalizadas = normalizarDecisionesParaRoundHistory(decisiones);
  gameState.roundDecisions = normalizadas;
  gameState.canalesDistribucion = normalizadas.canalesDistribucion;
  return normalizadas;
}

/* ======================================================================== */
/* =====================  RONDAS POSTERIORES  ============================= */
/* ======================================================================== */

function tomarDecisionesRondasPosteriores(
  nombreBot, dificultad, gameState, marketData, resultadosCache
) {
  const decisiones = { products: [], canalesDistribucion: {} };
  const productos = Array.isArray(gameState.products) ? gameState.products : [];
  const presupuestoWrapper = { valor: Number(gameState.budget || 0) };
  const rondaActual = Number(gameState.round || 1);
  const preciosPercibidos = gameState.preciosPercibidos || {};
  const resultadosAnteriores = Array.isArray(gameState.roundsHistory) ? gameState.roundsHistory : [];

  // 1) Segmentos objetivo propuestos (con histéresis) para detectar competidores
  const segmentosPropuestos = productos.map(p =>
    reelegirSegmentoConHisteresis(p, marketData.segmentos || {}, p.segmentoObjetivo)
  );
  const comp = hayCompetidoresEnSegmentos(resultadosCache, segmentosPropuestos, nombreBot);

  // 2) Reservar pools (publicidad/canales) según competencia
  const { poolPublicidad, poolCanales } = reservarPoolsPorCompetencia(presupuestoWrapper, comp);

  // 3) Decisiones por producto
  let productosRestantes = Math.max(1, productos.length);

  productos.forEach((producto, idx) => {
    const segmentoNuevo = segmentosPropuestos[idx];
    producto.segmentoObjetivo = segmentoNuevo;

    const demandaEstimada = estimarDemandaEsperada(
      producto, segmentoNuevo, resultadosCache, nombreBot, rondaActual, marketData
    );

    const stockPrevio = Number(producto.stock || 0);

    const precio = decidirPrecio(
      producto,
      marketData.segmentos[segmentoNuevo],
      dificultad,
      {
        nombreSegmento: segmentoNuevo,
        resultadosCache,
        nombreBot,
        rondaActual,
        marketData,
        demandaEstimada
      }
    );

    const calidad = decidirCalidadPorSegmento(segmentoNuevo, marketData, dificultad, producto);
    const posicionamientoPrecio = decidirPosicionamientoPrecio(producto, precio, preciosPercibidos);

    // Publicidad desde pool (reparto igualitario por producto; puedes ponderar si quieres)
    const publicidad = asignarPublicidadDesdePool(poolPublicidad, productosRestantes);
    productosRestantes--;

    const unidadesFabricar = decidirUnidadesAFabricar(
      producto,
      demandaEstimada,
      stockPrevio,
      dificultad,
      presupuestoWrapper,
      marketData.segmentos[segmentoNuevo],
      precio
    );

    decisiones.products.push({
      caracteristicas: producto.caracteristicas,
      precio,
      calidad,
      posicionamientoPrecio,
      publicidad,
      unidadesFabricar,
      costeUnitarioEst: Number(producto.costeUnitarioEst || 1000)
    });
  });

  // 4) Canales con pool fijo; sobrante vuelve al budget
  const resCanales = decidirCanalesDistribucionConPool(
    poolCanales.valor, productos, resultadosCache, marketData, dificultad, nombreBot, resultadosAnteriores
  );
  decisiones.canalesDistribucion = resCanales.unidades;
  presupuestoWrapper.valor += resCanales.sobrante;

  gameState.budget = presupuestoWrapper.valor;
  const normalizadas = normalizarDecisionesParaRoundHistory(decisiones);
  gameState.roundDecisions = normalizadas;
  gameState.canalesDistribucion = normalizadas.canalesDistribucion;
  return normalizadas;
}

/* ======================================================================== */
/* =======================  HELPERS DE SEGMENTO  ========================== */
/* ======================================================================== */

function asignarSegmentoPorProducto(producto, segmentosIdeales) {
  let mejor = null, menor = Infinity;
  for (const nombre in segmentosIdeales) {
    const ideal = segmentosIdeales[nombre]?.productoIdeal || {};
    let diff = 0;
    for (const k of Object.keys(ideal)) {
      if (k === 'promedio') continue;
      diff += Math.abs( Number(producto.caracteristicas?.[k] ?? 0) - Number(ideal[k] ?? 0) );
    }
    if (diff < menor) { menor = diff; mejor = nombre; }
  }
  return mejor;
}

function reelegirSegmentoConHisteresis(producto, segmentos, segmentoActual) {
  const umbral = 0.5;
  let mejor = segmentoActual ?? null;
  let mejorNota = mejor ? calcularInteresProductoParaSegmento(producto, segmentos[mejor] || {}) : -Infinity;

  for (const nombre in segmentos) {
    const nota = calcularInteresProductoParaSegmento(producto, segmentos[nombre] || {});
    if (nota > mejorNota + umbral) {
      mejor = nombre;
      mejorNota = nota;
    }
  }
  return mejor || segmentoActual || Object.keys(segmentos)[0];
}

function calcularInteresProductoParaSegmento(producto, segmentoObj) {
  const ideal = (segmentoObj && segmentoObj.productoIdeal) ? segmentoObj.productoIdeal : {};
  const keys = Object.keys(ideal).filter(k => k !== 'promedio');
  if (!keys.length) return 5;

  const UMBRAL = 1.13;
  const EXP = 3.5;
  let suma = 0;

  for (const k of keys) {
    const vProd = Number(producto.caracteristicas?.[k] ?? 0);
    const vIdeal = Number(ideal[k] ?? 0);
    if (vIdeal <= 0) continue;

    const excesoRel = vProd / vIdeal;
    let nota = 0;
    if (excesoRel < 1) {
      nota = 10 * Math.pow(excesoRel, EXP);
    } else if (excesoRel <= UMBRAL) {
      nota = 10 * excesoRel;
    } else {
      const desajuste = (excesoRel - UMBRAL) / UMBRAL;
      nota = 10 * UMBRAL * Math.pow(Math.max(0, 1 - desajuste), EXP);
    }
    suma += Math.max(0, Math.min(10, nota));
  }

  return +(suma / keys.length).toFixed(2);
}

/* ======================================================================== */
/* ==================  DEMANDA Y PRECIO ÓPTIMO DEL SEGMENTO  ============== */
/* ======================================================================== */

function unidadesTeoricasSegmento(marketData, nombreSegmento) {
  const seg = marketData.segmentos?.[nombreSegmento] || {};
  const usuariosPotenciales = Number(seg.usuariosPotenciales || 0);
  const demandaAno1 = Number(seg.demandaAno1 || 0);
  return Math.max(0, Math.round((usuariosPotenciales * demandaAno1) / 100));
}

function estimarDemandaEsperada(producto, segmento, resultadosCache, nombreBot, rondaActual, marketData) {
  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];

  const demandaTotalPrev = resultados
    .filter(r => r.segmento === segmento)
    .reduce((acc, r) => acc + Number(r.demanda || 0), 0);

  const ventasBotPrev = resultados
    .filter(r => r.jugador === nombreBot && r.segmento === segmento)
    .reduce((acc, r) => acc + Number(r.unidadesNetas || r.unidadesVendidas || 0), 0);

  const competidores = Math.max(1,
    new Set(resultados.filter(r => r.segmento === segmento).map(r => r.jugador)).size
  );

  const cuotaBase = 1 / competidores;
  const cuotaBotPrev = (demandaTotalPrev > 0) ? (ventasBotPrev / demandaTotalPrev) : 0;
  const cuotaSuavizada = 0.3 * cuotaBotPrev + 0.7 * cuotaBase;

  const demandaTeorica = unidadesTeoricasSegmento(marketData, segmento) || Math.max(1, demandaTotalPrev);
  const estim = Math.max(1, Math.round(demandaTeorica * cuotaSuavizada));

  try {
    console.log('[BOT] estimarDemandaEsperada', {
      jugador: nombreBot, ronda: rondaActual, segmento,
      competidores, cuotaBase:+cuotaBase.toFixed(4), cuotaBotPrev:+cuotaBotPrev.toFixed(4),
      cuotaSuavizada:+cuotaSuavizada.toFixed(4), demandaTeorica, estim
    });
  } catch {}
  return estim;
}

function calcularPrecioOptimo(segmento) {
  const fn = segmento?.funcionSensibilidad;
  if (typeof fn !== 'function') return 1000;
  let mejor = 1000, maxNota = -Infinity;
  for (let p = 100; p <= 4000; p += 10) {
    const nota = Number(fn(p)) || 0; // 0..10
    if (nota > maxNota) { maxNota = nota; mejor = p; }
  }
  return mejor;
}

/* ======================================================================== */
/* ========================  DECISIONES DE PRECIO  ======================== */
/* ======================================================================== */

function decidirPrecio(producto, segmento, dificultad, ctx = {}) {
  const fn = segmento?.funcionSensibilidad;
  if (typeof fn !== 'function') {
    return Math.max(100, Math.round(Number(producto.precio || 1000)));
  }

  const interesProducto = calcularInteresProductoParaSegmento(producto, segmento);
  const demandaBase = Math.max(1, Number(ctx.demandaEstimada || 0) ||
                                  unidadesTeoricasSegmento(ctx.marketData || {}, ctx.nombreSegmento));

  const precioIdeal = calcularPrecioOptimo(segmento);
  const pasos = 24, minP = precioIdeal * 0.80, maxP = precioIdeal * 1.20;

  let bestP = precioIdeal;
  let bestProfit = -Infinity;

  for (let i = 0; i <= pasos; i++) {
    const p = minP + i * ((maxP - minP) / pasos);

    const interesPrecio = Math.max(0, Math.min(10, Number(fn(p)) || 0));
    const interesCombinado = Math.max(0, Math.min(10, (interesProducto + interesPrecio) / 2));

    const ventasEsperadas = (interesCombinado / 10) * demandaBase;
    const tasaDevolucion = Math.max(0, 0.02 + (1 - (interesCombinado / 10)) * 0.10);
    const ventasNetas = Math.max(0, ventasEsperadas * (1 - tasaDevolucion));

    const costeEst = Number(producto.costeUnitarioEst || 1000);
    let costeRealUnit;
    try { costeRealUnit = calcularCosteReal(costeEst, Math.max(1, Math.round(ventasNetas))); }
    catch { costeRealUnit = costeEst; }

    const beneficio = ventasNetas * (p - costeRealUnit);
    if (beneficio > bestProfit) { bestProfit = beneficio; bestP = p; }
  }

  return Math.round( aplicarRuidoDificultad(bestP, dificultad) );
}

function aplicarRuidoDificultad(valor, dificultad) {
  let error = 0;
  if (dificultad === 'facil')   error = (Math.random() * 0.20) - 0.10;
  if (dificultad === 'normal')  error = (Math.random() * 0.10) - 0.05;
  if (dificultad === 'dificil') error = (Math.random() * 0.04) - 0.02;
  return Math.max(50, valor * (1 + error));
}

/* ======================================================================== */
/* ===================  PRODUCCIÓN (con stock y devol.)  ================== */
/* ======================================================================== */

function decidirUnidadesAFabricar(producto, demandaEstimada, stockPrevio, dificultad, presupuestoWrapper, segmento, precioElegido) {
  const COSTE_ALMACENAJE = 20;
  const costeUnitarioEst = Number(producto.costeUnitarioEst || 1000);

  let colch = 0.10;
  if (dificultad === 'facil')   colch = 0.20;
  if (dificultad === 'dificil') colch = 0.02;

  const deficit = Math.max(0, demandaEstimada - stockPrevio);
  let objetivo = Math.ceil(deficit * (1 + colch));

  const maxPosibles = Math.max(0, Math.floor(presupuestoWrapper.valor / costeUnitarioEst));
  let unidades = Math.min(objetivo, maxPosibles);

  try {
    const interesProd = calcularInteresProductoParaSegmento(producto, segmento || {});
    const fn = segmento?.funcionSensibilidad;
    const interesPrecio = (typeof fn === 'function') ? Math.max(0, Math.min(10, Number(fn(precioElegido)) || 0)) : interesProd;
    const interesCombinado = Math.max(0, Math.min(10, (interesProd + interesPrecio) / 2));

    const ventasEsperadas = (interesCombinado / 10) * demandaEstimada;
    const tasaDevol = Math.max(0, 0.02 + (1 - (interesCombinado / 10)) * 0.10);
    const ventasNetas = Math.max(0, ventasEsperadas * (1 - tasaDevol));

    let exceso = Math.max(0, (stockPrevio + unidades) - ventasNetas);
    let costAlm = exceso * COSTE_ALMACENAJE;

    let costeRealUnit = costeUnitarioEst;
    try { costeRealUnit = calcularCosteReal(costeUnitarioEst, Math.max(1, unidades)); } catch {}
    let margenUnit = (precioElegido || 0) - costeRealUnit;
    if (!isFinite(margenUnit) || margenUnit <= 0) margenUnit = costeRealUnit * 0.05;

    let beneficioBruto = Math.min(stockPrevio + unidades, ventasNetas) * margenUnit - costAlm;

    let guard = 0;
    while (beneficioBruto < 0 && unidades > 0 && guard < 20) {
      unidades = Math.max(0, Math.floor(unidades * 0.95));
      exceso = Math.max(0, (stockPrevio + unidades) - ventasNetas);
      costAlm = exceso * COSTE_ALMACENAJE;
      try { costeRealUnit = calcularCosteReal(costeUnitarioEst, Math.max(1, unidades)); } catch {}
      margenUnit = (precioElegido || 0) - costeRealUnit;
      if (!isFinite(margenUnit) || margenUnit <= 0) margenUnit = costeRealUnit * 0.05;
      beneficioBruto = Math.min(stockPrevio + unidades, ventasNetas) * margenUnit - costAlm;
      guard++;
    }
  } catch {}

  const costeTotal = unidades * costeUnitarioEst;
  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - costeTotal);

  return unidades;
}

/* ======================================================================== */
/* ===================  CALIDAD / PUBLICIDAD / POSPRECIO  ================= */
/* ======================================================================== */

function decidirCalidadPorSegmento(segmentoNombre, marketData, dificultad, producto = null) {
  const ideal = marketData.segmentos?.[segmentoNombre]?.productoIdeal || {};
  const idealProm = clamp(Number(ideal.promedio ?? 12), 1, 20);

  const cap = 19; // evita saturar en 20
  let base = Math.min(cap, idealProm);

  let ruido = 0;
  if (dificultad === 'facil')   ruido = (Math.random() * 4.0) - 2.0;   // ±2.0
  else if (dificultad === 'dificil') ruido = (Math.random() * 1.2) - 0.6; // ±0.6
  else                           ruido = (Math.random() * 2.4) - 1.2; // ±1.2

  let val = base + ruido;

  if (producto) {
    const keys = Object.keys(ideal).filter(k => k !== 'promedio');
    const dist = keys.length
      ? keys.reduce((s,k)=>{
          const vp = Number(producto.caracteristicas?.[k] ?? ideal[k] ?? 10);
          const vi = Number(ideal[k] ?? 10);
          return s + Math.abs(vp - vi) / 20;
        }, 0) / keys.length
      : 0.5;
    val -= 3 * dist; // baja si estás lejos del ideal
  }

  return clamp(Math.round(val), 1, 20);
}

function decidirPosicionamientoPrecio(producto, precioElegido, preciosPercibidos) {
  if (preciosPercibidos && typeof preciosPercibidos[producto.nombre] === 'number') {
    const perc = Number(preciosPercibidos[producto.nombre]);
    return Math.max(1, Math.round(perc / 50));
  }
  return Math.max(1, Math.round(Number(precioElegido || producto.precio || 1000) / 50));
}

/* ======================================================================== */
/* ==========================  CANALES (POOL)  ============================ */
/* ======================================================================== */

function decidirCanalesDistribucionConPool(
  pool, productos, resultadosCache, marketData, dificultad, nombreBot, resultadosAnteriores = []
) {
  const canales = ['granDistribucion','minoristas','online','tiendaPropia'];
  const costePorUnidad = { granDistribucion: 75000, minoristas: 115000, online: 150000, tiendaPropia: 300000 };

  if (pool < Math.min(...Object.values(costePorUnidad))) {
    return { unidades: { granDistribucion:0, minoristas:0, online:0, tiendaPropia:0 }, gastoReal: 0, sobrante: pool };
  }

  // Preferencia por canal: histórico 70% + base 30%
  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];
  const demHist = canales.reduce((o,c)=>(o[c]=0,o),{});
  resultados.filter(r => r.jugador === nombreBot).forEach(r => {
    if (demHist[r.canal] != null) demHist[r.canal] += Number(r.unidadesVendidas || r.unidadesNetas || 0);
  });
  const sumHist = canales.reduce((s,c)=> s + (demHist[c] || 0), 0) || 1;
  const baseMix = { granDistribucion: 0.4, minoristas: 0.3, online: 0.2, tiendaPropia: 0.1 };
  const pref = {};
  for (const c of canales) {
    const hist = demHist[c] / sumHist;
    pref[c] = 0.7 * hist + 0.3 * baseMix[c];
  }

  const unidades = {};
  let gasto = 0;
  for (const c of canales) {
    const coste = costePorUnidad[c];
    const parte = Math.max(0, Math.floor((pool * pref[c]) / coste));
    unidades[c] = parte;
    gasto += parte * coste;
  }

  let diff = pool - gasto;
  while (diff >= Math.min(...Object.values(costePorUnidad))) {
    let added = false;
    for (const c of canales) {
      const coste = costePorUnidad[c];
      if (diff >= coste) { unidades[c]++; diff -= coste; gasto += coste; added = true; }
    }
    if (!added) break;
  }

  return { unidades, gastoReal: gasto, sobrante: Math.max(0, pool - gasto) };
}

/* ======================================================================== */
/* ============================  HELPERS NEW  ============================= */
/* ======================================================================== */

function normalizarDecisionesParaRoundHistory(decisiones) {
  const prods = (decisiones.products || []).map(p => ({
    ...p,
    posicionamientoCalidad: p.posicionamientoCalidad ?? p.calidad ?? 0,
    presupuestoPublicidad: p.presupuestoPublicidad ?? p.publicidad ?? 0
  }));
  return { ...decisiones, products: prods };
}

function hayCompetidoresEnSegmentos(resultadosCache, segmentos, botName) {
  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];
  const setSeg = new Set(segmentos.filter(Boolean));
  for (const seg of setSeg) {
    const others = new Set(
      resultados.filter(r => r.segmento === seg).map(r => r.jugador)
    );
    others.delete(botName);
    if (others.size >= 1) return true;
  }
  return false; // sin datos o sin otros jugadores ⇒ bajo
}

function reservarPoolsPorCompetencia(presupuestoWrapper, hayCompetidores) {
  const budgetInicial = Number(presupuestoWrapper.valor || 0);
  // % fijos según competencia
  const pctPublicidad = hayCompetidores ? 0.04 : 0.02; // 4% ó 2%
  const pctCanales    = hayCompetidores ? 0.15 : 0.10; // 15% ó 10%

  let poolPub = Math.round(budgetInicial * pctPublicidad);
  let poolCan = Math.round(budgetInicial * pctCanales);

  // Asegurar que no exceden el budget (escala proporcional si hace falta)
  const totalPool = poolPub + poolCan;
  if (totalPool > presupuestoWrapper.valor) {
    const k = presupuestoWrapper.valor / (totalPool || 1);
    poolPub = Math.floor(poolPub * k);
    poolCan = Math.floor(poolCan * k);
  }

  // Retirar pools del presupuesto operativo (producción, etc.)
  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - (poolPub + poolCan));

  return { poolPublicidad: { valor: poolPub }, poolCanales: { valor: poolCan } };
}

function asignarPublicidadDesdePool(poolRef, productosRestantes) {
  if (!poolRef || poolRef.valor <= 0) return 0;
  const n = Math.max(1, productosRestantes);
  const parte = Math.floor(poolRef.valor / n);
  poolRef.valor -= parte;
  return parte;
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/* ======================================================================== */
/* ==================  PRODUCCIÓN RONDA 0 (simple)  ======================= */
/* ======================================================================== */

function decidirProduccionPrimeraRonda(producto, presupuestoWrapper, segmentoNombre, marketData, dificultad) {
  const costeUnitario = Number(producto.costeUnitarioEst || 1000);
  const demandaSeg = unidadesTeoricasSegmento(marketData, segmentoNombre);
  let cuota = 0.33; // base
  if (dificultad === 'facil') cuota = 0.40;
  if (dificultad === 'dificil') cuota = 0.25;

  const deseadas = Math.ceil(demandaSeg * cuota);
  const posibles = Math.max(0, Math.floor(presupuestoWrapper.valor / costeUnitario));
  const fabricar = Math.min(deseadas, posibles);
  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - fabricar * costeUnitario);
  return fabricar;
}

/* ======================================================================== */

module.exports = { tomarDecisionesBot };
