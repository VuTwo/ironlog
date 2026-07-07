/* view-progress.js — Progress tab: strength charts, records, weekly volume */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store;
  FT.views = FT.views || {};

  let selectedExercise = null;

  FT.views.progress = function (root) {
    const unit = S.settings.units;
    const trained = trainedExercises();
    if (!trained.length) {
      root.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">📈</div><h2>No data yet</h2><p class="muted">Charts unlock after you log workouts.</p></div></div>`;
      return;
    }
    if (!selectedExercise || !trained.some((t) => t.ex.id === selectedExercise)) selectedExercise = trained[0].ex.id;

    root.innerHTML = `
      <div class="page">
        <div class="section-head"><h1>Progress</h1></div>
        <div class="chip-row" id="ex-chips"></div>
        <div id="ex-detail"></div>
        <div class="section-head"><h2>Weekly training sets</h2></div>
        <div class="card"><div id="weekly-chart" class="chart-box"></div></div>
      </div>`;

    const chips = root.querySelector('#ex-chips');
    trained.slice(0, 10).forEach((t) => {
      const c = document.createElement('button');
      c.className = 'chip' + (t.ex.id === selectedExercise ? ' active' : '');
      c.textContent = t.ex.name;
      c.addEventListener('click', () => { selectedExercise = t.ex.id; FT.views.progress(root); });
      chips.appendChild(c);
    });
    const more = document.createElement('button');
    more.className = 'chip';
    more.textContent = 'Search…';
    more.addEventListener('click', async () => {
      const ex = await UI.pickExercise();
      if (ex) { selectedExercise = ex.id; FT.views.progress(root); }
    });
    chips.appendChild(more);

    renderExerciseDetail(root.querySelector('#ex-detail'), selectedExercise, unit);
    renderWeekly(root.querySelector('#weekly-chart'));
  };

  function trainedExercises() {
    const seen = new Map();
    for (const w of S.workouts) for (const en of w.entries) {
      const ex = S.exercise(en.exerciseId);
      if (ex && !seen.has(ex.id)) seen.set(ex.id, { ex, lastDate: w.date });
    }
    return [...seen.values()];
  }

  function renderExerciseDetail(container, exerciseId, unit) {
    const ex = S.exercise(exerciseId);
    const hist = S.exerciseHistory(exerciseId);
    const rec = S.records(exerciseId);
    container.innerHTML = `
      <div class="stat-row">
        <div class="stat-tile"><div class="stat-value">${rec.bestE1rm ? U.wt(rec.bestE1rm.value, unit) : '—'}</div><div class="stat-label">best e1RM (${unit})</div></div>
        <div class="stat-tile"><div class="stat-value">${rec.bestWeight ? U.wt(rec.bestWeight.value, unit) : '—'}</div><div class="stat-label">heaviest set (${unit})</div></div>
        <div class="stat-tile"><div class="stat-value">${hist.length}</div><div class="stat-label">sessions</div></div>
      </div>
      <div class="card">
        <div class="card-title-row"><span class="card-title">Estimated 1RM</span><span class="muted small">${U.esc(ex ? ex.name : '')}</span></div>
        <div id="e1rm-chart" class="chart-box"></div>
      </div>
      <div class="card">
        <div class="card-title-row"><span class="card-title">Session volume</span><span class="muted small">${unit}</span></div>
        <div id="vol-chart" class="chart-box"></div>
      </div>
      <button class="btn btn-ghost" style="width:100%" id="ex-history-btn">View full history</button>`;

    const pts = hist.map((h) => ({ x: U.parseKey(h.date).getTime(), y: U.fromKg(h.bestE1rm, unit), h }));
    FT.chartLine(container.querySelector('#e1rm-chart'), {
      points: pts,
      height: 190,
      showDots: pts.length <= 30,
      yFmt: (v) => Math.round(v),
      tooltip: (p) => `<b>${Math.round(p.y)} ${unit}</b> e1RM<br><span class="muted">${p.h.topSet ? `${U.wt(p.h.topSet.weightKg, unit)}×${p.h.topSet.reps}` : ''} · ${U.fmtDate(p.h.date)}</span>`,
    });
    FT.chartBars(container.querySelector('#vol-chart'), {
      bars: hist.slice(-16).map((h) => ({ x: U.fmtDate(h.date, { month: 'numeric', day: 'numeric' }), y: Math.round(U.fromKg(h.volume, unit)), h })),
      height: 160,
      yFmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v),
      tooltip: (b) => `<b>${b.y.toLocaleString()} ${unit}</b><br><span class="muted">${b.h.sets.length} sets · ${U.fmtDate(b.h.date)}</span>`,
    });
    container.querySelector('#ex-history-btn').addEventListener('click', () => FT.showExerciseDetail(exerciseId));
  }

  function renderWeekly(container) {
    const weeks = S.weeklyMuscleVolume(8);
    FT.chartBars(container, {
      bars: weeks.map((w) => ({ x: U.fmtDate(w.weekStart, { month: 'numeric', day: 'numeric' }), y: w.sets, w })),
      height: 160,
      yFmt: (v) => v,
      tooltip: (b) => {
        const top = Object.entries(b.w.byMuscle).sort((a, c) => c[1] - a[1]).slice(0, 4);
        return `<b>${b.y} sets</b> · wk of ${U.fmtDate(b.w.weekStart)}<br><span class="muted">${top.map(([m, n]) => `${m} ${n}`).join(' · ') || 'rest week'}</span>`;
      },
    });
  }

  // Full history sheet for an exercise (also used from workout logger)
  FT.showExerciseDetail = function (exerciseId) {
    const unit = S.settings.units;
    const ex = S.exercise(exerciseId);
    const hist = S.exerciseHistory(exerciseId).slice().reverse(); // newest first
    const rec = S.records(exerciseId);
    const body = document.createElement('div');
    body.innerHTML = `
      ${rec.bestE1rm ? `<div class="pr-box small">🏆 Best e1RM: <b>${U.wt(rec.bestE1rm.value, unit)} ${unit}</b> (${U.wt(rec.bestE1rm.set.weightKg, unit)}×${rec.bestE1rm.set.reps} on ${U.fmtDate(rec.bestE1rm.date)})</div>` : '<p class="muted">No history yet.</p>'}
      ${hist
        .map(
          (h) => `<div class="detail-ex">
            <div class="detail-ex-name">${U.fmtDate(h.date)}</div>
            ${h.sets.map((s, i) => `<div class="detail-set"><span class="muted">${i + 1}</span><span>${U.wt(s.weightKg, unit)} ${unit} × ${s.reps}${s.rpe ? ` <span class="muted">@${s.rpe}</span>` : ''}${s.type === 'warmup' ? ' <span class="set-tag">W</span>' : ''}</span><span class="muted small">e1RM ${U.wt(U.e1rm(s.weightKg || 0, s.reps || 0), unit)}</span></div>`).join('')}
          </div>`
        )
        .join('')}`;
    UI.sheet({ title: ex ? ex.name : 'Exercise', body });
  };
})();
