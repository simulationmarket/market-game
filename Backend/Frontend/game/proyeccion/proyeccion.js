document.addEventListener('DOMContentLoaded', () => {
  const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],  // ✅ permite fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

  // === Multi-partida: partidaId + playerName ===
  const params = new URLSearchParams(location.search);
  const partidaId  = params.get('partidaId')  || localStorage.getItem('partidaId')  || 'default';
  const playerName = localStorage.getItem('playerName') || params.get('playerName') || '';

  // Unirse a la sala ANTES de cualquier acción
  socket.emit('joinGame', { partidaId, nombre: playerName || null });

  if (!playerName) {
    alert('No se ha encontrado el nombre del jugador. Redirigiendo al inicio.');
    const url = new URL('../../index.html', location.href);
    url.searchParams.set('partidaId', partidaId);
    window.location.href = url.pathname + '?' + url.searchParams.toString();
    return;
  }

  // Asociar socket a jugador
  socket.emit('identificarJugador', playerName);

  // Volver preservando query
  document.getElementById('volver-btn')?.addEventListener('click', () => {
    const url = new URL('../game.html', location.href);
    url.searchParams.set('partidaId', partidaId);
    if (playerName) url.searchParams.set('playerName', playerName);
    window.location.href = url.pathname + '?' + url.searchParams.toString();
  });

  // ===== Estado =====
  let presupuestoActual = 0;
  let productos = [];
  let canalesDistribucion = {};
  let loans = [];

  // ===== Utils =====
  const fmt = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  function limpiarListasDetalle() {
    ['detalle-facturacion-lista','detalle-coste-ventas-lista','detalle-margen-bruto-lista',
     'detalle-publicidad-lista','detalle-comercial-lista','detalle-financiero-lista'
    ].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
  }

  function setValor(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = fmt(valor);
    if (valor >= 0) { el.classList.add('positivo'); el.classList.remove('negativo'); }
    else { el.classList.add('negativo'); el.classList.remove('positivo'); }
  }

  // ===== Sync inicial =====
  socket.on('syncPlayerData', (data) => {
    presupuestoActual   = data.budget   || 0;
    productos           = data.products || [];
    canalesDistribucion = data.canalesDistribucion || {};
    loans               = data.loans    || [];

    calcularCuentaResultados();
  });

  // ===== Cálculo de la proyección =====
  function calcularCuentaResultados() {
    limpiarListasDetalle();

    let facturacionTotal      = 0;
    let costeFabricacionTotal = 0;
    let costeVentas           = 0;
    let margenBruto           = 0;
    let gastosPublicitarios   = 0;
    let gastosComerciales     = 0;
    let gastosOperativos      = 0;
    let gastosFinancieros     = 0;

    // ---- Productos ----
    productos.forEach(producto => {
      const precio       = Number(producto.precio) || 0;
      const fabricar     = Number(producto.unidadesFabricar) || 0;
      const stockPrevio  = Number(producto.stock) || 0;

      // 1) Ventas proyectadas: fabricar + stock disponible
      const unidadesVentas   = fabricar + stockPrevio;
      const facturacionProd  = precio * unidadesVentas;

      // 2) Coste de fabricación SOLO de las unidades nuevas (según tu nota)
      const costeUnitario    = Number(producto.costeUnitarioEst) || 0;
      const costeRealUnit    = calcularCosteReal(costeUnitario, fabricar);
      const costeFabricacion = costeRealUnit * fabricar;

      // 3) Margen sobre lo proyectado (ingresos – coste de fabricación de nuevas)
      const margenProd       = facturacionProd - costeFabricacion;

      // 4) Publicidad
      const publicidadValue  = Number(producto.publicidad) || 0;

      // Acumuladores
      facturacionTotal      += facturacionProd;
      costeFabricacionTotal += costeFabricacion;
      costeVentas           += costeFabricacion; // “Coste de ventas” = coste de nuevas unidades
      margenBruto           += margenProd;
      gastosPublicitarios   += publicidadValue;

      // Detalle por producto
      appendDetalle('detalle-facturacion-lista', producto.nombre, facturacionProd);
      appendDetalle('detalle-coste-ventas-lista', producto.nombre, costeFabricacion);
      appendDetalle('detalle-margen-bruto-lista', producto.nombre, margenProd);
      appendDetalle('detalle-publicidad-lista',    producto.nombre, publicidadValue);
    });

    // ---- Canales (gasto comercial) ----
    const costeCanales = {
      granDistribucion: 75000,
      minoristas: 115000,
      online: 150000,
      tiendaPropia: 300000
    };
    Object.entries(canalesDistribucion).forEach(([canal, unidades]) => {
      const costo = (costeCanales[canal] || 0) * (Number(unidades) || 0);
      gastosComerciales += costo;
      appendDetalle('detalle-comercial-lista', formatearCanal(canal), costo);
    });

    gastosOperativos = gastosPublicitarios + gastosComerciales;

    // ---- Préstamos (gasto financiero) ----
    loans.forEach(loan => {
      const amortizacion = (Number(loan.amount) || 0) / (Number(loan.term) || 1);
      const interes      = amortizacion * (Number(loan.interestRate) || 0);
      const cuotaTotal   = amortizacion + interes;

      gastosFinancieros += cuotaTotal;

      // Detalle préstamo
      const li = document.createElement('li');
      li.innerHTML = `
        <span>Préstamo de ${fmt(loan.amount)}:</span>
        <ul>
          <li>Amortización: ${fmt(amortizacion)}</li>
          <li>Interés: ${fmt(interes)}</li>
          <li>Cuota Total: ${fmt(cuotaTotal)}</li>
        </ul>`;
      document.getElementById('detalle-financiero-lista')?.appendChild(li);
    });

    // ---- BAII / BAI / Impuestos / Neto ----
    const baii      = margenBruto - gastosOperativos;
    const bai       = baii - gastosFinancieros;
    const impuestos = bai > 0 ? bai * 0.15 : 0;
    const neto      = bai - impuestos;

    // ---- Pintar totales ----
    setValor('facturacion-total',  facturacionTotal);
    setValor('coste-ventas',      -costeVentas);
    setValor('margen-bruto',       margenBruto);
    setValor('gastos-operativos', -gastosOperativos);
    setValor('gastos-publicitarios', -gastosPublicitarios);
    setValor('gastos-comerciales',   -gastosComerciales);
    setValor('gastos-financieros',   -gastosFinancieros);
    setValor('baii', baii);
    setValor('bai',  bai);
    setValor('impuestos', -impuestos);
    setValor('resultado-neto', neto);
  }

  // === Helpers de detalle / formato ===
  function appendDetalle(listId, label, value) {
    const ul = document.getElementById(listId);
    if (!ul) return;
    const li = document.createElement('li');
    li.innerHTML = `<span>${label}:</span> <span>${fmt(value)}</span>`;
    ul.appendChild(li);
  }

  function formatearCanal(canal) {
    const m = { granDistribucion: 'Gran Distribución', minoristas: 'Minoristas', online: 'Online', tiendaPropia: 'Tienda Propia' };
    return m[canal] || canal;
  }

  // === Descuento por volumen sobre el coste unitario ===
  function calcularCosteReal(costeUnitario, unidadesFabricar) {
    const bonif = Math.min(0.0123 * Math.floor((Number(unidadesFabricar) || 0) / 63567), 0.0565);
    return (Number(costeUnitario) || 0) * (1 - bonif);
  }

  // === Expandir/contraer bloques (compat con tu HTML) ===
  window.toggleDetalle = function (id) {
    const detalle = document.getElementById(id);
    if (!detalle) return;
    const icon = detalle.previousElementSibling.querySelector('.toggle-icon');
    const visible = detalle.style.display === 'table-row';
    detalle.style.display = visible ? 'none' : 'table-row';
    if (icon) icon.textContent = visible ? '▶' : '▼';
  };
});
