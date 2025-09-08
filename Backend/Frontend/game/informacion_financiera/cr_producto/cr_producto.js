'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Esta subpantalla se conecta sola
    window.DISABLE_GLOBAL_SOCKET = true;
    window.DISABLE_POLLING = true;

    const qs = new URLSearchParams(location.search);
    const partidaId  = qs.get('partidaId')  || localStorage.getItem('partidaId')  || '';
    const playerName = qs.get('playerName') || localStorage.getItem('playerName') || '';
    if (partidaId)  localStorage.setItem('partidaId', partidaId);
    if (playerName) localStorage.setItem('playerName', playerName);

    const LOG = '[CR-PROD]';
    if (!('io' in window)) { console.error(LOG, 'socket.io no cargado'); return; }

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 20000
    });
    window.__sockCRP = socket;

    // ===== DIAGNÓSTICO GLOBAL =====
    try {
      socket.onAny?.((event, ...args) => {
        if (['ping','pong','connect','disconnect'].includes(event)) return;
        console.debug(LOG, 'onAny <-', event, args?.[0], { extraCount: args.length - 1 });
      });
    } catch {}

    // Estado
    let roundsHistory = [];
    let resultados = [];
    let syncData = null;
    let gotSync = false;
    let gotRes  = false;

    // Utils
    const norm = s => String(s ?? '').trim().toLowerCase();
    const n = v => Number(v) || 0;
    const num = (row, ...keys) => {
      for (const k of keys) {
        const v = row?.[k];
        if (v != null && v !== '') {
          const x = Number(v);
          if (!Number.isNaN(x)) return x;
        }
      }
      return 0;
    };

    const getRowPlayer = (row={}) =>
      row.jugador ?? row.empresa ?? row.nombreJugador ?? row.jugadorNombre ?? row.player ?? row.playerName ?? row.company;

    const getRowProducto = (row={}) =>
      row.producto ?? row.product ?? row.nombreProducto ?? row.productName;

    const matchesPlayer = (row, name) => {
      const a = norm(getRowPlayer(row));
      const b = norm(name);
      return a === b || a.includes(b) || b.includes(a);
    };

    const maybeRender = () => { if (gotSync && gotRes) tryRender(); };

    // Conexión
    socket.on('connect', () => {
      console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
      socket.emit('joinGame', { partidaId, nombre: playerName });
      socket.emit('identificarJugador', playerName);

      // Pedimos todas las variantes conocidas
      socket.emit('solicitarResultados',          { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
      socket.emit('solicitarResultadosFinales',   { partidaId, playerName });

      setTimeout(() => {
        socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
        socket.emit('solicitarResultadosFinales',   { partidaId, playerName });
      }, 1500);
    });

    socket.on('connect_error', e => console.error(LOG, 'connect_error', e?.message || e));

    // Sync de jugador
    function handleSync(d = {}) {
      syncData = d;
      roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : [];
      window.__roundsHistory = roundsHistory;
      gotSync = true;
      console.log(LOG, 'syncPlayerData rounds:', roundsHistory.length);
      maybeRender();
    }
    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador',    handleSync);

    // Extracción de arrays
    function extractArray(payload) {
      if (Array.isArray(payload)) return payload;
      if (!payload || typeof payload !== 'object') return [];
      const candidates = ['resultados','resultadosCompletos','resultadosFinales','data','rows','ventas','items','list','filas','productos'];
      for (const k of candidates) if (Array.isArray(payload[k])) return payload[k];
      if (payload.data && typeof payload.data === 'object') {
        for (const k of candidates) if (Array.isArray(payload.data[k])) return payload.data[k];
      }
      return [];
    }

    // Preferimos FINALES; COMPLETOS sólo si no hay nada
    function applyResultados(arr, source) {
      if (!arr?.length) return;
      if (source === 'finales') {
        resultados = arr;
      } else if (!resultados.length) {
        resultados = arr;
      }
      gotRes = true;
      console.log(LOG, `aplicados (${source}) filas:`, resultados.length);
      maybeRender();
    }

    function handleResultados(payload) {
      const arr = extractArray(payload);
      console.log(LOG, 'resultadosCompletos filas:', arr.length);
      applyResultados(arr, 'completos');
    }
    socket.on('resultadosCompletos', handleResultados);
    socket.on('resultados',          handleResultados);
    socket.on('ventasCompletas',     handleResultados);

    function handleResultadosFinales(payload) {
      const arr = extractArray(payload);
      if (arr?.length) console.log(LOG, 'keys primera fila:', Object.keys(arr[0]));
      console.log(LOG, 'resultadosFinales filas:', arr.length);
      applyResultados(arr, 'finales');
    }
    socket.on('resultadosFinales', handleResultadosFinales);
    socket.on('resumenResultados', handleResultadosFinales);

    // Construye mapas de publicidad y coste unitario (prioriza costeUnitarioReal)
    function buildPubCostMaps(roundData, syncData) {
      const pubMap = {};
      const costMap = {};
      const addFromList = (list = []) => {
        list.forEach(p => {
          const name = p?.nombre || p?.productName;
          if (!name) return;
          const k = norm(name);

          if (pubMap[k] == null) {
            const pub = Number(p.presupuestoPublicidad ?? p.publicidad);
            if (!Number.isNaN(pub)) pubMap[k] = pub;
          }
          if (costMap[k] == null) {
            const cu = p.costeUnitarioReal ?? p.costeUnitarioEst ?? p.costeUnitario ?? p.costUnit;
            const cuNum = Number(cu);
            if (!Number.isNaN(cuNum)) costMap[k] = cuNum;
          }
        });
      };

      addFromList(roundData?.decisiones?.products || roundData?.roundDecisions?.products || []);
      addFromList(syncData?.products || []);
      return { pubMap, costMap };
    }

    // RENDER
    function tryRender() {
      if (!playerName) { emptyState('Falta playerName en la URL o localStorage.'); return; }
      if (!resultados.length) { emptyState('Sin datos para tu jugador/productos todavía.'); return; }

      // Filas del jugador
      let filas = resultados.filter(r => matchesPlayer(r, playerName));

      // Fallback por productos del jugador (última ronda)
      const last = roundsHistory[roundsHistory.length - 1];
      if (filas.length === 0 && last?.decisiones?.products?.length) {
        const mySet = new Set((last.decisiones.products || []).map(p => norm(p?.nombre)).filter(Boolean));
        filas = resultados.filter(r => mySet.has(norm(getRowProducto(r))));
      }
      if (filas.length === 0) { emptyState('Recibimos resultados, pero ninguno coincide con tu jugador o productos.'); return; }

      const consol = consolidarPorProducto(filas, roundsHistory[roundsHistory.length - 1] || {});
      generarTabla(consol);
      generarGrafico(consol);
    }

    function emptyState(msg) {
      const cont = document.getElementById('tabla-contenedor');
      if (cont) cont.innerHTML = `<p>${msg}</p>`;
      const canvas = document.getElementById('gastosProductoChart');
      if (canvas?.getContext) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    }

    function consolidarPorProducto(filasJugador, roundData) {
      const { pubMap, costMap } = buildPubCostMaps(roundData, syncData);

      const porProducto = {};
      const totJugador = {
        facturacionBruta: 0,
        facturacionNeta:  0,
        costeVentas:      0,
        margenBruto:      0,
        gastosComerciales:0,
        gastosPublicidad: 0,
        costesAlmacenaje: 0,
        gastosFinancieros:0,
        impuestos:        0,
        resultadoNeto:    0
      };

      filasJugador.forEach(r => {
        const prodName = getRowProducto(r);
        if (!prodName) return;

        const key = prodName;
        porProducto[key] ||= {
          producto: prodName,
          facturacionBruta: 0,
          devoluciones:     0,
          facturacionNeta:  0,
          costeVentas:      0,
          margenBruto:      0,
          gastosComerciales:0,
          gastosPublicidad: 0,
          costesAlmacenaje: 0,
          BAII:             0,
          gastosFinancieros: 0,
          BAI:              0,
          impuestos:        0,
          resultadoNeto:    0
        };

        const c = porProducto[key];

        // Valores primarios de resultadosFinales
        const precio       = num(r, 'precio','price');
        const udsVendidas  = num(r, 'unidadesVendidas');
        const udsDevueltas = num(r, 'unidadesDevueltas');
        const udsNetas     = num(r, 'unidadesNetas');
        const excedenteUds = num(r, 'excedente','stockExcedente','exceso');

        // Facturación derivada si falta
        let factBruta = num(r, 'facturacionBruta','ingresosBrutos','facturacion_total','ventasBrutas','facturacion','ingresos');
        let factNeta  = num(r, 'facturacionNeta','ingresos','ventasNetas','netRevenue');
        if (!factBruta && precio && udsVendidas) factBruta = precio * udsVendidas;
        if (!factNeta  && precio && udsNetas)   factNeta  = precio * udsNetas;

        // Coste de ventas: backend o coste unitario × uds netas (prioriza costeUnitarioReal)
        const costUnit = costMap[norm(prodName)] || 0;
        let coste = num(r, 'costeVentasProducto','costeVentas','costoVentas','cost_of_goods','cogs');
        if (!coste && costUnit && udsNetas) coste = costUnit * udsNetas;

        // Margen: si no viene, neta - coste
        let margen = num(r, 'margenBrutoProducto','margenBruto','grossMargin','margen');
        if (!margen) margen = factNeta - (coste || 0);

        // Devoluciones en €
        const devolucionesImporte = (factBruta && factNeta) ? (factBruta - factNeta)
          : (precio && udsDevueltas) ? (precio * udsDevueltas) : 0;

        // Acumulados
        c.facturacionBruta += factBruta;
        c.facturacionNeta  += factNeta;
        c.costeVentas      += coste;
        c.margenBruto      += margen;
        c.devoluciones     += Math.max(0, devolucionesImporte);
        c.costesAlmacenaje += excedenteUds * 20;

        totJugador.facturacionBruta += factBruta;
        totJugador.facturacionNeta  += factNeta;
        totJugador.costeVentas      += coste;
        totJugador.margenBruto      += margen;
        totJugador.costesAlmacenaje += excedenteUds * 20;
      });

      // Publicidad por nombre
      Object.values(porProducto).forEach(c => {
        c.gastosPublicidad = pubMap[norm(c.producto)] || 0;
        totJugador.gastosPublicidad += c.gastosPublicidad;
      });

      // Gastos comerciales prorrateados si vienen a nivel jugador/ronda
      const brutaJugador = totJugador.facturacionBruta || 0;
      const gcGlobal = num(roundData || {}, 'gastosComerciales');
      let gastosComercialesJugador = num(roundData || {}, 'gastosComercialesJugador');
      if (!gastosComercialesJugador) {
        const brutaGlobal = num(roundData || {}, 'facturacionBruta');
        gastosComercialesJugador = (brutaGlobal > 0 && brutaJugador > 0) ? (gcGlobal * (brutaJugador / brutaGlobal)) : 0;
      }
      Object.values(porProducto).forEach(c => {
        const pct = brutaJugador > 0 ? (c.facturacionBruta / brutaJugador) : 0;
        c.gastosComerciales = gastosComercialesJugador * pct;
        totJugador.gastosComerciales += c.gastosComerciales;
      });

      // Gastos financieros prorrateados
      const gfJugador = num(roundData || {}, 'gastosFinancieros','costesFinancieros');
      Object.values(porProducto).forEach(c => {
        const pct = brutaJugador > 0 ? (c.facturacionBruta / brutaJugador) : 0;
        c.gastosFinancieros = gfJugador * pct;
      });

      // Métricas derivadas
      Object.values(porProducto).forEach(c => {
        c.BAII = c.margenBruto - c.gastosComerciales - c.gastosPublicidad - c.costesAlmacenaje;
        c.BAI  = c.BAII - c.gastosFinancieros;
        c.impuestos     = c.BAI * 0.15;
        c.resultadoNeto = c.BAI - c.impuestos;

        totJugador.impuestos     += c.impuestos;
        totJugador.resultadoNeto += c.resultadoNeto;
      });

      console.log(LOG, 'totalesJugador (internos):', totJugador);
      return Object.values(porProducto);
    }

    // ===== UI =====
    function generarTabla(productosConsolidados) {
      const cont = document.getElementById('tabla-contenedor');
      if (!cont) return;
      cont.innerHTML = '';

      const negativas = new Set(['gastosComerciales','gastosPublicidad','costesAlmacenaje','gastosFinancieros','costeVentas','devoluciones','impuestos']);

      productosConsolidados.forEach(prod => {
        const wrap = document.createElement('div');
        wrap.classList.add('producto-tabla');

        const title = document.createElement('h3');
        title.textContent = `Producto: ${prod.producto}`;
        wrap.appendChild(title);

        const table = document.createElement('table');
        table.classList.add('table','table-striped');

        const thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>Partida</th><th>Valor</th></tr>';
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const filas = [
          ['facturacionBruta','Facturación Bruta'],
          ['devoluciones','Devoluciones'],
          ['facturacionNeta','Facturación Neta'],
          ['costeVentas','Coste Ventas'],
          ['margenBruto','Margen Bruto'],
          ['gastosComerciales','Gastos Comerciales'],
          ['gastosPublicidad','Gastos de Publicidad'],
          ['costesAlmacenaje','Costes de Almacenaje'],
          ['BAII','BAII'],
          ['gastosFinancieros','Costes Financieros'],
          ['BAI','BAI'],
          ['impuestos','Impuestos'],
          ['resultadoNeto','Resultado Neto']
        ];

        filas.forEach(([key,label]) => {
          const tr = document.createElement('tr');
          const td1 = document.createElement('td'); td1.textContent = label;
          const td2 = document.createElement('td');
          const raw = n(prod[key]);
          const mostrar = negativas.has(key) ? -raw : raw;
          td2.textContent = mostrar.toLocaleString('es-ES', { style:'currency', currency:'EUR' });
          td2.style.color = mostrar >= 0 ? 'lightgreen' : '#ff6b6b';
          tr.appendChild(td1); tr.appendChild(td2); tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrap.appendChild(table);
        cont.appendChild(wrap);
      });
    }

    function generarGrafico(productosConsolidados) {
      const canvas = document.getElementById('gastosProductoChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const prev = typeof Chart?.getChart === 'function' ? (Chart.getChart('gastosProductoChart') || Chart.getChart(canvas)) : null;
      if (prev) prev.destroy();

      const labels = productosConsolidados.map(p => p.producto);
      const partidas = [
        { key:'costeVentas',       label:'Coste Ventas',        color:'#ff6384' },
        { key:'gastosComerciales', label:'Gastos Comerciales',  color:'#36a2eb' },
        { key:'gastosPublicidad',  label:'Gastos Publicidad',   color:'#ffcd56' },
        { key:'costesAlmacenaje',  label:'Costes Almacenaje',   color:'#4bc0c0' },
        { key:'gastosFinancieros', label:'Costes Financieros',  color:'#9966ff' },
        { key:'impuestos',         label:'Impuestos',           color:'#ff9f40' },
        { key:'resultadoNeto',     label:'Resultado Neto',      color:'#c45850' }
      ];

      const datasets = partidas.map(p => ({
        label: p.label,
        data: productosConsolidados.map(px => n(px[p.key])),
        backgroundColor: p.color
      }));

      new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
      });
    }
  });
})();
