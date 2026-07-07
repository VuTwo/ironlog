/* view-nutrition.js — Nutrition tab: daily macros vs targets, food log, 14-day chart */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store;
  FT.views = FT.views || {};

  let day = null; // dateKey being viewed

  FT.views.nutrition = function (root) {
    if (!day) day = U.todayKey();
    const t = S.settings.macroTargets;
    const m = S.dayMacros(day);
    const entries = S.day(day).entries;

    root.innerHTML = `
      <div class="page">
        <div class="section-head"><h1>Nutrition</h1><button class="text-btn" id="edit-targets">Targets</button></div>
        <div class="day-nav">
          <button class="icon-btn" id="day-prev">‹</button>
          <span class="day-label">${U.relDate(day)}</span>
          <button class="icon-btn" id="day-next" ${day === U.todayKey() ? 'disabled' : ''}>›</button>
        </div>
        <div class="card">
          <div class="kcal-row">
            <div class="kcal-big"><b>${Math.round(m.kcal)}</b><span class="muted"> / ${t.kcal} kcal</span></div>
            <div class="muted small">${t.kcal - Math.round(m.kcal) >= 0 ? `${t.kcal - Math.round(m.kcal)} left` : `${Math.round(m.kcal) - t.kcal} over`}</div>
          </div>
          ${macroBar('Protein', m.protein, t.protein, 'var(--series-1)')}
          ${macroBar('Carbs', m.carbs, t.carbs, 'var(--series-2)')}
          ${macroBar('Fat', m.fat, t.fat, 'var(--series-3)')}
        </div>
        <div class="btn-pair">
          <button class="btn btn-primary" id="add-food">＋ Add food</button>
          <button class="btn btn-ghost" id="quick-add">Quick add</button>
        </div>
        <div id="food-list"></div>
        <div class="section-head"><h2>Last 14 days</h2></div>
        <div class="card">
          <div class="legend">
            <span class="legend-item"><i style="background:var(--series-1)"></i>Protein</span>
            <span class="legend-item"><i style="background:var(--series-2)"></i>Carbs</span>
            <span class="legend-item"><i style="background:var(--series-3)"></i>Fat</span>
          </div>
          <div id="macro-chart" class="chart-box"></div>
        </div>
      </div>`;

    root.querySelector('#day-prev').addEventListener('click', () => { day = U.addDays(day, -1); FT.views.nutrition(root); });
    root.querySelector('#day-next').addEventListener('click', () => { if (day < U.todayKey()) { day = U.addDays(day, 1); FT.views.nutrition(root); } });

    root.querySelector('#edit-targets').addEventListener('click', async () => {
      const r = await UI.form('Daily targets', [
        { key: 'kcal', label: 'Calories (kcal)', type: 'number', value: t.kcal },
        { key: 'protein', label: 'Protein (g)', type: 'number', value: t.protein },
        { key: 'carbs', label: 'Carbs (g)', type: 'number', value: t.carbs },
        { key: 'fat', label: 'Fat (g)', type: 'number', value: t.fat },
      ]);
      if (r) {
        S.settings.macroTargets = { kcal: r.kcal || 0, protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0 };
        S.save('settings');
        FT.views.nutrition(root);
      }
    });

    root.querySelector('#add-food').addEventListener('click', async () => {
      const r = await UI.form('Add food', [
        { key: 'name', label: 'Name', placeholder: 'e.g. Chipotle bowl' },
        { key: 'kcal', label: 'Calories (kcal)', type: 'number' },
        { key: 'protein', label: 'Protein (g)', type: 'number' },
        { key: 'carbs', label: 'Carbs (g)', type: 'number' },
        { key: 'fat', label: 'Fat (g)', type: 'number' },
      ], 'Log it');
      if (!r || !r.name || !r.name.trim()) return;
      const entry = { name: r.name.trim(), kcal: r.kcal || 0, protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0 };
      S.addFoodEntry(day, entry);
      S.saveFood(entry); // remember for quick add
      FT.views.nutrition(root);
    });

    root.querySelector('#quick-add').addEventListener('click', () => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<input class="search-input" type="search" placeholder="Search saved foods…"><div class="ex-list" id="food-quick-list"></div>`;
      const list = wrap.querySelector('#food-quick-list');
      const search = wrap.querySelector('input');
      const render = () => {
        const q = search.value.trim().toLowerCase();
        list.innerHTML = S.foods
          .filter((f) => !q || f.name.toLowerCase().includes(q))
          .map((f) => `<button class="ex-item" data-id="${f.id}"><span class="ex-name">${U.esc(f.name)}</span><span class="ex-sub">${f.kcal} kcal · P${f.protein} C${f.carbs} F${f.fat}</span></button>`)
          .join('') || '<div class="muted" style="padding:16px;text-align:center">No saved foods.</div>';
      };
      render();
      search.addEventListener('input', U.debounce(render, 120));
      const sheet = UI.sheet({ title: 'Quick add', body: wrap });
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.ex-item');
        if (!item) return;
        const f = S.foods.find((x) => x.id === item.dataset.id);
        if (f) {
          S.addFoodEntry(day, { name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat });
          sheet.close();
          FT.views.nutrition(root);
        }
      });
    });

    const list = root.querySelector('#food-list');
    list.innerHTML = entries.length
      ? entries
          .map((e) => `<div class="card food-card"><div><div class="card-title">${U.esc(e.name)}</div><div class="muted small">${Math.round(e.kcal)} kcal · P ${Math.round(e.protein)} · C ${Math.round(e.carbs)} · F ${Math.round(e.fat)}</div></div><button class="icon-btn food-del" data-id="${e.id}">✕</button></div>`)
          .join('')
      : `<div class="card muted" style="text-align:center">Nothing logged ${day === U.todayKey() ? 'today' : 'this day'} yet.</div>`;
    list.addEventListener('click', (e) => {
      const del = e.target.closest('.food-del');
      if (!del) return;
      S.deleteFoodEntry(day, del.dataset.id);
      FT.views.nutrition(root);
    });

    // 14-day stacked kcal chart (macros converted to kcal), target line
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const dk = U.addDays(U.todayKey(), -i);
      const dm = S.dayMacros(dk);
      bars.push({
        x: U.fmtDate(dk, { day: 'numeric' }),
        dk, dm,
        parts: [
          { key: 'protein', value: dm.protein * 4 },
          { key: 'carbs', value: dm.carbs * 4 },
          { key: 'fat', value: dm.fat * 9 },
        ],
      });
    }
    const css = getComputedStyle(document.documentElement);
    FT.chartStacked(root.querySelector('#macro-chart'), {
      bars,
      height: 180,
      target: t.kcal,
      series: [
        { key: 'protein', color: css.getPropertyValue('--series-1').trim() || '#2a78d6' },
        { key: 'carbs', color: css.getPropertyValue('--series-2').trim() || '#1baf7a' },
        { key: 'fat', color: css.getPropertyValue('--series-3').trim() || '#eda100' },
      ],
      yFmt: (v) => (v >= 1000 ? v / 1000 + 'k' : v),
      tooltip: (b) => `<b>${Math.round(b.dm.kcal)} kcal</b> · ${U.fmtDate(b.dk)}<br><span class="muted">P ${Math.round(b.dm.protein)} · C ${Math.round(b.dm.carbs)} · F ${Math.round(b.dm.fat)}</span>`,
    });
  };

  function macroBar(label, val, target, color) {
    const pct = U.clamp(target ? (val / target) * 100 : 0, 0, 100);
    return `<div class="macro-row">
      <span class="macro-label">${label}</span>
      <div class="macro-track"><div class="macro-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="macro-val">${Math.round(val)}<span class="muted">/${target}g</span></span>
    </div>`;
  }
})();
