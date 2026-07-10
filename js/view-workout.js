/* view-workout.js — Workout tab: dashboard + active workout logging */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store;

  FT.views = FT.views || {};

  FT.views.workout = function (root) {
    if (S.activeWorkout) renderActive(root);
    else renderDashboard(root);
  };

  // ================= dashboard =================
  function renderDashboard(root) {
    const week = weekStats();
    const last = S.workouts[0];
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    root.innerHTML = `
      <div class="page">
        <div class="greet">
          <h1>${greet}</h1>
          <p class="muted">${U.fmtDateLong(U.todayKey())}</p>
        </div>
        <div id="program-section"></div>
        <div class="stat-row">
          <div class="stat-tile"><div class="stat-value">${week.count}</div><div class="stat-label">workouts this week</div></div>
          <div class="stat-tile"><div class="stat-value">${week.sets}</div><div class="stat-label">sets this week</div></div>
          <div class="stat-tile"><div class="stat-value">${fmtVol(week.volume)}</div><div class="stat-label">volume (${S.settings.units})</div></div>
        </div>
        <button class="btn btn-primary btn-big" id="start-empty">Start empty workout</button>
        <div class="section-head"><h2>Routines</h2><button class="text-btn" id="new-template">＋ New</button></div>
        <div id="template-list"></div>
        ${last ? `<div class="section-head"><h2>Last workout</h2></div><div id="last-workout"></div>` : ''}
      </div>`;

    if (FT.renderProgramSection) FT.renderProgramSection(root.querySelector('#program-section'));

    root.querySelector('#start-empty').addEventListener('click', () => {
      S.startWorkout(null);
      FT.render();
    });

    const tl = root.querySelector('#template-list');
    if (!S.templates.length) {
      tl.innerHTML = `<div class="card muted" style="text-align:center">No routines yet. Finish a workout and save it as a routine, or create one now.</div>`;
    } else {
      tl.innerHTML = S.templates
        .map((t) => {
          const exNames = t.entries.map((e) => (S.exercise(e.exerciseId) || {}).name || '?').slice(0, 4);
          const more = t.entries.length > 4 ? ` +${t.entries.length - 4} more` : '';
          return `<div class="card template-card" data-id="${t.id}">
            <div class="template-info">
              <div class="card-title">${U.esc(t.name)}</div>
              <div class="muted small">${U.esc(exNames.join(', '))}${more}</div>
            </div>
            <div class="template-actions">
              <button class="btn btn-small btn-primary tpl-start">Start</button>
              <button class="icon-btn tpl-menu">⋯</button>
            </div>
          </div>`;
        })
        .join('');
      tl.addEventListener('click', async (e) => {
        const card = e.target.closest('.template-card');
        if (!card) return;
        const t = S.templates.find((x) => x.id === card.dataset.id);
        if (e.target.closest('.tpl-start')) {
          S.startWorkout(t);
          FT.render();
        } else if (e.target.closest('.tpl-menu')) {
          UI.sheet({
            title: t.name,
            actions: [
              { label: 'Rename', cls: 'btn-ghost', onClick: async (api) => { api.close(); const r = await UI.form('Rename routine', [{ key: 'name', label: 'Name', value: t.name }]); if (r && r.name.trim()) { t.name = r.name.trim(); S.save('templates'); FT.render(); } } },
              { label: 'Delete routine', cls: 'btn-danger', onClick: async (api) => { api.close(); if (await UI.confirm('Delete routine', `Delete “${t.name}”? Workout history is not affected.`, 'Delete', true)) { S.deleteTemplate(t.id); FT.render(); } } },
            ],
          });
        }
      });
    }

    root.querySelector('#new-template') && root.querySelector('#new-template').addEventListener('click', async () => {
      const r = await UI.form('New routine', [{ key: 'name', label: 'Name', placeholder: 'e.g. Upper A' }], 'Create');
      if (!r || !r.name.trim()) return;
      const t = { id: 't' + U.uid(), name: r.name.trim(), entries: [] };
      S.templates.push(t);
      S.save('templates');
      // start it immediately so exercises can be added in the logger, then saved back
      const w = S.startWorkout(t);
      w.templateId = t.id;
      S.save('activeWorkout');
      UI.toast('Add exercises, then Finish to save the routine');
      FT.render();
    });

    if (last) {
      const lw = root.querySelector('#last-workout');
      lw.innerHTML = workoutSummaryCard(last);
      lw.addEventListener('click', () => FT.showWorkoutDetail(last));
    }
  }

  function weekStats() {
    const today = U.todayKey();
    const day = (U.parseKey(today).getDay() + 6) % 7;
    const monday = U.addDays(today, -day);
    let count = 0, sets = 0, volume = 0;
    for (const w of S.workouts) {
      if (w.date < monday) break;
      count++;
      sets += S.workoutSets(w);
      volume += S.workoutVolume(w);
    }
    return { count, sets, volume };
  }

  function fmtVol(kg) {
    const v = U.fromKg(kg, S.settings.units);
    return v >= 10000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v));
  }

  function workoutSummaryCard(w) {
    const unit = S.settings.units;
    const lines = w.entries
      .slice(0, 5)
      .map((en) => {
        const ex = S.exercise(en.exerciseId);
        const best = en.sets.filter((s) => s.type !== 'warmup').sort((a, b) => U.e1rm(b.weightKg, b.reps) - U.e1rm(a.weightKg, a.reps))[0] || en.sets[0];
        return `<div class="wl-row"><span>${en.sets.length} × ${U.esc(ex ? ex.name : '?')}</span><span class="muted">${best ? `${U.wt(best.weightKg, unit)} ${unit} × ${best.reps}` : ''}</span></div>`;
      })
      .join('');
    const dur = w.endedAt && w.startedAt ? U.fmtDuration(w.endedAt - w.startedAt) : '';
    return `<div class="card">
      <div class="card-title-row"><span class="card-title">${U.esc(w.name)}</span><span class="muted small">${U.relDate(w.date)}</span></div>
      <div class="muted small" style="margin-bottom:8px">${dur}${dur ? ' · ' : ''}${fmtVol(S.workoutVolume(w))} ${S.settings.units} volume</div>
      ${lines}${w.entries.length > 5 ? `<div class="muted small">+${w.entries.length - 5} more exercises</div>` : ''}
    </div>`;
  }
  FT.workoutSummaryCard = workoutSummaryCard;

  // ================= active workout =================
  let elapsedInterval = null;

  function renderActive(root) {
    const w = S.activeWorkout;
    const unit = S.settings.units;
    root.innerHTML = `
      <div class="page active-workout">
        <div class="aw-head">
          <input class="aw-name" id="aw-name" value="${U.esc(w.name)}">
          <div class="aw-meta"><span id="aw-elapsed"></span> · <span id="aw-setcount"></span></div>
        </div>
        <div id="aw-entries"></div>
        <button class="btn btn-ghost btn-big" id="aw-add-ex">＋ Add exercise</button>
        <textarea class="aw-notes" id="aw-notes" placeholder="Workout notes…">${U.esc(w.notes || '')}</textarea>
        <div class="aw-footer">
          <button class="btn btn-danger-ghost" id="aw-discard">Discard</button>
          <button class="btn btn-primary" id="aw-finish">Finish workout</button>
        </div>
      </div>`;

    clearInterval(elapsedInterval);
    const elapsedEl = root.querySelector('#aw-elapsed');
    const tick = () => { elapsedEl.textContent = U.fmtDuration(Date.now() - w.startedAt); };
    tick();
    elapsedInterval = setInterval(tick, 30000);

    root.querySelector('#aw-name').addEventListener('change', (e) => { w.name = e.target.value || 'Workout'; S.save('activeWorkout'); });
    root.querySelector('#aw-notes').addEventListener('change', (e) => { w.notes = e.target.value; S.save('activeWorkout'); });

    const entriesEl = root.querySelector('#aw-entries');
    renderEntries(entriesEl, w, unit);
    updateSetCount(root, w);

    root.querySelector('#aw-add-ex').addEventListener('click', async () => {
      const ex = await UI.pickExercise();
      if (!ex) return;
      const last = S.lastPerformance(ex.id);
      const sets = last
        ? last.sets.filter((s) => s.type !== 'warmup').map((s) => ({ weightKg: s.weightKg, reps: s.reps, rpe: null, type: 'normal', done: false }))
        : [{ weightKg: null, reps: null, rpe: null, type: 'normal', done: false }];
      w.entries.push({ exerciseId: ex.id, notes: '', sets: sets.length ? sets : [{ weightKg: null, reps: null, rpe: null, type: 'normal', done: false }] });
      S.save('activeWorkout');
      renderEntries(entriesEl, w, unit);
      updateSetCount(root, w);
    });

    root.querySelector('#aw-discard').addEventListener('click', async () => {
      if (await UI.confirm('Discard workout', 'This workout will not be saved.', 'Discard', true)) {
        S.discardWorkout();
        UI.stopRestTimer();
        FT.render();
      }
    });

    root.querySelector('#aw-finish').addEventListener('click', async () => {
      const done = U.sum(w.entries, (en) => en.sets.filter((s) => s.done).length);
      if (!done) {
        if (await UI.confirm('No sets completed', 'Nothing was logged. Discard this workout?', 'Discard', true)) {
          S.discardWorkout();
          UI.stopRestTimer();
          FT.render();
        }
        return;
      }
      const templateId = w.templateId;
      const prog = w.program;
      const finished = S.finishWorkout();
      UI.stopRestTimer();
      if (finished) {
        if (prog) S.markDayComplete(prog.week, prog.dayKey, finished.id);
        if (templateId) {
          // keep routine in sync with what was actually performed
          const t = S.templates.find((x) => x.id === templateId);
          if (t) {
            t.entries = finished.entries.map((en) => ({ exerciseId: en.exerciseId, sets: en.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, type: s.type || 'normal' })) }));
            S.save('templates');
          }
        }
        showFinishSummary(finished, !templateId);
        if (FT.fitbit && FT.fitbit.autoSyncWorkout) FT.fitbit.autoSyncWorkout(finished);
      }
      FT.render();
    });
  }

  function updateSetCount(root, w) {
    const done = U.sum(w.entries, (en) => en.sets.filter((s) => s.done).length);
    const total = U.sum(w.entries, (en) => en.sets.length);
    const el = root.querySelector('#aw-setcount');
    if (el) el.textContent = `${done}/${total} sets`;
  }

  const TYPE_CYCLE = ['normal', 'warmup', 'drop', 'failure'];
  const TYPE_LABEL = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

  function renderEntries(container, w, unit) {
    container.innerHTML = '';
    w.entries.forEach((en, ei) => {
      const ex = S.exercise(en.exerciseId);
      const last = lastSetsFor(en.exerciseId, w);
      const card = document.createElement('div');
      card.className = 'card ex-card';
      const tg = en.target;
      const targetHtml = tg
        ? `<div class="ex-target${tg.main ? ' is-main' : ''}">
             <div class="ex-target-line"><span class="ex-target-badge">TARGET</span><span>${U.esc(tg.line)}</span>${tg.rest ? `<span class="muted small ex-target-rest">rest ${U.esc(tg.rest)}</span>` : ''}</div>
             ${tg.superset ? `<div class="ex-super muted small">⛓ Superset: ${U.esc(tg.superset)}</div>` : ''}
             ${tg.cue ? `<button class="ex-cue-toggle" aria-expanded="false">💡 Coaching cue</button><div class="ex-cue" hidden>${U.esc(tg.cue)}</div>` : ''}
           </div>`
        : '';
      card.innerHTML = `
        <div class="ex-card-head">
          <div>
            <div class="card-title">${U.esc(ex ? ex.name : 'Unknown')}</div>
            <div class="muted small">${U.esc(ex ? ex.muscle : '')}</div>
          </div>
          <button class="icon-btn ex-menu">⋯</button>
        </div>
        ${targetHtml}
        <input class="ex-note" placeholder="Notes (cues, seat height…)" value="${U.esc(en.notes || '')}">
        <div class="set-grid">
          <div class="set-grid-head"><span>SET</span><span>PREV</span><span>${unit.toUpperCase()}</span><span>REPS</span><span>RPE</span><span>✓</span></div>
          <div class="set-rows"></div>
        </div>
        <button class="text-btn add-set">＋ Add set</button>`;
      const rowsEl = card.querySelector('.set-rows');
      en.sets.forEach((set, si) => rowsEl.appendChild(setRow(w, en, ei, set, si, last, unit, card)));

      const cueToggle = card.querySelector('.ex-cue-toggle');
      if (cueToggle) cueToggle.addEventListener('click', () => {
        const cue = card.querySelector('.ex-cue');
        const open = cue.hidden;
        cue.hidden = !open;
        cueToggle.setAttribute('aria-expanded', String(open));
      });
      card.querySelector('.ex-note').addEventListener('change', (e) => { en.notes = e.target.value; S.save('activeWorkout'); });
      card.querySelector('.add-set').addEventListener('click', () => {
        const prev = en.sets[en.sets.length - 1];
        en.sets.push({ weightKg: prev ? prev.weightKg : null, reps: prev ? prev.reps : null, rpe: null, type: 'normal', done: false });
        S.save('activeWorkout');
        renderEntries(container, w, unit);
      });
      card.querySelector('.ex-menu').addEventListener('click', () => {
        UI.sheet({
          title: ex ? ex.name : 'Exercise',
          actions: [
            { label: 'View history & records', cls: 'btn-ghost', onClick: (api) => { api.close(); FT.showExerciseDetail(en.exerciseId); } },
            { label: 'Move up', cls: 'btn-ghost', onClick: (api) => { api.close(); if (ei > 0) { [w.entries[ei - 1], w.entries[ei]] = [w.entries[ei], w.entries[ei - 1]]; S.save('activeWorkout'); renderEntries(container, w, unit); } } },
            { label: 'Remove exercise', cls: 'btn-danger', onClick: (api) => { api.close(); w.entries.splice(ei, 1); S.save('activeWorkout'); renderEntries(container, w, unit); const rootEl = document.getElementById('view'); updateSetCount(rootEl, w); } },
          ],
        });
      });
      container.appendChild(card);
    });
  }

  function lastSetsFor(exerciseId, currentWorkout) {
    for (const w of S.workouts) {
      if (w.id === currentWorkout.id) continue;
      const en = w.entries.find((e) => e.exerciseId === exerciseId);
      if (en && en.sets.length) return en.sets.filter((s) => s.type !== 'warmup');
    }
    return [];
  }

  function setRow(w, en, ei, set, si, last, unit, card) {
    const row = document.createElement('div');
    row.className = 'set-row' + (set.done ? ' done' : '') + (set.type !== 'normal' ? ' t-' + set.type : '');
    const prev = last[si];
    const prevTxt = prev ? `${U.wt(prev.weightKg, unit)}×${prev.reps}` : '—';
    row.innerHTML = `
      <button class="set-num">${TYPE_LABEL[set.type] || si + 1 - en.sets.slice(0, si).filter((s) => s.type === 'warmup').length}</button>
      <button class="set-prev muted">${prevTxt}</button>
      <input class="set-in in-weight" inputmode="decimal" placeholder="${prev ? U.wt(prev.weightKg, unit) : '0'}" value="${set.weightKg != null ? U.wt(set.weightKg, unit) : ''}">
      <input class="set-in in-reps" inputmode="numeric" placeholder="${prev ? prev.reps : '0'}" value="${set.reps != null ? set.reps : ''}">
      <input class="set-in in-rpe" inputmode="decimal" placeholder="–" value="${set.rpe != null ? set.rpe : ''}">
      <button class="set-check" aria-label="Complete set">✓</button>`;

    row.querySelector('.in-weight').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      set.weightKg = isNaN(v) ? null : U.toKg(v, unit);
      S.save('activeWorkout');
    });
    row.querySelector('.in-reps').addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      set.reps = isNaN(v) ? null : v;
      S.save('activeWorkout');
    });
    row.querySelector('.in-rpe').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      set.rpe = isNaN(v) ? null : U.clamp(v, 1, 10);
      e.target.value = set.rpe == null ? '' : set.rpe;
      S.save('activeWorkout');
    });
    // tap set number: cycle type; long-press could delete — use menu via double-tap? Keep: cycle type, ✕ via swipe not available → add small delete on type sheet
    row.querySelector('.set-num').addEventListener('click', () => {
      UI.sheet({
        title: `Set ${si + 1}`,
        actions: [
          { label: 'Normal set', cls: 'btn-ghost', onClick: (api) => { api.close(); set.type = 'normal'; refresh(); } },
          { label: 'Warm-up set', cls: 'btn-ghost', onClick: (api) => { api.close(); set.type = 'warmup'; refresh(); } },
          { label: 'Failure set', cls: 'btn-ghost', onClick: (api) => { api.close(); set.type = 'failure'; refresh(); } },
          { label: 'Delete set', cls: 'btn-danger', onClick: (api) => { api.close(); en.sets.splice(si, 1); S.save('activeWorkout'); rerenderAll(); } },
        ],
      });
    });
    row.querySelector('.set-prev').addEventListener('click', () => {
      if (!prev) return;
      set.weightKg = prev.weightKg; set.reps = prev.reps;
      row.querySelector('.in-weight').value = U.wt(prev.weightKg, unit);
      row.querySelector('.in-reps').value = prev.reps;
      S.save('activeWorkout');
    });
    row.querySelector('.set-check').addEventListener('click', () => {
      // fill from placeholder if empty
      if (set.weightKg == null && prev) set.weightKg = prev.weightKg;
      if (set.reps == null && prev) set.reps = prev.reps;
      if (set.reps == null) { UI.toast('Enter reps first'); return; }
      set.done = !set.done;
      row.classList.toggle('done', set.done);
      row.querySelector('.in-weight').value = set.weightKg != null ? U.wt(set.weightKg, unit) : '';
      row.querySelector('.in-reps').value = set.reps != null ? set.reps : '';
      S.save('activeWorkout');
      U.haptic(12);
      const rootEl = document.getElementById('view');
      updateSetCount(rootEl, w);
      if (set.done && S.settings.autoStartTimer) UI.startRestTimer(S.settings.restSeconds);
    });

    function refresh() {
      S.save('activeWorkout');
      rerenderAll();
    }
    function rerenderAll() {
      const container = document.getElementById('aw-entries');
      if (container) renderEntries(container, w, unit);
    }
    return row;
  }

  function showFinishSummary(w, offerTemplate) {
    const unit = S.settings.units;
    const prs = S.detectPRs(w);
    const dur = U.fmtDuration(w.endedAt - w.startedAt);
    const prHtml = prs.length
      ? `<div class="pr-box">🏆 ${prs.length} PR${prs.length > 1 ? 's' : ''}!<div class="small">${prs.map((p) => { const ex = S.exercise(p.exerciseId); return `${U.esc(ex ? ex.name : '?')}: ${U.wt(p.set.weightKg, unit)} ${unit} × ${p.set.reps} (e1RM ${U.wt(p.e1rm, unit)})`; }).join('<br>')}</div></div>`
      : '';
    const actions = [{ label: 'Done', onClick: (api) => api.close() }];
    if (offerTemplate) {
      actions.unshift({
        label: 'Save as routine',
        cls: 'btn-ghost',
        onClick: async (api) => {
          api.close();
          const r = await UI.form('Save routine', [{ key: 'name', label: 'Routine name', value: w.name }]);
          if (r && r.name.trim()) { S.saveTemplateFromWorkout(w, r.name.trim()); UI.toast('Routine saved'); FT.render(); }
        },
      });
    }
    UI.sheet({
      title: 'Workout complete 💪',
      body: `${prHtml}<div class="finish-stats">
        <div><b>${dur}</b><span class="muted small">duration</span></div>
        <div><b>${S.workoutSets(w)}</b><span class="muted small">sets</span></div>
        <div><b>${U.wt(S.workoutVolume(w), unit)}</b><span class="muted small">${unit} volume</span></div>
      </div>`,
      actions,
    });
  }
})();
