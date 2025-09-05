document.addEventListener("DOMContentLoaded", () => {
  const socket = io({ transports: ['websocket'], withCredentials: true, reconnection: true, reconnectionAttempts: 5, timeout: 20000 });;

  // === Multi-partida ===
  const params = new URLSearchParams(location.search);
  const partidaId  = params.get("partidaId")  || localStorage.getItem("partidaId")  || "default";
  const playerName = localStorage.getItem("playerName") || params.get("playerName");

  // Únete a la sala ANTES de cualquier acción
  socket.emit("joinGame", { partidaId, nombre: playerName || null });

  if (!playerName) {
    alert("No se ha encontrado el nombre del jugador. Redirigiendo al inicio.");
    const url = new URL("../../index.html", location.href);
    url.searchParams.set("partidaId", partidaId);
    window.location.href = url.pathname + "?" + url.searchParams.toString();
    return;
  }

  // Identificar jugador
  socket.emit("identificarJugador", playerName);

  // ===== Estado =====
  let budget = 0;
  let reservas = 0;
  let loans = [];
  let proyectosEnDesarrollo = [];
  let products = [];

  // ===== DOM =====
  const budgetElement          = document.querySelector("#budgetAmount");
  const reservasElement        = document.querySelector("#reservasAmount");
  const projectDialog          = document.getElementById("project-dialog");
  const projectNameInput       = document.getElementById("project-name");
  const projectDescriptionInput= document.getElementById("project-description");
  const costDisplay            = document.getElementById("cost-display");
  const unitCostDisplay        = document.getElementById("unit-cost-display");
  const executionTimeDisplay   = document.getElementById("execution-time-display");
  const developmentProjectsTBody = document.querySelector("#development-projects-list tbody");
  const modoRadios             = document.querySelectorAll("input[name='modo']");
  const productSelectCont      = document.getElementById("product-select-container");
  const productSelect          = document.getElementById("product-select");
  const sectionTitle           = document.getElementById("section-title");
  const generarProyectoBtn     = document.getElementById("generar-proyecto-btn");

  let modoActual = "nuevo";            // 'nuevo' | 'mejora'
  let productoSeleccionado = null;

  // ===== Catálogos de costes =====
  const costosDesarrollo = {
    pantalla:  [3000000, 6000000, 9000000, 12000000, 15000000, 18000000, 21000000, 24000000, 27000000, 30000000, 33000000, 36000000, 39000000, 42000000, 45000000, 48000000, 51000000, 54000000, 57000000, 60000000],
    procesador:[4500000, 7000000, 9500000, 12000000, 14500000, 17000000, 19500000, 22000000, 24500000, 27000000, 29500000, 32000000, 34500000, 37000000, 39500000, 42000000, 44500000, 47000000, 49500000, 52000000],
    bateria:   [10000000, 15000000, 20000000, 25000000, 30000000, 35000000, 40000000, 45000000, 50000000, 55000000, 60000000, 65000000, 70000000, 75000000, 80000000, 85000000, 90000000, 95000000, 100000000, 105000000],
    placaBase: [15000000, 17000000, 19000000, 21000000, 23000000, 25000000, 27000000, 29000000, 31000000, 33000000, 35000000, 37000000, 39000000, 41000000, 43000000, 45000000, 47000000, 49000000, 51000000, 53000000],
    ergonomia: [8000000, 10000000, 12000000, 14000000, 16000000, 18000000, 20000000, 22000000, 24000000, 26000000, 28000000, 30000000, 32000000, 34000000, 36000000, 38000000, 40000000, 42000000, 44000000, 46000000],
    acabados:  [6000000, 7000000, 8000000, 9000000, 10000000, 11000000, 12000000, 13000000, 14000000, 15000000, 16000000, 17000000, 18000000, 19000000, 20000000, 21000000, 22000000, 23000000, 24000000, 25000000],
    color:     [10000000, 12000000, 14000000, 16000000, 18000000, 20000000, 22000000, 24000000, 26000000, 28000000, 30000000, 32000000, 34000000, 36000000, 38000000, 40000000, 42000000, 44000000, 46000000, 48000000]
  };

  const costosUnitarios = {
    pantalla:  [10, 11, 12.5, 13.5, 15, 15, 15, 15, 15, 15, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42],
    procesador:[7.5, 7.5, 7.5, 7.5, 7.5, 10, 10, 10, 10, 13.5, 13.5, 13.5, 13.5, 13.5, 16, 19, 22, 25, 28, 31],
    bateria:   [11, 11, 11, 11, 11, 13, 13, 13, 30, 30, 30, 30, 30, 30, 30, 30, 37.5, 45, 52.5, 60],
    placaBase: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    ergonomia: [5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    acabados:  [5, 5, 5, 5, 5, 7.5, 7.5, 7.5, 7.5, 7.5, 10, 12.5, 15, 17.5, 20, 24, 28, 32, 36, 40],
    color:     [5, 7, 8, 10, 11, 12.5, 14, 15.5, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]
  };

  // ===== UI: modo nuevo/mejora =====
  modoRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      modoActual = radio.value; // 'nuevo' | 'mejora'

      if (modoActual === "mejora") {
        productSelectCont.classList.remove("hidden");
        sectionTitle.textContent = "Mejorar Producto";
        generarProyectoBtn.textContent = "Generar Mejora";

        if (products.length) {
          productSelect.value = "0"; // usamos índice
          productoSeleccionado = products[0];
          precargarSliders(productoSeleccionado);
        }
      } else {
        productSelectCont.classList.add("hidden");
        sectionTitle.textContent = "Características del Producto";
        generarProyectoBtn.textContent = "Generar Proyecto";
        productoSeleccionado = null;
        precargarSliders(null); // sliders a 10
      }
      actualizarCostosDisplay();
    });
  });

  productSelect.addEventListener("change", () => {
    const idx = parseInt(productSelect.value, 10);
    productoSeleccionado = Number.isInteger(idx) ? products[idx] : null;
    precargarSliders(productoSeleccionado);
    actualizarCostosDisplay();
  });

  // ===== Sync inicial desde servidor =====
  socket.on("syncPlayerData", (data) => {
    budget                = data.budget   ?? 0;
    reservas              = data.reserves ?? 0;
    loans                 = data.loans    ?? [];
    proyectosEnDesarrollo = data.projects ?? [];
    products              = data.products || [];

    // Poblar select (por índice)
    productSelect.innerHTML = "";
    products.forEach((prod, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = prod.nombre || `Producto ${idx + 1}`;
      productSelect.appendChild(opt);
    });

    // Si ya estamos en 'mejora', precarga el primero
    if (modoActual === "mejora" && products.length) {
      productSelect.value  = "0";
      productoSeleccionado = products[0];
      precargarSliders(productoSeleccionado);
    }

    updateDisplay();
    renderizarProyectos();
    actualizarCostosDisplay();
  });

  // ===== Utilidades =====
  function updateDisplay() {
    budgetElement.textContent  = (budget   || 0).toLocaleString("es-ES") + " €";
    if (reservasElement) reservasElement.textContent = (reservas || 0).toLocaleString("es-ES") + " €";
  }

  function renderizarProyectos() {
    developmentProjectsTBody.innerHTML = "";
    proyectosEnDesarrollo.forEach(p => añadirProyectoALista(p));
  }

  function syncWithServer() {
    const playerData = {
      budget,
      projects: proyectosEnDesarrollo,
      reserves: reservas,
      loans,
      products
    };
    socket.emit("updatePlayerData", { playerName, playerData });
  }

  function precargarSliders(producto) {
    const niveles = (modoActual === "mejora" && producto)
      ? (producto.caracteristicas || producto.caracteristicasAjustadas || {})
      : { pantalla:10, procesador:10, bateria:10, placaBase:10, ergonomia:10, acabados:10, color:10 };

    Object.entries(niveles).forEach(([attr, val]) => {
      const slider  = document.getElementById(attr);
      const display = slider?.nextElementSibling;
      if (!slider) return;
      slider.value = Number(val) || 10;
      if (display) display.textContent = slider.value;
    });
  }

  function calcularCostos() {
    const sliders = document.querySelectorAll(".characteristic input[type='range']");
    let deltaDev = 0;
    let unitario = 0;
    const factor = (modoActual === "mejora") ? 1.5 : 1;
    const base   = (modoActual === "mejora" && productoSeleccionado)
      ? (productoSeleccionado.caracteristicas || {})
      : {};

    sliders.forEach(slider => {
      const attr  = slider.id;
      const nuevo = parseInt(slider.value, 10) - 1; // 0..19

      // coste unitario con el nivel "nuevo" siempre
      unitario += (costosUnitarios[attr]?.[nuevo] || 0);

      if (modoActual === "mejora") {
        const actual = ((base[attr] || 1) - 1);
        deltaDev += Math.abs(
          (costosDesarrollo[attr]?.[nuevo] || 0) - (costosDesarrollo[attr]?.[actual] || 0)
        );
      } else {
        deltaDev += (costosDesarrollo[attr]?.[nuevo] || 0);
      }
    });

    const costoDesarrollo = deltaDev * factor;
    return { costoDesarrollo, costeUnitarioEst: unitario };
  }

  function actualizarCostosDisplay() {
    const { costoDesarrollo, costeUnitarioEst } = calcularCostos();
    const tiempoEjecucion = Math.ceil(costoDesarrollo / 97000000);

    costDisplay.textContent      = (costoDesarrollo || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
    unitCostDisplay.textContent  = (Number(costeUnitarioEst) || 0).toFixed(2) + " €";
    executionTimeDisplay.textContent = `${tiempoEjecucion} rondas`;
  }

  // Mostrar valor del slider y actualizar en tiempo real
  document.querySelectorAll(".characteristic input[type='range']").forEach(slider => {
    const valueDisplay = document.createElement("span");
    valueDisplay.className = "slider-value";
    slider.parentNode.appendChild(valueDisplay);
    valueDisplay.textContent = slider.value;

    slider.addEventListener("input", () => {
      valueDisplay.textContent = slider.value;
      actualizarCostosDisplay();
    });
  });

  // ===== Acciones =====
  document.querySelector(".generar-proyecto").addEventListener("click", () => {
    const { costoDesarrollo } = calcularCostos();
    if (costoDesarrollo > budget) {
      alert("No tienes suficiente presupuesto para este proyecto.");
      return;
    }
    projectDialog.classList.remove("hidden");
  });

  document.querySelector("#aceptar-proyecto-btn").addEventListener("click", () => {
    const nombre = projectNameInput.value.trim();
    const descripcion = projectDescriptionInput.value.trim();
    if (!nombre || !descripcion) {
      alert("Por favor, ingresa un nombre y una descripción para el proyecto.");
      return;
    }

    const { costoDesarrollo, costeUnitarioEst } = calcularCostos();
    const tiempoEjecucion = Math.ceil(costoDesarrollo / 80000000);

    const caracteristicas = {
      pantalla:  Number(document.getElementById("pantalla").value),
      procesador:Number(document.getElementById("procesador").value),
      bateria:   Number(document.getElementById("bateria").value),
      placaBase: Number(document.getElementById("placaBase").value),
      ergonomia: Number(document.getElementById("ergonomia").value),
      acabados:  Number(document.getElementById("acabados").value),
      color:     Number(document.getElementById("color").value)
    };

    const nuevoProyecto = {
      tipo: (modoActual === "mejora") ? "Mejora" : "Nuevo",
      nombre,
      descripcion,
      tiempoRestante: tiempoEjecucion,
      costeUnitarioEst,
      caracteristicas
    };

    // Descontar del presupuesto y sincronizar
    budget -= costoDesarrollo;
    proyectosEnDesarrollo.push(nuevoProyecto);
    syncWithServer();
    updateDisplay();
    añadirProyectoALista(nuevoProyecto);

    // Cerrar diálogo
    projectDialog.classList.add("hidden");
    projectNameInput.value = "";
    projectDescriptionInput.value = "";
  });

  function lanzarProyecto(index) {
    if (!Number.isInteger(index) || index < 0 || index >= proyectosEnDesarrollo.length) return;

    const proyecto = proyectosEnDesarrollo[index];
    if (!proyecto) return;

    if (confirm("Tu producto ha sido lanzado, ya puedes encontrarlo en tu portfolio.")) {
      // Enviar al servidor (incluimos partidaId para mayor claridad)
      socket.emit("lanzarProyecto", { playerName, proyecto, partidaId });

      // Quitar de la lista local y sincronizar
      proyectosEnDesarrollo.splice(index, 1);
      renderizarProyectos();
      syncWithServer();
    }
  }

  function añadirProyectoALista(proyecto) {
    const row = document.createElement("tr");

    const tipoCell = document.createElement("td");  tipoCell.textContent = proyecto.tipo || "Nuevo";
    const nombreCell = document.createElement("td"); nombreCell.textContent = proyecto.nombre;
    const descCell = document.createElement("td");   descCell.textContent = proyecto.descripcion;
    const tiempoCell = document.createElement("td"); tiempoCell.textContent = `${proyecto.tiempoRestante} rondas`;

    const accionesCell = document.createElement("td");
    const lanzarBtn = document.createElement("button");
    lanzarBtn.textContent = "Lanzamiento";
    lanzarBtn.disabled = (proyecto.tiempoRestante > 0);
    lanzarBtn.addEventListener("click", () => {
      const idx = proyectosEnDesarrollo.findIndex(p => p.nombre === proyecto.nombre);
      if (idx !== -1) lanzarProyecto(idx);
    });
    accionesCell.appendChild(lanzarBtn);

    row.appendChild(tipoCell);
    row.appendChild(nombreCell);
    row.appendChild(descCell);
    row.appendChild(tiempoCell);
    row.appendChild(accionesCell);

    developmentProjectsTBody.appendChild(row);
  }

  // Cancelar diálogo
  document.querySelector("#cancelar-proyecto-btn").addEventListener("click", () => {
    projectDialog.classList.add("hidden");
    projectNameInput.value = "";
    projectDescriptionInput.value = "";
  });

  // Volver preservando partidaId/playerName
  document.querySelector("#back-button").addEventListener("click", () => {
    const url = new URL("../game.html", location.href);
    url.searchParams.set("partidaId", partidaId);
    if (playerName) url.searchParams.set("playerName", playerName);
    window.location.href = url.pathname + "?" + url.searchParams.toString();
  });
});
