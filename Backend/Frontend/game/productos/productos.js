document.addEventListener("DOMContentLoaded", () => {
  const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],  // ✅ permite fallback
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

  // === Multisala (sin cambios funcionales) ===
  const params = new URLSearchParams(location.search);
  const partidaId  = params.get("partidaId")  || localStorage.getItem("partidaId")  || "default";
  const playerName = localStorage.getItem("playerName") || params.get("playerName") || null;

  socket.emit("joinGame", { partidaId, nombre: playerName || null });
  if (playerName) socket.emit("identificarJugador", playerName);

  // DOM
  const grid    = document.getElementById("productos-lista");
  const backBtn = document.getElementById("back-button");

  backBtn?.addEventListener("click", () => {
    const url = new URL("../game.html", location.href);
    url.searchParams.set("partidaId", partidaId);
    if (playerName) url.searchParams.set("playerName", playerName);
    location.href = url.pathname + "?" + url.searchParams.toString();
  });

  // Estado
  let allProducts = [];

  // Utils
  const fmtMoney = (n) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  const initials = (nombre = "") => {
    const parts = String(nombre).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() || "").join("");
  };

  const specRow = (k, v) => `
    <div class="spec-row">
      <span class="spec-key">${k}</span>
      <span class="spec-sep"></span>
      <span class="spec-val">${v}</span>
    </div>
  `;

  function render(products) {
    if (!grid) return;
    grid.innerHTML = "";

    if (!products.length) {
      grid.innerHTML = `<div class="empty">No tienes productos en el portfolio todavía.</div>`;
      return;
    }

    products.forEach((p) => {
      const nombre = p?.nombre ?? "Producto";
      const descripcion = p?.descripcion ?? "";
      // ✅ Usamos SIEMPRE características base
      const caracteristicas = p?.caracteristicas || {};
      const coste = (p?.costeUnitarioEst != null) ? fmtMoney(p.costeUnitarioEst) : "—";

      const specsHTML = Object.entries(caracteristicas).map(([k, v]) => specRow(k, v)).join("");

      const card = document.createElement("article");
      card.className = "producto";
      card.innerHTML = `
        <div class="card-head">
          <div class="avatar" aria-hidden="true">${initials(nombre) || "PR"}</div>
          <div class="title">
            <h3 title="${nombre}">${nombre}</h3>
            <p title="${descripcion}">${descripcion || "Sin descripción"}</p>
          </div>
        </div>

        <div class="card-body">
          <div class="specs" aria-label="Características">
            ${specsHTML || '<div class="spec-row"><span class="spec-key">Características</span><span class="spec-sep"></span><span class="spec-val">Sin datos</span></div>'}
          </div>

          <div class="metric" role="group" aria-label="Métricas">
            <span class="label">Coste unitario estimado</span>
            <span class="value">${coste}</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-danger" data-action="delete">Descatalogar</button>
          <button class="btn btn-ghost"  data-action="details">Detalles</button>
        </div>
      `;

      // Acciones (sin cambios funcionales)
      card.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (!confirm(`¿Descatalogar "${nombre}"?`)) return;
        socket.emit("eliminarProducto", { partidaId, playerName, producto: nombre });
        allProducts = allProducts.filter(x => x?.nombre !== nombre); // optimista
        render(allProducts);
      });

      card.querySelector('[data-action="details"]').addEventListener("click", () => {
        alert(
`Nombre: ${nombre}
Descripción: ${descripcion || "—"}
Coste unitario: ${coste}`
        );
      });

      grid.appendChild(card);
    });
  }

  // Datos entrantes (sin cambios)
  socket.on("syncPlayerData", (data) => {
    const products = Array.isArray(data?.products) ? data.products : [];
    allProducts = products;
    render(allProducts);
  });
});
