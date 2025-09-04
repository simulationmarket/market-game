document.addEventListener("DOMContentLoaded", () => {
    const socket = io();

    // Recuperar el nombre del jugador almacenado en localStorage
    const playerName = localStorage.getItem("playerName");
    if (!playerName) {
        alert("No se ha encontrado el nombre del jugador. Redirigiendo al inicio.");
        window.location.href = "index.html";
        return;
    }

    // Emitir identificarJugador al conectarse
    socket.emit("identificarJugador", playerName);

    // Variables de estado
    let budget = 0;
    let reservas;  // Añadido para manejar reservas
    let loans = [];  
    let proyectosEnDesarrollo = [];
    

    // Elementos del DOM
    const budgetElement = document.querySelector("#budgetAmount");
    const reservasElement = document.querySelector("#reservasAmount"); // Elemento para mostrar reservas
    const projectDialog = document.getElementById("project-dialog");
    const projectNameInput = document.getElementById("project-name");
    const projectDescriptionInput = document.getElementById("project-description");
    const costDisplay = document.getElementById("cost-display");
    const unitCostDisplay = document.getElementById("unit-cost-display");
    const executionTimeDisplay = document.getElementById("execution-time-display");
    const developmentProjectsList = document.getElementById("development-projects-list").querySelector("tbody");
    const modoRadios         = document.querySelectorAll("input[name='modo']");
    const productSelectCont  = document.getElementById("product-select-container");
    const productSelect      = document.getElementById("product-select");
    const sectionTitle       = document.getElementById("section-title");
    const generarProyectoBtn = document.getElementById("generar-proyecto-btn");
    let modoActual           = 'nuevo';
    let productoSeleccionado = null;
    let products             = [];
    modoRadios.forEach(radio => radio.addEventListener("change", () => {
    modoActual = radio.value;          // 'nuevo' | 'mejora'

    if (modoActual === 'mejora') {
        productSelectCont.classList.remove('hidden');
        sectionTitle.textContent = 'Mejorar Producto';
        generarProyectoBtn.textContent = 'Generar Mejora';

        // precarga el primer producto
        productoSeleccionado = products[0] || null;
        if (productoSeleccionado) {
            productSelect.value = productoSeleccionado.id;
            precargarSliders(productoSeleccionado);
        }
    } else {
        productSelectCont.classList.add('hidden');
        sectionTitle.textContent = 'Características del Producto';
        generarProyectoBtn.textContent = 'Generar Proyecto';
        precargarSliders(null);        // sliders a 10
        productoSeleccionado = null;
    }
    actualizarCostosDisplay();
}));

productSelect.addEventListener("change", () => {
    const idx = parseInt(productSelect.value, 10);
    productoSeleccionado = products[idx];
    precargarSliders(productoSeleccionado);
    actualizarCostosDisplay();
});

    // Tablas de costos de desarrollo y costos unitarios
    const costosDesarrollo = {
        pantalla: [3000000, 6000000, 9000000, 12000000, 15000000, 18000000, 21000000, 24000000, 27000000, 30000000, 33000000, 36000000, 39000000, 42000000, 45000000, 48000000, 51000000, 54000000, 57000000, 60000000],
        procesador: [4500000, 7000000, 9500000, 12000000, 14500000, 17000000, 19500000, 22000000, 24500000, 27000000, 29500000, 32000000, 34500000, 37000000, 39500000, 42000000, 44500000, 47000000, 49500000, 52000000],
        bateria: [10000000, 15000000, 20000000, 25000000, 30000000, 35000000, 40000000, 45000000, 50000000, 55000000, 60000000, 65000000, 70000000, 75000000, 80000000, 85000000, 90000000, 95000000, 100000000, 105000000],
        placaBase: [15000000, 17000000, 19000000, 21000000, 23000000, 25000000, 27000000, 29000000, 31000000, 33000000, 35000000, 37000000, 39000000, 41000000, 43000000, 45000000, 47000000, 49000000, 51000000, 53000000],
        ergonomia: [8000000, 10000000, 12000000, 14000000, 16000000, 18000000, 20000000, 22000000, 24000000, 26000000, 28000000, 30000000, 32000000, 34000000, 36000000, 38000000, 40000000, 42000000, 44000000, 46000000],
        acabados: [6000000, 7000000, 8000000, 9000000, 10000000, 11000000, 12000000, 13000000, 14000000, 15000000, 16000000, 17000000, 18000000, 19000000, 20000000, 21000000, 22000000, 23000000, 24000000, 25000000],
        color: [10000000, 12000000, 14000000, 16000000, 18000000, 20000000, 22000000, 24000000, 26000000, 28000000, 30000000, 32000000, 34000000, 36000000, 38000000, 40000000, 42000000, 44000000, 46000000, 48000000]
    };

    const costosUnitarios = {
        pantalla: [10, 11, 12.5, 13.5, 15, 15, 15, 15, 15, 15, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42],
        procesador: [7.5, 7.5, 7.5, 7.5, 7.5, 10, 10, 10, 10, 13.5, 13.5, 13.5, 13.5, 13.5, 16, 19, 22, 25, 28, 31],
        bateria: [11, 11, 11, 11, 11, 13, 13, 13, 30, 30, 30, 30, 30, 30, 30, 30, 37.5, 45, 52.5, 60],
        placaBase: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
        ergonomia: [5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
        acabados: [5, 5, 5, 5, 5, 7.5, 7.5, 7.5, 7.5, 7.5, 10, 12.5, 15, 17.5, 20, 24, 28, 32, 36, 40],
        color: [5, 7, 8, 10, 11, 12.5, 14, 15.5, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38]

    };

    socket.on("syncPlayerData", (data) => {
  console.log("Datos recibidos del servidor en I+D:", data);

        // 1. Estado financiero y proyectos
        budget                 = data.budget   ?? 0;
        reservas               = data.reserves ?? 0;
        loans                  = data.loans    ?? [];
        proyectosEnDesarrollo  = data.projects ?? [];

        // 2. Productos terminados (para 'Mejorar')
        products = data.products || [];
        productSelect.innerHTML = '';
        products.forEach((prod, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;              // usamos el índice
        opt.textContent = prod.nombre;
        productSelect.appendChild(opt);
    });

        // 3. Si ya estamos en modo 'mejora', precargar el primer producto
        if (modoActual === 'mejora' && products.length) {
            productoSeleccionado = products.find(p => p.id === productSelect.value) || products[0];
            productSelect.value  = productoSeleccionado.id;
            precargarSliders(productoSeleccionado);   // ← función que rellenará los sliders
        }

        // 4. Refrescar interfaz
        updateDisplay();      // presupuesto, reservas, etc.
        renderizarProyectos();// proyectos en desarrollo
        actualizarCostosDisplay(); // recalcular tabla de costes
        });
    // Función para actualizar la visualización del presupuesto y reservas
    function updateDisplay() {
        budgetElement.textContent = budget.toLocaleString('es-ES') + " €";
        if (reservasElement) {
            reservasElement.textContent = reservas.toLocaleString('es-ES') + " €";  // Actualizar las reservas
        }
    }

    // Función para renderizar proyectos
    function renderizarProyectos() {
        developmentProjectsList.innerHTML = '';  // Limpiar lista de proyectos

        proyectosEnDesarrollo.forEach((proyecto) => {
            añadirProyectoALista(proyecto);
        });
    }

   // Función para sincronizar datos con el servidor
   function syncWithServer() {
    const playerData = {
        budget,
        projects: proyectosEnDesarrollo,
        reserves: reservas, // Asegúrate de incluir reservas
        loans, // Incluye los préstamos
        products // Incluye los productos existentes
    };

    if (!playerName) {
        console.error("Error: playerName no está definido.");
        return;
    }

    socket.emit("updatePlayerData", { playerName, playerData });
}

function precargarSliders(producto) {
    const niveles = modoActual === 'mejora' && producto
        ? producto.caracteristicas                // fuente oficial
        : { pantalla:10, procesador:10, bateria:10,
            placaBase:10, ergonomia:10, acabados:10, color:10 };

    Object.entries(niveles).forEach(([attr, val]) => {
        const slider  = document.getElementById(attr);
        const display = slider.nextElementSibling;
        slider.value  = val;
        if (display)  display.textContent = val;
    });
}
    // Cálculo de costos
    function calcularCostos() {
    const sliders = document.querySelectorAll(".characteristic input[type='range']");
    let deltaDev  = 0;      // sólo para desarrollo
    let unitario  = 0;      // coste unitario final del producto
    const factor  = modoActual === 'mejora' ? 1.5 : 1;
    const base    = modoActual === 'mejora' && productoSeleccionado
                  ? productoSeleccionado.caracteristicas
                  : {};

    sliders.forEach(slider => {
        const attr   = slider.id;
        const nuevo  = parseInt(slider.value, 10) - 1;        // índice 0‑19

        // Coste unitario SIEMPRE se calcula con el nivel nuevo
        unitario += costosUnitarios[attr][nuevo];

        if (modoActual === 'mejora') {
            const actual = (base[attr] || 1) - 1;
            deltaDev += Math.abs(
                costosDesarrollo[attr][nuevo] - costosDesarrollo[attr][actual]
            );
        } else {
            deltaDev += costosDesarrollo[attr][nuevo];
        }
    });

    const costoDesarrollo = deltaDev * factor;
    return { costoDesarrollo, costeUnitarioEst: unitario };
}


    // Actualización de los costos y tiempo de ejecución
    function actualizarCostosDisplay() {
        const { costoDesarrollo, costeUnitarioEst } = calcularCostos();
        const tiempoEjecucion = Math.ceil(costoDesarrollo / 97000000);

        costDisplay.textContent = costoDesarrollo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        unitCostDisplay.textContent = costeUnitarioEst.toFixed(2) + " €";
        executionTimeDisplay.textContent = tiempoEjecucion + " rondas";
    }

    // Mostrar valor del slider y actualizar costos en tiempo real
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

    // Botón para generar un proyecto
    document.querySelector(".generar-proyecto").addEventListener("click", () => {
        const { costoDesarrollo } = calcularCostos();
        if (costoDesarrollo > budget) {
            alert("No tienes suficiente presupuesto para este proyecto.");
            return;
        }
        projectDialog.classList.remove("hidden");
    });

    // Función para aceptar el proyecto
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
        pantalla: Number(document.getElementById('pantalla').value),
        procesador: Number(document.getElementById('procesador').value),
        bateria: Number(document.getElementById('bateria').value),
        placaBase: Number(document.getElementById('placaBase').value),
        ergonomia: Number(document.getElementById('ergonomia').value),
        acabados: Number(document.getElementById('acabados').value),
        color: Number(document.getElementById('color').value)
    };

        const nuevoProyecto = {
        tipo:              modoActual === 'mejora' ? 'Mejora' : 'Nuevo',
        nombre,
        descripcion,
        tiempoRestante:    tiempoEjecucion,
        costeUnitarioEst,
        caracteristicas
    };
        // Resta el costo del presupuesto
        budget -= costoDesarrollo;

        // Actualizar en el servidor
        proyectosEnDesarrollo.push(nuevoProyecto);
        syncWithServer();  // Sincronizar con el servidor
        updateDisplay();  // Actualizar visualización del presupuesto
        añadirProyectoALista(nuevoProyecto);  // Mostrar en la lista de proyectos
        projectDialog.classList.add("hidden");
        projectNameInput.value = "";
        projectDescriptionInput.value = "";
    });

    // Función para lanzar un proyecto (convertirlo en producto)
    function lanzarProyecto(index) {
        if (typeof index === "undefined" || index < 0 || index >= proyectosEnDesarrollo.length) {
            console.error(`Índice inválido en lanzarProyecto: ${index}`, proyectosEnDesarrollo);
            return;
        }
    
        const proyecto = proyectosEnDesarrollo[index];
    
        if (!proyecto) {
            console.error(`No se encontró un proyecto válido en el índice ${index}:`, proyectosEnDesarrollo);
            return;
        }
    
        console.log("Lanzando proyecto al servidor:", proyecto);
    
        // Mostrar un mensaje al jugador
        if (confirm("Tu producto ha sido lanzado, ya puedes encontrarlo en tu portfolio.")) {
            // Enviar el proyecto al servidor para que sea convertido en producto
            socket.emit("lanzarProyecto", { playerName, proyecto });
    
            // Eliminar el proyecto de la lista de proyectos en desarrollo
            proyectosEnDesarrollo.splice(index, 1);
    
            // Actualizar la visualización de los proyectos
            renderizarProyectos();
            syncWithServer(); // Sincronizar con el servidor
        }
    }
    

// Añadir un proyecto a la lista con un botón de lanzamiento
function añadirProyectoALista(proyecto) {
    const row = document.createElement("tr");

    // 1. Celda Tipo
    const tipoCell = document.createElement("td");
    tipoCell.textContent = proyecto.tipo || 'Nuevo';
    row.appendChild(tipoCell);

    // 2. Nombre
    const nombreCell = document.createElement("td");
    nombreCell.textContent = proyecto.nombre;
    row.appendChild(nombreCell);

    // 3. Descripción
    const descripcionCell = document.createElement("td");
    descripcionCell.textContent = proyecto.descripcion;
    row.appendChild(descripcionCell);

    // 4. Tiempo restante
    const tiempoRestanteCell = document.createElement("td");
    tiempoRestanteCell.textContent = `${proyecto.tiempoRestante} rondas`;
    row.appendChild(tiempoRestanteCell);

    // 5. Acciones
    const accionesCell = document.createElement("td");
    const lanzarBtn = document.createElement("button");
    lanzarBtn.textContent = "Lanzamiento";
    lanzarBtn.disabled = proyecto.tiempoRestante > 0;
    lanzarBtn.addEventListener("click", () => {
        const idx = proyectosEnDesarrollo.findIndex(p => p.nombre === proyecto.nombre);
        if (idx !== -1) lanzarProyecto(idx);
    });
    accionesCell.appendChild(lanzarBtn);
    row.appendChild(accionesCell);

    developmentProjectsList.appendChild(row);
}
// Cancelar proyecto
document.querySelector("#cancelar-proyecto-btn").addEventListener("click", () => {
    projectDialog.classList.add("hidden");
    projectNameInput.value = "";
    projectDescriptionInput.value = "";
});


    // Volver a la pantalla de juego
    document.querySelector("#back-button").addEventListener("click", () => {
        window.location.href = "../game.html";
    });
});