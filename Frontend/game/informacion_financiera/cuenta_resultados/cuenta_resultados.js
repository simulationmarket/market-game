document.addEventListener('DOMContentLoaded', function () {
    const socket = io();
    let playerName = null;
    let roundsHistory = [];

    // Detectar si estamos en un iframe
    const isIframe = window.self !== window.top;

    if (isIframe) {
        // Si estamos en un iframe, escuchar el mensaje del padre
        window.addEventListener('message', (event) => {
            const { playerName: receivedPlayerName, roundsHistory: receivedRoundsHistory } = event.data || {};
            if (receivedPlayerName && Array.isArray(receivedRoundsHistory)) {
                playerName = receivedPlayerName;
                roundsHistory = receivedRoundsHistory;
                console.log(`Datos sincronizados en iframe para ${playerName}:`, roundsHistory);

                // Renderizar datos
                generarEstructuraTabla(roundsHistory);
                actualizarTabla(roundsHistory);
                actualizarGrafico(roundsHistory);
            } else {
                console.error("Datos inválidos recibidos en el iframe:", event.data);
            }
        });
    } else {
        // Si no estamos en un iframe, obtener el jugador directamente de localStorage
        playerName = localStorage.getItem("playerName");
        if (!playerName) {
            alert("No se ha encontrado el nombre del jugador. Redirigiendo al inicio.");
            window.location.href = "index.html";
            return;
        }
        console.log("Identificando jugador:", playerName);
        sincronizarJugador(playerName);
    }

    function sincronizarJugador(playerName) {
        // Emitir evento para identificar al jugador
        socket.emit("identificarJugador", playerName);

        // Escuchar el evento syncPlayerData para obtener los datos
        socket.on("syncPlayerData", (data) => {
            console.log("Datos sincronizados recibidos del servidor:", data);
            if (data && data.roundsHistory) {
                roundsHistory = data.roundsHistory;
                generarEstructuraTabla(roundsHistory);
                actualizarTabla(roundsHistory);
                actualizarGrafico(roundsHistory);
            } else {
                console.error("Los datos recibidos no son válidos.");
            }
        });
    }


    
    function formatPartidaName(partida) {
        // Reemplazar camelCase con palabras separadas por espacios
        const formatted = partida.replace(/([a-z])([A-Z])/g, "$1 $2");
        // Convertir las palabras a "Primera Letra Mayúscula"
        return formatted
            .split(" ")
            .map(word => {
                // Si es "baii" o "bai", convertir a mayúsculas completas
                if (word.toLowerCase() === "baii" || word.toLowerCase() === "bai") {
                    return word.toUpperCase();
                }
                // Caso contrario, primera letra en mayúscula
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(" ");
    }
    
    // Función para generar la estructura de la tabla
function generarEstructuraTabla(roundsHistory) {
    console.log("Generando estructura de la tabla con:", roundsHistory);
    const tableHeader = document.getElementById("header-row");
    const tableBody = document.getElementById("results-body");

    // Limpiar la tabla
    tableHeader.innerHTML = "<th>Partida</th>";
    tableBody.innerHTML = "";

    // Crear encabezados de las rondas
    roundsHistory.forEach((_, ronda) => {
        const th = document.createElement("th");
        th.textContent = `R${ronda}`;
        tableHeader.appendChild(th);
    });

    // Métricas a mostrar en las filas
    const partidas = [
        "facturacionBruta",
        "devoluciones",
        "facturacionNeta",
        "costeVentas",
        "margenBruto",
        "gastosOperativos",
        "gastosPublicidad", // Nueva partida
        "gastosComerciales",
        "costeAlmacenaje",
        "baii",
        "gastosFinancieros",
        "bai",
        "impuestos",
        "resultadoNeto",
    ];

    // Definir partidas importantes y colores
    const partidasImportantes = [
        "facturacionBruta",
        "facturacionNeta",
        "margenBruto",
        "gastosOperativos",
        "baii",
        "bai",
        "resultadoNeto",
    ];

    const partidasSuma = [
        "facturacionBruta",
        "facturacionNeta",
        "margenBruto",
        "baii",
        "bai",
        "resultadoNeto",
    ];

    const partidasResta = [
        "devoluciones",
        "costeVentas",
        "gastosPublicidad", // Añadida como partida que resta
        "gastosOperativos",
        "gastosComerciales",
        "costeAlmacenaje",
        "gastosFinancieros",
        "impuestos",
    ];

    partidas.forEach(partida => {
        const row = document.createElement("tr");
        const partidaCell = document.createElement("td");
        partidaCell.textContent = formatPartidaName(partida); // Formatear el texto de la partida

        // Resaltar las partidas importantes en negrita
        if (partidasImportantes.includes(partida)) {
            partidaCell.style.fontWeight = "bold"; // Negrita
            partidaCell.style.color = "black"; // Negro
        } else {
            partidaCell.style.color = "black"; // Asegurar que las demás partidas estén en negro
        }
        row.appendChild(partidaCell);

        roundsHistory.forEach((_, ronda) => {
            const cell = document.createElement("td");
            cell.id = `${partida}-r${ronda}`;
            cell.textContent = "0"; // Inicializar con "0"

            // Aplicar colores según la naturaleza de la partida (suma/resta)
            if (partidasSuma.includes(partida)) {
                cell.style.color = "green"; // Verde para suma
            } else if (partidasResta.includes(partida)) {
                cell.style.color = "red"; // Rojo para resta
            }

            // Aplicar negrita si la partida está en la lista de partidas importantes
            if (partidasImportantes.includes(partida)) {
                cell.style.fontWeight = "bold";
            }

            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });
}

function actualizarTabla(roundsHistory) {
    roundsHistory.forEach((datos, ronda) => {
        console.log(`Procesando ronda ${ronda}:`, datos); // Depuración inicial

        const partidas = [
            "facturacionBruta",
            "devoluciones",
            "facturacionNeta",
            "costeVentas",
            "margenBruto",
            "gastosOperativos",
            "gastosPublicidad", // Nueva partida
            "gastosComerciales",
            "costeAlmacenaje",
            "baii",
            "gastosFinancieros",
            "bai",
            "impuestos",
            "resultadoNeto",
        ];

        partidas.forEach(partida => {
            const cell = document.getElementById(`${partida}-r${ronda}`);
            if (cell) {
                let valor = datos[partida] || 0;

                // Calcular "gastosPublicidad"
                if (partida === "gastosPublicidad") {
                    if (datos.decisiones && Array.isArray(datos.decisiones.products)) {
                        console.log(`Productos encontrados en ronda ${ronda}:`, datos.decisiones.products); // Confirmar productos
                        valor = datos.decisiones.products.reduce((total, product) => {
                            const publicidad = product.presupuestoPublicidad || 0;
                            console.log(`Producto presupuesto publicidad: ${publicidad}`); // Confirmar valor de publicidad
                            return total + publicidad;
                        }, 0);
                    } else {
                        console.warn(`No hay productos válidos en "datos.decisiones.products" para calcular "gastosPublicidad" en R${ronda}`);
                        valor = 0;
                    }
                }

                // Mostrar el valor en la celda
                cell.textContent = parseFloat(valor).toLocaleString("es-ES");

                // Depuración adicional para gastosPublicidad
                if (partida === "gastosPublicidad") {
                    console.log(`Gastos Publicidad calculados para R${ronda}:`, valor);
                }
            }
        });
    });
}

    
    function actualizarGrafico(roundsHistory) {
        const etiquetas = roundsHistory.map((_, index) => `R${index}`); // Rondas como etiquetas
    
        // Calcular cada métrica como porcentaje de la facturación neta
        const costesVentas = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.costeVentas / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
        const gastosOperativos = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.gastosOperativos / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
        const gastosComerciales = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.gastosComerciales / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
        const costeAlmacenaje = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.costeAlmacenaje / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
        const gastosFinancieros = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.gastosFinancieros / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
        const impuestos = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.impuestos / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
        const resultadoNeto = roundsHistory.map(datos =>
            datos.facturacionNeta ? ((datos.resultadoNeto / datos.facturacionNeta) * 100).toFixed(2) : 0
        );
    
        const ctx = document.getElementById('gastosPorcentajeChart').getContext('2d');
    
        // Destruir gráfico existente si ya está inicializado
        if (window.financialChart) {
            window.financialChart.destroy();
        }
    
        // Crear gráfico de barras apiladas
        window.financialChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [
                    {
                        label: 'Costes de Ventas',
                        data: costesVentas,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)', // Azul claro
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Gastos Operativos', // Mostrar solo el total
                        data: gastosOperativos,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)', // Verde agua
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Gastos Financieros',
                        data: gastosFinancieros,
                        backgroundColor: 'rgba(255, 99, 132, 0.7)', // Rojo claro
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Impuestos',
                        data: impuestos,
                        backgroundColor: 'rgba(102, 255, 102, 0.7)', // Verde claro
                        borderColor: 'rgba(102, 255, 102, 1)',
                        borderWidth: 1,
                    },
                    {
                        label: 'Resultado Neto',
                        data: resultadoNeto,
                        backgroundColor: 'rgba(255, 159, 64, 0.7)', // Naranja
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Rondas',
                            font: {
                                size: 16,
                                weight: 'bold',
                            },
                            color: '#ffffff',
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                size: 14,
                            },
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)',
                        },
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Porcentaje (%)',
                            font: {
                                size: 16,
                                weight: 'bold',
                            },
                            color: '#ffffff',
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                size: 14,
                            },
                            callback: value => `${value}%`,
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.2)',
                        },
                    },
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 14,
                            },
                        },
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                // Mostrar el nombre de la partida
                                return tooltipItems[0].dataset.label;
                            },
                            label: (tooltipItem) => {
                                // Mostrar el valor con formato y símbolo de porcentaje
                                return `${tooltipItem.raw}%`;
                            },
                        },
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 16,
                        },
                        bodyFont: {
                            size: 14,
                        },
                        borderColor: '#ffffff',
                        borderWidth: 1,
                    },
                },
                layout: {
                    padding: {
                        top: 20,
                        bottom: 10,
                        left: 20,
                        right: 20,
                    },
                },
            },
        });
        
    
        // Ajustar estilo del contenedor del gráfico
        document.getElementById('gastosPorcentajeChart').parentElement.style.backgroundColor = '#333';
        document.getElementById('gastosPorcentajeChart').parentElement.style.borderRadius = '10px';
    }
    
});
