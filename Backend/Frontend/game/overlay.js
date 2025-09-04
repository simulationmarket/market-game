(function (global) {
  let overlayEl = null, contentEl = null;

  function init(opts = {}) {
    overlayEl = document.getElementById(opts.overlayId || 'resultadosOverlay');
    contentEl = document.getElementById(opts.contentId || 'resultadosContent');
  }

  // ===== Helpers =====
  function getLastClosedRoundIndex(estados = []) {
    if (!Array.isArray(estados) || estados.length === 0) return -1;
    const maxLen = estados.reduce((m,e)=> Math.max(m, Array.isArray(e.roundsHistory)? e.roundsHistory.length : 0), 0);
    return Math.max(-1, maxLen - 1);
  }

  const toNum = (v) => Number(v) || 0;
  const fmtMEUR = (n) => `${(toNum(n)/1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;

  function delta(curr, prev) {
    if (prev === null || prev === undefined) return { abs: null, pct: null, dir: 0 };
    const c = toNum(curr), p = toNum(prev);
    if (p === 0 && c === 0) return { abs: 0, pct: 0, dir: 0 };
    if (p === 0) return { abs: c - p, pct: null, dir: c > 0 ? 1 : (c < 0 ? -1 : 0) };
    const abs = c - p;
    const pct = (abs / Math.abs(p)) * 100;
    const dir = abs > 0 ? 1 : (abs < 0 ? -1 : 0);
    return { abs, pct, dir };
  }

  function metricSeries(e, key) {
    const rh = Array.isArray(e.roundsHistory) ? e.roundsHistory : [];
    return rh.map(r => toNum(r?.[key]));
  }

  function lastNUpToIndex(series, uptoIndex, n = 4) {
    const end = Math.min(series.length, uptoIndex + 1);
    const start = Math.max(0, end - n);
    const arr = series.slice(start, end);
    while (arr.length < n) arr.unshift(0);
    return { values: arr, startIndex: end - arr.length }; // devolvemos también el índice real del primer valor
  }

  // ===== Gráfico de BARRAS (4 últimas rondas) con color por barra =====
  /**
   * Dibuja un bar chart con 4 barras y etiquetas.
   * Cada barra colorea ↑/↓/= según su Δ vs su ronda anterior.
   * @param {number[]} values 4 últimos valores (incluye actual)
   * @param {string[]} labels etiquetas tipo ["R03","R04","R05","R06"]
   * @param {number|null} prevForFirst valor de la ronda anterior a la PRIMERA barra (para calcular su Δ). Si null => flat
   * @param {boolean} isPrice formatea como € si true; si false, en M€
   */
  function barChart(values, labels, prevForFirst, isPrice = false) {
    const w = 480, h = 180, pad = {t:16, r:16, b:32, l:40};
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;

    const nums = values.map(toNum);
    const min = Math.min(0, ...nums);
    const max = Math.max(...nums, 1);
    const range = (max - min) || 1;

    const barGap = 12;
    const barW = (innerW - barGap * (nums.length - 1)) / nums.length;

    const y = (v) => pad.t + innerH - ((v - min) / range) * innerH;
    const x = (i) => pad.l + i * (barW + barGap);

    const fmt = (v) => isPrice
      ? `${v.toLocaleString('es-ES',{maximumFractionDigits:2})} €`
      : fmtMEUR(v);

    // Línea de cero si hay positivos y negativos
    const zeroY = (min < 0 && max > 0) ? y(0) : null;

    const bars = nums.map((v, i) => {
      const prev = (i === 0) ? (prevForFirst ?? null) : nums[i - 1];
      let dir = 0;
      if (prev !== null && prev !== undefined) {
        if (v > prev) dir = 1; else if (v < prev) dir = -1; else dir = 0;
      }
      const cls = dir > 0 ? 'up' : dir < 0 ? 'down' : 'flat';

      const xi = x(i);
      const yi = Math.min(y(v), y(0));
      const height = Math.abs(y(v) - y(0));

      return `
        <rect class="bar ${cls}" x="${xi}" y="${yi}" width="${barW}" height="${height}"></rect>
        <text x="${xi + barW/2}" y="${yi - 6}" text-anchor="middle">${fmt(v)}</text>
        <text x="${xi + barW/2}" y="${pad.t + innerH + 16}" text-anchor="middle" class="axis">${labels[i]}</text>
      `;
    }).join('');

    return `
      <svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        ${zeroY !== null ? `<line x1="${pad.l}" y1="${zeroY}" x2="${pad.l+innerW}" y2="${zeroY}" stroke="#6b7280" stroke-width="1" class="axis"/>` : ''}
        ${bars}
      </svg>
    `;
  }

  // ===== Slides de métricas (con barChart por barra) =====
  function slideForMetric(estados, rIndex, metric) {
    const rows = estados.map(e => {
      const rh   = Array.isArray(e.roundsHistory) ? e.roundsHistory : [];
      const curr = rh[rIndex] || {};
      const prev = rIndex > 0 ? rh[rIndex-1] || null : null;

      const currV = toNum(curr[metric.key]);
      const prevV = prev ? toNum(prev[metric.key]) : null;
      const d = delta(currV, prevV); // << KPIs Δ abs / Δ % siguen basados en la última ronda (color aquí)

      const fullSeries = metricSeries(e, metric.key);
      const { values: last4, startIndex } = lastNUpToIndex(fullSeries, rIndex, 4);

      // Etiquetas "Rxx" en base al índice real
      const labels = last4.map((_, i, arr) => {
        const base = rIndex - (arr.length - 1 - i);
        const num = Math.max(0, base);
        return `R${String(num).padStart(2,'0')}`;
      });

      // Valor previo a la PRIMERA barra para que su color sea correcto
      const prevForFirst = (startIndex - 1 >= 0) ? toNum(fullSeries[startIndex - 1]) : null;

      const isPrice = metric.key === 'valorAccion';
      const chart = barChart(last4, labels, prevForFirst, isPrice);

      return { name: e.playerName || 'Jugador', currV, d, chart };
    }).sort((a,b) => b.currV - a.currV);

    return `
      <div class="slide" data-metric="${metric.key}">
        <div class="slide-title">${metric.title}</div>
        <div class="grid-cards">
          ${rows.map(r => `
            <div class="card">
              <div class="card-head">
                <div class="name">${r.name}</div>
                <div class="curr">${
                  metric.key==='valorAccion'
                    ? `${toNum(r.currV).toLocaleString('es-ES',{maximumFractionDigits:2})} €`
                    : fmtMEUR(r.currV)
                }</div>
              </div>
              <div class="kpi">
                <div class="label">Δ abs</div>
                <div class="num ${r.d.dir>0?'up':(r.d.dir<0?'down':'flat')}">${
                  r.d.abs===null ? '—' :
                    (metric.key==='valorAccion'
                      ? `${r.d.dir>0?'▲':'▼'} ${Math.abs(r.d.abs).toLocaleString('es-ES',{maximumFractionDigits:2})} €`
                      : `${r.d.dir>0?'▲':'▼'} ${fmtMEUR(Math.abs(r.d.abs))}`
                    )
                }</div>
                <div class="label">Δ %</div>
                <div class="num ${r.d.dir>0?'up':(r.d.dir<0?'down':'flat')}">
                  ${r.d.pct===null ? '—' : `${r.d.dir>0?'▲':(r.d.dir<0?'▼':'●')} ${Math.abs(r.d.pct).toFixed(1)}%`}
                </div>
              </div>
              ${r.chart}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderResultados(estados, rIndex) {
    if (!overlayEl || !contentEl) return;

    // Header (sin podio)
    const header = `
      <div class="overlay-header">
        <div class="title">Resultados — Ronda ${rIndex}</div>
        <button class="overlay-close" type="button" aria-label="Cerrar">✕</button>
      </div>
    `;

    // Slides: Precio → Facturación → Margen → BAII → BAI → Resultado Neto
    const metrics = [
      { key: 'valorAccion',     title: 'Precio de la acción' },
      { key: 'facturacionNeta', title: 'Facturación Neta'    },
      { key: 'margenBruto',     title: 'Margen Bruto'        },
      { key: 'baii',            title: 'BAII'                },
      { key: 'bai',             title: 'BAI'                 },
      { key: 'resultadoNeto',   title: 'Resultado Neto'      },
    ];

    const slidesHtml = metrics
      .map(m => slideForMetric(estados, rIndex, { key: m.key, title: m.title }))
      .join('');

    const carousel = `
      <div class="carousel" data-index="0">
        <div class="viewport">
          <div class="slides">${slidesHtml}</div>
        </div>
        <div class="dots">
          ${metrics.map((_,i)=> `<button class="dot ${i===0?'active':''}" type="button" data-to="${i}" aria-label="Ir al slide ${i+1}"></button>`).join('')}
        </div>
      </div>
    `;

    contentEl.innerHTML = `${header}${carousel}`;
    overlayEl.classList.remove('hidden');

    // Botón cerrar
    const closeBtn = contentEl.querySelector('.overlay-close');
    if (closeBtn) closeBtn.addEventListener('click', hide);

    // Flechas fuera del recuadro (una sola vez)
    if (!overlayEl.querySelector('.overlay-nav.prev')) {
      overlayEl.insertAdjacentHTML('beforeend', `<button class="overlay-nav prev" type="button" aria-label="Anterior" title="Anterior">‹</button>`);
      overlayEl.insertAdjacentHTML('beforeend', `<button class="overlay-nav next" type="button" aria-label="Siguiente" title="Siguiente">›</button>`);
    }
    const prevBtn = overlayEl.querySelector('.overlay-nav.prev');
    const nextBtn = overlayEl.querySelector('.overlay-nav.next');

    // Control de carrusel — circular
    const root = contentEl.querySelector('.carousel');
    const viewport = root.querySelector('.viewport');
    const slidesEl = root.querySelector('.slides');
    const dots = Array.from(root.querySelectorAll('.dot'));
    const slideCount = root.querySelectorAll('.slide').length;

    const safeCount = Math.max(slideCount, dots.length);
    const setActiveDot = (i) => dots.forEach((d, j) => d.classList.toggle('active', j === i));

    const goTo = (idx) => {
      if (!safeCount) return;
      let i = Number(root.dataset.index || 0);
      i = (idx % safeCount + safeCount) % safeCount; // wrap duro
      root.dataset.index = String(i);
      slidesEl.style.transform = `translateX(-${i * 100}%)`;
      setActiveDot(i);
      viewport.scrollTop = 0;
    };

    prevBtn.onclick = () => goTo((Number(root.dataset.index || 0) - 1));
    nextBtn.onclick = () => goTo((Number(root.dataset.index || 0) + 1));
    dots.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.to))));

    // Accesibilidad: teclas ← →
    overlayEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  goTo(Number(root.dataset.index || 0) - 1);
      if (e.key === 'ArrowRight') goTo(Number(root.dataset.index || 0) + 1);
    });
    overlayEl.tabIndex = -1;
    overlayEl.focus();
  }

  function handleTodosLosEstados(estados, showOverlayPendingForRound, lastRoundOverlayShown) {
    const closedIndex = getLastClosedRoundIndex(estados);
    if (closedIndex < 0) return { lastRoundOverlayShown, showOverlayPendingForRound };

    const rIndex = Math.min(
      typeof showOverlayPendingForRound === 'number' ? showOverlayPendingForRound : closedIndex,
      closedIndex
    );
    if (rIndex <= lastRoundOverlayShown) return { lastRoundOverlayShown, showOverlayPendingForRound };

    renderResultados(estados, rIndex);
    return { lastRoundOverlayShown: rIndex, showOverlayPendingForRound: -1 };
  }

  function hide() { if (overlayEl) overlayEl.classList.add('hidden'); }

  global.Overlay = { init, getLastClosedRoundIndex, renderResultados, handleTodosLosEstados, hide };
})(window);
