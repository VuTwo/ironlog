/* charts.js — lightweight SVG charts (line + crosshair tooltip, bars, stacked bars).
   Colors come from CSS custom properties set in app.css (light/dark aware). */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util;
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceTicks(min, max, count) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    let step = mag;
    for (const m of [1, 2, 2.5, 5, 10]) { if (step0 <= m * mag) { step = m * mag; break; } }
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return ticks;
  }

  const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

  /* Line chart.
     opts: { points:[{x:Date-ms, y:number, label?:string}], points2?: same (secondary/trend line),
             yFmt(v), xFmt(ms), height, tooltip(pt)→html, color?, showDots? } */
  FT.chartLine = function (container, opts) {
    container.innerHTML = '';
    const pts = opts.points || [];
    if (pts.length < 2) {
      container.innerHTML = '<div class="chart-empty">Not enough data yet — log a few more sessions.</div>';
      return;
    }
    const W = container.clientWidth || 340;
    const H = opts.height || 200;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'chart' }, container);

    const xs = pts.map((p) => p.x);
    const ysAll = pts.map((p) => p.y).concat(opts.points2 ? opts.points2.map((p) => p.y) : []);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let yMin = Math.min(...ysAll), yMax = Math.max(...ysAll);
    const padY = (yMax - yMin) * 0.12 || yMax * 0.1 || 1;
    yMin = Math.max(0, yMin - padY); yMax = yMax + padY;
    const ticks = niceTicks(yMin, yMax, 4);
    yMin = ticks[0]; yMax = ticks[ticks.length - 1];

    const px = (x) => PAD.left + ((x - xMin) / Math.max(1, xMax - xMin)) * (W - PAD.left - PAD.right);
    const py = (y) => PAD.top + (1 - (y - yMin) / Math.max(0.0001, yMax - yMin)) * (H - PAD.top - PAD.bottom);

    // grid + y labels
    for (const t of ticks) {
      el('line', { x1: PAD.left, x2: W - PAD.right, y1: py(t), y2: py(t), class: 'grid' }, svg);
      const txt = el('text', { x: PAD.left - 6, y: py(t) + 3, class: 'tick', 'text-anchor': 'end' }, svg);
      txt.textContent = opts.yFmt ? opts.yFmt(t) : t;
    }
    // x labels: first, middle, last
    const xFmt = opts.xFmt || ((ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const xIdx = pts.length > 2 ? [0, Math.floor(pts.length / 2), pts.length - 1] : [0, pts.length - 1];
    for (const i of xIdx) {
      const t = el('text', { x: px(pts[i].x), y: H - 6, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle' }, svg);
      t.textContent = xFmt(pts[i].x);
    }

    const lineColor = opts.color || 'var(--series-1)';
    const path = (arr) => arr.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join('');

    // area fill under the smooth line (trend if present, else primary)
    const areaPts = opts.points2 || pts;
    const area = `${path(areaPts)}L${px(areaPts[areaPts.length - 1].x).toFixed(1)},${py(yMin)}L${px(areaPts[0].x).toFixed(1)},${py(yMin)}Z`;
    el('path', { d: area, fill: lineColor, opacity: '0.08' }, svg);

    // secondary (raw/scatter) behind trend
    if (opts.points2) {
      el('path', { d: path(opts.points2), fill: 'none', stroke: lineColor, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      // primary becomes dots-only raw data
    }
    if (opts.dotsOnly) {
      for (const p of pts) el('circle', { cx: px(p.x), cy: py(p.y), r: 3, fill: lineColor, opacity: 0.45 }, svg);
    } else {
      el('path', { d: path(pts), fill: 'none', stroke: lineColor, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    }
    if (opts.showDots && !opts.dotsOnly) {
      for (const p of pts) el('circle', { cx: px(p.x), cy: py(p.y), r: 3.5, fill: lineColor, class: 'dot-ring' }, svg);
    }

    // hover layer: crosshair + tooltip
    const hover = el('g', { style: 'display:none' }, svg);
    const vline = el('line', { y1: PAD.top, y2: H - PAD.bottom, class: 'crosshair' }, hover);
    const dot = el('circle', { r: 5, fill: lineColor, class: 'hover-dot' }, hover);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.style.display = 'none';
    container.style.position = 'relative';
    container.appendChild(tip);

    const hoverPts = (opts.points2 && opts.dotsOnly) ? opts.points2 : pts; // tooltip follows trend line if present
    function showAt(clientX) {
      const rect = svg.getBoundingClientRect();
      const mx = ((clientX - rect.left) / rect.width) * W;
      let best = 0, bd = Infinity;
      hoverPts.forEach((p, i) => { const d = Math.abs(px(p.x) - mx); if (d < bd) { bd = d; best = i; } });
      const p = hoverPts[best];
      hover.style.display = '';
      vline.setAttribute('x1', px(p.x)); vline.setAttribute('x2', px(p.x));
      dot.setAttribute('cx', px(p.x)); dot.setAttribute('cy', py(p.y));
      tip.style.display = '';
      tip.innerHTML = opts.tooltip ? opts.tooltip(p, best) : `<b>${opts.yFmt ? opts.yFmt(p.y) : p.y}</b>`;
      const tw = tip.offsetWidth;
      let left = (px(p.x) / W) * rect.width - tw / 2;
      left = U.clamp(left, 0, rect.width - tw);
      tip.style.left = left + 'px';
      tip.style.top = '0px';
    }
    function hide() { hover.style.display = 'none'; tip.style.display = 'none'; }
    svg.addEventListener('pointermove', (e) => showAt(e.clientX));
    svg.addEventListener('pointerdown', (e) => showAt(e.clientX));
    svg.addEventListener('pointerleave', hide);
  };

  /* Bar chart. opts: { bars:[{x:label, y:number, meta?}], yFmt, height, tooltip(bar)→html, color } */
  FT.chartBars = function (container, opts) {
    container.innerHTML = '';
    const bars = opts.bars || [];
    if (!bars.length) { container.innerHTML = '<div class="chart-empty">No data yet.</div>'; return; }
    const W = container.clientWidth || 340;
    const H = opts.height || 180;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'chart' }, container);
    let yMax = Math.max(...bars.map((b) => b.y), 1);
    const ticks = niceTicks(0, yMax, 3);
    yMax = ticks[ticks.length - 1];
    const py = (y) => PAD.top + (1 - y / yMax) * (H - PAD.top - PAD.bottom);
    for (const t of ticks) {
      el('line', { x1: PAD.left, x2: W - PAD.right, y1: py(t), y2: py(t), class: 'grid' }, svg);
      const txt = el('text', { x: PAD.left - 6, y: py(t) + 3, class: 'tick', 'text-anchor': 'end' }, svg);
      txt.textContent = opts.yFmt ? opts.yFmt(t) : t;
    }
    const innerW = W - PAD.left - PAD.right;
    const bw = Math.min(28, (innerW / bars.length) - 2);
    const color = opts.color || 'var(--series-1)';
    const tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.style.display = 'none';
    container.style.position = 'relative';
    container.appendChild(tip);

    bars.forEach((b, i) => {
      const cx = PAD.left + (i + 0.5) * (innerW / bars.length);
      const h = Math.max(0, py(0) - py(b.y));
      const r = Math.min(4, bw / 2, h);
      // rounded top, flat baseline
      const x0 = cx - bw / 2, yTop = py(b.y), yBase = py(0);
      const d = h <= 0.5
        ? ''
        : `M${x0},${yBase}L${x0},${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}L${x0 + bw - r},${yTop}Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r}L${x0 + bw},${yBase}Z`;
      if (d) el('path', { d, fill: color }, svg);
      // hit target
      const hit = el('rect', { x: cx - (innerW / bars.length) / 2, y: PAD.top, width: innerW / bars.length, height: H - PAD.top - PAD.bottom, fill: 'transparent' }, svg);
      const show = () => {
        tip.style.display = '';
        tip.innerHTML = opts.tooltip ? opts.tooltip(b) : `<b>${b.y}</b>`;
        const rect = svg.getBoundingClientRect();
        let left = (cx / W) * rect.width - tip.offsetWidth / 2;
        tip.style.left = U.clamp(left, 0, rect.width - tip.offsetWidth) + 'px';
        tip.style.top = '0px';
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      // x labels: sparse
      if (bars.length <= 8 || i % Math.ceil(bars.length / 6) === 0) {
        const t = el('text', { x: cx, y: H - 6, class: 'tick', 'text-anchor': 'middle' }, svg);
        t.textContent = b.x;
      }
    });
    svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    el('line', { x1: PAD.left, x2: W - PAD.right, y1: py(0), y2: py(0), class: 'baseline' }, svg);
  };

  /* Stacked bars (macros). opts: { bars:[{x, parts:[{key,value}]}], series:[{key,label,color}], yFmt, height, target?, tooltip } */
  FT.chartStacked = function (container, opts) {
    container.innerHTML = '';
    const bars = opts.bars || [];
    if (!bars.length) { container.innerHTML = '<div class="chart-empty">No data yet.</div>'; return; }
    const W = container.clientWidth || 340;
    const H = opts.height || 200;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'chart' }, container);
    let yMax = Math.max(...bars.map((b) => U.sum(b.parts, (p) => p.value)), opts.target || 0, 1);
    const ticks = niceTicks(0, yMax, 3);
    yMax = ticks[ticks.length - 1];
    const py = (y) => PAD.top + (1 - y / yMax) * (H - PAD.top - PAD.bottom);
    for (const t of ticks) {
      el('line', { x1: PAD.left, x2: W - PAD.right, y1: py(t), y2: py(t), class: 'grid' }, svg);
      const txt = el('text', { x: PAD.left - 6, y: py(t) + 3, class: 'tick', 'text-anchor': 'end' }, svg);
      txt.textContent = opts.yFmt ? opts.yFmt(t) : t;
    }
    const innerW = W - PAD.left - PAD.right;
    const bw = Math.min(26, innerW / bars.length - 3);
    const colorOf = {};
    (opts.series || []).forEach((s) => (colorOf[s.key] = s.color));
    const tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.style.display = 'none';
    container.style.position = 'relative';
    container.appendChild(tip);

    bars.forEach((b, i) => {
      const cx = PAD.left + (i + 0.5) * (innerW / bars.length);
      let acc = 0;
      b.parts.forEach((p, pi) => {
        if (!p.value) return;
        const y1 = py(acc), y2 = py(acc + p.value);
        const gap = pi === 0 ? 0 : 1; // 2px visual gap split between segments
        el('rect', { x: cx - bw / 2, y: y2 + gap, width: bw, height: Math.max(0, y1 - y2 - gap), rx: 2, fill: colorOf[p.key] || 'var(--series-1)' }, svg);
        acc += p.value;
      });
      const hit = el('rect', { x: cx - (innerW / bars.length) / 2, y: PAD.top, width: innerW / bars.length, height: H - PAD.top - PAD.bottom, fill: 'transparent' }, svg);
      const show = () => {
        tip.style.display = '';
        tip.innerHTML = opts.tooltip ? opts.tooltip(b) : '';
        const rect = svg.getBoundingClientRect();
        let left = (cx / W) * rect.width - tip.offsetWidth / 2;
        tip.style.left = U.clamp(left, 0, rect.width - tip.offsetWidth) + 'px';
        tip.style.top = '0px';
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      if (bars.length <= 8 || i % Math.ceil(bars.length / 7) === 0) {
        const t = el('text', { x: cx, y: H - 6, class: 'tick', 'text-anchor': 'middle' }, svg);
        t.textContent = b.x;
      }
    });
    if (opts.target) {
      el('line', { x1: PAD.left, x2: W - PAD.right, y1: py(opts.target), y2: py(opts.target), class: 'target-line' }, svg);
    }
    svg.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
    el('line', { x1: PAD.left, x2: W - PAD.right, y1: py(0), y2: py(0), class: 'baseline' }, svg);
  };
})();
