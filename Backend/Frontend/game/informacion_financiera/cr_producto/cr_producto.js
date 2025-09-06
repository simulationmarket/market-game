'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
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

    let roundsHistory = [];
    let resultados = [];
    let gotSync = false;
    let gotRes = false;

    const _norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const _matchRow = (row) => {
      const c = _norm(row.jugador ?? row.empresa ?? row.nombreJugador ?? row.jugadorNombre);
      const p = _norm(playerName);
      return c === p || c.includes(p) || p.includes(c);
    };
    const maybeRender = () => { if (gotSync && gotRes) tryRender(); };

    socket.on('connect', () => {
      console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
      socket.emit('identificarJugador', playerName);
      socket.emit('joinGame', { partidaId, playerName, nombre: playerName });
      socket.emit('solicitarResultados', { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    });
    socket.on('connect_error', e => console.error(LOG, 'connect_error', e?.message || e));

    function handleSync(d = {}) { roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : []; gotSync = true; maybeRender(); }
    function handleResultados(payload) {
      resultados = Array.isArray(payload) ? payload : (Array.isArray(payload?.resultados) ? payload.resultados : []);
      gotRes = true; maybeRender();
    }

    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador',    handleSync);
    socket.on('resultadosCompletos', handleResultados);

    function consolidarResultadosPorProducto(resultados, roundData) {
      if (!roundData || !roundData.decisiones || !roundData.decisiones.products) return [];
      const productosConsolidados = {};
      const totalesJugador = {
        facturacionBruta: 0, facturacionNeta: 0, costeVentas: 0, margenBruto: 0,
        gastosComerciales: 0, gastosPublicidad: 0, costesAlmacenaje: 0,
        gastosFinancieros: 0, impuestos: 0, resultadoNeto: 0
      };

      resultados.forEach((r) => {
        const producto = r.producto;
        const facturacionBruta    = Number(r.facturacionBruta ?? r.ingresosBrutos ?? r.facturacion ?? 0);
        const facturacionNeta     = Number(r.facturacionNeta  ?? r.ingresosNetos  ?? r.ventasNetas ?? 0);
        const costeVentasProducto = Number(r.costeVentasProducto ?? r.costeVentas ?? r.cogs ?? 0);
        const margenBrutoProducto = Number(r.margenBrutoProducto ?? (facturacionNeta - costeVentasProducto) ?? 0);
        const excedente           = Number(r.excedente ?? r.stockExcedente ?? 0);

        if (!productosConsolidados[producto]) {
          productosConsolidados[producto] = {
            producto, facturacionBruta:0, devoluciones:0, facturacionNeta:0, costeVentas:0, margenBruto:0,
            gastosComerciales:0, gastosPublicidad:0, costesAlmacenaje:0, BAII:0,
            gastosFinancieros: roundData.gastosFinancieros || 0, BAI:0, impuestos:0, resultadoNeto:0
          };
        }

        const c = productosConsolidados[producto];
        c.facturacionBruta += facturacionBruta;
        c.facturacionNeta  += facturacionNeta;
        c.costeVentas      += costeVentasProducto;
        c.margenBruto      += margenBrutoProducto;
        c.devoluciones     += (facturacionBruta - facturacionNeta);
        c.costesAlmacenaje += excedente * 20;

        totalesJugador.facturacionBruta += facturacionBruta;
        totalesJugador.facturacionNeta  += facturacionNeta;
        totalesJugador.costeVentas      += costeVentasProducto;
        totalesJugador.margenBruto      += margenBrutoProducto;
        totalesJugador.costesAlmacenaje += excedente * 20;
      });

      const productosDecision = roundData.decisiones.products || [];
      Object.values(productosConsolidados).forEach((c, idx) => {
        const d = productosDecision[idx];
        if (d) { c.gastosPublicidad = Number(d.presupuestoPublicidad ?? d.publicidad ?? 0); totalesJugador.gastosPublicidad += c.gastosPublicidad; }
        const pct = (totalesJugador.facturacionBruta > 0) ? (c.facturacionBruta / totalesJugador.facturacionBruta) : 0;
        c.gastosComerciales = (roundData.gastosComerciales || 0) * pct; totalesJugador.gastosComerciales += c.gastosComerciales;
        c.BAII = c.margenBruto - c.gastosComerciales - c.gastosPublicidad - c.costesAlmacenaje;
        c.BAI  = c.BAII - c.gastosFinancieros;
        c.impuestos = c.BAI * 0.15; totalesJugador.impuestos += c.impuestos;
        c.resultadoNeto = c.BAI - c.impuestos; totalesJugador.resultadoNeto += c.resultadoNeto;
      });

      return Object.values(productosConsolidados);
    }

    function tryRender() {
      const last = roundsHistory[roundsHistory.length - 1];
      let filas = resultados.filter((r) => _matchRow(r));
      if (filas.length === 0) {
        const mySet = new Set((last?.decisiones?.products || []).map(p => _norm(p?.nombre)).filter(Boolean));
        filas = resultados.filter(r => mySet.has(_norm(r.producto)));
        if (filas.length === 0) {
          const cont = document.getElementById('tabla-contenedor');
          if (cont) cont.innerHTML = '<p>Sin filas para tu jugador/productos todavía.</p>';
          const canvas = document.getElementById('gastosProductoChart');
          if (canvas?.getContext) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
          return;
        }
      }
      const consol = consolidarResultadosPorProducto(filas, last);
      generarEstructuraTabla(consol);
      generarGraficoPorProducto(consol);
    }
  });

  function generarEstructuraTabla(productosConsolidados) {
    const cont = document.getElementById('tabla-contenedor');
    if (!cont) return; cont.innerHTML = '';

    productosConsolidados.forEach((prod) => {
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
      const partes = [
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
      const negativas = new Set(['gastosComerciales','gastosPublicidad','costesAlmacenaje','gastosFinancieros','costeVentas','devoluciones','impuestos']);

      partes.forEach(([key,label]) => {
        const row = document.createElement('tr');
        const c1  = document.createElement('td'); c1.textContent = label;
        const c2  = document.createElement('td');
        const raw = Number(prod[key] || 0);
        const mostrado = negativas.has(key) ? -raw : raw;
        c2.textContent = mostrado.toLocaleString('es-ES', { style:'currency', currency:'EUR' });
        c2.style.color = mostrado >= 0 ? 'green' : 'red';
        row.appendChild(c1); row.appendChild(c2); tbody.appendChild(row);
      });

      table.appendChild(tbody);
      wrap.appendChild(table);
      cont.appendChild(wrap);
    });
  }

  function generarGraficoPorProducto(productosConsolidados) {
    const canvas = document.getElementById('gastosProductoChart');
    if (!canvas) return;

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
      data: productosConsolidados.map(px => Number(px[p.key] || 0)),
      backgroundColor: p.color
    }));

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
  }
})();
