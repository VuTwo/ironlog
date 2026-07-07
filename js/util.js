/* util.js — shared helpers. Namespaced under window.FT */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = (FT.util = {});

  const KG_PER_LB = 0.45359237;

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---- dates (local, ISO yyyy-mm-dd keys) ----
  U.todayKey = () => U.dateKey(new Date());
  U.dateKey = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  U.parseKey = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  U.addDays = (key, n) => {
    const d = U.parseKey(key);
    d.setDate(d.getDate() + n);
    return U.dateKey(d);
  };
  U.fmtDate = (key, opts) => U.parseKey(key).toLocaleDateString(undefined, opts || { weekday: 'short', month: 'short', day: 'numeric' });
  U.fmtDateLong = (key) => U.parseKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  U.relDate = (key) => {
    const today = U.todayKey();
    if (key === today) return 'Today';
    if (key === U.addDays(today, -1)) return 'Yesterday';
    const days = Math.round((U.parseKey(today) - U.parseKey(key)) / 86400000);
    if (days < 7) return U.parseKey(key).toLocaleDateString(undefined, { weekday: 'long' });
    return U.fmtDate(key);
  };
  U.fmtDuration = (ms) => {
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };
  U.fmtClock = (secs) => {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ---- units: all weights stored canonically in kg ----
  U.KG_PER_LB = KG_PER_LB;
  U.toKg = (val, unit) => (unit === 'lb' ? val * KG_PER_LB : val);
  U.fromKg = (kg, unit) => (unit === 'lb' ? kg / KG_PER_LB : kg);
  // Display weight in user unit, rounded to sensible precision
  U.wt = (kg, unit) => {
    if (kg == null || isNaN(kg)) return '—';
    const v = U.fromKg(kg, unit);
    const rounded = Math.round(v * 10) / 10;
    return (rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1));
  };
  U.wtu = (kg, unit) => (kg == null ? '—' : `${U.wt(kg, unit)} ${unit}`);

  // ---- strength math ----
  // Epley estimated 1RM; reps=1 returns weight itself
  U.e1rm = (kg, reps) => (reps <= 1 ? kg : kg * (1 + reps / 30));
  U.setVolume = (set) => (set.weightKg || 0) * (set.reps || 0);

  // ---- misc ----
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  U.sum = (arr, fn) => arr.reduce((a, x) => a + (fn ? fn(x) : x), 0);
  U.groupBy = (arr, fn) => {
    const m = new Map();
    for (const x of arr) {
      const k = fn(x);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return m;
  };
  U.debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  // Exponential moving average for trend weight (MacroFactor-style)
  U.ema = (points, alpha) => {
    let prev = null;
    return points.map((p) => {
      prev = prev == null ? p : alpha * p + (1 - alpha) * prev;
      return prev;
    });
  };

  U.haptic = (ms) => { try { navigator.vibrate && navigator.vibrate(ms || 10); } catch (e) {} };

  U.download = (filename, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  };

  U.copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) {}
      document.body.removeChild(ta);
      return ok;
    }
  };

  U.shareText = async (title, text) => {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return true; } catch (e) { return false; }
    }
    return U.copyText(text);
  };
})();
