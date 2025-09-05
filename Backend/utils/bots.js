// utils/bots.js (Pro) — multipartida/Koyeb ready
// Objetivo: bots más listos sin cambiar APIs externas.
// Entrada (igual que antes): tomarDecisionesBot(nombreBot, dificultad, gameState, marketData, resultadosUltimaRonda)
// Salida (igual que antes): { products: [{caracteristicas, precio, calidad, posicionamientoPrecio, publicidad, unidadesFabricar}], canalesDistribucion }

/**
 * Notas clave:
 * - Sin estado global: la “memoria” del bot vive en gameState.__botMemory (per-partida/per-bot).
 * - Precio = busca máximo de beneficio en torno a xMax de la curva del segmento con suelo coste+margen.
 * - Producción = newsvendor (α = cu/(cu+co), co≈20 €/ud).
 * - Publicidad/Canales = bandit (ε-greedy) usando ROI reciente; si no hay histórico, usa preferencias del segmento.
 * - Anti-canibalización: separa precios 5–10% y/o canales si dos productos van al mismo segmento.
 * - Reelección de segmento con inercia: sólo pivota tras 2 rondas malas.
 */

// ========================= Utilidades generales =========================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function ensureMemory(gameState) {
  if (!gameState.__botMemory) {
    gameState.__botMemory = {
      productos: {}, // por nombreProducto → { segmentoObjetivo, ventasHist: [...], precios: [...], publi: [...], roiPubli: [...], roiCanal: { canal: [...]} }
      rondasMalas: {}, // por producto → contador
    };
  }
  return gameState.__botMemory;
}

function distanciaAProductoIdeal(caracteristicas, ideal) {
  let sum = 0, n = 0;
  for (const k of Object.keys(ideal)) {
    if (k === 'promedio') continue;
    const v = Number(caracteristicas[k] || 0);
    const t = Number(ideal[k] || 0);
    sum += Math.abs(v - t);
    n++;
  }
  return n ? sum / n : Infinity;
}

function elegirSegmento(producto, marketData, memoria, fuerza = false) {
  // Busca el segmento más cercano por características. Mantén inercia salvo "fuerza".
  const segs = marketData?.segmentos || {};
  const entradas = Object.entries(segs);
  if (!entradas.length) return memoria.segmentoObjetivo || 'granConsumidor';

  const ranked = entradas.map(([seg, datos]) => {
    const d = distanciaAProductoIdeal(producto.caracteristicas || {}, datos.productoIdeal || {});
    return { seg, d };
  }).sort((a,b)=> a.d - b.d);

  const mejor = ranked[0]?.seg || 'granConsumidor';
  if (!memoria.segmentoObjetivo || memoria.segmentoObjetivo === mejor) return mejor;
  // Si hay segmento previo distinto, sólo cambia si fuerza=true
  return fuerza ? mejor : memoria.segmentoObjetivo;
}

function evaluarDemandaPrecio(coef, precio) {
  if (!coef || typeof coef.a !== 'number') return 0;
  const { a, b, c } = coef;
  return Math.max(0, a*precio*precio + b*precio + c); // truncamos a 0
}

function costeUnitarioEstimado(producto) {
  // Si existe costeUnitarioEst úsalo; si no, estima con una suma simple ponderada por característica
  if (typeof producto.costeUnitarioEst === 'number') return producto.costeUnitarioEst;
  const pesos = { pantalla:3, procesador:3, bateria:2.5, placaBase:2, ergonomia:1.5, acabados:1.5, color:1 };
  let suma = 0;
  for (const k of Object.keys(pesos)) {
    suma += (producto.caracteristicas?.[k] || 0) * pesos[k];
  }
  return Math.max(50, suma); // piso defensivo
}

function margenObjetivoPorDificultad(dificultad) {
  switch ((dificultad||'normal').toLowerCase()) {
    case 'facil': return rnd(0.08, 0.12);
    case 'dificil': return rnd(0.22, 0.32);
    default: return rnd(0.15, 0.22);
  }
}

function optimizarPrecio(producto, segmento, marketData, dificultad, antiOverlap = 0, preciosCompetencia = []) {
  const coef = marketData.segmentos?.[segmento]?.coeficientes;
  const xMax = coef?.xMax || 500;
  const coste = costeUnitarioEstimado(producto);
  const margenObj = margenObjetivoPorDificultad(dificultad);
  const precioMin = coste * (1 + margenObj);

  // Rango de búsqueda alrededor de xMax y también respetando suelo de coste+margen
  const low = Math.max(precioMin, xMax * 0.75);
  const high = Math.max(low + 1, xMax * 1.25);

  // Anti-canibalización básica: si antiOverlap > 0, separa +/− un %
  const separacion = antiOverlap ? (1 + antiOverlap) : 1;

  // Considera percentiles de competencia para no caer muy por debajo
  let pComp = null;
  if (preciosCompetencia.length) {
    const arr = [...preciosCompetencia].sort((a,b)=>a-b);
    const idx = Math.floor(arr.length * 0.6);
    pComp = arr[idx];
  }

  let mejor = { precio: low, beneficio: -Infinity, demanda: 0 };
  const pasos = 25;
  for (let i=0;i<=pasos;i++) {
    let p = low + (i*(high-low)/pasos);
    if (pComp) p = Math.max(p, pComp*0.9); // no te vayas demasiado por debajo del p60
    p *= separacion; // separa de tu otro producto si aplica

    const demanda = evaluarDemandaPrecio(coef, p);
    const beneficio = (p - coste) * demanda;
    if (beneficio > mejor.beneficio) mejor = { precio: p, beneficio, demanda };
  }

  // Calidad (posicionamientoCalidad) simple: media de características vs ideal
  const ideal = marketData.segmentos?.[segmento]?.productoIdeal || {};
  const dist = distanciaAProductoIdeal(producto.caracteristicas||{}, ideal);
  const calidad = clamp(20 - dist, 1, 20); // 1..20 (cuanto más cerca del ideal, mayor calidad)

  return {
    precio: Math.round(mejor.precio),
    demandaEsperada: Math.max(0, Math.round(mejor.demanda)),
    calidad: Math.round(calidad),
    posicionamientoPrecio: clamp(Math.round((mejor.precio / (xMax||1)) * 10), 1, 20),
    coste
  };
}

function decidirProduccionNewsvendor(precio, coste, demandaEsperada, stockActual) {
  const cu = Math.max(0, precio - coste); // coste de ruptura ≈ margen
  const co = 20; // coste de sobrestock por unidad (consistente con resultados)
  const alpha = (cu + co) > 0 ? (cu / (cu + co)) : 0.5; // 0..1
  const objetivo = Math.ceil(alpha * demandaEsperada);
  const aFabricar = Math.max(0, objetivo - (Number(stockActual)||0));
  // añade variación leve ±5%
  const variacion = 1 + (Math.random()*0.10 - 0.05);
  return Math.max(0, Math.round(aFabricar * variacion));
}

function extraerVentasPorProducto(botName, resultadosUltimaRonda) {
  const ventas = {}; // nombreProducto → { unidadesVendidas, porCanal: { canal: u } }
  if (!Array.isArray(resultadosUltimaRonda)) return ventas;
  for (const r of resultadosUltimaRonda) {
    if ((r.jugador||'').toLowerCase() !== (botName||'').toLowerCase()) continue;
    const prod = r.producto;
    if (!prod) continue;
    if (!ventas[prod]) ventas[prod] = { unidadesVendidas: 0, porCanal: {} };
    ventas[prod].unidadesVendidas += Number(r.unidadesVendidas||0);
    const canal = r.canal || 'desconocido';
    ventas[prod].porCanal[canal] = (ventas[prod].porCanal[canal]||0) + Number(r.unidadesVendidas||0);
  }
  return ventas;
}

function epsilonGreedy(scores, epsilon = 0.15) {
  // scores: { key: score }
  const claves = Object.keys(scores);
  if (!claves.length) return null;
  if (Math.random() < epsilon) return pick(claves);
  return claves.sort((a,b)=> (scores[b]||0) - (scores[a]||0))[0];
}

function repartirEnterosPonderado(total, pesos) {
  // pesos: { key: weight>=0 } → asigna enteros que suman total
  const claves = Object.keys(pesos);
  if (total <= 0 || !claves.length) return Object.fromEntries(claves.map(k=>[k,0]));
  const suma = claves.reduce((a,k)=> a + Math.max(0, pesos[k]||0), 0) || 1;
  const prelim = {};
  let asignados = 0;
  for (const k of claves) {
    const v = Math.max(0, pesos[k]||0);
    const x = Math.floor((v / suma) * total);
    prelim[k] = x; asignados += x;
  }
  // reparte restos por orden de mayor peso
  const restos = total - asignados;
  const orden = claves.sort((a,b)=> (pesos[b]||0) - (pesos[a]||0));
  for (let i=0;i<restos;i++) prelim[orden[i % orden.length]]++;
  return prelim;
}

function gastarPresupuesto(gameState, concepto, monto) {
  const m = Math.max(0, Math.floor(Number(monto)||0));
  gameState.budget = Math.max(0, Math.floor((Number(gameState.budget)||0) - m));
  // log opcional: console.log(`[BOT] Gasto ${concepto}: -${m} → budget=${gameState.budget}`)
  return m;
}

function estimarROIProducto(producto, ventasPrev, publiPrev) {
  // ROI simple: ventas/unidad de publicidad (evita división por 0)
  const v = Number(ventasPrev||0);
  const p = Math.max(1, Number(publiPrev||0));
  return v / p;
}

function estimarROICanal(ventasPorCanal, gastoPorCanal) {
  const scores = {};
  for (const canal of Object.keys(ventasPorCanal||{})) {
    const v = Number(ventasPorCanal[canal]||0);
    const g = Math.max(1, Number(gastoPorCanal?.[canal]||0));
    scores[canal] = v / g;
  }
  return scores;
}

function costoCanalUnitario(canal) {
  switch (canal) {
    case 'granDistribucion': return 75000;
    case 'minoristas': return 115000;
    case 'online': return 150000;
    case 'tiendaPropia': return 300000;
    default: return 100000;
  }
}

function preferenciasInicialesSegmento(marketData, segmento) {
  const pref = marketData.segmentos?.[segmento]?.canalPreferencias || {};
  // convierte % en pesos
  const pesos = {};
  for (const k of Object.keys(pref)) pesos[k] = Math.max(0, Number(pref[k]||0));
  return pesos;
}

function separarPreciosAntiCanibalizacion(decisionesProductos, delta = 0.07) {
  // Si dos productos apuntan al mismo segmento y tienen precio muy cercano, separa uno +delta
  const porSegmento = {};
  decisionesProductos.forEach((d,i)=>{
    porSegmento[d.segmento] ||= [];
    porSegmento[d.segmento].push({ idx:i, precio:d.precio });
  });
  for (const seg of Object.keys(porSegmento)) {
    const arr = porSegmento[seg];
    if (arr.length < 2) continue;
    arr.sort((a,b)=>a.precio-b.precio);
    for (let j=1;j<arr.length;j++) {
      const prev = arr[j-1];
      const cur = arr[j];
      if (Math.abs(cur.precio - prev.precio) / prev.precio < 0.05) {
        // separa el más caro un +delta
        decisionesProductos[cur.idx].precio = Math.round(decisionesProductos[cur.idx].precio * (1 + delta));
      }
    }
  }
}

// ========================= Motor principal =========================
function tomarDecisionesBot(botName, dificultad, gameState, marketData, resultadosUltimaRonda, options = {}) {
  const memory = ensureMemory(gameState);
  const productos = Array.isArray(gameState.products) ? gameState.products : [];
  const ventasPrev = extraerVentasPorProducto(botName, resultadosUltimaRonda);

  // ===== 1) Reevaluar segmento objetivo con inercia =====
  const decisionesTmp = [];
  for (const producto of productos) {
    const memProd = memory.productos[producto.nombre] ||= { segmentoObjetivo: null, ventasHist: [], precios: [], publi: [], roiPubli: [], roiCanal: {} };

    // rendimiento de la ronda previa
    const ventasUlt = ventasPrev[producto.nombre]?.unidadesVendidas || 0;
    memProd.ventasHist.push(ventasUlt);
    if (memProd.ventasHist.length > 8) memProd.ventasHist.shift();

    const mala = ventasUlt <= 0; // simple; podrías usar percentiles de segmento si quieres
    memory.rondasMalas[producto.nombre] = (memory.rondasMalas[producto.nombre]||0) + (mala ? 1 : -1);
    if (memory.rondasMalas[producto.nombre] < 0) memory.rondasMalas[producto.nombre] = 0;

    const fuerzaPivot = memory.rondasMalas[producto.nombre] >= 2;
    const segmentoObj = elegirSegmento(producto, marketData, memProd, fuerzaPivot);
    memProd.segmentoObjetivo = segmentoObj;

    decisionesTmp.push({ producto, memProd, segmento: segmentoObj });
  }

  // ===== 2) Precios (beneficio máx) =====
  const preciosCompetenciaPorSeg = {}; // segmento → precios ajenos (si necesitas, podrías extraer de resultadosUltimaRonda)
  const prelim = decisionesTmp.map(({ producto, memProd, segmento }) => {
    const preciosComp = preciosCompetenciaPorSeg[segmento] || [];
    return { producto, memProd, segmento, prec: optimizarPrecio(producto, segmento, marketData, dificultad, 0, preciosComp) };
  });

  // Anti-canibalización → separa un poco los precios si coinciden en segmento
  const decisionesPrecio = prelim.map(x => ({ segmento: x.segmento, precio: x.prec.precio }));
  separarPreciosAntiCanibalizacion(decisionesPrecio, 0.07);
  decisionesPrecio.forEach((dp, i) => { prelim[i].prec.precio = dp.precio; });

  // ===== 3) Producción (newsvendor) =====
  const decisiones = prelim.map(({ producto, memProd, segmento, prec }) => {
    const stock = Number(producto.stock||0);
    const unidadesFabricar = decidirProduccionNewsvendor(prec.precio, prec.coste, prec.demandaEsperada, stock);
    return { producto, memProd, segmento, ...prec, unidadesFabricar };
  });

  // ===== 4) Presupuesto: prioriza producción → publicidad → canales =====
  const presupuestoInicial = Number(gameState.budget||0);

  // 4.1 Producción (coste = coste * unidadesFabricar)
  for (const d of decisiones) {
    const costeProd = Math.max(0, Math.round(d.coste * d.unidadesFabricar));
    const pagado = gastarPresupuesto(gameState, `produccion:${d.producto.nombre}`, costeProd);
    if (pagado < costeProd) {
      // si no alcanzó, reduce unidades proporcionalmente
      const factor = pagado / (costeProd || 1);
      d.unidadesFabricar = Math.floor(d.unidadesFabricar * factor);
    }
  }

  // 4.2 Publicidad (bandit por producto)
  const roundHistory = Array.isArray(gameState.roundsHistory) ? gameState.roundsHistory : [];
  const lastSnap = roundHistory[roundHistory.length-1];
  const lastDecisiones = lastSnap?.decisiones?.products || [];

  const roiPorProducto = {};
  for (const d of decisiones) {
    const publicidadPrev = (lastDecisiones.find(p=> p && p.caracteristicas && (d.producto.nombre === d.producto.nombre))?.presupuestoPublicidad) || d.producto.publicidad || 0;
    const ventasUlt = ventasPrev[d.producto.nombre]?.unidadesVendidas || 0;
    roiPorProducto[d.producto.nombre] = estimarROIProducto(d.producto, ventasUlt, publicidadPrev);
  }

  const presupuestoRestante = Number(gameState.budget||0);
  const presupuestoPubli = Math.floor(presupuestoRestante * 0.35); // 35% del remanente
  const gastoPubli = repartirEnterosPonderado(presupuestoPubli, roiPorProducto);

  for (const d of decisiones) {
    d.publicidad = Math.floor(gastoPubli[d.producto.nombre] || 0);
    if (d.publicidad > 0) gastarPresupuesto(gameState, `publicidad:${d.producto.nombre}`, d.publicidad);
  }

  // 4.3 Canales (bandit por canal, con prior por preferencias de segmento)
  const canales = ['granDistribucion','minoristas','online','tiendaPropia'];
  const gastoCanalPrev = lastSnap?.decisiones?.canalesDistribucion || {};

  const ventasPorCanalTotales = canales.reduce((acc,c)=> (acc[c]=0, acc), {});
  for (const prod in ventasPrev) {
    const pc = ventasPrev[prod].porCanal || {};
    for (const c of Object.keys(pc)) ventasPorCanalTotales[c] = (ventasPorCanalTotales[c]||0) + Number(pc[c]||0);
  }

  const gastoPrevPorCanalEuros = {};
  for (const c of canales) {
    const unidades = Number(gastoCanalPrev[c]||0);
    gastoPrevPorCanalEuros[c] = unidades * costoCanalUnitario(c);
  }

  let roiCanal = estimarROICanal(ventasPorCanalTotales, gastoPrevPorCanalEuros);
  const prior = preferenciasInicialesSegmento(marketData, decisiones[0]?.segmento || 'granConsumidor');
  for (const c of canales) roiCanal[c] = (roiCanal[c]||0) + (prior[c]||0)/1000; // prior suave

  // número de "unidades de presencia" a comprar según budget restante
  const budgetCanales = Math.max(0, Number(gameState.budget||0));
  // coste mínimo por unidad es 75k → limitemos a no más de ~10 unidades totales para no quemar todo
  const maxUnidadesPosibles = Math.min(10, Math.floor(budgetCanales / 75000));
  const unidadesPorCanal = repartirEnterosPonderado(maxUnidadesPosibles, roiCanal);

  // Paga por canales y ajusta a lo que alcance
  const canalesDistribucion = {};
  for (const c of canales) {
    let unidades = Math.max(0, unidadesPorCanal[c]||0);
    const costeU = costoCanalUnitario(c);
    while (unidades > 0) {
      const pagado = gastarPresupuesto(gameState, `canal:${c}`, costeU);
      if (pagado < costeU) { unidades--; break; }
      canalesDistribucion[c] = (canalesDistribucion[c]||0) + 1;
      unidades--;
    }
  }

  // ===== 5) Volcar decisiones finales por producto =====
  const decisionesProductos = decisiones.map(d => ({
    caracteristicas: d.producto.caracteristicas,
    precio: d.precio,
    calidad: d.calidad,
    posicionamientoPrecio: d.posicionamientoPrecio,
    publicidad: d.publicidad || 0,
    unidadesFabricar: d.unidadesFabricar
  }));

  // Fallback si no se compró ninguna presencia de canal
  if (Object.keys(canalesDistribucion).length === 0) {
    const pref = preferenciasInicialesSegmento(marketData, decisiones[0]?.segmento || 'granConsumidor');
    const mejor = Object.keys(pref).sort((a,b)=> (pref[b]||0)-(pref[a]||0))[0] || 'minoristas';
    canalesDistribucion[mejor] = 1;
  }

  return { products: decisionesProductos, canalesDistribucion };
}

module.exports = { tomarDecisionesBot };
