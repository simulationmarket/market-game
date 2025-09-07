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
    // buffers de diagnóstico
    window.__sockCRP = socket;

    let roundsHistory = [];
    let resultados = [];
    let gotSync = false;
    let gotRes  = false;

    const norm = s => String(s ?? '').trim().toLowerCase();
    const matchesPlayer = (row, name) => {
      const a = norm(row?.jugador ?? row?.empresa ?? row?.nombreJugador ?? row?.jugadorNombre ?? row?.player ?? row?.playerName ?? row?.company);
      const b = norm(name);
      return a === b || a.includes(b) || b.includes(a);
    };
    const n = v => Number(v) || 0;

    const maybeRender = () => { if (gotSync && gotRes) tryRender(); };

    socket.on('connect', () => {
      console.log(LOG, 'WS OK', { id: socket.id, partidaId, playerName });
      socket.emit('joinGame', { partidaId, nombre: playerName });
      socket.emit('identificarJugador', playerName); // STRING
      socket.emit('solicitarResultados',          { partidaId, playerName });
      socket.emit('solicitarResultadosCompletos', { partidaId, playerName });
    });

    socket.on('connect_error', e => console.error(LOG, 'connect_error', e?.message || e));

    // roundsHistory del jugador (para decisiones, gastos financieros/comerciales del jugador)
    function handleSync(d = {}) {
      roundsHistory = Array.isArray(d.roundsHistory) ? d.roundsHistory : [];
      window.__roundsHistory = roundsHistory; // buffer
      gotSync = true;
      console.log(LOG, 'syncPlayerData rounds:', roundsHistory.length);
      maybeRender();
    }
    socket.on('syncPlayerData', handleSync);
    socket.on('syncJugador',    handleSync);

    // resultados completos (todas las filas de ventas con partidas ya calculadas)
    function handleResultados(payload) {
      resultados = Array.isArray(payload) ? payload
                : (Array.isArray(payload?.resultados) ? payload.resultados : []);
      window.__ultimosResultados = resultados; // buffer para inspección
      gotRes = true;
      console.log(LOG, 'resultadosCompletos filas:', resultados.length);

      if (resultados.length) {
        const demo = resultados.slice(0, 3).map(r => ({
          jugador: r.jugador,
          producto: r.producto,
          facturacionBruta: r.facturacionBruta,
          facturacionNeta:  r.facturacionNeta,
          costeVentasProducto: r.costeVentasProducto,
          margenBrutoProducto: r.margenBrutoProducto,
          excedente: r.excedente
        }));
        console.log(LOG, 'muestra filas:', demo);
      }
      maybeRender();
    }
    socket.on('resultadosCompletos', handleResultados);

    function tryRender() {
      if (!playerName) return;

      // 1) Filas del jugador
      let filas = resultados.filter(r => matchesPlayer(r, playerName));

      // 2) Fallback por productos del jugador según última ronda
      const last = roundsHistory[roundsHistory.length - 1];
      if (filas.length === 0 && last?.decisiones?.products?.length) {
        const mySet = new Set((last.decisiones.products || []).map(p => norm(p?.nombre)).filter(Boolean));
        filas = resultados.filter(r => mySet.has(norm(r.producto)));
      }

      if (filas.length === 0) {
        emptyState('Sin datos para tu jugador/productos todavía.');
        return;
      }

      // 3) Consolidar por producto con campos EXACTOS de tu backend
      const consol = consolidarPorProducto(filas, last);

      // 4) Pintar
      generarTabla(consol);
      generarGrafico(consol);
    }

    function emptyState(msg) {
      const cont = document.getElementById('tabla-contenedor');
      if (cont) cont.innerHTML = `<p>${msg}</p>`;
      const canvas = document.getElementById('gastosProductoChart');
      if (canvas?.getContext) canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    }

    // ====== Consolidación por producto ======
    function consolidarPorProducto(filasJugador, roundData) {
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

      // Mapa de publicidad por NOMBRE de producto (más robusto que por índice)
      const pubMap = {};
      const prodList = roundData?.decisiones?.products || [];
      prodList.forEach(p => {
        if (p?.nombre) pubMap[norm(p.nombre)] = n(p.presupuestoPublicidad ?? p.publicidad);
      });

      // Agrupar y sumar partidas ya calculadas por el backend
      filasJugador.forEach(r => {
        const prodName = r.producto;
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

        const factBruta = n(r.facturacionBruta);
        const factNeta  = n(r.facturacionNeta);
        const coste     = n(r.costeVentasProducto);
        const margen    = n(r.margenBrutoProducto);
        const excedente = n(r.excedente);

        c.facturacionBruta += factBruta;
        c.facturacionNeta  += factNeta;
        c.costeVentas      += coste;
        c.margenBruto      += margen;
        c.devoluciones     += (factBruta - factNeta);
        c.costesAlmacenaje += excedente * 20;

        totJugador.facturacionBruta += factBruta;
        totJugador.facturacionNeta  += factNeta;
        totJugador.costeVentas      += coste;
        totJugador.margenBruto      += margen;
        totJugador.costesAlmacenaje += excedente * 20;
      });

      // Publicidad por nombre
      Object.values(porProducto).forEach(c => {
        c.gastosPublicidad = pubMap[norm(c.producto)] || 0;
        totJugador.gastosPublicidad += c.gastosPublicidad;
      });

      // Gastos comerciales del jugador:
      // si roundData trae los del jugador, úsalo; si no, aproxima por proporción contra bruta global de la ronda
      const gcRondaJugador = n(roundData?.gastosComerciales);
      let gastosComercialesJugador = gcRondaJugador;
      if (!gastosComercialesJugador) {
        const brutaGlobal = n(roundData?.facturacionBruta);
        const brutaJugador = totJugador.facturacionBruta;
        const gcGlobal = n(roundData?.gastosComerciales);
        gastosComercialesJugador = (brutaGlobal > 0 && brutaJugador > 0) ? (gcGlobal * (brutaJugador / brutaGlobal)) : 0;
      }

      // Reparto de comerciales entre productos por peso en bruta del jugador
      const brutaJugador = totJugador.facturacionBruta || 0;
      Object.values(porProducto).forEach(c => {
        const pct = brutaJugador > 0 ? (c.facturacionBruta / brutaJugador) : 0;
        c.gastosComerciales = gastosComercialesJugador * pct;
        totJugador.gastosComerciales += c.gastosComerciales;
      });

      // Gastos financieros del jugador (si el round los trae, prorrateamos igual)
      const gfJugador = n(roundData?.gastosFinancieros);
      Object.values(porProducto).forEach(c => {
        const pct = brutaJugador > 0 ? (c.facturacionBruta / brutaJugador) : 0;
        c.gastosFinancieros = gfJugador * pct;
        // totJugador.gastosFinancieros += c.gastosFinancieros; // opcional sumatorio
      });

      // Métricas derivadas por producto
      Object.values(porProducto).forEach(c => {
        c.BAII = c.margenBruto - c.gastosComerciales - c.gastosPublicidad - c.costesAlmacenaje;
        c.BAI  = c.BAII - c.gastosFinancieros;
        c.impuestos     = c.BAI * 0.15;
        c.resultadoNeto = c.BAI - c.impuestos;

        totJugador.impuestos     += c.impuestos;
        totJugador.resultadoNeto += c.resultadoNeto;
      });

      // (Opcional) Log de consistencia interna
      console.log(LOG, 'totalesJugador (internos):', totJugador);

      return Object.values(porProducto);
    }

    // ====== UI ======
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

      // Destruye gráfico previo si existe
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
