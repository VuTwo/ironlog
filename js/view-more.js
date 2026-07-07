/* view-more.js — Settings / Data / Sync panel (opened from the header gear) */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, UI = FT.ui, S = FT.store;

  FT.showMore = function () {
    const body = document.createElement('div');
    render(body);
    UI.sheet({ title: 'Settings & data', body });
  };

  function render(body) {
    const st = S.settings;
    const fb = st.fitbit;
    const connected = FT.fitbit.connected();
    body.innerHTML = `
      <div class="settings-section">
        <h3>Preferences</h3>
        <div class="setting-row"><span>Units</span>
          <div class="seg"><button class="seg-btn${st.units === 'lb' ? ' active' : ''}" data-u="lb">lb</button><button class="seg-btn${st.units === 'kg' ? ' active' : ''}" data-u="kg">kg</button></div>
        </div>
        <div class="setting-row"><span>Theme</span>
          <div class="seg" id="theme-seg">${['auto', 'dark', 'light'].map((t) => `<button class="seg-btn${st.theme === t ? ' active' : ''}" data-t="${t}">${t}</button>`).join('')}</div>
        </div>
        <div class="setting-row"><span>Rest timer</span>
          <div class="seg" id="rest-seg">${[90, 120, 150, 180, 240].map((s) => `<button class="seg-btn${st.restSeconds === s ? ' active' : ''}" data-s="${s}">${s >= 120 ? (s / 60).toFixed(s % 60 ? 1 : 0) + 'm' : s + 's'}</button>`).join('')}</div>
        </div>
        <div class="setting-row"><span>Auto-start rest timer</span><button class="toggle${st.autoStartTimer ? ' on' : ''}" id="tgl-timer"></button></div>
      </div>

      <div class="settings-section">
        <h3>Feed your AI</h3>
        <p class="muted small">Generates a markdown digest of your training, body weight and nutrition — paste it into Claude/ChatGPT for coaching analysis.</p>
        <div class="btn-pair">
          <button class="btn btn-primary" id="ai-copy">Copy AI digest</button>
          <button class="btn btn-ghost" id="ai-share">Share…</button>
        </div>
      </div>

      <div class="settings-section">
        <h3>Export & backup</h3>
        <div class="btn-col">
          <button class="btn btn-ghost" id="exp-json">Download full backup (JSON)</button>
          <button class="btn btn-ghost" id="exp-csv-w">Workouts CSV</button>
          <button class="btn btn-ghost" id="exp-csv-b">Body weight CSV</button>
          <button class="btn btn-ghost" id="exp-csv-n">Nutrition CSV</button>
          <button class="btn btn-ghost" id="imp-json">Restore from backup…</button>
          <button class="btn btn-ghost" id="imp-strong">Import Strong app CSV…</button>
        </div>
        <input type="file" id="file-json" accept=".json" hidden>
        <input type="file" id="file-strong" accept=".csv" hidden>
      </div>

      <div class="settings-section">
        <h3>Fitbit / Google Health sync</h3>
        ${connected
          ? `<p class="small">✅ Connected${fb.userId ? ` (user ${U.esc(fb.userId)})` : ''}. Weight and workouts you log can sync to Fitbit, which feeds the Fitbit app and Google's health coach.</p>
             <div class="setting-row"><span>Auto-sync weigh-ins</span><button class="toggle${fb.autoWeight ? ' on' : ''}" id="tgl-fbw"></button></div>
             <div class="setting-row"><span>Auto-sync workouts</span><button class="toggle${fb.autoWorkout ? ' on' : ''}" id="tgl-fbwo"></button></div>
             <div class="btn-col">
               <button class="btn btn-ghost" id="fb-pull">Pull last 30 days of Fitbit weigh-ins</button>
               <button class="btn btn-danger-ghost" id="fb-disc">Disconnect Fitbit</button>
             </div>`
          : `<p class="muted small">One-time setup: register a free app at <b>dev.fitbit.com</b> (OAuth 2.0 type “Client”, redirect URL = this app's exact URL), then paste the Client ID below. Requires the app to be hosted over HTTPS. Once connected, weigh-ins and workouts sync to Fitbit and flow into Google's coaching.</p>
             <label class="field"><span class="field-label">Fitbit Client ID</span><input id="fb-client" value="${U.esc(fb.clientId || '')}" placeholder="e.g. 23ABCD"></label>
             <button class="btn btn-primary" id="fb-connect" style="width:100%">Connect Fitbit</button>`}
      </div>

      <div class="settings-section muted small">
        IronLog · all data lives on this device (export regularly!) · e1RM = Epley
      </div>`;

    // preferences
    body.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => { st.units = b.dataset.u; S.save('settings'); render(body); FT.render(); }));
    body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { st.theme = b.dataset.t; S.save('settings'); FT.applyTheme(); render(body); }));
    body.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { st.restSeconds = parseInt(b.dataset.s, 10); S.save('settings'); render(body); }));
    body.querySelector('#tgl-timer').addEventListener('click', () => { st.autoStartTimer = !st.autoStartTimer; S.save('settings'); render(body); });

    // AI digest
    body.querySelector('#ai-copy').addEventListener('click', async () => {
      const ok = await U.copyText(FT.exporter.aiDigest(8));
      UI.toast(ok ? 'Digest copied — paste it into your AI' : 'Copy failed');
    });
    body.querySelector('#ai-share').addEventListener('click', () => U.shareText('Training digest', FT.exporter.aiDigest(8)));

    // exports
    const stamp = U.todayKey();
    body.querySelector('#exp-json').addEventListener('click', () => U.download(`ironlog-backup-${stamp}.json`, FT.exporter.backupJson(), 'application/json'));
    body.querySelector('#exp-csv-w').addEventListener('click', () => U.download(`ironlog-workouts-${stamp}.csv`, FT.exporter.workoutsCsv(), 'text/csv'));
    body.querySelector('#exp-csv-b').addEventListener('click', () => U.download(`ironlog-body-${stamp}.csv`, FT.exporter.bodyCsv(), 'text/csv'));
    body.querySelector('#exp-csv-n').addEventListener('click', () => U.download(`ironlog-nutrition-${stamp}.csv`, FT.exporter.nutritionCsv(), 'text/csv'));

    // restore
    const fileJson = body.querySelector('#file-json');
    body.querySelector('#imp-json').addEventListener('click', () => fileJson.click());
    fileJson.addEventListener('change', async () => {
      const f = fileJson.files[0];
      if (!f) return;
      if (!(await UI.confirm('Restore backup', 'This replaces ALL current data with the backup. Continue?', 'Restore', true))) return;
      try {
        FT.exporter.restoreJson(await f.text());
        UI.toast('Backup restored ✓');
        FT.render();
      } catch (e) { UI.toast('Restore failed: ' + e.message); }
    });

    // Strong import
    const fileStrong = body.querySelector('#file-strong');
    body.querySelector('#imp-strong').addEventListener('click', () => fileStrong.click());
    fileStrong.addEventListener('change', async () => {
      const f = fileStrong.files[0];
      if (!f) return;
      const r = await UI.form('Import from Strong', [{ key: 'unit', label: 'Weights in the CSV are in…', type: 'select', options: ['lb', 'kg'] }], 'Import');
      if (!r) return;
      try {
        const n = FT.exporter.importStrongCsv(await f.text(), r.unit);
        UI.toast(`Imported ${n} workouts ✓`);
        FT.render();
      } catch (e) { UI.toast('Import failed: ' + e.message); }
    });

    // Fitbit
    if (connected) {
      body.querySelector('#tgl-fbw').addEventListener('click', () => { fb.autoWeight = !fb.autoWeight; S.save('settings'); render(body); });
      body.querySelector('#tgl-fbwo').addEventListener('click', () => { fb.autoWorkout = !fb.autoWorkout; S.save('settings'); render(body); });
      body.querySelector('#fb-pull').addEventListener('click', async () => {
        try { const n = await FT.fitbit.pullWeight(30); UI.toast(`Pulled ${n} new weigh-ins ✓`); FT.render(); }
        catch (e) { UI.toast(e.message); }
      });
      body.querySelector('#fb-disc').addEventListener('click', async () => {
        if (await UI.confirm('Disconnect Fitbit', 'Sync stops; your local data is unaffected.', 'Disconnect', true)) { FT.fitbit.disconnect(); render(body); }
      });
    } else {
      const input = body.querySelector('#fb-client');
      input.addEventListener('change', () => { fb.clientId = input.value.trim(); S.save('settings'); });
      body.querySelector('#fb-connect').addEventListener('click', () => { fb.clientId = input.value.trim(); S.save('settings'); FT.fitbit.connect(); });
    }
  }
})();
