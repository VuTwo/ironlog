/* app.js — bootstrapping, tab navigation, theme */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const S = FT.store;

  const TABS = [
    { id: 'workout', label: 'Workout', icon: '🏋️' },
    { id: 'history', label: 'History', icon: '📖' },
    { id: 'progress', label: 'Progress', icon: '📈' },
    { id: 'nutrition', label: 'Food', icon: '🍗' },
    { id: 'body', label: 'Body', icon: '⚖️' },
  ];
  let current = 'workout';

  FT.applyTheme = function () {
    const t = S.settings.theme || 'auto';
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#0d0d0d' : '#f9f9f7';
  };

  FT.render = function () {
    const view = document.getElementById('view');
    view.scrollTop = 0;
    (FT.views[current] || FT.views.workout)(view);
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === current));
    // active workout indicator on the Workout tab
    const dot = document.querySelector('.tab-btn[data-tab="workout"] .tab-dot');
    if (dot) dot.style.display = S.activeWorkout ? '' : 'none';
  };

  FT.go = function (tab) {
    current = tab;
    FT.render();
  };

  async function init() {
    await S.load();
    FT.applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', FT.applyTheme);

    const app = document.getElementById('app');
    app.innerHTML = `
      <header class="topbar">
        <span class="brand">IRON<b>LOG</b></span>
        <button class="icon-btn" id="more-btn" aria-label="Settings">⚙︎</button>
      </header>
      <main id="view"></main>
      <nav class="tabbar">
        ${TABS.map((t) => `<button class="tab-btn" data-tab="${t.id}"><span class="tab-icon">${t.icon}${t.id === 'workout' ? '<i class="tab-dot"></i>' : ''}</span><span class="tab-label">${t.label}</span></button>`).join('')}
      </nav>`;

    document.getElementById('more-btn').addEventListener('click', FT.showMore);
    document.querySelector('.tabbar').addEventListener('click', (e) => {
      const b = e.target.closest('.tab-btn');
      if (b) FT.go(b.dataset.tab);
    });

    // finish Fitbit OAuth if returning from authorize
    try { await FT.fitbit.handleRedirect(); } catch (e) {}

    FT.render();

    // register service worker when served over http(s) from our own files
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__SINGLE_FILE__) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
