document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const playerName = localStorage.getItem("playerName");

    if (!playerName) {
        alert("Jugador no identificado. Redirigiendo a la pantalla de inicio.");
        window.location.href = "../index.html";
        return;
    }

    socket.emit("identificarJugador", playerName);

    let presupuestoActual = 0;
    let productos = [];
    let canalesDistribucion = { granDistribucion: 0, minoristas: 0, online: 0, tiendaPropia: 0 };
    let presupuestoCanalesTotal = 0;
    let previousPresupuestoCanalesTotal = 0; // Para guardar el presupuesto total de canales previo
    let projects = [];
    let loans = [];  

    function calcularCosteReal(costeUnitario, unidadesFabricar) {
        let bonificacion = Math.min(5.5, Math.floor(unidadesFabricar / 78000) * 0.67);
        return costeUnitario * (1 - bonificacion / 100);
    }

    function actualizarPresupuestoDisplay() {
        const presupuestoElement = document.getElementById("presupuesto-actual");
        presupuestoElement.textContent = presupuestoActual.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

        if (presupuestoActual < 0) {
            presupuestoElement.classList.add("negative");
        } else {
            presupuestoElement.classList.remove("negative");
        }
    }

    function calcularPresupuestoCanalesTotal() {
        const costosCanales = { granDistribucion: 75000, minoristas: 115000, online: 150000, tiendaPropia: 300000 };
        let total = 0;
        for (const canal in canalesDistribucion) {
            total += canalesDistribucion[canal] * costosCanales[canal];
        }
        return total;
    }
  
    function actualizarPresupuestoCanalesTotal() {
        const nuevoPresupuestoCanalesTotal = calcularPresupuestoCanalesTotal();

        // Calcular la diferencia y aplicarla al presupuesto actual
        const diferencia = nuevoPresupuestoCanalesTotal - previousPresupuestoCanalesTotal;
        presupuestoActual -= diferencia;

        // Actualizar el presupuesto de canales y el presupuesto actual en pantalla
        presupuestoCanalesTotal = nuevoPresupuestoCanalesTotal;
        document.getElementById("presupuesto-total").textContent = presupuestoCanalesTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

        // Actualizar el presupuesto en pantalla
        actualizarPresupuestoDisplay();

        // Guardar el nuevo valor como el presupuesto anterior para futuras comparaciones
        previousPresupuestoCanalesTotal = nuevoPresupuestoCanalesTotal;
    }

    function actualizarDiferenciaPresupuesto(tipo, index, nuevoValor) {
        let diferencia = 0;

        if (tipo === 'publicidad') {
            diferencia = nuevoValor - productos[index].publicidad;
            productos[index].publicidad = nuevoValor;
        } else if (tipo === 'unidadesFabricar') {
            diferencia = (nuevoValor - productos[index].unidadesFabricar) * productos[index].costeUnitarioEst;
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
        productoDiv.querySelector(".coste-real").textContent = `${costeReal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
        productoDiv.querySelector(".coste-total").textContent = `${costeTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
        productoDiv.querySelector(".margen-unitario").textContent = `${margenUnitario.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
        productoDiv.querySelector(".margen-total").textContent = `${margenTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;

        const margenUnitarioElement = productoDiv.querySelector(".margen-unitario");
        const margenTotalElement = productoDiv.querySelector(".margen-total");

        margenUnitarioElement.classList.toggle("negative", margenUnitario < 0);
        margenTotalElement.classList.toggle("negative", margenTotal < 0);
    }

    function renderizarProductos() {
        const productosContainer = document.getElementById("productos-container");
        productosContainer.innerHTML = "";

        productos.forEach((producto, index) => {
            const productoDiv = document.createElement("div");
            productoDiv.classList.add("producto");

            productoDiv.innerHTML = `
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
                    <span>${producto.costeUnitarioEst.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
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
            productosContainer.appendChild(productoDiv);

            const addInputEventListener = (selector, type) => {
                productoDiv.querySelector(selector).addEventListener("input", (event) => {
                    const nuevoValor = parseFloat(event.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                    actualizarDiferenciaPresupuesto(type, index, nuevoValor);
                    event.target.value = nuevoValor.toLocaleString('es-ES', { maximumFractionDigits: 2 });
                });
            };

            addInputEventListener(".precio", "precio");
            addInputEventListener(".unidades-fabricar", "unidadesFabricar");
            addInputEventListener(".publicidad", "publicidad");

            // Eventos para posicionamiento
            productoDiv.querySelector(".posicionamiento-precio").addEventListener("input", (event) => {
                productos[index].posicionamientoPrecio = parseFloat(event.target.value) || 1;
            });

            productoDiv.querySelector(".posicionamiento-calidad").addEventListener("input", (event) => {
                productos[index].calidad = parseFloat(event.target.value) || 1;
            });

            recalcularCostesMárgenes(index); 
        });
    }

    socket.on("syncPlayerData", (data) => {
        console.log("Datos recibidos de syncPlayerData:", data); // Log para depuración inicial
    
        presupuestoActual = data.budget;
        reserves = data.reserves;
        productos = data.products;
        canalesDistribucion = data.canalesDistribucion;
        projects = data.projects;
        loans = data.loans || [];
    
        console.log("Estado inicial de interactuadoEnRonda:", data.interactuadoEnRonda);
        console.log("Ronda actual:", data.round);
    
        if (data.interactuadoEnRonda === null) { // Cambiado a interactuadoEnRonda
            console.log("Primera interacción de esta ronda. Calculando gastos iniciales...");
    
            // Calcular y restar costos iniciales
            productos.forEach(producto => {
                const gastoFabricacion = producto.unidadesFabricar * producto.costeUnitarioEst || 0;
                const gastoPublicidad = producto.publicidad || 0;
    
                presupuestoActual -= gastoFabricacion + gastoPublicidad;
    
                console.log(
                    `Producto: ${producto.nombre}, Gasto Fabricación: ${gastoFabricacion}, Gasto Publicidad: ${gastoPublicidad}`
                );
            });
    
            const gastoCanales = calcularPresupuestoCanalesTotal();
            presupuestoActual -= gastoCanales;
    
            console.log(`Gastos iniciales calculados: Fabricación y Publicidad + Canales: ${gastoCanales}`);
    
            // Notificar al servidor que esta ronda ya fue interactuada
            socket.emit("actualizarRondaInteractuada", { playerName, interactuadoEnRonda: data.round }); // Cambiado a interactuadoEnRonda
            console.log(`Se notificó al servidor que la ronda ${data.round} fue interactuada.`);
        } else {
            console.log("Esta ronda ya fue procesada. No se realizan deducciones adicionales.");
        }
    
        // Asegurar que los inputs de los canales se actualizan siempre
        console.log("Actualizando valores de canales en la interfaz...");
        document.getElementById("gran-distribucion").value = canalesDistribucion.granDistribucion;
        document.getElementById("minoristas").value = canalesDistribucion.minoristas;
        document.getElementById("online").value = canalesDistribucion.online;
        document.getElementById("tienda-propia").value = canalesDistribucion.tiendaPropia;
    
        // Actualizar presupuesto de canales y pantalla
        presupuestoCanalesTotal = calcularPresupuestoCanalesTotal();
        previousPresupuestoCanalesTotal = presupuestoCanalesTotal;
        document.getElementById("presupuesto-total").textContent = presupuestoCanalesTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    
        console.log("Presupuesto total de canales actualizado:", presupuestoCanalesTotal);
    
        // Actualizar la pantalla
        actualizarPresupuestoDisplay();
        renderizarProductos();
    });
    
    
    
    
    
    

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
                rondaInteractuada: true // Actualizar el estado al guardar decisiones
            }
        };
        socket.emit("updatePlayerData", datosEnvio);
        window.location.href = "../game.html";
    });

    ["gran-distribucion", "minoristas", "online", "tienda-propia"].forEach((canalId, index) => {
        const canalNombre = ["granDistribucion", "minoristas", "online", "tiendaPropia"][index];
        document.getElementById(canalId).addEventListener("input", (event) => {
            canalesDistribucion[canalNombre] = parseInt(event.target.value) || 0;
            actualizarPresupuestoCanalesTotal();
        });
    });
});
