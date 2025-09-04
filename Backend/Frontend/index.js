const socket = io();
const playerNameInput = document.getElementById("playerName");
const readyButton = document.getElementById("readyButton");
const statusText = document.getElementById("status");

// Manejo del botón de "Listo"
readyButton.addEventListener("click", () => {
  const playerName = playerNameInput.value.trim();

  if (!playerName) {
    mostrarMensaje("❗ Por favor, introduce un nombre para continuar.", "#e74c3c");
    return;
  }

  // Guardar nombre y desactivar entradas
  localStorage.setItem("playerName", playerName);
  readyButton.disabled = true;
  playerNameInput.disabled = true;

  mostrarMensaje("⌛ Esperando a otros jugadores...", "#f1c40f");

  // 🔑 Esta línea permite que el servidor asocie socket con jugador
  socket.emit("identificarJugador", playerName);

  // Marcar al jugador como listo
  socket.emit("playerReady", playerName);
});

// Permitir usar ENTER para enviar nombre
playerNameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    readyButton.click();
  }
});

// Iniciar juego cuando todos estén listos
socket.on("startGame", () => {
  mostrarMensaje("✅ ¡Todos listos! Entrando al juego...", "#2ecc71");

  setTimeout(() => {
    // Asegúrate de que el archivo está en /game/game.html
    window.location.href = "/game/game.html";
  }, 1000);
});

// Manejar nombres en uso
socket.on("nombreEnUso", () => {
  mostrarMensaje("⚠️ Ese nombre ya está en uso. Prueba otro.", "#e67e22");
  readyButton.disabled = false;
  playerNameInput.disabled = false;
});

// Utilidad para actualizar estado
function mostrarMensaje(texto, color) {
  statusText.textContent = texto;
  statusText.style.color = color;
}
// Escuchar actualizaciones del temporizador desde el servidor
socket.on("temporizadorInscripcionTick", ({ tiempoRestante }) => {
  const temporizadorDiv = document.getElementById("temporizador");

  if (temporizadorDiv) {
    if (tiempoRestante > 0) {
      temporizadorDiv.textContent = `⏳ La partida comienza en ${tiempoRestante} segundos...`;
    } else {
      temporizadorDiv.textContent = "¡La partida va a comenzar!";
    }
  }
});
