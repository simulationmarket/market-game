document.addEventListener('DOMContentLoaded', function () {
  const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],  // ✅ permite fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});
  const ctxPrincipal = document.getElementById('consumoChart').getContext('2d');
  let consumoChart;

  // === MULTISALA + nombre del jugador ===
  const params = new URLSearchParams(location.search);
  const partidaId  = params.get('partidaId')  || localStorage.getItem('partidaId')  || 'default';
  const playerName = params.get('playerName') || localStorage.getItem('playerName') || null;

  function joinAndRequest() {
    socket.emit('joinGame', { partidaId, nombre: playerName || null });
    if (playerName) socket.emit('identificarJugador', playerName);
    socket.emit('getMarketData',       { partidaId });
    socket.emit('solicitarResultados', { partidaId });
  }
  joinAndRequest();
  socket.on('connect', joinAndRequest);

  // ----------- ESTADO -----------
  let demandaPorSegmento = {};   // de marketUpdate (Demanda)
  let consumoPorSegmento = {};   // de resultados* (Venta Neta)

  // ----------- COLORES / HELPERS -----------
  const coloresBase = {
    profesionales: 'rgba(54, 162, 235',
    altosIngresos: 'rgba(255, 206, 86',
    granConsumidor: 'rgba(75, 192, 192',
    bajosIngresos: 'rgba(255, 99, 132',
    innovadores: 'rgba(153, 102, 255'
  };
  const colorSeg = (seg, alpha = 0.9) => `${(coloresBase[seg] || 'rgba(200, 200, 200')}, ${alpha})`;

  const colors = {
    granDistribucion: 'rgba(54, 162, 235, 0.7)',
    minoristas: 'rgba(255, 206, 86, 0.7)',
    online: 'rgba(75, 192, 192, 0.7)',
    tiendaPropia: 'rgba(255, 99, 132, 0.7)'
  };

  const segmentCanvasIds = {
    profesionales: 'consumoProfesionales',
    altosIngresos: 'consumoAltosIngresos',
    granConsumidor: 'consumoGranConsumidor',
    bajosIngresos: 'consumoBajosIngresos',
    innovadores: 'consumoInnovadores'
  };
  const gastoCanvasIds = {
    profesionales: 'gastoProfesionales',
    altosIngresos: 'gastoAltosIngresos',
    granConsumidor: 'gastoGranConsumidor',
    bajosIngresos: 'gastoBajosIngresos',
    innovadores: 'gastoInnovadores'
  };
  const porcentajeCanvasIds = {
    profesionales: 'porcentajeProfesionales',
    altosIngresos: 'porcentajeAltosIngresos',
    granConsumidor: 'porcentajeGranConsumidor',
    bajosIngresos: 'porcentajeBajosIngresos',
    innovadores: 'porcentajeInnovadores'
  };

  const segmentCharts = {};
  const gastoCharts   = {};
  const porcentajeCharts = {};

  function generarColorPorProducto(producto = '') {
    const hash = [...producto].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const r = (hash * 37) % 255;
    const g = (hash * 67) % 255;
    const b = (hash * 97) % 255;
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  }

  // ========= MARKET UPDATE -> DEMANDA =========
  socket.on('marketUpdate', (marketData) => {
    if (!marketData) return;
    if (marketData.partidaId && marketData.partidaId !== partidaId) return;

    console.log('[consumo] Datos de mercado recibidos:', marketData);

    demandaPorSegmento = Object.fromEntries(
      Object.entries(marketData?.segmentos || {}).map(([seg, d]) => {
        const unidades = (typeof d?.unidades === 'number')
          ? d.unidades
          : ((parseFloat(d?.usuariosPotenciales) || 0) * ((parseFloat(d?.demandaAno1) || 0) / 100));
        return [seg, Math.round(unidades)];
      })
    );

    console.log('[consumo] Demanda por segmento:', demandaPorSegmento);
    renderOrUpdatePrincipal(); // pinta Demanda aunque aún no haya resultados
  });

  // ========= RESULTADOS (varios nombres posibles) =========
  function handleResultados(payloadRaw) {
    if (!payloadRaw) { renderOrUpdatePrincipal(); return; }
    if (!Array.isArray(payloadRaw) && payloadRaw.partidaId && payloadRaw.partidaId !== partidaId) return;

    const arr = Array.isArray(payloadRaw)
      ? payloadRaw
      : (payloadRaw.resultadosFinales || payloadRaw.resultados || payloadRaw.data || []);

    console.log('[consumo] Resultados finales recibidos:', arr);

    consumoPorSegmento = {};
    const consumoPorSegmentoYCanal = {};
    const gastoPorSegmentoYCanal   = {};
    const consumoPorSegmentoYProducto = {};

    (arr || []).forEach(data => {
      const segmento = data.segmento;
      const canal    = data.canal;
      const producto = data.producto;
      const unidades = parseFloat(data.unidadesNetas) || 0;
      const precio   = parseFloat(data.precio) || 0;

      // Totales por segmento
      consumoPorSegmento[segmento] = (consumoPorSegmento[segmento] || 0) + unidades;

      // Por canal
      if (!consumoPorSegmentoYCanal[segmento]) consumoPorSegmentoYCanal[segmento] = {};
      consumoPorSegmentoYCanal[segmento][canal] = (consumoPorSegmentoYCanal[segmento][canal] || 0) + unidades;

      // Gasto promedio
      if (!gastoPorSegmentoYCanal[segmento]) gastoPorSegmentoYCanal[segmento] = {};
      if (!gastoPorSegmentoYCanal[segmento][canal]) gastoPorSegmentoYCanal[segmento][canal] = { totalGasto: 0, totalUnidades: 0 };
      gastoPorSegmentoYCanal[segmento][canal].totalGasto += precio * unidades;
      gastoPorSegmentoYCanal[segmento][canal].totalUnidades += unidades;

      // % por producto
      if (!consumoPorSegmentoYProducto[segmento]) consumoPorSegmentoYProducto[segmento] = {};
      consumoPorSegmentoYProducto[segmento][producto] = (consumoPorSegmentoYProducto[segmento][producto] || 0) + unidades;
    });

    // Pintamos todo lo derivado
    renderOrUpdatePrincipal();
    renderChartsPorSegmento(consumoPorSegmentoYCanal);
    renderChartsGasto(gastoPorSegmentoYCanal);
    renderChartsPorcentaje(consumoPorSegmentoYProducto);
  }

  socket.on('resultadosFinales', handleResultados);
  socket.on('resultadosRonda',   handleResultados);
  socket.on('resultados',        handleResultados);
  socket.on('ventasCalculadas',  handleResultados);
  socket.on('consumoUpdate',     handleResultados);

  // ----------- Gráfico principal: Demanda + (si hay) Venta Neta -----------
  function renderOrUpdatePrincipal() {
    const segs = Array.from(new Set([
      ...Object.keys(demandaPorSegmento || {}),
      ...Object.keys(consumoPorSegmento || {})
    ]));
    if (!segs.length) return;

    const datosBrutos = segs.map(s => +demandaPorSegmento[s] || 0);
    const datosNetos  = segs.map(s => +consumoPorSegmento[s] || 0);
    const hayVentaNeta = datosNetos.some(v => v > 0);

    const datasets = [{
      label: 'Demanda',
      data: datosBrutos,
      backgroundColor: segs.map(s => colorSeg(s, 0.3)),
      borderWidth: 0,
      barThickness: 60,
      order: 1
    }];

    if (hayVentaNeta) {
      datasets.push({
        label: 'Venta Neta',
        data: datosNetos,
        backgroundColor: segs.map(s => colorSeg(s, 0.9)),
        borderColor:   segs.map(s => colorSeg(s, 1)),
        borderWidth: 1,
        barThickness: 60,
        order: 2
      });
    }

    if (consumoChart) {
      consumoChart.data.labels = segs;
      consumoChart.data.datasets = datasets;
      consumoChart.update('none');
    } else {
      consumoChart = new Chart(ctxPrincipal, {
        type: 'bar',
        data: { labels: segs, datasets },
        options: {
          indexAxis: 'x',
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            x: {
              stacked: false,
              title: { display: true, text: 'Segmentos', font: { size: 20 }, color: '#fff' },
              ticks:  { color: '#fff', font: { size: 16 } }
            },
            y: {
              stacked: false,
              beginAtZero: true,
              title: { display: true, text: 'Unidades por Segmento', font: { size: 20 }, color: '#fff' },
              ticks:  { color: '#fff', font: { size: 16 }, callback: v => Number(v).toLocaleString() }
            }
          },
          plugins: {
            legend: { labels: { font: { size: 18 }, color: '#fff' } },
            tooltip: {
              enabled: true,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw || 0).toLocaleString()} unidades`
              }
            }
          }
        }
      });
    }
  }

  // ----------- Por segmento: Consumo por canal -----------
  function renderChartsPorSegmento(consumoPorSegmentoYCanal) {
    Object.keys(segmentCanvasIds).forEach(segmento => {
      const el = document.getElementById(segmentCanvasIds[segmento]);
      if (!el) return;
      const ctx = el.getContext('2d');

      const dataPorCanal = consumoPorSegmentoYCanal[segmento] || {};
      const labels = Object.keys(dataPorCanal);
      const values = Object.values(dataPorCanal);

      if (segmentCharts[segmento]) segmentCharts[segmento].destroy();

      segmentCharts[segmento] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: `Consumo por Canal (${segmento})`,
            data: values,
            backgroundColor: labels.map(c => colors[c] || 'rgba(0,0,0,0.7)'),
            borderColor:     labels.map(c => colors[c] || 'rgba(0,0,0,1)'),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Unidades Netas Consumidas', font: { size: 14 }, color: '#fff' },
              ticks: { color: '#fff', callback: v => Number(v).toLocaleString() }
            },
            x: {
              title: { display: true, text: 'Canales de Distribución', font: { size: 14 }, color: '#fff' },
              ticks: { color: '#fff' }
            }
          },
          plugins: {
            legend: { labels: { font: { size: 12 }, color: '#fff' } },
            tooltip: { enabled: true }
          }
        }
      });
    });
  }

  // ----------- Por segmento: Gasto promedio por canal -----------
  function renderChartsGasto(gastoPorSegmentoYCanal) {
    Object.keys(gastoCanvasIds).forEach(segmento => {
      const el = document.getElementById(gastoCanvasIds[segmento]);
      if (!el) return;
      const ctx = el.getContext('2d');

      const dataPorCanal = gastoPorSegmentoYCanal[segmento] || {};
      const labels = Object.keys(dataPorCanal);
      const values = labels.map(canal => {
        const g = dataPorCanal[canal];
        return g.totalUnidades > 0 ? g.totalGasto / g.totalUnidades : 0;
      });

      if (gastoCharts[segmento]) gastoCharts[segmento].destroy();

      gastoCharts[segmento] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: `Gasto Promedio por Canal (${segmento})`,
            data: values,
            backgroundColor: labels.map(c => colors[c] || 'rgba(0,0,0,0.7)'),
            borderColor:     labels.map(c => colors[c] || 'rgba(0,0,0,1)'),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Precio Promedio', font: { size: 14 }, color: '#fff' },
              ticks: { color: '#fff', callback: v => Number(v).toFixed(2) }
            },
            x: {
              title: { display: true, text: 'Canales de Distribución', font: { size: 14 }, color: '#fff' },
              ticks: { color: '#fff' }
            }
          },
          plugins: {
            legend: { labels: { font: { size: 12 }, color: '#fff' } },
            tooltip: { enabled: true }
          }
        }
      });
    });
  }

  // ----------- Por segmento: % por producto -----------
  function renderChartsPorcentaje(consumoPorSegmentoYProducto) {
    Object.keys(porcentajeCanvasIds).forEach(segmento => {
      const el = document.getElementById(porcentajeCanvasIds[segmento]);
      if (!el) return;
      const ctx = el.getContext('2d');

      const data = consumoPorSegmentoYProducto[segmento] || {};
      const total = Object.values(data).reduce((a, b) => a + b, 0);
      const labels = Object.keys(data);
      const values = labels.map(p => total > 0 ? (data[p] / total) * 100 : 0);
      const colores = labels.map(generarColorPorProducto);

      if (porcentajeCharts[segmento]) porcentajeCharts[segmento].destroy();

      porcentajeCharts[segmento] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: `Porcentaje de Consumo (${segmento})`,
            data: values,
            backgroundColor: colores,
            borderColor: colores.map(c => c.replace('0.7', '1')),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'nearest', intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Porcentaje (%)', font: { size: 14 }, color: '#fff' },
              ticks: { color: '#fff', callback: v => `${Number(v).toFixed(0)}%` }
            },
            x: {
              title: { display: true, text: 'Productos', font: { size: 14 }, color: '#fff' },
              ticks: { color: '#fff' }
            }
          },
          plugins: {
            legend: { labels: { font: { size: 12 }, color: '#fff' } },
            tooltip: { enabled: true }
          }
        }
      });
    });
  }
});
