/* fitbit.js — Fitbit Web API sync (OAuth 2.0 + PKCE, no server needed).
   Fitbit is the bridge to Google: weight + workouts pushed here appear in the
   Fitbit app and feed Google's health coach. Setup (one time):
   1. dev.fitbit.com → Register an app → OAuth 2.0 Application Type: "Client"
   2. Redirect URL: the exact URL this app is hosted at (https required)
   3. Paste the Client ID in Settings → Sync. */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, S = FT.store;
  const FB = (FT.fitbit = {});
  const AUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
  const TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
  const API = 'https://api.fitbit.com';
  const SCOPES = 'activity nutrition weight profile';

  const cfg = () => S.settings.fitbit;
  FB.connected = () => !!cfg().refreshToken;

  const redirectUri = () => location.origin + location.pathname;

  // ---------- PKCE helpers ----------
  function b64url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function makeChallenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return b64url(digest);
  }

  FB.connect = async function () {
    const clientId = cfg().clientId && cfg().clientId.trim();
    if (!clientId) { FT.ui.toast('Enter your Fitbit Client ID first'); return; }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      FT.ui.toast('Fitbit OAuth requires the app to be hosted over HTTPS');
      return;
    }
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    localStorage.setItem('fb_verifier', verifier);
    const challenge = await makeChallenge(verifier);
    const url = `${AUTH_URL}?client_id=${encodeURIComponent(clientId)}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(redirectUri())}`;
    location.href = url;
  };

  // Call on startup: completes the OAuth round-trip if we returned with ?code=
  FB.handleRedirect = async function () {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    if (!code) return false;
    history.replaceState(null, '', location.pathname); // strip code from URL
    const verifier = localStorage.getItem('fb_verifier');
    if (!verifier) return false;
    try {
      const body = new URLSearchParams({
        client_id: cfg().clientId.trim(),
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri(),
      });
      const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors ? data.errors[0].message : 'Token exchange failed');
      saveTokens(data);
      FT.ui.toast('Fitbit connected ✓');
      localStorage.removeItem('fb_verifier');
      return true;
    } catch (e) {
      FT.ui.toast('Fitbit connect failed: ' + e.message);
      return false;
    }
  };

  function saveTokens(data) {
    const f = cfg();
    f.accessToken = data.access_token;
    f.refreshToken = data.refresh_token;
    f.userId = data.user_id || f.userId;
    f.scopes = data.scope || f.scopes;
    f.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    S.save('settings');
  }

  FB.disconnect = () => {
    S.settings.fitbit = { ...S.settings.fitbit, accessToken: '', refreshToken: '', expiresAt: 0, userId: '', scopes: '' };
    S.save('settings');
  };

  async function accessToken() {
    const f = cfg();
    if (!f.refreshToken) throw new Error('Not connected');
    if (Date.now() < f.expiresAt && f.accessToken) return f.accessToken;
    const body = new URLSearchParams({ client_id: f.clientId.trim(), grant_type: 'refresh_token', refresh_token: f.refreshToken });
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await res.json();
    if (!res.ok) { FB.disconnect(); throw new Error('Fitbit session expired — reconnect in Settings'); }
    saveTokens(data);
    return data.access_token;
  }

  async function api(method, path, params) {
    const token = await accessToken();
    const url = API + path + (params ? '?' + new URLSearchParams(params) : '');
    const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) {
      let msg = res.status;
      try { const j = await res.json(); msg = j.errors ? j.errors[0].message : msg; } catch (e) {}
      throw new Error('Fitbit API: ' + msg);
    }
    return res.json();
  }

  // ---------- sync operations ----------
  // Weight: Fitbit expects the unit system of Accept-Language; default (none) = metric kg.
  FB.pushWeight = (dateKey, weightKg) =>
    api('POST', '/1/user/-/body/log/weight.json', { weight: (Math.round(weightKg * 100) / 100).toFixed(2), date: dateKey });

  // Workout → Fitbit activity "Weights" (activityId 2050)
  FB.pushWorkout = (w) => {
    const start = new Date(w.startedAt);
    const hh = String(start.getHours()).padStart(2, '0'), mm = String(start.getMinutes()).padStart(2, '0');
    const durationMs = Math.max(60000, (w.endedAt || w.startedAt + 3600000) - w.startedAt);
    return api('POST', '/1/user/-/activities.json', {
      activityId: 2050,
      startTime: `${hh}:${mm}`,
      durationMillis: durationMs,
      date: w.date,
    });
  };

  FB.pullWeight = async (days) => {
    const data = await api('GET', `/1/user/-/body/log/weight/date/${U.todayKey()}/${days || 30}d.json`);
    let added = 0;
    for (const entry of data.weight || []) {
      const existing = S.bodyLog.find((b) => b.date === entry.date);
      if (existing) continue;
      S.bodyLog.push({ id: 'b' + U.uid(), date: entry.date, weightKg: entry.weight, bodyFat: entry.fat || null, notes: 'from Fitbit' });
      added++;
    }
    S.bodyLog.sort((a, b) => (a.date < b.date ? 1 : -1));
    S.save('bodyLog');
    return added;
  };

  // fire-and-forget hooks used by views; silent unless connected
  FB.autoSyncWeight = (dateKey, weightKg) => {
    if (!FB.connected() || !S.settings.fitbit.autoWeight) return;
    FB.pushWeight(dateKey, weightKg).then(() => FT.ui.toast('Weight synced to Fitbit ✓')).catch((e) => FT.ui.toast(e.message));
  };
  FB.autoSyncWorkout = (w) => {
    if (!FB.connected() || !S.settings.fitbit.autoWorkout) return;
    FB.pushWorkout(w).then(() => FT.ui.toast('Workout synced to Fitbit ✓')).catch((e) => FT.ui.toast(e.message));
  };
})();
