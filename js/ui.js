/* ui.js — shared UI primitives: bottom sheets, toasts, confirm, rest timer */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util;
  const UI = (FT.ui = {});

  // ---------- toast ----------
  let toastTimer = null;
  UI.toast = (msg, ms) => {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2200);
  };

  // ---------- bottom sheet ----------
  // UI.sheet({title, body: HTMLElement|html-string, actions?:[{label, cls, onClick}]}) → {close}
  UI.sheet = (opts) => {
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `
      <div class="sheet-grab"></div>
      <div class="sheet-head">
        <div class="sheet-title">${U.esc(opts.title || '')}</div>
        <button class="icon-btn sheet-close" aria-label="Close">✕</button>
      </div>
      <div class="sheet-body"></div>
      <div class="sheet-actions"></div>`;
    const body = sheet.querySelector('.sheet-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    const actions = sheet.querySelector('.sheet-actions');
    const api = {
      close: () => {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 200);
        document.body.classList.remove('sheet-open');
      },
      body,
    };
    for (const a of opts.actions || []) {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'btn-primary');
      b.textContent = a.label;
      b.addEventListener('click', () => a.onClick(api));
      actions.appendChild(b);
    }
    if (!(opts.actions || []).length) actions.remove();
    overlay.appendChild(sheet);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) api.close(); });
    sheet.querySelector('.sheet-close').addEventListener('click', api.close);
    document.body.appendChild(overlay);
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => overlay.classList.add('open'));
    return api;
  };

  UI.confirm = (title, msg, confirmLabel, danger) =>
    new Promise((resolve) => {
      const s = UI.sheet({
        title,
        body: `<p class="muted" style="padding:0 4px 8px">${U.esc(msg)}</p>`,
        actions: [
          { label: confirmLabel || 'Confirm', cls: danger ? 'btn-danger' : 'btn-primary', onClick: (api) => { api.close(); resolve(true); } },
          { label: 'Cancel', cls: 'btn-ghost', onClick: (api) => { api.close(); resolve(false); } },
        ],
      });
      s; // keep reference
    });

  // ---------- prompt sheet with fields ----------
  // fields: [{key,label,type:'text'|'number'|'textarea'|'select',value,options?,placeholder?,step?}]
  UI.form = (title, fields, submitLabel) =>
    new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'form-fields';
      for (const f of fields) {
        const row = document.createElement('label');
        row.className = 'field';
        let input;
        if (f.type === 'textarea') {
          input = document.createElement('textarea');
          input.rows = 3;
        } else if (f.type === 'select') {
          input = document.createElement('select');
          for (const o of f.options) {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            input.appendChild(opt);
          }
        } else {
          input = document.createElement('input');
          input.type = f.type || 'text';
          if (f.type === 'number') { input.inputMode = 'decimal'; if (f.step) input.step = f.step; }
        }
        if (f.value != null) input.value = f.value;
        if (f.placeholder) input.placeholder = f.placeholder;
        input.dataset.key = f.key;
        row.innerHTML = `<span class="field-label">${U.esc(f.label)}</span>`;
        row.appendChild(input);
        wrap.appendChild(row);
      }
      UI.sheet({
        title,
        body: wrap,
        actions: [
          {
            label: submitLabel || 'Save',
            onClick: (api) => {
              const out = {};
              wrap.querySelectorAll('[data-key]').forEach((el) => {
                out[el.dataset.key] = el.type === 'number' ? (el.value === '' ? null : parseFloat(el.value)) : el.value;
              });
              api.close();
              resolve(out);
            },
          },
          { label: 'Cancel', cls: 'btn-ghost', onClick: (api) => { api.close(); resolve(null); } },
        ],
      });
    });

  // ---------- rest timer (persists across views via fixed pill) ----------
  const timer = { endsAt: 0, total: 0, interval: null };
  UI.startRestTimer = (seconds) => {
    timer.endsAt = Date.now() + seconds * 1000;
    timer.total = seconds;
    if (!timer.interval) timer.interval = setInterval(tickTimer, 250);
    tickTimer();
  };
  UI.stopRestTimer = () => {
    timer.endsAt = 0;
    clearInterval(timer.interval);
    timer.interval = null;
    const pill = document.getElementById('rest-pill');
    if (pill) pill.remove();
  };
  UI.adjustRestTimer = (delta) => {
    if (!timer.endsAt) return;
    timer.endsAt += delta * 1000;
    tickTimer();
  };
  function tickTimer() {
    const remain = Math.ceil((timer.endsAt - Date.now()) / 1000);
    let pill = document.getElementById('rest-pill');
    if (remain <= 0) {
      if (timer.endsAt) {
        U.haptic([80, 60, 80]);
        beep();
        UI.toast('Rest done — next set 💪');
      }
      UI.stopRestTimer();
      return;
    }
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'rest-pill';
      pill.innerHTML = `<svg viewBox="0 0 36 36" class="rest-ring"><circle class="rest-track" cx="18" cy="18" r="15.5"/><circle class="rest-prog" cx="18" cy="18" r="15.5"/></svg><span class="rest-time"></span><button class="rest-adj" data-d="-15">−15</button><button class="rest-adj" data-d="15">+15</button><button class="rest-skip">Skip</button>`;
      pill.querySelectorAll('.rest-adj').forEach((b) => b.addEventListener('click', () => UI.adjustRestTimer(parseInt(b.dataset.d, 10))));
      pill.querySelector('.rest-skip').addEventListener('click', UI.stopRestTimer);
      document.body.appendChild(pill);
    }
    pill.querySelector('.rest-time').textContent = U.fmtClock(remain);
    const frac = U.clamp(remain / timer.total, 0, 1);
    const C = 2 * Math.PI * 15.5;
    pill.querySelector('.rest-prog').style.strokeDasharray = `${C * frac} ${C}`;
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.08;
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 350);
    } catch (e) {}
  }

  // ---------- exercise picker ----------
  UI.pickExercise = () =>
    new Promise((resolve) => {
      const S = FT.store;
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <input class="search-input" type="search" placeholder="Search exercises…">
        <div class="chip-row" id="muscle-chips"></div>
        <div class="ex-list"></div>
        <button class="btn btn-ghost" id="new-ex-btn" style="width:100%;margin-top:8px">+ Create custom exercise</button>`;
      const list = wrap.querySelector('.ex-list');
      const search = wrap.querySelector('.search-input');
      const chips = wrap.querySelector('#muscle-chips');
      let muscle = '';
      const chipAll = document.createElement('button');
      chipAll.className = 'chip active'; chipAll.textContent = 'All';
      chips.appendChild(chipAll);
      for (const m of FT.MUSCLES) {
        const c = document.createElement('button');
        c.className = 'chip'; c.textContent = m;
        chips.appendChild(c);
      }
      chips.addEventListener('click', (e) => {
        const c = e.target.closest('.chip');
        if (!c) return;
        chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
        c.classList.add('active');
        muscle = c.textContent === 'All' ? '' : c.textContent;
        render();
      });
      const sheet = UI.sheet({ title: 'Add exercise', body: wrap });
      function render() {
        const q = search.value.trim().toLowerCase();
        const items = S.exercises
          .filter((e) => (!muscle || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)))
          .sort((a, b) => a.name.localeCompare(b.name));
        list.innerHTML = items
          .map((e) => {
            const last = S.lastPerformance(e.id);
            const sub = last ? `Last: ${U.fmtDate(last.date)}` : e.equipment;
            return `<button class="ex-item" data-id="${e.id}"><span class="ex-name">${U.esc(e.name)}</span><span class="ex-sub">${U.esc(e.muscle)} · ${U.esc(sub)}</span></button>`;
          })
          .join('') || '<div class="muted" style="padding:16px;text-align:center">No matches.</div>';
      }
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.ex-item');
        if (!item) return;
        sheet.close();
        resolve(S.exercise(item.dataset.id));
      });
      search.addEventListener('input', U.debounce(render, 120));
      wrap.querySelector('#new-ex-btn').addEventListener('click', async () => {
        const res = await UI.form('New exercise', [
          { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Larsen Press' },
          { key: 'muscle', label: 'Muscle group', type: 'select', options: FT.MUSCLES },
          { key: 'equipment', label: 'Equipment', type: 'select', options: FT.EQUIPMENT },
        ], 'Create');
        if (res && res.name && res.name.trim()) {
          const ex = S.addExercise(res.name, res.muscle, res.equipment);
          sheet.close();
          resolve(ex);
        }
      });
      render();
      setTimeout(() => search.focus(), 250);
    });

  // ---------- plate calculator ----------
  UI.plateCalc = (weightKg) => {
    const S = FT.store.settings;
    const unit = S.units;
    const total = U.fromKg(weightKg, unit);
    const bar = U.fromKg(S.barKg, unit);
    const plates = unit === 'lb' ? S.plateSetLb : [25, 20, 15, 10, 5, 2.5, 1.25];
    let perSide = (total - bar) / 2;
    const loading = [];
    for (const p of plates) {
      let n = 0;
      while (perSide >= p - 0.01) { perSide -= p; n++; }
      if (n) loading.push({ plate: p, n });
    }
    const rows = loading.length
      ? loading.map((l) => `<div class="plate-row"><span class="plate-badge">${l.plate}</span><span>× ${l.n} per side</span></div>`).join('')
      : `<p class="muted">Bar only (or below bar weight).</p>`;
    const remainder = perSide > 0.01 ? `<p class="muted">~${perSide.toFixed(1)} ${unit}/side unloadable with your plates.</p>` : '';
    UI.sheet({
      title: `Load ${U.wt(weightKg, unit)} ${unit}`,
      body: `<div class="plate-list">${rows}</div>${remainder}<p class="muted" style="margin-top:8px">Bar: ${Math.round(bar)} ${unit}</p>`,
    });
  };
})();
