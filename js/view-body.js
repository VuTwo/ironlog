/* view-body.js — Body tab: weight logging, trend weight (EMA), history */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store;
  FT.views = FT.views || {};

  let range = 90; // days shown in chart

  FT.views.body = function (root) {
    const unit = S.settings.units;
    const log = S.bodyLog.slice().sort((a, b) => (a.date < b.date ? -1 : 1)); // oldest→newest
    const trend = trendSeries(log);
    const latest = trend.length ? trend[trend.length - 1] : null;
    const delta = (days) => {
      if (!latest) return null;
      const cutoff = U.addDays(latest.date, -days);
      const past = [...trend].reverse().find((p) => p.date <= cutoff);
      return past ? latest.trendKg - past.trendKg : null;
    };
    const d7 = delta(7), d30 = delta(30);
    const fmtDelta = (d) => (d == null ? '—' : `${d >= 0 ? '+' : '−'}${U.wt(Math.abs(d), unit)}`);

    root.innerHTML = `
      <div class="page">
        <div class="section-head"><h1>Body</h1></div>
        <div class="stat-row">
          <div class="stat-tile"><div class="stat-value">${latest ? U.wt(latest.trendKg, unit) : '—'}</div><div class="stat-label">trend weight (${unit})</div></div>
          <div class="stat-tile"><div class="stat-value">${fmtDelta(d7)}</div><div class="stat-label">7-day change</div></div>
          <div class="stat-tile"><div class="stat-value">${fmtDelta(d30)}</div><div class="stat-label">30-day change</div></div>
        </div>
        <button class="btn btn-primary btn-big" id="log-weight">＋ Log weight</button>
        <div class="card">
          <div class="card-title-row"><span class="card-title">Weight</span>
            <div class="range-tabs">
              ${[30, 90, 365].map((r) => `<button class="range-tab${r === range ? ' active' : ''}" data-r="${r}">${r === 365 ? '1y' : r + 'd'}</button>`).join('')}
            </div>
          </div>
          <div id="weight-chart" class="chart-box"></div>
          <div class="muted small" style="margin-top:6px">Dots are scale readings; the line is your smoothed trend — trust the line, not the daily noise.</div>
        </div>
        <div class="section-head"><h2>Entries</h2></div>
        <div id="body-list"></div>
      </div>`;

    root.querySelector('#log-weight').addEventListener('click', async () => {
      const todayEntry = S.bodyLog.find((b) => b.date === U.todayKey());
      const r = await UI.form('Log weight', [
        { key: 'weight', label: `Weight (${unit})`, type: 'number', step: '0.1', value: todayEntry ? +U.wt(todayEntry.weightKg, unit) : (latest ? +U.wt(latest.weightKg, unit) : null) },
        { key: 'bodyFat', label: 'Body fat % (optional)', type: 'number', step: '0.1', value: todayEntry && todayEntry.bodyFat != null ? todayEntry.bodyFat : null },
        { key: 'notes', label: 'Notes (optional)', placeholder: 'fasted, post-carb-up…' },
      ], 'Save');
      if (!r || r.weight == null || isNaN(r.weight)) return;
      S.logWeight(U.todayKey(), U.toKg(r.weight, unit), r.bodyFat, r.notes);
      if (FT.fitbit && FT.fitbit.autoSyncWeight) FT.fitbit.autoSyncWeight(U.todayKey(), U.toKg(r.weight, unit));
      FT.views.body(root);
    });

    root.querySelectorAll('.range-tab').forEach((b) =>
      b.addEventListener('click', () => { range = parseInt(b.dataset.r, 10); FT.views.body(root); })
    );

    // chart
    const cutoff = U.addDays(U.todayKey(), -range);
    const shown = trend.filter((p) => p.date >= cutoff);
    const raw = shown.map((p) => ({ x: U.parseKey(p.date).getTime(), y: U.fromKg(p.weightKg, unit), p }));
    const tr = shown.map((p) => ({ x: U.parseKey(p.date).getTime(), y: U.fromKg(p.trendKg, unit), p }));
    FT.chartLine(root.querySelector('#weight-chart'), {
      points: raw,
      points2: tr,
      dotsOnly: true,
      height: 200,
      yFmt: (v) => Math.round(v),
      tooltip: (p) => `<b>${U.wt(p.p.trendKg, unit)} ${unit}</b> trend<br><span class="muted">${U.wt(p.p.weightKg, unit)} scale · ${U.fmtDate(p.p.date)}</span>`,
    });

    // list (newest first)
    const list = root.querySelector('#body-list');
    const newest = S.bodyLog.slice(0, 60);
    list.innerHTML = newest.length
      ? newest
          .map((b) => `<div class="card food-card"><div><div class="card-title">${U.wt(b.weightKg, unit)} ${unit}${b.bodyFat != null && b.bodyFat !== '' ? ` · ${b.bodyFat}% bf` : ''}</div><div class="muted small">${U.relDate(b.date)}${b.notes ? ' · ' + U.esc(b.notes) : ''}</div></div><button class="icon-btn body-del" data-id="${b.id}">✕</button></div>`)
          .join('')
      : `<div class="card muted" style="text-align:center">No weigh-ins yet. Morning, post-bathroom, pre-food is the most consistent time.</div>`;
    list.addEventListener('click', async (e) => {
      const del = e.target.closest('.body-del');
      if (!del) return;
      if (await UI.confirm('Delete entry', 'Remove this weigh-in?', 'Delete', true)) {
        S.deleteBodyEntry(del.dataset.id);
        FT.views.body(root);
      }
    });
  };

  // EMA trend over the log; alpha 0.15 ≈ ~2 week half-life, smooths water noise
  function trendSeries(logAsc) {
    const alpha = 0.15;
    let prev = null;
    return logAsc.map((b) => {
      prev = prev == null ? b.weightKg : alpha * b.weightKg + (1 - alpha) * prev;
      return { date: b.date, weightKg: b.weightKg, trendKg: prev, bodyFat: b.bodyFat };
    });
  }
})();
