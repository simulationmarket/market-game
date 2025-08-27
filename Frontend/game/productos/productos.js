document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const productosGrid = document.querySelector("#productos-lista");

    const nombreEmpresa = localStorage.getItem("playerName");

    // Verificar si el contenedor de productos existe
    if (!productosGrid) {
        console.error("No se encontró el contenedor de productos con el ID 'productos-lista'.");
        return;
    }

    // Cargar los productos y mostrar en la interfaz
    function cargarProductos(productos) {
        console.log("Productos a renderizar:", productos);
        productosGrid.innerHTML = ''; // Limpiar lista actual

        productos.forEach((producto, index) => {
            const productoDiv = document.createElement("div");
            productoDiv.classList.add("producto");

            const nombreDiv = document.createElement("h3");
            nombreDiv.textContent = producto.nombre;

            const descripcionDiv = document.createElement("p");
            descripcionDiv.textContent = producto.descripcion;

            const caracteristicasDiv = document.createElement("ul");
            for (const [caracteristica, valor] of Object.entries(producto.caracteristicas)) {
                const li = document.createElement("li");
                li.innerHTML = `<span>${caracteristica}:</span><span>${valor}</span>`;
                caracteristicasDiv.appendChild(li);
            }

            const costeUnitarioDiv = document.createElement("p");
const costeUnitario = producto.costeUnitarioEst !== undefined ? producto.costeUnitarioEst : 'No disponible';
costeUnitarioDiv.innerHTML = `<strong>Coste Unitario:</strong> ${costeUnitario} €`;

            // Crear el botón para eliminar el producto (descatalogar)
            const eliminarBtn = document.createElement("button");
            eliminarBtn.textContent = "Descatalogar";
            eliminarBtn.classList.add("eliminar-btn");
            eliminarBtn.style.backgroundColor = "red";
            eliminarBtn.style.color = "white";

            // Añadir el evento de clic al botón para eliminar el producto
            eliminarBtn.addEventListener("click", () => {
                const confirmacion = confirm("¿Seguro que deseas descatalogar este producto?");
                if (confirmacion) {
                    // Emitir el evento al servidor para eliminar el producto
                    socket.emit("eliminarProducto", { playerName: nombreEmpresa, producto: producto.nombre });

                    // Eliminar el producto del DOM localmente
                    productoDiv.remove();
                }
            });

            // Añadir los elementos creados al contenedor de productos
            productoDiv.appendChild(nombreDiv);
            productoDiv.appendChild(descripcionDiv);
            productoDiv.appendChild(caracteristicasDiv);
            productoDiv.appendChild(costeUnitarioDiv);  // Añadir el coste unitario al div del producto
            productoDiv.appendChild(eliminarBtn); // Añadir el botón al div del producto

            productosGrid.appendChild(productoDiv);  // Agregar el div del producto al contenedor
        });
    }

    // Escuchar el evento para sincronizar los datos del jugador (incluyendo los productos)
    socket.on("syncPlayerData", (data) => {
        console.log("Datos recibidos del servidor:", data);  // Verificar los datos recibidos
        
        if (data.products && Array.isArray(data.products)) {
            console.log("Productos sincronizados:", data.products);
            cargarProductos(data.products);
        } else {
            console.error("La lista de productos es inválida o está vacía.");
        }
    });
    // Emitir el evento para identificar al jugador
    socket.emit("identificarJugador", nombreEmpresa);
});
