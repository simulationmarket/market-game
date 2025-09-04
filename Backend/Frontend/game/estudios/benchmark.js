document.addEventListener('DOMContentLoaded', function () {
  const socket = io();

  // Plugin Chart.js (como en tu versión original)
  Chart.register(ChartDataLabels);

  // Colores por segmento
  const colors = {
    profesionales: 'rgba(54, 162, 235, 1)', // Azul
    altosIngresos: 'rgba(255, 206, 86, 1)', // Amarillo
    granConsumidor: 'rgba(75, 192, 192, 1)', // Verde
    bajosIngresos: 'rgba(255, 99, 132, 1)', // Rojo
    innovadores: 'rgba(153, 102, 255, 1)'  // Púrpura
  };
  let posicionamientoChartInstance = null;
  const posicionamientoData = [];
  const productosData = [];
  let preciosChartInstance = null; // instancia del chart de precios por jugador
  


  // 👉 Opción B: solo procesamos el PRÓXIMO 'todosLosEstados' tras cada 'marketUpdate'
  let esperandoEstados = false;

  // --- MERCADO (segmentos) ---
  socket.emit('getMarketData'); // como en tu archivo inicial

  socket.on('marketUpdate', (data) => {
    console.log('Datos de mercado recibidos:', data);

    const segmentos = data.segmentos || {};
    posicionamientoData.length = 0; // reset

    for (const segmento in segmentos) {
      if (!segmentos.hasOwnProperty(segmento)) continue;
      const datosSegmento = segmentos[segmento];

      // === MISMO PARSEO QUE TENÍAS ANTES ===
      const funcionTexto = String(datosSegmento.funcionSensibilidad || '')
        .replace('function anonymous', 'function');

      const coeficientes = funcionTexto.match(/-?\d+(\.\d+)?/g); // como tu versión
      if (coeficientes && coeficientes.length >= 3) {
        const a = parseFloat(coeficientes[0]); // x^2
        const b = parseFloat(coeficientes[1]); // x
        const c = parseFloat(coeficientes[2]); // indep.

        // ⚠️ Dejamos tu fórmula original (que te “funcionaba” con tu parseo)
        const xMax = -c / (2 * a);

        const valoresProductoIdeal = Object.values(datosSegmento.productoIdeal || {});
        const calidadPromedio = valoresProductoIdeal.length
          ? valoresProductoIdeal.reduce((ac, v) => ac + (parseFloat(v) || 0), 0) / valoresProductoIdeal.length
          : 0;

        posicionamientoData.push({
          x: xMax * 0.02,  // misma escala visual
          y: calidadPromedio,
          label: segmento,
          backgroundColor: colors[segmento],
          pointStyle: 'circle'
        });
      } else {
        console.error(`Error al extraer coeficientes para el segmento: ${segmento}`);
      }
    }

    // Pintar SIEMPRE segmentos
    renderPosicionamientoChart([...posicionamientoData]);

    // 👉 Opción B: SIEMPRE pedimos estados al llegar cualquier marketUpdate
    esperandoEstados = true;                   // solo aceptaremos el PRÓXIMO 'todosLosEstados'
    socket.emit('solicitarEstadosJugadores');  // pedimos snapshot actual de jugadores
  });

  // --- ESTADOS (productos de jugadores) ---
  socket.on('todosLosEstados', (estados = []) => {
    // Ignora cualquier 'todosLosEstados' que no sea el pedido por el último 'marketUpdate'
    if (!esperandoEstados) {
      console.log('[Benchmark] Ignorando estados (no solicitados tras marketUpdate)');
      return;
    }
    esperandoEstados = false; // consumimos esta respuesta

    console.log('Estados de jugadores recibidos:', estados);
    productosData.length = 0; // limpiar puntos de productos

    if (!Array.isArray(estados) || estados.length === 0) {
      renderPosicionamientoChart([...posicionamientoData]); // solo segmentos
      renderPrecioPorJugador([]);
      return;
    }

    // Añadir puntos de productos (SOLO si el precio > 0)
    estados.forEach(estado => {
      const productos = Array.isArray(estado.products) ? estado.products : [];
      productos.forEach(producto => {
        const ajustadas = producto?.caracteristicasAjustadas || producto?.caracteristicas || {};
        const vals = Object.values(ajustadas).map(v => parseFloat(v) || 0);
        const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

        // Precio válido: primero precioPercibido, luego pvp, luego precio
        const precioBase = [producto?.precioPercibido, producto?.pvp, producto?.precio]
          .find(v => typeof v === 'number' && isFinite(v) && v > 0);

        // ⛔ Si no hay precio > 0, NO pintamos el punto (evita pegotear al eje X en ronda 0)
        if (typeof precioBase !== 'number') return;

        productosData.push({
          x: precioBase * 0.02,
          y: avg,
          label: producto?.nombre || 'Producto',
          backgroundColor: 'rgba(255, 255, 255, 1)',
          pointStyle: 'rectRot'
        });
      });
    });

    // Render con segmentos + productos
    renderPosicionamientoChart([...posicionamientoData, ...productosData]);
    renderPrecioPorJugador(estados);
  });

  function renderPosicionamientoChart(data) {
  const canvas = document.getElementById('posicionamientoChart');
  if (!canvas) return;

  // 🔧 Destruye el chart anterior si existe
  if (posicionamientoChartInstance) {
    posicionamientoChartInstance.destroy();
    posicionamientoChartInstance = null;
  }

  const ctx = canvas.getContext('2d');
  posicionamientoChartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: data.map(d => ({
        label: d.label,
        data: [{ x: d.x, y: d.y }],
        backgroundColor: d.backgroundColor,
        borderColor: d.backgroundColor,
        pointRadius: 6,
        pointStyle: d.pointStyle
      }))
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const dataset = context.dataset;
              const punto = dataset.data[context.dataIndex];
              return `${dataset.label}: (Precio: ${Number(punto.x).toFixed(2)}, Calidad: ${Number(punto.y).toFixed(2)})`;
            }
          }
        },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'end',
          color: 'white',
          font: { weight: 'bold' },
          formatter: (_value, ctx) => ctx.dataset.label
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Precio (X)', color: 'white', font: { weight: 'bold' } },
          min: 0,
          max: 20,
          ticks: { stepSize: 1, color: 'white' },
          grid: {
            color: (ctx) => ctx.tick.value === 10 ? 'white' : 'rgba(255, 255, 255, 0.2)',
            lineWidth: (ctx) => ctx.tick.value === 10 ? 2 : 1,
            borderColor: 'white'
          }
        },
        y: {
          title: { display: true, text: 'Calidad (Y)', color: 'white', font: { weight: 'bold' } },
          min: 0,
          max: 20,
          ticks: { stepSize: 1, color: 'white' },
          grid: {
            color: (ctx) => ctx.tick.value === 10 ? 'white' : 'rgba(255, 255, 255, 0.2)',
            lineWidth: (ctx) => ctx.tick.value === 10 ? 2 : 1,
            borderColor: 'white'
          }
        }
      }
    }
  });
}
const renderPrecioPorJugador = (jugadores = []) => {
  const container = document.getElementById('precios-container') || document.getElementById('precioPorJugador');
  if (!container) return;

  // === medir el bloque de Posicionamiento ===
  // intentamos leer el wrapper del scatter (".chart-item"); si no, el parent del canvas
  const posCanvas = document.getElementById('posicionamientoChart');
  const posWrapper = posCanvas ? (posCanvas.closest('.chart-item') || posCanvas.parentElement) : null;
  const rect = posWrapper ? posWrapper.getBoundingClientRect()
                          : (posCanvas ? posCanvas.getBoundingClientRect() : { width: 960, height: 480 });

  const targetWidth  = Math.max(Math.round(rect.width  || 960), 600);
  const targetHeight = Math.max(Math.round(rect.height || 480), 320);

// --- CONTENEDOR: céntralo y evita límites del padre ---
container.innerHTML = '';
container.style.display = 'flex';
container.style.justifyContent = 'center';
container.style.alignItems = 'stretch';
container.style.width = '100%';
container.style.maxWidth = 'none';
container.style.margin = '0';
container.style.boxSizing = 'border-box';

// Si el padre es CSS Grid y te mete en una columna estrecha,
// haz que este bloque ocupe TODAS las columnas:
container.style.gridColumn = '1 / -1';

// --- WRAPPER "card" negro con tamaño FIJO (no se reduce en flex/grid) ---
const wrapper = document.createElement('div');
wrapper.className = 'chart-item';
wrapper.style.background   = '#000';
wrapper.style.borderRadius = '16px';
wrapper.style.padding      = '16px';
wrapper.style.boxShadow    = '0 4px 16px rgba(0,0,0,0.35)';

// Igualamos EXACTAMENTE al tamaño del bloque de Posicionamiento:
wrapper.style.width   = `${targetWidth}px`;
wrapper.style.minWidth= `${targetWidth}px`;
wrapper.style.maxWidth= `${targetWidth}px`;
wrapper.style.height  = `${targetHeight}px`;

// Clave para flex: tamaño fijo, NO shrink
wrapper.style.flex = `0 0 ${targetWidth}px`;
wrapper.style.alignSelf = 'center';
wrapper.style.boxSizing = 'border-box';

// Canvas a 100% del wrapper
const canvas = document.createElement('canvas');
canvas.style.width = '100%';
canvas.style.height = '100%';
wrapper.appendChild(canvas);
container.appendChild(wrapper);

// Ajusta los atributos reales para nitidez retina
canvas.width  = wrapper.clientWidth;
canvas.height = wrapper.clientHeight;

  const predefinedColors = [
    'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)',
    'rgba(201, 203, 207, 1)'
  ];

  // productos únicos
  const productos = [];
  jugadores.forEach(j => (j.products || []).forEach(p => {
    if (!productos.includes(p.nombre)) productos.push(p.nombre);
  }));

  // datasets por jugador
  const datasets = jugadores.map((jugador, index) => {
    const color = predefinedColors[index % predefinedColors.length];
    const data = productos.map(nombreBuscado => {
      const p = (jugador.products || []).find(pp => pp.nombre === nombreBuscado);
      const precio =
        (typeof p?.precioPercibido === 'number' && p.precioPercibido > 0) ? p.precioPercibido :
        (typeof p?.pvp === 'number' && p.pvp > 0) ? p.pvp :
        (typeof p?.precio === 'number' && p.precio > 0) ? p.precio :
        null;
      return precio;
    });

    return {
      label: jugador.nombre || jugador.playerName || `Jugador ${index + 1}`,
      data,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1
    };
  });

  // destruir instancia previa si existe
  if (preciosChartInstance) {
    preciosChartInstance.destroy();
    preciosChartInstance = null;
  }

  // crear chart respetando el tamaño del wrapper (mismo que Posicionamiento)
  preciosChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: productos, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false, // respeta width/height del contenedor
      plugins: {
        legend: { position: 'top', labels: { color: 'white' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const valor = ctx.raw;
              if (valor == null) return `${ctx.dataset.label}: —`;
              return `${ctx.dataset.label}: ${Number(valor).toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.2)' } },
        y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.2)' } }
      }
    }
  });
};



  // Conexión (como en tu archivo)
  socket.on('connect', () => {
    console.log('Conectado al servidor. Solicitando resultados...');
    socket.emit('solicitarResultados');
  });

  // Resultados finales (sin tocar)
  socket.on('resultadosFinales', (resultadosFinales) => {
    console.log('Resultados finales recibidos:', resultadosFinales);
    const canales = ['granDistribucion', 'minoristas', 'online', 'tiendaPropia'];
    const cuotasPorCanal = {};
    canales.forEach(canal => { cuotasPorCanal[canal] = {}; });

    resultadosFinales.forEach(({ jugador, canal, unidadesVendidas }) => {
      if (!canal || !jugador || isNaN(parseFloat(unidadesVendidas))) return;
      if (!cuotasPorCanal[canal][jugador]) { cuotasPorCanal[canal][jugador] = 0; }
      cuotasPorCanal[canal][jugador] += parseFloat(unidadesVendidas);
    });

    console.log('Cuotas calculadas por canal:', cuotasPorCanal);
    renderCuotasPorCanal(canales, cuotasPorCanal);
  });

  function renderCuotasPorCanal(canales, cuotasPorCanal) {
    const predefinedColors = [
      'rgba(28, 13, 224, 0.79)', 'rgba(206, 160, 44, 0.73)', 'rgba(60, 223, 223, 0.84)',
      'rgba(255, 99, 132, 0.6)', 'rgba(124, 64, 243, 0.72)', 'rgba(235, 125, 15, 0.6)',
      'rgba(35, 118, 212, 0.93)'
    ];

    canales.forEach((canal, index) => {
      const canalId = `canal${index + 1}Chart`;
      const container = document.getElementById(canalId);
      if (!container) return;

      const total = Object.values(cuotasPorCanal[canal]).reduce((a, b) => a + b, 0);
      if (total === 0) return;

      const labels = Object.keys(cuotasPorCanal[canal]);
      const data = labels.map(j => (cuotasPorCanal[canal][j] / total) * 100);
      const bg = labels.map((_, i) => predefinedColors[i % predefinedColors.length]);
      const bd = labels.map((_, i) => predefinedColors[i % predefinedColors.length].replace('0.6', '1'));

      try {
        if (container._chartInstance) {
  container._chartInstance.destroy();
  container._chartInstance = null;
}

container._chartInstance = new Chart(container.getContext('2d'), {
          type: 'bar',
          data: { labels, datasets: [{ label: `Cuota de Canal (${canal})`, data, backgroundColor: bg, borderColor: bd, borderWidth: 1 }] },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => `${ctx.raw.toFixed(2)}%` } },
              datalabels: {
                anchor: 'end', align: 'start', color: 'white',
                formatter: (v) => `${v.toFixed(2)}%`
              }
            },
            scales: {
              x: { title: { display: true, text: 'Jugadores', color: 'white', font: { weight: 'bold' } }, ticks: { color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.2)', borderColor: 'white' } },
              y: { title: { display: true, text: 'Cuota (%)', color: 'white', font: { weight: 'bold' } }, ticks: { color: 'white', beginAtZero: true }, grid: { color: 'rgba(255, 255, 255, 0.2)', borderColor: 'white' } }
            }
          },
          plugins: [ChartDataLabels]
        });
      } catch (error) {
        console.error(`Error al crear el gráfico para ${canal}:`, error);
      }
    });
  }
});
