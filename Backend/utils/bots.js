// backend/Utils/Bots.js
// Solo se actualiza este archivo (bots). No requiere cambios en calculos.js.
const { calcularCosteReal } = require('./calculos');

/**
 * Punto de entrada: devuelve un objeto de decisiones para el jugador-bot.
 * Estructura:
 * {
 *   products: [{
 *     caracteristicas, precio, calidad, posicionamientoPrecio, publicidad, unidadesFabricar, costeUnitarioEst
 *   }],
 *   canalesDistribucion: { granDistribucion, minoristas, online, tiendaPropia }
 * }
 */
function tomarDecisionesBot(nombreBot, dificultad, gameState, marketData, resultadosCache) {
  const esPrimeraRonda = (Number(gameState.round) || 0) === 0;
  if (esPrimeraRonda) {
    return tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData);
  }
  return tomarDecisionesRondasPosteriores(
    nombreBot, dificultad, gameState, marketData, resultadosCache
  );
}

/* ======================================================================== */
/* ======================  RONDA 0 (ARRANQUE)  ============================ */
/* ======================================================================== */

function tomarDecisionesPrimeraRonda(nombreBot, dificultad, gameState, marketData) {
  const decisiones = { products: [], canalesDistribucion: {} };
  const productos = Array.isArray(gameState.products) ? gameState.products : [];
  const presupuestoWrapper = { valor: Number(gameState.budget || 0) };

  for (const producto of productos) {
    const segmentoObjetivo = asignarSegmentoPorProducto(producto, marketData.segmentos || {});
    producto.segmentoObjetivo = segmentoObjetivo;

    const precioRef = calcularPrecioOptimo(marketData.segmentos[segmentoObjetivo]);
    const precio = aplicarRuidoDificultad(precioRef, dificultad);

    const calidad = decidirCalidadPorSegmento(segmentoObjetivo, marketData, dificultad);
    const posicionamientoPrecio = Math.max(1, Math.round(precio / 50)); // compatible con calculos.js

    const publicidad = decidirPublicidadPrimeraRonda(presupuestoWrapper);

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
  }

  decisiones.canalesDistribucion = decidirCanalesDistribucionPrimeraRonda(presupuestoWrapper);

  // Guardar presupuesto restante en gameState (si el llamante muta referencia)
  gameState.budget = presupuestoWrapper.valor;
  return decisiones;
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

  for (const producto of productos) {
    // Reevaluar segmento con histéresis suave
    const segmentoAnterior = producto.segmentoObjetivo;
    const segmentoNuevo = reelegirSegmentoConHisteresis(producto, marketData.segmentos || {}, segmentoAnterior);
    producto.segmentoObjetivo = segmentoNuevo;

    const demandaEstimada = estimarDemandaEsperada(
      producto, segmentoNuevo, resultadosCache, nombreBot, rondaActual, marketData
    );

    const stockPrevio = Number(producto.stock || 0);

    const precio = decidirPrecio(
      producto,
      marketData.segmentos[segmentoNuevo],
      dificultad,
      { // contexto para demanda y sensibilidad
        nombreSegmento: segmentoNuevo,
        resultadosCache,
        nombreBot,
        rondaActual,
        marketData,
        demandaEstimada
      }
    );

    const calidad = decidirCalidadPorSegmento(segmentoNuevo, marketData, dificultad);
    const posicionamientoPrecio = decidirPosicionamientoPrecio(producto, precio, preciosPercibidos);

    const publicidad = decidirPublicidad(producto, resultadosAnteriores, presupuestoWrapper);

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
  }

  decisiones.canalesDistribucion = decidirCanalesDistribucion(
    productos, presupuestoWrapper, resultadosCache, marketData, dificultad, nombreBot, resultadosAnteriores
  );

  gameState.budget = presupuestoWrapper.valor;
  return decisiones;
}

/* ======================================================================== */
/* =======================  HELPERS DE SEGMENTO  ========================== */
/* ======================================================================== */

// Segmento más cercano al ideal (distancia L1 sobre características)
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
  // Calcula "nota de interés" por segmento y solo cambia si mejora > umbral
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

// Interés de producto por segmento (aprox. consistente con calculos.js)
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
  // Si no hay histórico de la ronda anterior, usar cuota base 1/competidores y unidades teóricas
  const resultados = Array.isArray(resultadosCache) ? resultadosCache : [];

  // Demanda total del segmento (ronda previa)
  const demandaTotalPrev = resultados
    .filter(r => r.segmento === segmento)
    .reduce((acc, r) => acc + Number(r.demanda || 0), 0);

  // Ventas del bot (ronda previa)
  const ventasBotPrev = resultados
    .filter(r => r.jugador === nombreBot && r.segmento === segmento)
    .reduce((acc, r) => acc + Number(r.unidadesNetas || r.unidadesVendidas || 0), 0);

  // Nº competidores activos en el segmento
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

  // Demanda base estimada (del propio bot) para este producto/segmento
  const demandaBase = Math.max(1, Number(ctx.demandaEstimada || 0) ||
                                  unidadesTeoricasSegmento(ctx.marketData || {}, ctx.nombreSegmento));

  const precioIdeal = calcularPrecioOptimo(segmento);
  const pasos = 24, minP = precioIdeal * 0.80, maxP = precioIdeal * 1.20;

  let bestP = precioIdeal;
  let bestProfit = -Infinity;

  for (let i = 0; i <= pasos; i++) {
    const p = minP + i * ((maxP - minP) / pasos);

    // Interés por precio candidato p (0..10)
    const interesPrecio = Math.max(0, Math.min(10, Number(fn(p)) || 0));
    const interesCombinado = Math.max(0, Math.min(10, (interesProducto + interesPrecio) / 2));

    // Ventas esperadas y devoluciones
    const ventasEsperadas = (interesCombinado / 10) * demandaBase;
    const tasaDevolucion = Math.max(0, 0.02 + (1 - (interesCombinado / 10)) * 0.10);
    const ventasNetas = Math.max(0, ventasEsperadas * (1 - tasaDevolucion));

    // Coste real por escala aproximado con ese volumen
    const costeEst = Number(producto.costeUnitarioEst || 1000);
    let costeRealUnit;
    try { costeRealUnit = calcularCosteReal(costeEst, Math.max(1, Math.round(ventasNetas))); }
    catch { costeRealUnit = costeEst; }

    const beneficio = ventasNetas * (p - costeRealUnit);
    if (beneficio > bestProfit) { bestProfit = beneficio; bestP = p; }
  }

  // Ruido por dificultad
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
  const COSTE_ALMACENAJE = 20; // consistente con resultadosJugadores.js
  const costeUnitarioEst = Number(producto.costeUnitarioEst || 1000);

  // Colchón según dificultad
  let colch = 0.10;
  if (dificultad === 'facil')   colch = 0.20;
  if (dificultad === 'dificil') colch = 0.02;

  const deficit = Math.max(0, demandaEstimada - stockPrevio);
  let objetivo = Math.ceil(deficit * (1 + colch));

  // Límite por presupuesto
  const maxPosibles = Math.max(0, Math.floor(presupuestoWrapper.valor / costeUnitarioEst));
  let unidades = Math.min(objetivo, maxPosibles);

  // Estimación de ventas netas esperadas según interés del producto + precio elegido
  try {
    const interesProd = calcularInteresProductoParaSegmento(producto, segmento || {});
    const fn = segmento?.funcionSensibilidad;
    const interesPrecio = (typeof fn === 'function') ? Math.max(0, Math.min(10, Number(fn(precioElegido)) || 0)) : interesProd;
    const interesCombinado = Math.max(0, Math.min(10, (interesProd + interesPrecio) / 2));

    const ventasEsperadas = (interesCombinado / 10) * demandaEstimada;
    const tasaDevol = Math.max(0, 0.02 + (1 - (interesCombinado / 10)) * 0.10);
    const ventasNetas = Math.max(0, ventasEsperadas * (1 - tasaDevol));

    // Simular reducción si el coste de almacenaje + producción deja beneficio bruto negativo
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

  // Aplicar y descontar presupuesto
  const costeTotal = unidades * costeUnitarioEst;
  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - costeTotal);

  return unidades;
}

/* ======================================================================== */
/* ===================  CALIDAD / PUBLICIDAD / POSPRECIO  ================= */
/* ======================================================================== */

function decidirCalidadPorSegmento(segmentoNombre, marketData, dificultad) {
  const idealProm = Number(marketData.segmentos?.[segmentoNombre]?.productoIdeal?.promedio || 5);
  let ruido = 0;
  if (dificultad === 'facil')   ruido = (Math.random() * 1.0) - 0.5;
  if (dificultad === 'normal')  ruido = (Math.random() * 0.6) - 0.3;
  if (dificultad === 'dificil') ruido = (Math.random() * 0.3) - 0.15;
  return Math.max(0, Math.min(10, Math.round(idealProm + ruido)));
}

function decidirPublicidadPrimeraRonda(presupuestoWrapper) {
  const pct = 0.06;
  const gasto = Math.round(Math.min(presupuestoWrapper.valor * pct, presupuestoWrapper.valor));
  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - gasto);
  return gasto;
}

function decidirPublicidad(producto, resultadosAnteriores, presupuestoWrapper) {
  let pct = 0.05;
  try {
    const ultimo = resultadosAnteriores[resultadosAnteriores.length - 1] || {};
    const rn = Number(ultimo.resultadoNeto || ultimo.resultado || 0);
    const baii = Number(ultimo.BAII || ultimo.baII || 0);
    if (rn < 0 || baii < 0) pct = 0.02;
  } catch {}
  const gasto = Math.round(Math.min(presupuestoWrapper.valor * pct, presupuestoWrapper.valor));
  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - gasto);
  return gasto;
}

function decidirPosicionamientoPrecio(producto, precioElegido, preciosPercibidos) {
  // Si tenemos "precio percibido" previo, úsalo como pista (se guarda en gameState por el motor)
  if (preciosPercibidos && typeof preciosPercibidos[producto.nombre] === 'number') {
    const perc = Number(preciosPercibidos[producto.nombre]);
    return Math.max(1, Math.round(perc / 50)); // inverso de (x / 0.02) ≈ x*50
  }
  return Math.max(1, Math.round(Number(precioElegido || producto.precio || 1000) / 50));
}

/* ======================================================================== */
/* ==========================  CANALES (GASTO)  =========================== */
/* ======================================================================== */

function decidirCanalesDistribucionPrimeraRonda(presupuestoWrapper) {
  const costeUnidad = { granDistribucion: 75000, minoristas: 115000, online: 150000, tiendaPropia: 300000 };
  const canales = Object.keys(costeUnidad);
  const unidades = {};
  for (const canal of canales) {
    const coste = costeUnidad[canal];
    const maxU = Math.min(10, Math.floor(presupuestoWrapper.valor / coste));
    unidades[canal] = maxU;
    presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - maxU * coste);
  }
  return unidades;
}

function decidirCanalesDistribucion(
  productos, presupuestoWrapper, resultadosCache, marketData, dificultad, nombreBot, resultadosAnteriores = []
) {
  const costeUnidad = { granDistribucion: 75000, minoristas: 115000, online: 150000, tiendaPropia: 300000 };
  const canales = Object.keys(costeUnidad);

  // % de marketing base
  let marketingPct = 0.10 + Math.random() * 0.05;

  // Control de riesgo: recorta si vienes de pérdidas
  try {
    const ultimo = resultadosAnteriores[resultadosAnteriores.length - 1] || {};
    const rn = Number(ultimo.resultadoNeto || ultimo.resultado || 0);
    const baii = Number(ultimo.BAII || ultimo.baII || 0);
    if (rn < 0 || baii < 0) {
      marketingPct = Math.max(0.05, marketingPct * 0.7);
    }
  } catch {}

  const presupuestoCanales = Math.min(Math.round(presupuestoWrapper.valor * marketingPct), presupuestoWrapper.valor);

  // Preferencia por canal: histórico (ventas) 70% + base 30%
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

  // Asignación en "unidades de presencia" (enteras)
  const unidades = {};
  for (const c of canales) {
    const coste = costeUnidad[c];
    unidades[c] = Math.max(0, Math.round( (presupuestoCanales * pref[c]) / coste ));
  }

  // Ajuste para gastar lo más posible sin pasarse
  let gasto = canales.reduce((s,c)=> s + unidades[c]*costeUnidad[c], 0);
  let diff = presupuestoCanales - gasto;
  let guard = 0;
  while (diff >= Math.min(...canales.map(c=>costeUnidad[c])) && guard < 50) {
    let asignado = false;
    for (const c of canales) {
      const coste = costeUnidad[c];
      if (diff >= coste) { unidades[c]++; diff -= coste; asignado = true; }
    }
    if (!asignado) break;
    guard++;
  }

  presupuestoWrapper.valor = Math.max(0, presupuestoWrapper.valor - canales.reduce((s,c)=> s + unidades[c]*costeUnidad[c], 0));
  return unidades;
}

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
