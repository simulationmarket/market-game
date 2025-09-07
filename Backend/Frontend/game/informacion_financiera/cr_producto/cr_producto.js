'use strict';

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    // Esta subpantalla se conecta sola (no usa postMessage)
    window.DISABLE_GLOBAL_SOCKET = true;
    window.DISABLE_POLLING = true;

    const qs = new URLSearchParams(location.search);
    const partidaId  = qs.get('partidaId')  || localStorage.getItem('partidaId')  || '';
    const playerName = qs.get('playerName') || localStorage.getItem('playerName') || '';
    if (partidaId)  localStorage.setItem('partidaId', partidaId);
    if (playerName) localStorage.setItem('playerName', playerName);

    const LOG = '[CR-PROD]';
    if (!('io' in window)) { console.error(LOG, 'socket.io no cargado'); return; }

    // Igual que Productos/Estudios
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
    let gotRes  = false;

    const maybeRender = () => { if (gotSync && gotRes) tryRender(); };

    socket.on('connect', () => {
      console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
      // Orden recomendado (como en Productos)
      socket.emit('joinGame', { partidaId, nombre: playerName });
      socket.emit('identificarJugador', playerName); // STRING
      socket.emit('solicitarResultados',          { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    });

    socket.on('connect_error', e => console.error(LOG, 'connect_error', e?.message || e));

    // 1) roundsHistory (para gastosComerciales/Financieros y decisiones.products)
    function handleSync(d = {}) {
      roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : [];
      gotSync = true;
      console.log(LOG, 'syncPlayerData rounds:', roundsHistory.length);
      maybeRender();
    }
    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador',    handleSync);

    // 2) resultados completos (todas las filas)
    function handleResultados(payload) {
      resultados = Array.isArray(payload) ? payload
                : (Array.isArray(payload?.resultados) ? payload.resultados : []);
      gotRes = true;
      console.log(LOG, 'resultadosCompletos filas:', resultados.length);
      // Log de muestra con las claves que usamos
      if (resultados.length) {
        const s = resultados.slice(0,3).map(r => ({
          jugador: r.jugador, producto: r.producto,
          facturacionBruta: r.facturacionBruta, facturacionNeta: r.facturacionNeta,
          costeVentasProducto: r.costeVentasProducto, margenBrutoProducto: r.margenBrutoProducto,
          excedente: r.excedente
        }));
        console.log(LOG, 'muestra filas:', s);
      }
      maybeRender();
    }
    socket.on('resultadosCompletos', handleResultados);

    function tryRender() {
      if (!playerName) { console.warn(LOG, 'playerName vacío'); return; }
      if (!resultsOk(resultados)) { emptyState('Sin datos de resultados.'); return; }
      if (!roundsOk(roundsHistory)) { emptyState('Sin roundsHistory.'); return; }

      // El antiguo usaba roundsHistory[0]; mantenemos ese criterio
      const roundData = roundsHistory[0];

      // Filtrado EXACTO por jugador (como el antiguo)
      const filasJugador = resultados.filter(r => r && r.jugador === playerName && r.producto != null);

      if (filasJugador.length === 0) {
        // fallback: si no hay filas exactas, lo decimos explícitamente
        console.warn(LOG, `No hay filas para jugador=${playerName}.`);
        emptyState('Sin filas del jugador todavía.');
        return;
      }

      const consol = consolidarResultadosPorProducto(filasJugador, roundData);
      generarEstructuraTabla(consol);
      generarGraficoPorProducto(consol);
    }

    // ===== helpers de guardas / estado vacío =====
    function resultsOk(arr) {
      return Array.isArray(arr) && arr.length > 0;
    }
    function roundsOk(arr) {
      return Array.isArray(arr) && arr.length > 0 && arr[0] && typeof arr[0] === 'object';
    }
    function emptyState(msg) {
      const cont = document.getElementById('tabla-contenedor');
      if (cont) cont.innerHTML = `<p>${msg}</p>`;
      const canvas = document.getElementById('gastosProductoChart');
      if (canvas?.getContext) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    }
  });

  // ========= LÓGICA DE DATOS (exactamente como el antiguo) =========

  function consolidarResultadosPorProducto(resultados, roundData) {
    if (!roundData || !roundData.decisiones || !roundData.decisiones.products) {
      console.error("Datos de la ronda o decisiones no proporcionados.");
      return [];
    }

    const productosConsolidados = {};
    const totalesJugador = {
      facturacionBruta: 0,
      facturacionNeta:  0,
      costeVentas:      0,
      margenBruto:      0,
      gastosComerciales:0,
      gastosPublicidad: 0,
      costesAlmacenaje: 0,
      gastosFinancieros:0,
      impuestos:        0,
      resultadoNeto:    0,
    };

    // Agrupar resultados por producto
    resultados.forEach((resultado) => {
      const {
        producto,
        excedente,
        facturacionBruta,
        facturacionNeta,
        costeVentasProducto,
        margenBrutoProducto,
        // unidadesDevueltas // (no se usa en la consolidación)
      } = (resultado || {});

      if (!producto) return;

      if (!productosConsolidados[producto]) {
        productosConsolidados[producto] = {
          producto,
          facturacionBruta: 0,
          devoluciones:     0,
          facturacionNeta:  0,
          costeVentas:      0,
          margenBruto:      0,
          gastosComerciales:0,
          gastosPublicidad: 0,
          costesAlmacenaje: 0,
          BAII:             0,
          gastosFinancieros: roundData.gastosFinancieros || 0,
          BAI:              0,
          impuestos:        0,
          resultadoNeto:    0,
        };
      }

      const c = productosConsolidados[producto];

      // Sumas por producto (exactamente como antiguo)
      c.facturacionBruta += (facturacionBruta || 0);
      c.facturacionNeta  += (facturacionNeta  || 0);
      c.costeVentas      += (costeVentasProducto || 0);
      c.margenBruto      += (margenBrutoProducto || 0);
      c.devoluciones     += (facturacionBruta || 0) - (facturacionNeta || 0);
      c.costesAlmacenaje += (excedente || 0) * 20;

      // Totales globales del jugador para proporciones/validaciones
      totalesJugador.facturacionBruta += (facturacionBruta || 0);
      totalesJugador.facturacionNeta  += (facturacionNeta  || 0);
      totalesJugador.costeVentas      += (costeVentasProducto || 0);
      totalesJugador.margenBruto      += (margenBrutoProducto || 0);
      totalesJugador.costesAlmacenaje += (excedente || 0) * 20;
    });

    // Asignar publicidad por índice de products (como antiguo)
    Object.values(productosConsolidados).forEach((c, idx) => {
      const productoDecision = roundData.decisiones?.products?.[idx];
      if (productoDecision) {
        c.gastosPublicidad = (productoDecision.presupuestoPublicidad || 0);
        totalesJugador.gastosPublicidad += c.gastosPublicidad;
      }

      // Gastos comerciales proporcionados por facturación bruta
      const pct = c.facturacionBruta && totalesJugador.facturacionBruta
        ? (c.facturacionBruta / totalesJugador.facturacionBruta) : 0;
      c.gastosComerciales = (roundData.gastosComerciales || 0) * pct;
      totalesJugador.gastosComerciales += c.gastosComerciales;

      // Métricas derivadas
      c.BAII = c.margenBruto - c.gastosComerciales - c.gastosPublicidad - c.costesAlmacenaje;
      c.BAI  = c.BAII - c.gastosFinancieros;
      c.impuestos    = c.BAI * 0.15;
      c.resultadoNeto= c.BAI - c.impuestos;

      totalesJugador.gastosFinancieros += (roundData.gastosFinancieros || 0) * pct; // solo para validar si quieres
      totalesJugador.impuestos        += c.impuestos;
      totalesJugador.resultadoNeto    += c.resultadoNeto;
    });

    // Validaciones (opcional; como el antiguo)
    validarTotales(roundData, totalesJugador);

    return Object.values(productosConsolidados);
  }

  function validarTotales(roundData, tot) {
    const keys = ["facturacionBruta","facturacionNeta","costeVentas","margenBruto","gastosComerciales","gastosPublicidad","costesAlmacenaje"];
    keys.forEach((k) => {
      const jugador = Number(tot[k] || 0);
      const global  = Number(roundData[k] || 0);
      const ok = Math.abs(jugador - global) <= 0.01;
      (ok
        ? console.log
        : console.warn
      )(`[CR-PROD] validar ${k}: jugador=${jugador.toFixed(2)} global=${global.toFixed(2)} ${ok ? 'OK' : 'DESV'}`);
    });
  }

  function generarEstructuraTabla(productosConsolidados) {
    const tablaContenedor = document.getElementById("tabla-contenedor");
    if (!tablaContenedor) { console.error("No se encontró #tabla-contenedor"); return; }
    tablaContenedor.innerHTML = "";

    productosConsolidados.forEach(producto => {
      const wrap = document.createElement("div");
      wrap.classList.add("producto-tabla");

      const title = document.createElement("h3");
      title.textContent = `Producto: ${producto.producto}`;
      wrap.appendChild(title);

      const table = document.createElement("table");
      table.classList.add("table", "table-striped");

      const thead = document.createElement("thead");
      thead.innerHTML = `<tr><th>Partida</th><th>Valor</th></tr>`;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");
      const partidas = [
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

      partidas.forEach(([key,label]) => {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td'); td1.textContent = label;
        const td2 = document.createElement('td');
        const raw = Number(producto[key] || 0);
        const mostrar = negativas.has(key) ? -raw : raw;
        td2.textContent = mostrar.toLocaleString('es-ES', { style:'currency', currency:'EUR' });
        td2.style.color = mostrar >= 0 ? 'green' : 'red';
        tr.appendChild(td1); tr.appendChild(td2); tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      wrap.appendChild(table);
      tablaContenedor.appendChild(wrap);
    });
  }

  function generarGraficoPorProducto(productosConsolidados) {
    const canvas = document.getElementById('gastosProductoChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Chart apilado por partidas, como el antiguo
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

    // Destruye gráfico previo si existiese
    const prev = typeof Chart?.getChart === 'function' ? (Chart.getChart('gastosProductoChart') || Chart.getChart(canvas)) : null;
    if (prev) prev.destroy();

    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { x: { stacked: true }, y: { stacked: true } }
      }
    });
  }
})();
