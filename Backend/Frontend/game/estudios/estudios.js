document.addEventListener('DOMContentLoaded', function () {
    const socket = io();

    // Recuperar el nombre del jugador almacenado en localStorage
    const playerName = localStorage.getItem("playerName");
    if (!playerName) {
        alert("No se ha encontrado el nombre del jugador. Redirigiendo al inicio.");
        window.location.href = "index.html";
        return;
    }

    // Emitir evento para identificar al jugador
    socket.emit("identificarJugador", playerName);

    const btnConsumo = document.getElementById('consumo-btn');
    const btnSegmentos = document.getElementById('segmentos-btn');
    const btnBenchmark = document.getElementById('benchmark-btn');

    const iframe = document.getElementById('iframe-content');

    if (btnConsumo) {
        btnConsumo.addEventListener('click', function () {
            iframe.src = 'consumo.html';
        });
    }

    if (btnSegmentos) {
        btnSegmentos.addEventListener('click', function () {
            iframe.src = 'segmentos.html';
        });
    }

    if (btnBenchmark) {
        btnBenchmark.addEventListener('click', function () {
            iframe.src = 'benchmark.html';
        });
    }

    // Cargar por defecto la página de segmentos
    iframe.src = 'segmentos.html';

    const btnVolver = document.getElementById('volver-btn');

if (btnVolver) {
    btnVolver.addEventListener('click', function () {
        window.location.href = '../game.html'; // Redirige a game.html
    });
}

});