(function (global) {
  let overlayEl = null, contentEl = null;

  function init(opts = {}) {
    overlayEl = document.getElementById(opts.overlayId || 'finalOverlay');
    contentEl = document.getElementById(opts.contentId || 'finalContent');
  }

  function hide() { if (overlayEl) overlayEl.classList.add('hidden'); }

  // ========= helpers formateo =========
  const toNum = (v) => Number(v) || 0;
  const fmtMEUR = (n) => `${(toNum(n)/1e6).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M€`;
  const fmtEUR = (n) => (toNum(n)).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' €';
  const clsDelta = (v) => v == null ? 'flat' : (v > 0 ? 'up' : (v < 0 ? 'down' : 'flat'));
  const fmtPct = (p) => {
    if (p === null || p === undefined) return '—';
    const sign = p > 0 ? '▲' : (p < 0 ? '▼' : '●');
    return `${sign} ${Math.abs(p).toFixed(1)}%`;
  };
  function delta(curr, prev) {
    if (prev === null || prev === undefined) return { abs: null, pct: null, dir: 0 };
    const c = toNum(curr), p = toNum(prev);
    if (p === 0 && c === 0) return { abs: 0, pct: 0, dir: 0 };
    if (p === 0) return { abs: c - p, pct: null, dir: c > 0 ? 1 : (c < 0 ? -1 : 0) };
    const abs = c - p, pct = (abs / Math.abs(p)) * 100, dir = abs > 0 ? 1 : (abs < 0 ? -1 : 0);
    return { abs, pct, dir };
  }
  const metricSeries = (e, key) => (Array.isArray(e.roundsHistory) ? e.roundsHistory : []).map(r => toNum(r?.[key]));
  function lastNUpToIndex(series, uptoIndex, n = 4) {
    const end = Math.min(series.length, uptoIndex + 1);
    const start = Math.max(0, end - n);
    const arr = series.slice(start, end);
    while (arr.length < n) arr.unshift(0);
    return { values: arr, startIndex: end - arr.length };
  }

  // ===== bar chart 4 barras (mismo estilo que overlay.js) =====
  function barChart(values, labels, prevForFirst, isPrice = false) {
    const w = 480, h = 180, pad = {t:16, r:16, b:32, l:40};
    const innerW = w - pad.l - pad.r, innerH = h - pad.t - pad.b;

    const nums = values.map(toNum);
    const min = Math.min(0, ...nums);
    const max = Math.max(...nums, 1);
    const range = (max - min) || 1;

    const barGap = 12;
    const barW = (innerW - barGap * (nums.length - 1)) / nums.length;

    const y = (v) => pad.t + innerH - ((v - min) / range) * innerH;
    const x = (i) => pad.l + i * (barW + barGap);

    const fmt = (v) => isPrice ? `${v.toLocaleString('es-ES',{maximumFractionDigits:2})} €` : fmtMEUR(v);
    const zeroY = (min < 0 && max > 0) ? y(0) : null;

    const bars = nums.map((v, i) => {
      const prev = (i === 0) ? (prevForFirst ?? null) : nums[i - 1];
      let dir = 0; if (prev !== null && prev !== undefined) dir = v > prev ? 1 : (v < prev ? -1 : 0);
      const cls = dir > 0 ? 'up' : dir < 0 ? 'down' : 'flat';
      const xi = x(i), yi = Math.min(y(v), y(0)), height = Math.abs(y(v) - y(0));
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

  // ===== slide builder (idéntico al del overlay de rondas) =====
  function slideForMetric(estados, rIndex, metric) {
    const rows = estados.map(e => {
      const rh   = Array.isArray(e.roundsHistory) ? e.roundsHistory : [];
      const curr = rh[rIndex] || {};
      const prev = rIndex > 0 ? rh[rIndex-1] || null : null;

      const currV = toNum(curr[metric.key]);
      const prevV = prev ? toNum(prev[metric.key]) : null;
      const d = delta(currV, prevV);

      const fullSeries = metricSeries(e, metric.key);
      const { values: last4, startIndex } = lastNUpToIndex(fullSeries, rIndex, 4);

      const labels = last4.map((_, i, arr) => {
        const base = rIndex - (arr.length - 1 - i);
        const num = Math.max(0, base);
        return `R${String(num).padStart(2,'0')}`;
      });

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

  // ========= RENDER PRINCIPAL =========
  function render(payload) {
    if (!overlayEl || !contentEl) return;

    const roundIndex = payload?.roundIndex ?? 10;
    const leaderboard = Array.isArray(payload?.leaderboard) ? payload.leaderboard : [];

    // TOP 4 – tarjetas/podio
    const top4 = leaderboard.slice(0, 4);
    const rankClass = (i) => i===0 ? 'pod-1' : i===1 ? 'pod-2' : i===2 ? 'pod-3' : 'pod-4';
    const rankLabel = (i) => `#${i+1}`;
    const podHtml = top4.map((r, i) => `
      <div class="pod-card ${rankClass(i)}">
        <div class="pod-head">
          ${i===0 ? `<div class="trophy">🏆</div>` : ''}
          <span class="pod-rank">${rankLabel(i)}</span>
          <span class="pod-name">${r.name}</span>
        </div>
        <div>
          <span class="pod-metric">${fmtEUR(r.valorAccion)}</span>
          <span class="pod-delta ${clsDelta(r.deltaPct)}" style="margin-left:8px;">${fmtPct(r.deltaPct)}</span>
        </div>
      </div>
    `).join('');

    // Contenedor del carrusel de resultados (se inyecta cuando tengamos 'estados')
    contentEl.innerHTML = `
      <div class="final-title">Partida finalizada — Ronda ${roundIndex}</div>

      <div class="podium4">${podHtml}</div>

      <div class="results-block">
        <div class="subsection-title">Resumen de resultados</div>
        <div id="finalResultsInner">
          <div style="opacity:.7;padding:8px;">Cargando resumen…</div>
        </div>
      </div>

      <div class="final-actions">
        <button class="btn" id="btnGoHome">Volver al inicio</button>
      </div>
    `;

    overlayEl.classList.remove('hidden');

    const goHome = () => {
      try { if (global.socket) global.socket.emit?.('leaveRoom'); } catch(e){}
      window.location.replace('/');
    };
    const btn = contentEl.querySelector('#btnGoHome');
    if (btn) btn.addEventListener('click', goHome);

    overlayEl.tabIndex = -1;
    overlayEl.onkeydown = (e) => { if (e.key === 'Enter') goHome(); };
    overlayEl.focus();
  }

  // ========= INYECTAR CARRUSEL (dentro del overlay final) =========
  function injectResults(estados = [], rIndex = null) {
    if (!overlayEl || !contentEl) return;
    const mount = contentEl.querySelector('#finalResultsInner');
    if (!mount) return;

    // Si no nos pasan índice, usamos el último consolidado
    const getLastClosedRoundIndex = (arr = []) => {
      if (!Array.isArray(arr) || arr.length === 0) return -1;
      const maxLen = arr.reduce((m,e)=> Math.max(m, Array.isArray(e.roundsHistory)? e.roundsHistory.length : 0), 0);
      return Math.max(-1, maxLen - 1);
    };
    const closedIndex = getLastClosedRoundIndex(estados);
    const idx = (typeof rIndex === 'number' ? rIndex : closedIndex);
    if (idx < 0) {
      mount.innerHTML = `<div style="opacity:.7;padding:8px;">Sin rondas cerradas.</div>`;
      return;
    }

    const metrics = [
      { key: 'valorAccion',     title: 'Precio de la acción' },
      { key: 'facturacionNeta', title: 'Facturación Neta'    },
      { key: 'margenBruto',     title: 'Margen Bruto'        },
      { key: 'baii',            title: 'BAII'                },
      { key: 'bai',             title: 'BAI'                 },
      { key: 'resultadoNeto',   title: 'Resultado Neto'      },
    ];
    const slidesHtml = metrics.map(m => slideForMetric(estados, idx, m)).join('');

    mount.innerHTML = `
      <div class="carousel" data-index="0">
        <div class="viewport">
          <div class="slides">${slidesHtml}</div>
        </div>
        <div class="dots">
          ${metrics.map((_,i)=> `<button class="dot ${i===0?'active':''}" type="button" data-to="${i}" aria-label="Ir al slide ${i+1}"></button>`).join('')}
        </div>
      </div>
    `;

    // Controles del carrusel (locales a este bloque)
    const root = mount.querySelector('.carousel');
    const viewport = root.querySelector('.viewport');
    const slidesEl = root.querySelector('.slides');
    const dots = Array.from(root.querySelectorAll('.dot'));
    const slideCount = root.querySelectorAll('.slide').length;
    const safeCount = Math.max(slideCount, dots.length);
    const setActiveDot = (i) => dots.forEach((d, j) => d.classList.toggle('active', j === i));

    const goTo = (idx2) => {
      if (!safeCount) return;
      let i = Number(root.dataset.index || 0);
      i = (idx2 % safeCount + safeCount) % safeCount; // wrap circular
      root.dataset.index = String(i);
      slidesEl.style.transform = `translateX(-${i * 100}%)`;
      setActiveDot(i);
      viewport.scrollTop = 0;
    };

    dots.forEach(d => d.addEventListener('click', () => goTo(Number(d.dataset.to))));
    // teclas ← →
    overlayEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  goTo(Number(root.dataset.index || 0) - 1);
      if (e.key === 'ArrowRight') goTo(Number(root.dataset.index || 0) + 1);
    });
  }

  // API pública
  global.FinalOverlay = { init, render, injectResults, hide };
})(window);
