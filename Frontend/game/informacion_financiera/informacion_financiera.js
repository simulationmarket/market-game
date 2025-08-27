document.addEventListener('DOMContentLoaded', function () {
    const socket = io();

    // Recuperar el nombre del jugador
    const playerName = localStorage.getItem("playerName");
    if (!playerName) {
        alert("No se ha encontrado el nombre del jugador. Redirigiendo al inicio.");
        window.location.href = "index.html";
        return;
    }

    console.log("Identificando jugador:", playerName);
    socket.emit("identificarJugador", playerName);

    const navButtons = document.querySelectorAll(".nav-button");
    const contentSections = document.querySelectorAll(".content-section");

    // Función para sincronizar datos con un iframe
    const sincronizarIframe = (iframeSelector, message) => {
        const iframe = document.querySelector(iframeSelector);
        if (iframe && iframe.contentWindow) {
            console.log(`Enviando datos al iframe (${iframeSelector}):`, message);
            iframe.contentWindow.postMessage(message, '*');
        } else {
            console.warn(`Iframe no encontrado o no cargado: ${iframeSelector}`);
        }
    };

    // Sincronizar datos iniciales
    socket.on("syncPlayerData", (data) => {
        console.log("Datos sincronizados recibidos:", data);

        const roundsHistory = data.roundsHistory || [];
        localStorage.setItem("roundsHistory", JSON.stringify(roundsHistory));

        // Sincronizar iframes
        sincronizarIframe('iframe[src="cuenta_resultados/cuenta_resultados.html"]', {
            playerName,
            roundsHistory,
        });

        sincronizarIframe('iframe[src="cr_producto/cr_producto.html"]', {
            playerName,
            roundsHistory,
            resultados: [],
        });

        sincronizarIframe('iframe[src="ventas/ventas.html"]', {
            playerName,
            roundsHistory,
            resultados: [],
        });
    });

    // Sincronizar resultados completos con los iframes que lo necesitan
    socket.on("resultadosCompletos", (resultados) => {
        console.log("Resultados completos recibidos:", resultados);

        if (resultados.length > 0) {
            const roundsHistory = JSON.parse(localStorage.getItem("roundsHistory") || "[]");

            sincronizarIframe('iframe[src="cr_producto/cr_producto.html"]', {
                playerName,
                roundsHistory,
                resultados,
            });

            sincronizarIframe('iframe[src="ventas/ventas.html"]', {
                playerName,
                roundsHistory,
                resultados,
            });

        } else {
            console.warn("Resultados vacíos, no se sincronizarán.");
        }
    });

    // Navegación entre secciones
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            contentSections.forEach(section => section.classList.remove('active'));
            const targetId = button.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            targetSection.classList.add('active');

            console.log(`Navegando a: ${targetId}`);

            // Lanzar sincronización de resultados si se entra a cr_producto o ventas
            if (targetId === 'cuenta-productos' || targetId === 'ventas') {
                socket.emit('solicitarResultadosCompletos');
            }
        });
    });
});
