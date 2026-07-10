/* view-program.js — FORGED program: Workout-dashboard section + full Program screen */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store, P = FT.program;

  const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const dayShort = (d) => titleCase((d.title.split(':')[0] || d.title).trim());     // "Lower A"
  const dayFocus = (d) => titleCase((d.title.split(':')[1] || '').trim());          // "Squat Strength + Posterior Chain"

  // ---------- dashboard section (rendered on the Workout tab) ----------
  FT.renderProgramSection = function (host) {
    if (!host) return;
    if (!S.program.active) {
      const pg = FT.PROGRAM;
      host.innerHTML = `
        <div class="card program-cta">
          <div class="pc-kicker">GUIDED PROGRAM</div>
          <div class="pc-title">${U.esc(pg.name)}</div>
          <div class="muted small">${U.esc(pg.subtitle)} · 8-week cycle, 4 days/week. Target weights auto-calc from your maxes.</div>
          <div class="btn-pair" style="margin-top:12px">
            <button class="btn btn-primary" id="pg-start">Start program</button>
            <button class="btn btn-ghost" id="pg-preview">Preview</button>
          </div>
        </div>`;
      host.querySelector('#pg-start').addEventListener('click', () => {
        S.startProgram();
        UI.toast('FORGED started — tap Program to set your maxes');
        FT.render();
      });
      host.querySelector('#pg-preview').addEventListener('click', () => FT.showProgram());
      return;
    }

    const week = P.currentWeek();
    const wk = P.week(week);
    host.innerHTML = `
      <div class="card program-week">
        <div class="pw-head">
          <div>
            <div class="pc-kicker">FORGED · WEEK ${week}${wk.deload ? ' · <span class="pill-deload">DELOAD</span>' : ''}</div>
            <div class="muted small">${U.esc(P.blockLabel(wk))}</div>
          </div>
          <button class="text-btn" id="pg-open">Program ▸</button>
        </div>
        <div class="pw-days">${wk.days.map((d) => dayRow(week, d)).join('')}</div>
      </div>`;
    host.querySelector('#pg-open').addEventListener('click', () => FT.showProgram());
    bindDayRows(host, week);
  };

  function dayRow(week, d) {
    const done = P.dayCompleted(week, d.key);
    return `<div class="pw-day${done ? ' done' : ''}" data-week="${week}" data-day="${d.key}">
      <div class="pw-day-info">
        <div class="pw-day-name">${U.esc(dayShort(d))} <span class="muted">· ${U.esc(d.day)}</span></div>
        <div class="muted small">${U.esc(dayFocus(d))}</div>
      </div>
      ${done
        ? `<button class="pw-day-btn is-done" data-act="menu">✓ Done</button>`
        : `<button class="btn btn-small btn-primary" data-act="start">Start</button>`}
    </div>`;
  }

  function bindDayRows(host, defaultWeek) {
    host.querySelectorAll('.pw-day').forEach((row) => {
      const week = +row.dataset.week, key = row.dataset.day;
      row.addEventListener('click', (e) => {
        const act = (e.target.closest('[data-act]') || {}).dataset ? e.target.closest('[data-act]').dataset.act : null;
        if (act === 'start' || (!act && !P.dayCompleted(week, key))) startDay(week, key);
        else if (act === 'menu') dayMenu(week, key);
      });
    });
  }

  function startDay(week, key) {
    if (S.activeWorkout) {
      UI.confirm('A workout is in progress', 'Finish or discard your current workout before starting a program day.', 'OK').then(() => {});
      return;
    }
    S.startProgramDay(week, key);
    // close the Program sheet if it's open so we land on the logger
    document.querySelectorAll('.sheet-overlay').forEach((o) => o.remove());
    document.body.classList.remove('sheet-open');
    FT.render();
  }

  function dayMenu(week, key) {
    const d = P.day(week, key);
    const rec = S.program.completed[`w${week}${key}`];
    UI.sheet({
      title: `${dayShort(d)} — Week ${week}`,
      actions: [
        rec && rec.workoutId
          ? { label: 'View logged workout', cls: 'btn-ghost', onClick: (api) => { api.close(); const w = S.workouts.find((x) => x.id === rec.workoutId); if (w) FT.showWorkoutDetail(w); else UI.toast('Workout not found'); } }
          : null,
        { label: 'Redo this day', cls: 'btn-ghost', onClick: (api) => { api.close(); startDay(week, key); } },
        { label: 'Mark not done', cls: 'btn-danger', onClick: (api) => { api.close(); S.clearDayComplete(week, key); FT.render(); if (FT.__programSheet) FT.__programSheet(); } },
      ].filter(Boolean),
    });
  }

  // ---------- full Program screen ----------
  FT.showProgram = function () {
    if (!S.program.active) S.startProgram();
    const body = document.createElement('div');
    body.className = 'program-screen';
    const sheet = UI.sheet({ title: 'FORGED program', body });
    const rerender = () => renderScreen(body, rerender);
    FT.__programSheet = rerender;   // allow external refresh (e.g. after marking not-done)
    renderScreen(body, rerender);
  };

  function renderScreen(body, rerender) {
    const unit = S.settings.units;
    const pg = FT.PROGRAM;
    const sel = S.program.viewWeek || P.currentWeek();
    const wk = P.week(sel);
    const maxes = pg.lifts.map((l) => `
      <button class="max-row" data-lift="${l.key}">
        <span>${U.esc(l.name)} 1RM</span>
        <b>${U.wtu(S.program.oneRM[l.key], unit)}</b>
      </button>`).join('');

    const chips = pg.weeks.map((w) =>
      `<button class="wk-chip${w.n === sel ? ' active' : ''}${w.deload ? ' deload' : ''}${P.weekComplete(w.n) ? ' complete' : ''}" data-week="${w.n}">${w.n}${w.deload ? '·D' : ''}</button>`).join('');

    const days = wk.days.map((d) => dayRow(sel, d)).join('');
    const log = S.program.log[sel] || {};
    const logView = `
      <div class="log-grid">
        <div><span class="muted small">Bodyweight</span><b>${log.bodyweightKg != null ? U.wtu(log.bodyweightKg, unit) : '—'}</b></div>
        <div><span class="muted small">Squat top</span><b>${U.esc(log.squat || '—')}</b></div>
        <div><span class="muted small">Bench top</span><b>${U.esc(log.bench || '—')}</b></div>
        <div><span class="muted small">Deadlift top</span><b>${U.esc(log.deadlift || '—')}</b></div>
        <div><span class="muted small">Sleep</span><b>${log.sleep != null ? log.sleep + '/10' : '—'}</b></div>
        <div><span class="muted small">Pump / fun</span><b>${log.pump != null ? log.pump + '/10' : '—'}</b></div>
      </div>
      ${log.notes ? `<div class="log-notes">${U.esc(log.notes)}</div>` : ''}`;

    body.innerHTML = `
      <div class="settings-section">
        <h3>Your maxes</h3>
        <p class="muted small">Every target weight is ${'%'}1RM rounded to 5 lb. Edit a max and the whole cycle updates.</p>
        <div class="max-list">${maxes}</div>
      </div>

      <div class="settings-section">
        <h3>Week</h3>
        <div class="wk-chip-row">${chips}</div>
        <div class="wk-meta"><b>Week ${sel}</b> · ${U.esc(P.blockLabel(wk))}${wk.deload ? ' · <span class="pill-deload">DELOAD</span>' : ''}</div>
        <div class="pw-days">${days}</div>
      </div>

      <div class="settings-section">
        <div class="section-head" style="margin:0 0 8px"><h3 style="margin:0">Week ${sel} progress log</h3><button class="text-btn" id="edit-log">Edit</button></div>
        ${logView}
      </div>

      <details class="settings-section prog-info">
        <summary>RPE cheat sheet &amp; 8-week map</summary>
        <table class="mini-table">${pg.rpeCheat.map((r) => `<tr><td class="mt-key">RPE ${U.esc(r[0])}</td><td>${U.esc(r[1])}</td></tr>`).join('')}</table>
        <table class="mini-table" style="margin-top:10px">${pg.weekMap.map((r) => `<tr><td class="mt-key">Wk ${U.esc(r[0])}</td><td><b>${U.esc(r[1])}</b><br><span class="muted small">${U.esc(r[2])}</span></td></tr>`).join('')}</table>
      </details>

      <div class="settings-section">
        <button class="btn btn-danger-ghost" id="reset-prog" style="width:100%">Reset program progress</button>
      </div>`;

    // maxes
    body.querySelectorAll('.max-row').forEach((btn) => btn.addEventListener('click', async () => {
      const key = btn.dataset.lift;
      const name = pg.lifts.find((l) => l.key === key).name;
      const cur = S.program.oneRM[key];
      const r = await UI.form(`${name} 1RM`, [{ key: 'v', label: `Estimated 1RM (${unit})`, type: 'number', value: cur != null ? U.wt(cur, unit) : '' }], 'Save');
      if (r && r.v != null) { S.setProgramMax(key, U.toKg(r.v, unit)); rerender(); }
    }));

    // week chips
    body.querySelectorAll('.wk-chip').forEach((c) => c.addEventListener('click', () => {
      S.program.viewWeek = +c.dataset.week; S.save('program'); rerender();
    }));

    // day rows
    bindDayRows(body, sel);

    // edit log
    body.querySelector('#edit-log').addEventListener('click', async () => {
      const r = await UI.form(`Week ${sel} log`, [
        { key: 'bw', label: `Bodyweight (${unit})`, type: 'number', value: log.bodyweightKg != null ? U.wt(log.bodyweightKg, unit) : '' },
        { key: 'squat', label: 'Squat top set (e.g. 315×5 @8)', value: log.squat || '' },
        { key: 'bench', label: 'Bench top set', value: log.bench || '' },
        { key: 'deadlift', label: 'Deadlift top set', value: log.deadlift || '' },
        { key: 'sleep', label: 'Sleep (1-10)', type: 'number', value: log.sleep != null ? log.sleep : '' },
        { key: 'pump', label: 'Pump / enjoyment (1-10)', type: 'number', value: log.pump != null ? log.pump : '' },
        { key: 'notes', label: 'Weekly notes & wins', type: 'textarea', value: log.notes || '' },
      ], 'Save');
      if (!r) return;
      S.saveProgramLog(sel, {
        bodyweightKg: r.bw != null ? U.toKg(r.bw, unit) : null,
        squat: r.squat, bench: r.bench, deadlift: r.deadlift,
        sleep: r.sleep, pump: r.pump, notes: r.notes,
      });
      rerender();
    });

    // reset
    body.querySelector('#reset-prog').addEventListener('click', async () => {
      if (await UI.confirm('Reset program', 'Clears all day completions and weekly logs, and stops the program. Your logged workouts are NOT deleted.', 'Reset', true)) {
        S.program.active = false;
        S.program.completed = {};
        S.program.log = {};
        S.program.viewWeek = null;
        S.save('program');
        rerender();
        FT.render();
      }
    });
  }
})();
