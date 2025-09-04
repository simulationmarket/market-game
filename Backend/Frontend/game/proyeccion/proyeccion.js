// Conectar con el servidor a través de Socket.io
const socket = io();
const playerName = localStorage.getItem("playerName");

let presupuestoActual = 0;
let productos = [];
let canalesDistribucion = {};
let loans = [];

// Sincronizar con el servidor y cargar datos iniciales
socket.emit("identificarJugador", playerName);
socket.on("syncPlayerData", (data) => {
    presupuestoActual = data.budget || 0;
    productos = data.products || [];
    canalesDistribucion = data.canalesDistribucion || {};
    loans = data.loans || [];  // Obtener los préstamos del servidor

    console.log("Datos recibidos del servidor:", { presupuestoActual, productos, canalesDistribucion, loans });
    
    // Llamar a la función para calcular y mostrar la cuenta de resultados
    calcularCuentaResultados();
});

// Función para actualizar el valor y el color en función de si es positivo o negativo
function actualizarValorConColor(idElemento, valor) {
    const elemento = document.getElementById(idElemento);
    elemento.textContent = `${valor.toLocaleString('es-ES')} €`;

    // Aplicar clase en función de si es positivo o negativo
    if (valor >= 0) {
        elemento.classList.add("positivo");
        elemento.classList.remove("negativo");
    } else {
        elemento.classList.add("negativo");
        elemento.classList.remove("positivo");
    }
}

function calcularCuentaResultados() {
    let facturacionTotal = 0;
    let costeFabricacionTot   = 0;
    let costeVentas = 0;
    let margenBruto = 0;
    let gastosOperativos = 0;
    let gastosPublicitarios = 0;
    let gastosComerciales = 0;
    let gastosFinancieros = 0;

    // Cálculo de Facturación, Coste de Ventas y Margen Bruto
productos.forEach(producto => {
  let precio            = producto.precio || 0;
  let fabricar          = producto.unidadesFabricar || 0;
  let stockPrevio       = producto.stock || 0;

  // 1) Ventas proyectadas sobre TODO el inventario
  let unidadesVentas    = fabricar + stockPrevio;
  let facturacionProd   = precio * unidadesVentas;

  // 2) Coste solo de fabricar nuevas unidades
  let costeUnitario     = producto.costeUnitarioEst || 0;
  let costeRealFab      = calcularCosteReal(costeUnitario, fabricar);
  let costeFabricacion  = costeRealFab * unidadesVentas;

  // 3) Margen (ingresos – coste de fabricación)
  let margenProd        = facturacionProd - costeFabricacion;

  // 4) Acumuladores
  facturacionTotal    += facturacionProd;
  costeFabricacionTot += costeFabricacion;
  // Coste de Ventas = Coste de Fabricación de las nuevas unidades
  let costeVentasProd  = costeFabricacion;
  costeVentas         += costeVentasProd;
  margenBruto         += margenProd;

  // 5) Publicidad
  let publicidadValue = producto.publicidad || 0;
  gastosPublicitarios += publicidadValue;

  // 6) Detalles en el DOM
  const append = (id, label, value) => {
    let li = document.createElement("li");
    li.innerHTML = `<span>${label}:</span> ` +
                   `<span>${value.toLocaleString('es-ES')} €</span>`;
    document.getElementById(id).appendChild(li);
  };

  append("detalle-facturacion-lista", producto.nombre, facturacionProd);
  append("detalle-coste-ventas-lista", producto.nombre, costeVentasProd);
  append("detalle-margen-bruto-lista", producto.nombre, margenProd);
  append("detalle-publicidad-lista", producto.nombre, publicidadValue);

  
});

    // Cálculo de Gastos Comerciales por canal de distribución
    const costeCanales = {
    granDistribucion: 75000,
    minoristas: 115000,
    online: 150000,
    tiendaPropia: 300000
    };

    Object.entries(canalesDistribucion).forEach(([canal, unidades]) => {
        let costoCanal = (costeCanales[canal] || 0) * unidades;
        gastosComerciales += costoCanal;

        let comercialDetalle = document.createElement("li");
        comercialDetalle.innerHTML = `<span>${canal}:</span> <span>${costoCanal.toLocaleString('es-ES')} €</span>`;
        document.getElementById("detalle-comercial-lista").appendChild(comercialDetalle);
    });

    gastosOperativos = gastosPublicitarios + gastosComerciales;

    // Cálculo de Gastos Financieros y detalle de cada préstamo
    loans.forEach(loan => {
        const amortizacionCuota = loan.amount / loan.term;
        const interesCuota = amortizacionCuota * loan.interestRate;
        const cuotaTotal = amortizacionCuota + interesCuota;

        gastosFinancieros += cuotaTotal;

        let financieroDetalle = document.createElement("li");
        financieroDetalle.innerHTML = `
            <span>Préstamo de ${loan.amount.toLocaleString('es-ES')} €:</span>
            <ul>
                <li>Amortización: ${amortizacionCuota.toLocaleString('es-ES')} €</li>
                <li>Interés: ${interesCuota.toLocaleString('es-ES')} €</li>
                <li>Cuota Total: ${cuotaTotal.toLocaleString('es-ES')} €</li>
            </ul>
        `;
        document.getElementById("detalle-financiero-lista").appendChild(financieroDetalle);
    });

    // Calcular el BAII
    let baii = margenBruto - gastosOperativos;

    // Calcular BAI (incluye Gastos Financieros)
    let bai = baii - gastosFinancieros;

    // Calcular Impuestos (15% de BAI si BAI > 0)
    let impuestos = bai > 0 ? bai * 0.15 : 0;

    // Calcular Resultado Neto
    let resultadoNeto = bai - impuestos;

    // Actualizar valores totales en la interfaz con colores según el valor
    actualizarValorConColor("facturacion-total", facturacionTotal);
    actualizarValorConColor("coste-ventas", -costeVentas);
    actualizarValorConColor("margen-bruto", margenBruto);
    actualizarValorConColor("gastos-operativos", -gastosOperativos);
    actualizarValorConColor("gastos-publicitarios", -gastosPublicitarios);
    actualizarValorConColor("gastos-comerciales", -gastosComerciales);
    actualizarValorConColor("gastos-financieros", -gastosFinancieros);
    actualizarValorConColor("baii", baii);
    actualizarValorConColor("bai", bai);
    actualizarValorConColor("impuestos", -impuestos);
    actualizarValorConColor("resultado-neto", resultadoNeto);
}

// Función auxiliar para calcular el coste real
function calcularCosteReal(costeUnitario, unidadesFabricar) {
    const bonificacion = Math.min(0.0123 * Math.floor(unidadesFabricar / 63567), 0.0565);
    return costeUnitario * (1 - bonificacion);
}

// Función para expandir y contraer detalles
function toggleDetalle(id) {
    let detalle = document.getElementById(id);
    let icon = detalle.previousElementSibling.querySelector(".toggle-icon");

    if (detalle.style.display === "none" || detalle.style.display === "") {
        detalle.style.display = "table-row";
        icon.textContent = "▼";
    } else {
        detalle.style.display = "none";
        icon.textContent = "▶";
    }
}

window.onload = () => {
    if (productos.length > 0) calcularCuentaResultados();
};
