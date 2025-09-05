// index.js (lobby) — Koyeb/multipartida ready

// ⚠️ Si en producción el backend está en OTRO dominio, pon la URL explícita:
// const socket = io("https://tuapp.koyeb.app", {
const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'], // WS + fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

socket.on('connect', () => console.log('[OK] conectado', socket.id));
socket.on('connect_error', (e) => console.log('[connect_error]', e?.message, e));
// --- Elementos de la UI ---
const playerNameInput = document.getElementById("playerName");
const partidaIdInput   = document.getElementById("partidaId");
const readyButton     = document.getElementById("readyButton");
const newCodeBtn      = document.getElementById("newCodeBtn");
const copyLinkBtn     = document.getElementById("copyLink");
const statusText      = document.getElementById("status");

// Prefills desde URL/localStorage
const params = new URLSearchParams(location.search);
const urlPartidaId = params.get("partidaId");
const savedName = localStorage.getItem("playerName");
const savedRoom = localStorage.getItem("partidaId");

if (savedName) playerNameInput.value = savedName;
if (urlPartidaId) partidaIdInput.value = urlPartidaId;
else if (savedRoom) partidaIdInput.value = savedRoom;

// Utilidad mensajes
function mostrarMensaje(texto, color) {
  statusText.textContent = texto;
  statusText.style.color = color || "#333";
}

// Generar código aleatorio tipo ABC12
function generarCodigo() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

newCodeBtn.addEventListener("click", () => {
  partidaIdInput.value = generarCodigo();
  mostrarMensaje("Código creado. ¡Comparte el enlace antes de darle a 'Estoy Listo'!", "#3498db");
  actualizarInvitacionEnlace();
});

copyLinkBtn.addEventListener("click", async () => {
  const link = actualizarInvitacionEnlace();
  try {
    await navigator.clipboard.writeText(link);
    mostrarMensaje("Enlace copiado al portapapeles.", "#8e44ad");
  } catch {
    mostrarMensaje("No se pudo copiar. Selecciona y copia manualmente: " + link, "#c0392b");
  }
});

function actualizarInvitacionEnlace() {
  const code = (partidaIdInput.value || "").trim() || generarCodigo();
  const url = new URL(location.href);
  url.searchParams.set("partidaId", code);
  return url.toString();
}

// ENTER envía
playerNameInput.addEventListener("keypress", (e) => { if (e.key === "Enter") readyButton.click(); });
partidaIdInput.addEventListener("keypress",   (e) => { if (e.key === "Enter") readyButton.click(); });

// Botón "Estoy Listo"
readyButton.addEventListener("click", () => {
  const playerName = playerNameInput.value.trim();
  let partidaId = (partidaIdInput.value || "").trim();

  if (!playerName) {
    mostrarMensaje("❗ Por favor, introduce un nombre para continuar.", "#e74c3c");
    return;
  }
  if (!partidaId) {
    partidaId = generarCodigo();
    partidaIdInput.value = partidaId;
  }

  // Guardar en localStorage para game.html
  localStorage.setItem("playerName", playerName);
  localStorage.setItem("partidaId", partidaId);

  // Desactivar inputs
  readyButton.disabled = true;
  playerNameInput.disabled = true;
  partidaIdInput.disabled = true;
  newCodeBtn.disabled = true;
  copyLinkBtn.disabled = true;

  mostrarMensaje("⌛ Esperando a otros jugadores...", "#f1c40f");

  // 1) Unirse a la sala ANTES de identificarse
  socket.emit("joinGame", { partidaId, nombre: playerName });

  // 2) Asociar socket con el jugador + marcar listo
  socket.emit("identificarJugador", playerName);
  socket.emit("playerReady", playerName);
});

// --- Eventos desde el servidor (room de la partida) ---
socket.on("waitingForPlayers", (message) => {
  mostrarMensaje(message || "Esperando a otros jugadores…", "#f39c12");
});

socket.on("startGame", () => {
  mostrarMensaje("✅ ¡Todos listos! Entrando al juego...", "#2ecc71");
  const partidaId = (partidaIdInput.value || localStorage.getItem("partidaId") || "").trim();
  setTimeout(() => {
    // Pasa la partida en la URL para que el cliente de juego se una a la misma sala
    window.location.href = `/game/game.html?partidaId=${encodeURIComponent(partidaId)}`;
  }, 800);
});

socket.on("nombreEnUso", () => {
  mostrarMensaje("⚠️ Ese nombre ya está en uso. Prueba otro.", "#e67e22");
  readyButton.disabled = false;
  playerNameInput.disabled = false;
  partidaIdInput.disabled = false;
  newCodeBtn.disabled = false;
  copyLinkBtn.disabled = false;
});

// Temporizador de inscripción por sala
socket.on("temporizadorInscripcionTick", ({ tiempoRestante }) => {
  const temporizadorDiv = document.getElementById("temporizador");
  if (!temporizadorDiv) return;
  temporizadorDiv.textContent =
    tiempoRestante > 0
      ? `⏳ La partida comienza en ${tiempoRestante} segundos...`
      : "¡La partida va a comenzar!";
});

// (Opcional) UX de conexión en redes móviles/proxy
socket.on("connect", () => mostrarMensaje("Conectado. Puedes crear o unirte a una partida.", "#2ecc71"));
socket.on("connect_error", () => mostrarMensaje("No se pudo conectar. Reintentando…", "#e74c3c"));
socket.on("reconnect", (n) => mostrarMensaje(`Reconectado (intento ${n}).`, "#27ae60"));
