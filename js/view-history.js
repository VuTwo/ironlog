/* view-history.js — History tab: workout log + detail sheet */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store;
  FT.views = FT.views || {};

  FT.views.history = function (root) {
    const unit = S.settings.units;
    if (!S.workouts.length) {
      root.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">📖</div><h2>No workouts yet</h2><p class="muted">Your training history will appear here after your first session.</p></div></div>`;
      return;
    }
    const byMonth = U.groupBy(S.workouts, (w) => w.date.slice(0, 7));
    let html = `<div class="page"><div class="section-head"><h1>History</h1><span class="muted">${S.workouts.length} workouts</span></div>`;
    for (const [month, ws] of byMonth) {
      const d = U.parseKey(month + '-01');
      html += `<div class="month-head">${d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>`;
      html += ws
        .map((w) => {
          const dur = w.endedAt ? U.fmtDuration(w.endedAt - w.startedAt) : '';
          const exNames = w.entries.map((en) => (S.exercise(en.exerciseId) || {}).name || '?');
          return `<div class="card hist-card" data-id="${w.id}">
            <div class="card-title-row"><span class="card-title">${U.esc(w.name)}</span><span class="muted small">${U.relDate(w.date)}</span></div>
            <div class="muted small">${dur}${dur ? ' · ' : ''}${S.workoutSets(w)} sets · ${U.wt(S.workoutVolume(w), unit)} ${unit}</div>
            <div class="small hist-ex">${U.esc(exNames.slice(0, 3).join(' · '))}${exNames.length > 3 ? ` · +${exNames.length - 3}` : ''}</div>
          </div>`;
        })
        .join('');
    }
    html += '</div>';
    root.innerHTML = html;
    root.addEventListener('click', (e) => {
      const card = e.target.closest('.hist-card');
      if (!card) return;
      const w = S.workouts.find((x) => x.id === card.dataset.id);
      if (w) FT.showWorkoutDetail(w);
    });
  };

  FT.showWorkoutDetail = function (w) {
    const unit = S.settings.units;
    const body = document.createElement('div');
    const dur = w.endedAt ? U.fmtDuration(w.endedAt - w.startedAt) : '—';
    body.innerHTML = `
      <div class="muted small" style="margin-bottom:10px">${U.fmtDateLong(w.date)} · ${dur} · ${U.wt(S.workoutVolume(w), unit)} ${unit} volume</div>
      ${w.notes ? `<p class="wnote">${U.esc(w.notes)}</p>` : ''}
      ${w.entries
        .map((en) => {
          const ex = S.exercise(en.exerciseId);
          return `<div class="detail-ex">
            <div class="detail-ex-name" data-ex="${en.exerciseId}">${U.esc(ex ? ex.name : '?')}</div>
            ${en.notes ? `<div class="muted small">${U.esc(en.notes)}</div>` : ''}
            ${en.sets
              .map((s, i) => {
                const tag = s.type === 'warmup' ? '<span class="set-tag">W</span>' : s.type === 'failure' ? '<span class="set-tag f">F</span>' : '';
                return `<div class="detail-set"><span class="muted">${i + 1}</span><span>${U.wt(s.weightKg, unit)} ${unit} × ${s.reps}${s.rpe ? ` <span class="muted">@${s.rpe}</span>` : ''} ${tag}</span><span class="muted small">e1RM ${U.wt(U.e1rm(s.weightKg || 0, s.reps || 0), unit)}</span></div>`;
              })
              .join('')}
          </div>`;
        })
        .join('')}`;
    body.addEventListener('click', (e) => {
      const exEl = e.target.closest('.detail-ex-name');
      if (exEl) { sheet.close(); FT.showExerciseDetail(exEl.dataset.ex); }
    });
    const sheet = UI.sheet({
      title: w.name,
      body,
      actions: [
        { label: 'Repeat workout', onClick: (api) => { api.close(); S.startWorkout({ name: w.name, entries: w.entries.map((en) => ({ exerciseId: en.exerciseId, sets: en.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, type: s.type })) })) }); FT.render(); } },
        { label: 'Save as routine', cls: 'btn-ghost', onClick: async (api) => { api.close(); const r = await UI.form('Save routine', [{ key: 'name', label: 'Routine name', value: w.name }]); if (r && r.name.trim()) { S.saveTemplateFromWorkout(w, r.name.trim()); UI.toast('Routine saved'); FT.render(); } } },
        { label: 'Delete workout', cls: 'btn-danger', onClick: async (api) => { api.close(); if (await UI.confirm('Delete workout', 'This permanently removes it from history.', 'Delete', true)) { S.deleteWorkout(w.id); FT.render(); } } },
      ],
    });
  };
})();
