// sockets/market.js
const math = require('mathjs');

/** Convierte "y = ax^2 + bx + c" en una función JS */
function convertirCadenaAFuncion(cadena) {
  const expresion = cadena.replace('y =', '').trim();
  return new Function('x', `return ${expresion};`);
}

/** Extrae coeficientes (a,b,c) y vértice (xMax,yMax) de una función cuadrática f(x) */
function extraerCoeficientesDesdeFuncion(f) {
  try {
    const puntos = [0, 1, 2];
    const y_vals = puntos.map(x => f(x));
    const x_vals = puntos.map(x => [x ** 2, x, 1]);
    const inv = math.inv(x_vals);
    const [a, b, c] = math.multiply(inv, y_vals);

    let xMax = null, yMax = null;
    if (a !== 0) {
      xMax = -b / (2 * a);
      yMax = a * xMax * xMax + b * xMax + c;
    }
    return { a, b, c, xMax, yMax };
  } catch {
    return { a: 0, b: 0, c: 0, xMax: null, yMax: null };
  }
}

/** ===== Estado de mercado por partida =====
 * Usamos una fábrica para crear el estado de mercado de CADA partida.
 */
function createMarketData() {
  const data = {
    segmentos: {
      profesionales: {
        usuariosPotenciales: 12000000,
        demandaAno1: 5,
        get unidades() {
          return this.usuariosPotenciales * (this.demandaAno1 / 100);
        },
        get poblacionEsperada() {
          return this.usuariosPotenciales * 1.02; // +2%
        },
        demandaEsperada: 5,
        funcionSensibilidad: convertirCadenaAFuncion('y = -0.0159*(x**2) + 23.665*x - 8696.6'),
        productoIdeal: {
          pantalla: 17, procesador: 17, bateria: 20, placaBase: 16,
          ergonomia: 15, acabados: 14, color: 15, promedio: 15.71
        },
        costeProducto: {
          pantalla: 61, procesador: 38, bateria: 75, placaBase: 40,
          ergonomia: 22, acabados: 20, color: 46, ideal: 302
        },
        canalPreferencias: { granDistribucion: 15, minoristas: 60, online: 10, tiendaPropia: 15 },
        historial: []
      },
      altosIngresos: {
        usuariosPotenciales: 13000000,
        demandaAno1: 5,
        get unidades() {
          return this.usuariosPotenciales * (this.demandaAno1 / 100);
        },
        get poblacionEsperada() {
          return this.usuariosPotenciales * 1.02;
        },
        demandaEsperada: 5,
        funcionSensibilidad: convertirCadenaAFuncion('y = -0.017*(x**2) + 21.218*x - 6519.2'),
        productoIdeal: {
          pantalla: 13, procesador: 9, bateria: 10, placaBase: 7,
          ergonomia: 11, acabados: 16, color: 16, promedio: 12.43
        },
        costeProducto: {
          pantalla: 56, procesador: 27, bateria: 60, placaBase: 15,
          ergonomia: 22, acabados: 20, color: 49, ideal: 249
        },
        canalPreferencias: { granDistribucion: 5, minoristas: 10, online: 35, tiendaPropia: 50 },
        historial: []
      },
      granConsumidor: {
        usuariosPotenciales: 33000000,
        demandaAno1: 5,
        get unidades() {
          return this.usuariosPotenciales * (this.demandaAno1 / 100);
        },
        get poblacionEsperada() {
          return this.usuariosPotenciales * 1.02;
        },
        demandaEsperada: 5,
        funcionSensibilidad: convertirCadenaAFuncion('y = -0.0118*(x**2) + 6.5381*x - 802.5'),
        productoIdeal: {
          pantalla: 8, procesador: 6, bateria: 7, placaBase: 7,
          ergonomia: 9, acabados: 8, color: 8, promedio: 7.57
        },
        costeProducto: {
          pantalla: 48, procesador: 20, bateria: 35, placaBase: 15,
          ergonomia: 18, acabados: 20, color: 31, ideal: 187
        },
        canalPreferencias: { granDistribucion: 15, minoristas: 40, online: 25, tiendaPropia: 20 },
        historial: []
      },
      bajosIngresos: {
        usuariosPotenciales: 72000000,
        demandaAno1: 5,
        get unidades() {
          return this.usuariosPotenciales * (this.demandaAno1 / 100);
        },
        get poblacionEsperada() {
          return this.usuariosPotenciales * 1.02;
        },
        demandaEsperada: 5,
        funcionSensibilidad: convertirCadenaAFuncion('y = -0.027*(x**2) + 7.6114*x - 437.54'),
        productoIdeal: {
          pantalla: 3, procesador: 2, bateria: 3, placaBase: 2,
          ergonomia: 2, acabados: 2, color: 2, promedio: 2.29
        },
        costeProducto: {
          pantalla: 27, procesador: 15, bateria: 35, placaBase: 15,
          ergonomia: 11, acabados: 10, color: 14, ideal: 127
        },
        canalPreferencias: { granDistribucion: 40, minoristas: 25, online: 25, tiendaPropia: 10 },
        historial: []
      },
      innovadores: {
        usuariosPotenciales: 25000000,
        demandaAno1: 5,
        get unidades() {
          return this.usuariosPotenciales * (this.demandaAno1 / 100);
        },
        get poblacionEsperada() {
          return this.usuariosPotenciales * 1.02;
        },
        demandaEsperada: 5,
        funcionSensibilidad: convertirCadenaAFuncion('y = -0.0343*(x**2) + 27.429*x - 5386.9'),
        productoIdeal: {
          pantalla: 13, procesador: 11, bateria: 12, placaBase: 15,
          ergonomia: 16, acabados: 15, color: 12, promedio: 13.43
        },
        costeProducto: {
          pantalla: 50, procesador: 27, bateria: 60, placaBase: 40,
          ergonomia: 24, acabados: 20, color: 42, ideal: 263
        },
        canalPreferencias: { granDistribucion: 5, minoristas: 15, online: 50, tiendaPropia: 30 },
        historial: []
      }
    }
  };

  // Calcula y anexa coeficientes iniciales
  for (const seg of Object.keys(data.segmentos)) {
    const f = data.segmentos[seg].funcionSensibilidad;
    data.segmentos[seg].coeficientes = extraerCoeficientesDesdeFuncion(f);
  }

  return data;
}

/** ==================== Actualización de mercado ==================== */
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
  actualizarFuncionesSensibilidad(marketData, resultadosCache);
}

// ===== Helpers de actualización =====
function registrarHistorial(marketData, rondaActual) {
  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    const datosSegmento = marketData.segmentos[segmento];
    const coef = datosSegmento.coeficientes || extraerCoeficientesDesdeFuncion(datosSegmento.funcionSensibilidad);

    const snapshot = {
      ronda: rondaActual,
      usuariosPotenciales: datosSegmento.usuariosPotenciales,
      demandaAno1: datosSegmento.demandaAno1,
      demandaEsperada: datosSegmento.demandaEsperada,
      canalPreferencias: { ...datosSegmento.canalPreferencias },
      productoIdeal: { ...datosSegmento.productoIdeal },
      funcionString: datosSegmento.funcionSensibilidad?.toString(),
      coeficientes: coef
    };

    datosSegmento.historial.push(snapshot);
    console.log(`Historial actualizado para el segmento ${segmento}:`, snapshot);
  }
}

function actualizarUsuariosPotenciales(marketData) {
  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    const datosSegmento = marketData.segmentos[segmento];

    const variacionPorcentaje = Math.random() * (2 - 0.5) + 0.5; // 0.5% a 2%
    const factor = 1 + variacionPorcentaje / 100;
    datosSegmento.usuariosPotenciales = Math.round(datosSegmento.usuariosPotenciales * factor);

    console.log(
      `Segmento ${segmento} actualizado: Usuarios Potenciales: ${datosSegmento.usuariosPotenciales} (+${variacionPorcentaje.toFixed(2)}%)`
    );
  }
}

function ajustarDemandaAno1(marketData, resultadosCache) {
  const coberturaPorSegmento = calcularCoberturaPorSegmento(marketData, resultadosCache);

  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    const datosSegmento = marketData.segmentos[segmento];
    const c = coberturaPorSegmento[segmento.toLowerCase()]?.cobertura ?? 0;
    const coberturaDemanda = typeof c === 'number' ? c : parseFloat(c); // ★ asegurar número

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

function ajustarPreferenciasDeCanal(marketData, resultadosCache) {
  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    const datosSegmento = marketData.segmentos[segmento];
    const preferenciasPrevias = { ...datosSegmento.canalPreferencias };

    const satisfaccionCanales = {};
    const demandaEsperadaPorCanal = {};
    let seRegistraronVentas = false;
    let todaDemandaCubierta = true;

    for (const canal in preferenciasPrevias) {
      if (!Object.prototype.hasOwnProperty.call(preferenciasPrevias, canal)) continue;
      satisfaccionCanales[canal] = 0;
      demandaEsperadaPorCanal[canal] =
        (preferenciasPrevias[canal] / 100) *
        datosSegmento.usuariosPotenciales *
        (datosSegmento.demandaAno1 / 100);
    }

    console.log(`Segmento ${segmento} - Demanda esperada por canal:`, demandaEsperadaPorCanal);

    resultadosCache.forEach(({ canal, segmento: segResultado, unidadesVendidas }) => {
      if (segmento === segResultado && satisfaccionCanales[canal] !== undefined) {
        const ventas = parseFloat(unidadesVendidas) || 0;
        satisfaccionCanales[canal] += ventas;
        if (ventas > 0) seRegistraronVentas = true;
      }
    });

    console.log(`Segmento ${segmento} - Satisfacción por canal:`, satisfaccionCanales);

    for (const canal in satisfaccionCanales) {
      if (!Object.prototype.hasOwnProperty.call(satisfaccionCanales, canal)) continue;
      if (demandaEsperadaPorCanal[canal] > 0) {
        const cobertura = (satisfaccionCanales[canal] / demandaEsperadaPorCanal[canal]) * 100;
        if (cobertura < 100) todaDemandaCubierta = false;
      }
    }

    console.log(`Segmento ${segmento} - Toda la demanda cubierta:`, todaDemandaCubierta);

    if (!seRegistraronVentas || todaDemandaCubierta) {
      console.log(`Segmento ${segmento} - Sin cambios en preferencias (ventas: ${seRegistraronVentas}, toda demanda cubierta: ${todaDemandaCubierta}).`);
      continue;
    }

    // Convertimos a coberturas %
    for (const canal in satisfaccionCanales) {
      if (!Object.prototype.hasOwnProperty.call(satisfaccionCanales, canal)) continue;
      if (demandaEsperadaPorCanal[canal] > 0) {
        satisfaccionCanales[canal] = (satisfaccionCanales[canal] / demandaEsperadaPorCanal[canal]) * 100;
      } else {
        satisfaccionCanales[canal] = 0;
      }
    }

    console.log(`Segmento ${segmento} - Cobertura por canal:`, satisfaccionCanales);

    const canalesOrdenados = Object.entries(satisfaccionCanales).sort((a, b) => b[1] - a[1]);

    // Ajustes ±2/±1 y clamp a [0,100]
    if (canalesOrdenados.length > 0) datosSegmento.canalPreferencias[canalesOrdenados[0][0]] = Math.max(0, Math.min(100, datosSegmento.canalPreferencias[canalesOrdenados[0][0]] + 2));
    if (canalesOrdenados.length > 1) datosSegmento.canalPreferencias[canalesOrdenados[1][0]] = Math.max(0, Math.min(100, datosSegmento.canalPreferencias[canalesOrdenados[1][0]] + 1));
    if (canalesOrdenados.length > 2) datosSegmento.canalPreferencias[canalesOrdenados[2][0]] = Math.max(0, Math.min(100, datosSegmento.canalPreferencias[canalesOrdenados[2][0]] - 1));
    if (canalesOrdenados.length > 3) datosSegmento.canalPreferencias[canalesOrdenados[3][0]] = Math.max(0, Math.min(100, datosSegmento.canalPreferencias[canalesOrdenados[3][0]] - 2));

    // Re-normaliza a 100 (con 1 decimal)
    const suma = Object.values(datosSegmento.canalPreferencias).reduce((a, b) => a + b, 0) || 1;
    for (const canal in datosSegmento.canalPreferencias) {
      if (!Object.prototype.hasOwnProperty.call(datosSegmento.canalPreferencias, canal)) continue;
      datosSegmento.canalPreferencias[canal] = parseFloat(((datosSegmento.canalPreferencias[canal] / suma) * 100).toFixed(1));
    }

    console.log(`Segmento ${segmento} actualizado: Preferencias de Canal:`, datosSegmento.canalPreferencias);
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

  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    console.log(`Procesando el segmento: ${segmento}`);
    const datosSegmento = marketData.segmentos[segmento];

    console.log(`Segmento ${segmento}: Producto ideal antes:`, JSON.stringify(datosSegmento.productoIdeal));

    const sumaCaracteristicas = {};
    let totalVentas = 0;

    const ventasSegmento = resultadosCache.filter(
      r => (r.segmento || '').toLowerCase() === segmento.toLowerCase()
    );

    ventasSegmento.forEach(({ producto, unidadesVendidas, jugador }) => {
      const unidades = parseFloat(unidadesVendidas);
      if (unidades <= 0) return;

      const nombreJugador = jugador?.trim()?.toLowerCase();
      if (!nombreJugador || !normalizedPlayers[nombreJugador]) return;

      const playerData = normalizedPlayers[nombreJugador];
      const productoData = playerData.gameState.products.find(p => p.nombre === producto);

      if (productoData && productoData.caracteristicas) {
        for (const [caracteristica, valor] of Object.entries(productoData.caracteristicas)) {
          sumaCaracteristicas[caracteristica] = (sumaCaracteristicas[caracteristica] || 0) + valor * unidades;
        }
        totalVentas += unidades;
      }
    });

    if (totalVentas > 0) {
      const promedioComprado = {};
      for (const [caracteristica, suma] of Object.entries(sumaCaracteristicas)) {
        promedioComprado[caracteristica] = suma / totalVentas;
      }

      for (const caracteristica in datosSegmento.productoIdeal) {
        if (promedioComprado[caracteristica] !== undefined && caracteristica !== 'promedio') {
          datosSegmento.productoIdeal[caracteristica] =
            (datosSegmento.productoIdeal[caracteristica] * 0.95) +
            (promedioComprado[caracteristica] * 0.05);
        }
      }

      // ★ recalcula promedio tras el ajuste
      const claves = Object.keys(datosSegmento.productoIdeal).filter(k => k !== 'promedio');
      const prom = claves.reduce((acc, k) => acc + Number(datosSegmento.productoIdeal[k] || 0), 0) / claves.length;
      datosSegmento.productoIdeal.promedio = Number(prom.toFixed(2));

      console.log(`Segmento ${segmento}: Nuevo producto ideal:`, JSON.stringify(datosSegmento.productoIdeal));
    } else {
      console.log(`Segmento ${segmento}: No hubo ventas registradas.`);
    }
  }
}

function actualizarFuncionesSensibilidad(marketData, resultadosCache) {
  console.log("Actualizando las funciones de sensibilidad para cada segmento...");

  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    const datosSegmento = marketData.segmentos[segmento];

    console.log(`\nProcesando segmento: ${segmento}`);

    if (!datosSegmento.funcionSensibilidad) {
      console.warn(`El segmento ${segmento} no tiene una función de sensibilidad definida.`);
      continue;
    }

    // Coeficientes actuales
    let { a, b, c, xMax, yMax } = extraerCoeficientesDesdeFuncion(datosSegmento.funcionSensibilidad);
    console.log(`Coeficientes extraídos: a=${a.toFixed(4)}, b=${b.toFixed(4)}, c=${c.toFixed(4)}`);
    if (xMax === null || yMax === null) {
      // fallback por si a=0
      xMax = 500;
      yMax = datosSegmento.funcionSensibilidad(xMax);
    } else {
      console.log(`x_max=${xMax.toFixed(2)}, y_max=${yMax.toFixed(2)}`);
    }

    const ventasSegmento = resultadosCache.filter(
      r => (r.segmento || '').toLowerCase() === segmento.toLowerCase()
    );

    const totalUnidades = ventasSegmento.reduce(
      (acc, { unidadesVendidas }) => acc + parseFloat(unidadesVendidas || 0),
      0
    );

    const totalDemanda = ventasSegmento.reduce(
      (acc, { demanda }) => acc + parseFloat(demanda || 0),
      0
    );

    const cobertura = totalDemanda > 0 ? totalUnidades / totalDemanda : 0;

    console.log(`Total demanda: ${totalDemanda}, Total ventas: ${totalUnidades}, Cobertura: ${cobertura.toFixed(2)}`);

    if (totalUnidades > 0) {
      const precioPromedioPonderado =
        ventasSegmento.reduce(
          (acc, { precio, unidadesVendidas }) =>
            acc + parseFloat(precio || 0) * parseFloat(unidadesVendidas || 0),
          0
        ) / totalUnidades;

      console.log(`Precio promedio ponderado: ${precioPromedioPonderado.toFixed(2)}`);

      // Mantener altura del pico (yMax) y mover vértice hacia precioCombinado
      const precioCombinado = (0.9 * xMax) + (0.1 * precioPromedioPonderado);
      console.log(`Precio combinado: ${precioCombinado.toFixed(2)}`);

      const aNuevo = a; // misma "curvatura" base
      const bNuevo = -2 * aNuevo * precioCombinado;
      const cNuevo = yMax - (aNuevo * Math.pow(precioCombinado, 2) + bNuevo * precioCombinado);

      console.log(`Coef ajustados: a=${aNuevo.toFixed(4)}, b=${bNuevo.toFixed(4)}, c=${cNuevo.toFixed(4)}`);

      datosSegmento.funcionSensibilidad = convertirCadenaAFuncion(
        `y = ${aNuevo.toFixed(4)}*(x**2) + ${bNuevo.toFixed(4)}*x + ${cNuevo.toFixed(4)}`
      );
      datosSegmento.coeficientes = { a: aNuevo, b: bNuevo, c: cNuevo, xMax: precioCombinado, yMax };
      console.log(`Función de sensibilidad actualizada: ${datosSegmento.funcionSensibilidad.toString()}`);
    } else {
      // Sin ventas: widen/narrow según cobertura estimada
      let aNuevo = a;
      if (cobertura < 0.33) {
        aNuevo *= 0.9; console.log("Curva ensanchada (Cobertura < 33%)");
      } else if (cobertura > 0.66) {
        aNuevo *= 1.1; console.log("Curva estrechada (Cobertura > 66%)");
      }

      const bNuevo = -2 * aNuevo * xMax; // mantenemos vértice en xMax previo
      const cNuevo = yMax - (aNuevo * Math.pow(xMax, 2) + bNuevo * xMax);

      console.log(`Coef ajustados (sin ventas): a=${aNuevo.toFixed(4)}, b=${bNuevo.toFixed(4)}, c=${cNuevo.toFixed(4)}`);

      datosSegmento.funcionSensibilidad = convertirCadenaAFuncion(
        `y = ${aNuevo.toFixed(4)}*(x**2) + ${bNuevo.toFixed(4)}*x + ${cNuevo.toFixed(4)}`
      );
      datosSegmento.coeficientes = { a: aNuevo, b: bNuevo, c: cNuevo, xMax, yMax };
      console.log(`Función de sensibilidad actualizada (sin ventas): ${datosSegmento.funcionSensibilidad.toString()}`);
    }
  }
}

function calcularCoberturaPorSegmento(marketData, resultadosCache) {
  const coberturaPorSegmento = {};

  // Inicializa por segmento con estado previo
  for (const segmento in marketData.segmentos) {
    if (!Object.prototype.hasOwnProperty.call(marketData.segmentos, segmento)) continue;
    const datosSegmento = marketData.segmentos[segmento];
    const usuariosPrev = datosSegmento.usuariosPotenciales;
    const demandaPrev = datosSegmento.demandaAno1;

    coberturaPorSegmento[segmento.toLowerCase()] = {
      unidadesVendidas: 0,
      demandaEsperada: usuariosPrev * (demandaPrev / 100),
      cobertura: 0
    };
  }

  console.log("Cobertura inicial:", coberturaPorSegmento);

  resultadosCache.forEach(({ segmento, unidadesVendidas }) => {
    const key = (segmento || '').toLowerCase();
    if (coberturaPorSegmento[key]) {
      const unidades = parseFloat(unidadesVendidas) || 0;
      coberturaPorSegmento[key].unidadesVendidas += unidades;
      console.log(`Segmento: ${key}, Unidades Vendidas Acumuladas: ${coberturaPorSegmento[key].unidadesVendidas}`);
    } else {
      console.warn(`Segmento no encontrado en coberturaPorSegmento: ${segmento}`);
    }
  });

  for (const segmento in coberturaPorSegmento) {
    const { unidadesVendidas, demandaEsperada } = coberturaPorSegmento[segmento];
    const coberturaNum = demandaEsperada > 0 ? (unidadesVendidas / demandaEsperada) * 100 : 0;
    coberturaPorSegmento[segmento].cobertura = Math.min(100, Math.round(coberturaNum * 100) / 100); // número con 2 decimales
    console.log(
      `Cobertura Calculada para ${segmento}: Unidades = ${unidadesVendidas}, Demanda = ${demandaEsperada}, Cobertura = ${coberturaPorSegmento[segmento].cobertura}%`
    );
  }

  return coberturaPorSegmento;
}

/** ==================== Sockets de mercado (multi-partida) ==================== */
const handleMarketSockets = (io, registry) => {
  io.on('connection', (socket) => {
    console.log('Nueva conexión de cliente (market)');

    socket.on('getMarketData', (payload = {}) => {
      const partidaId = payload.partidaId || socket.data?.partidaId || 'default';
      const partida = registry.getOrCreatePartida(partidaId);

      // Inicializa marketData de la partida si aún no existe
      if (!partida.marketData || !partida.marketData.segmentos) {
        partida.marketData = createMarketData();
      }

      console.log(`Enviando datos del mercado [${partidaId}]`);

      // Serializar funciones + coeficientes antes de emitir (el cliente no puede ejecutar funciones directamente)
      const marketDataSerializado = {
        ...partida.marketData,
        segmentos: Object.fromEntries(
          Object.entries(partida.marketData.segmentos).map(([segmento, datos]) => [
            segmento,
            {
              ...datos,
              funcionSensibilidad: datos.funcionSensibilidad?.toString(),
              coeficientes: datos.coeficientes || extraerCoeficientesDesdeFuncion(datos.funcionSensibilidad)
            }
          ])
        )
      };

      // Enviar solo a este socket (si quieres broadcast, usa io.to(`partida:${partidaId}`).emit)
      socket.emit('marketUpdate', marketDataSerializado);
    });
  });
};

// ===== Exports =====
module.exports = {
  createMarketData,
  actualizarMercado,
  handleMarketSockets,
};
