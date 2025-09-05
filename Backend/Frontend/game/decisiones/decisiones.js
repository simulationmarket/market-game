document.addEventListener("DOMContentLoaded", () => {
  const socket = io({ transports: ['websocket'], withCredentials: true, reconnection: true, reconnectionAttempts: 5, timeout: 20000 });;

  // === Multi-partida: obtener y preservar partidaId + playerName ===
  const params = new URLSearchParams(location.search);
  const partidaId = params.get("partidaId") || localStorage.getItem("partidaId") || "default";
  const playerName = localStorage.getItem("playerName") || params.get("playerName");

  // Únete a la sala ANTES de cualquier otra acción
  socket.emit("joinGame", { partidaId, nombre: playerName || null });

  if (!playerName) {
    alert("Jugador no identificado. Redirigiendo a la pantalla de inicio.");
    const url = new URL("../../index.html", location.href);
    url.searchParams.set("partidaId", partidaId);
    window.location.href = url.pathname + "?" + url.searchParams.toString();
    return;
  }

  // Identificar al jugador (asocia el socket a su estado)
  socket.emit("identificarJugador", playerName);

  // ====== Estado local ======
  let presupuestoActual = 0;
  let productos = [];
  let canalesDistribucion = { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 };
  let presupuestoCanalesTotal = 0;
  let previousPresupuestoCanalesTotal = 0;
  let projects = [];
  let loans = [];
  let reserves = 0; // ← faltaba en tu versión original

  // ====== Utilidades ======
  function calcularCosteReal(costeUnitario, unidadesFabricar) {
    let bonificacion = Math.min(5.5, Math.floor(unidadesFabricar / 78000) * 0.67);
    return costeUnitario * (1 - bonificacion / 100);
  }

  function actualizarPresupuestoDisplay() {
    const presupuestoElement = document.getElementById("presupuesto-actual");
    presupuestoElement.textContent = (presupuestoActual || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    presupuestoElement.classList.toggle("negative", presupuestoActual < 0);
  }

  function calcularPresupuestoCanalesTotal() {
    const costosCanales = { granDistribucion: 75000, minoristas: 115000, online: 150000, tiendaPropia: 300000 };
    let total = 0;
    for (const canal in canalesDistribucion) {
      total += (canalesDistribucion[canal] || 0) * costosCanales[canal];
    }
    return total;
  }

  function actualizarPresupuestoCanalesTotal() {
    const nuevoPresupuestoCanalesTotal = calcularPresupuestoCanalesTotal();
    const diferencia = nuevoPresupuestoCanalesTotal - previousPresupuestoCanalesTotal;
    presupuestoActual -= diferencia;

    presupuestoCanalesTotal = nuevoPresupuestoCanalesTotal;
    document.getElementById("presupuesto-total").textContent =
      presupuestoCanalesTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

    actualizarPresupuestoDisplay();
    previousPresupuestoCanalesTotal = nuevoPresupuestoCanalesTotal;
  }

  function actualizarDiferenciaPresupuesto(tipo, index, nuevoValor) {
    let diferencia = 0;

    if (tipo === 'publicidad') {
      diferencia = nuevoValor - (productos[index].publicidad || 0);
      productos[index].publicidad = nuevoValor;
    } else if (tipo === 'unidadesFabricar') {
      diferencia = (nuevoValor - (productos[index].unidadesFabricar || 0)) * (productos[index].costeUnitarioEst || 0);
      productos[index].unidadesFabricar = nuevoValor;
    } else if (tipo === 'precio') {
      productos[index].precio = nuevoValor;
    }

    presupuestoActual -= diferencia;
    actualizarPresupuestoDisplay();
    recalcularCostesMárgenes(index);
  }

  function recalcularCostesMárgenes(index) {
    const producto = productos[index];
    const costeReal = calcularCosteReal(producto.costeUnitarioEst, producto.unidadesFabricar);
    const margenUnitario = producto.precio - costeReal;
    const margenTotal = margenUnitario * producto.unidadesFabricar;
    const costeTotal = costeReal * producto.unidadesFabricar;

    const productoDiv = document.querySelectorAll(".producto")[index];
    productoDiv.querySelector(".coste-real").textContent =
      `${costeReal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
    productoDiv.querySelector(".coste-total").textContent =
      `${costeTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
    productoDiv.querySelector(".margen-unitario").textContent =
      `${margenUnitario.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
    productoDiv.querySelector(".margen-total").textContent =
      `${margenTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;

    const margenUnitarioElement = productoDiv.querySelector(".margen-unitario");
    const margenTotalElement = productoDiv.querySelector(".margen-total");
    margenUnitarioElement.classList.toggle("negative", margenUnitario < 0);
    margenTotalElement.classList.toggle("negative", margenTotal < 0);
  }

  function renderizarProductos() {
    const cont = document.getElementById("productos-container");
    cont.innerHTML = "";

    productos.forEach((producto, index) => {
      const div = document.createElement("div");
      div.classList.add("producto");

      div.innerHTML = `
        <h3>${producto.nombre} - ${producto.descripcion}</h3>
        <div class="input-group-horizontal">
          <label>Precio (€):</label>
          <input type="text" class="precio" value="${new Intl.NumberFormat('es-ES').format(producto.precio)}" data-index="${index}">
        </div>
        <div class="input-group-horizontal">
          <label>Unidades a Fabricar:</label>
          <input type="text" class="unidades-fabricar" value="${new Intl.NumberFormat('es-ES').format(producto.unidadesFabricar)}" data-index="${index}">
        </div>
        <div class="input-group-horizontal">
          <label>Stock Actual:</label>
          <span>${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(producto.stock || 0)}</span>
        </div>
        <div class="input-group-horizontal">
          <label>Coste Unitario:</label>
          <span>${(producto.costeUnitarioEst || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
        </div>
        <div class="input-group-horizontal">
          <label>Coste Real:</label>
          <span class="coste-real">0.00 €</span>
        </div>
        <div class="input-group-horizontal">
          <label>Coste Total de Fabricación:</label>
          <span class="coste-total">0.00 €</span>
        </div>
        <div class="input-group-horizontal">
          <label>Margen Bruto Unitario:</label>
          <span class="margen-unitario">0.00 €</span>
        </div>
        <div class="input-group-horizontal">
          <label>Margen Bruto Total:</label>
          <span class="margen-total">0.00 €</span>
        </div>
        <div class="input-group-horizontal">
          <label>Posicionamiento en Precio:</label>
          <input type="text" class="posicionamiento-precio" value="${producto.posicionamientoPrecio}">
        </div>
        <div class="input-group-horizontal">
          <label>Posicionamiento en Calidad:</label>
          <input type="text" class="posicionamiento-calidad" value="${producto.calidad}">
        </div>
        <div class="input-group-horizontal">
          <label>Presupuesto en Publicidad (€):</label>
          <input type="text" class="publicidad" value="${new Intl.NumberFormat('es-ES').format(producto.publicidad)}" data-index="${index}">
        </div>
      `;
      cont.appendChild(div);

      const addInputEventListener = (selector, type) => {
        div.querySelector(selector).addEventListener("input", (event) => {
          const nuevoValor = parseFloat(event.target.value.replace(/\./g, '').replace(',', '.')) || 0;
          actualizarDiferenciaPresupuesto(type, index, nuevoValor);
          event.target.value = nuevoValor.toLocaleString('es-ES', { maximumFractionDigits: 2 });
        });
      };

      addInputEventListener(".precio", "precio");
      addInputEventListener(".unidades-fabricar", "unidadesFabricar");
      addInputEventListener(".publicidad", "publicidad");

      // Posicionamiento
      div.querySelector(".posicionamiento-precio").addEventListener("input", (e) => {
        productos[index].posicionamientoPrecio = parseFloat(e.target.value) || 1;
      });
      div.querySelector(".posicionamiento-calidad").addEventListener("input", (e) => {
        productos[index].calidad = parseFloat(e.target.value) || 1;
      });

      recalcularCostesMárgenes(index);
    });
  }

  // ====== Sincronización desde servidor ======
  socket.on("syncPlayerData", (data) => {
    console.log("Datos recibidos de syncPlayerData:", data);

    presupuestoActual = data.budget ?? 0;
    reserves = data.reserves ?? 0;
    productos = data.products || [];
    canalesDistribucion = data.canalesDistribucion || { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 };
    projects = data.projects || [];
    loans = data.loans || [];

    console.log("Estado inicial de interactuadoEnRonda:", data.interactuadoEnRonda);
    console.log("Ronda actual:", data.round);

    // Primera interacción de esta ronda → aplica deducciones iniciales
    if (data.interactuadoEnRonda === null) {
      console.log("Primera interacción de esta ronda. Calculando gastos iniciales...");

      productos.forEach(producto => {
        const gastoFabricacion = (producto.unidadesFabricar || 0) * (producto.costeUnitarioEst || 0);
        const gastoPublicidad  = (producto.publicidad || 0);
        presupuestoActual -= (gastoFabricacion + gastoPublicidad);
        console.log(`Producto: ${producto.nombre}, Fabricación: ${gastoFabricacion}, Publicidad: ${gastoPublicidad}`);
      });

      const gastoCanales = calcularPresupuestoCanalesTotal();
      presupuestoActual -= gastoCanales;
      console.log(`Gasto en canales aplicado: ${gastoCanales}`);

      // En lugar de 'actualizarRondaInteractuada' (no existe en el server), usa updatePlayerData
      socket.emit("updatePlayerData", {
        playerName,
        playerData: { rondaInteractuada: data.round }
      });
      console.log(`Marcada ronda ${data.round} como interactuada (server).`);
    } else {
      console.log("Esta ronda ya fue procesada. No se realizan deducciones adicionales.");
    }

    // Sincroniza inputs de canales
    document.getElementById("gran-distribucion").value = canalesDistribucion.granDistribucion || 0;
    document.getElementById("minoristas").value       = canalesDistribucion.minoristas || 0;
    document.getElementById("online").value           = canalesDistribucion.online || 0;
    document.getElementById("tienda-propia").value    = canalesDistribucion.tiendaPropia || 0;

    // Presupuesto de canales
    presupuestoCanalesTotal = calcularPresupuestoCanalesTotal();
    previousPresupuestoCanalesTotal = presupuestoCanalesTotal;
    document.getElementById("presupuesto-total").textContent =
      presupuestoCanalesTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

    actualizarPresupuestoDisplay();
    renderizarProductos();
  });

  // ====== Guardar decisiones y volver a game.html (preservando partidaId) ======
  document.getElementById("guardar-decisiones").addEventListener("click", () => {
    const datosEnvio = {
      playerName,
      playerData: {
        budget: presupuestoActual,
        reserves,
        products: productos,
        canalesDistribucion,
        projects,
        loans,
        rondaInteractuada: true // marca que ya interactuó
      }
    };
    socket.emit("updatePlayerData", datosEnvio);

    const url = new URL("../game.html", location.href);
    url.searchParams.set("partidaId", partidaId);
    if (playerName) url.searchParams.set("playerName", playerName);
    window.location.href = url.pathname + "?" + url.searchParams.toString();
  });

  // ====== Recalcular presupuesto de canales en vivo ======
  ["gran-distribucion", "minoristas", "online", "tienda-propia"].forEach((id, idx) => {
    const key = ["granDistribucion", "minoristas", "online", "tiendaPropia"][idx];
    document.getElementById(id).addEventListener("input", (e) => {
      canalesDistribucion[key] = parseInt(e.target.value, 10) || 0;
      actualizarPresupuestoCanalesTotal();
    });
  });
});
