/* export.js — backup/restore, CSV export, AI digest, Strong CSV import */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util, S = FT.store;
  const EX = (FT.exporter = {});

  // ---------- full JSON backup ----------
  EX.backupJson = () => {
    const data = {
      app: 'IronLog',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { ...S.settings, fitbit: undefined }, // never export tokens
      exercises: S.exercises,
      workouts: S.workouts,
      templates: S.templates,
      bodyLog: S.bodyLog,
      nutrition: S.nutrition,
      foods: S.foods,
    };
    return JSON.stringify(data, null, 2);
  };

  EX.restoreJson = (text) => {
    const data = JSON.parse(text);
    if (!data || data.app !== 'IronLog') throw new Error('Not an IronLog backup file');
    const fitbit = S.settings.fitbit;
    if (data.settings) S.settings = { ...S.settings, ...data.settings, fitbit };
    for (const k of ['exercises', 'workouts', 'templates', 'bodyLog', 'nutrition', 'foods']) {
      if (data[k]) S[k] = data[k];
    }
    S.save();
  };

  // ---------- CSV export ----------
  const csvCell = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  EX.workoutsCsv = () => {
    const unit = S.settings.units;
    const rows = [['date', 'workout', 'exercise', 'muscle', 'set_number', `weight_${unit}`, 'reps', 'rpe', 'set_type', 'e1rm_' + unit, 'exercise_notes', 'workout_notes']];
    for (const w of [...S.workouts].reverse()) {
      w.entries.forEach((en) => {
        const ex = S.exercise(en.exerciseId);
        en.sets.forEach((s, i) => {
          rows.push([
            w.date, w.name, ex ? ex.name : '?', ex ? ex.muscle : '',
            i + 1, U.wt(s.weightKg, unit), s.reps, s.rpe || '', s.type || 'normal',
            U.wt(U.e1rm(s.weightKg || 0, s.reps || 0), unit),
            en.notes || '', w.notes || '',
          ]);
        });
      });
    }
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  };

  EX.bodyCsv = () => {
    const unit = S.settings.units;
    const rows = [['date', `weight_${unit}`, 'body_fat_pct', 'notes']];
    for (const b of [...S.bodyLog].reverse()) rows.push([b.date, U.wt(b.weightKg, unit), b.bodyFat || '', b.notes || '']);
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  };

  EX.nutritionCsv = () => {
    const rows = [['date', 'food', 'kcal', 'protein_g', 'carbs_g', 'fat_g']];
    const dates = Object.keys(S.nutrition).sort();
    for (const d of dates) for (const e of S.nutrition[d].entries) rows.push([d, e.name, e.kcal, e.protein, e.carbs, e.fat]);
    return rows.map((r) => r.map(csvCell).join(',')).join('\n');
  };

  // ---------- AI digest (markdown, paste straight into any AI) ----------
  EX.aiDigest = (weeks) => {
    weeks = weeks || 8;
    const unit = S.settings.units;
    const cutoff = U.addDays(U.todayKey(), -7 * weeks);
    const lines = [];
    lines.push(`# Training data for AI analysis`);
    lines.push(`Generated ${U.todayKey()} · units: ${unit} · window: last ${weeks} weeks`);
    lines.push('');

    // Profile / context
    const t = S.settings.macroTargets;
    lines.push(`## Context`);
    lines.push(`- Macro targets: ${t.kcal} kcal, ${t.protein}g protein, ${t.carbs}g carbs, ${t.fat}g fat`);
    const bodyAsc = S.bodyLog.filter((b) => b.date >= cutoff).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (bodyAsc.length >= 2) {
      const first = bodyAsc[0], lastB = bodyAsc[bodyAsc.length - 1];
      lines.push(`- Body weight: ${U.wt(first.weightKg, unit)} → ${U.wt(lastB.weightKg, unit)} ${unit} (${bodyAsc.length} weigh-ins over window)`);
    }
    lines.push('');

    // Records
    lines.push(`## Current records (estimated 1RM, Epley)`);
    const trained = new Set();
    for (const w of S.workouts) for (const en of w.entries) trained.add(en.exerciseId);
    const recs = [...trained]
      .map((id) => ({ ex: S.exercise(id), rec: S.records(id), sessions: S.exerciseHistory(id).length }))
      .filter((r) => r.ex && r.rec.bestE1rm)
      .sort((a, b) => b.rec.bestE1rm.value - a.rec.bestE1rm.value)
      .slice(0, 12);
    for (const r of recs) {
      lines.push(`- ${r.ex.name}: e1RM ${U.wt(r.rec.bestE1rm.value, unit)} ${unit} (best set ${U.wt(r.rec.bestE1rm.set.weightKg, unit)}×${r.rec.bestE1rm.set.reps}, ${r.rec.bestE1rm.date}) — ${r.sessions} sessions logged`);
    }
    lines.push('');

    // Weekly volume
    lines.push(`## Weekly training sets by muscle group`);
    const wv = S.weeklyMuscleVolume(weeks);
    for (const wk of wv) {
      if (!wk.sets) continue;
      const parts = Object.entries(wk.byMuscle).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ${n}`).join(', ');
      lines.push(`- Week of ${wk.weekStart}: ${wk.sets} sets (${parts})`);
    }
    lines.push('');

    // Workout log
    lines.push(`## Workout log`);
    const ws = S.workouts.filter((w) => w.date >= cutoff);
    for (const w of [...ws].reverse()) {
      const dur = w.endedAt ? ` (${U.fmtDuration(w.endedAt - w.startedAt)})` : '';
      lines.push(`### ${w.date} — ${w.name}${dur}`);
      if (w.notes) lines.push(`Notes: ${w.notes}`);
      for (const en of w.entries) {
        const ex = S.exercise(en.exerciseId);
        const sets = en.sets
          .map((s) => `${U.wt(s.weightKg, unit)}×${s.reps}${s.rpe ? `@${s.rpe}` : ''}${s.type === 'warmup' ? ' (warmup)' : s.type === 'failure' ? ' (to failure)' : ''}`)
          .join(', ');
        lines.push(`- ${ex ? ex.name : '?'}: ${sets}${en.notes ? ` — “${en.notes}”` : ''}`);
      }
      lines.push('');
    }

    // Body log
    if (bodyAsc.length) {
      lines.push(`## Body weight log (${unit})`);
      lines.push(bodyAsc.map((b) => `${b.date}: ${U.wt(b.weightKg, unit)}${b.bodyFat ? ` (${b.bodyFat}% bf)` : ''}`).join(' · '));
      lines.push('');
    }

    // Nutrition averages by week
    const nutDates = Object.keys(S.nutrition).filter((d) => d >= cutoff && S.nutrition[d].entries.length).sort();
    if (nutDates.length) {
      lines.push(`## Nutrition (daily averages per week)`);
      const byWeek = U.groupBy(nutDates, (d) => {
        const dow = (U.parseKey(d).getDay() + 6) % 7;
        return U.addDays(d, -dow);
      });
      for (const [wk, dates] of byWeek) {
        const ms = dates.map((d) => S.dayMacros(d));
        const avg = (k) => Math.round(U.sum(ms, (m) => m[k]) / ms.length);
        lines.push(`- Week of ${wk} (${dates.length} days logged): ${avg('kcal')} kcal, P ${avg('protein')}g, C ${avg('carbs')}g, F ${avg('fat')}g`);
      }
      lines.push('');
    }

    lines.push(`## Questions to consider`);
    lines.push(`Analyze progression per lift, flag stalls or imbalances in weekly volume, assess whether nutrition supports the current goal, and suggest concrete next-block changes.`);
    return lines.join('\n');
  };

  // ---------- Strong app CSV import ----------
  EX.importStrongCsv = (text, weightUnit) => {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error('Empty CSV');
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name) => head.findIndex((h) => h === name || h.startsWith(name));
    const ci = {
      date: col('date'), workout: col('workout name'), exercise: col('exercise name'),
      order: col('set order'), weight: col('weight'), reps: col('reps'), rpe: col('rpe'), notes: col('notes'),
    };
    if (ci.date < 0 || ci.exercise < 0) throw new Error('Unrecognized CSV — expected a Strong export');
    const byWorkout = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[ci.date]) continue;
      const dateKey = r[ci.date].slice(0, 10);
      const wname = ci.workout >= 0 ? r[ci.workout] : 'Imported';
      const key = dateKey + '|' + wname;
      if (!byWorkout.has(key)) byWorkout.set(key, { date: dateKey, name: wname || 'Imported workout', entries: new Map() });
      const w = byWorkout.get(key);
      const exName = r[ci.exercise];
      if (!w.entries.has(exName)) w.entries.set(exName, []);
      const weight = parseFloat(r[ci.weight]) || 0;
      const reps = parseInt(r[ci.reps], 10) || 0;
      const rpe = ci.rpe >= 0 ? parseFloat(r[ci.rpe]) || null : null;
      if (!reps && !weight) continue;
      w.entries.get(exName).push({ weightKg: U.toKg(weight, weightUnit), reps, rpe, type: 'normal', done: true });
    }
    let imported = 0;
    const existingDates = new Set(S.workouts.map((w) => w.date + '|' + w.name));
    for (const w of byWorkout.values()) {
      if (existingDates.has(w.date + '|' + w.name)) continue;
      const entries = [];
      for (const [exName, sets] of w.entries) {
        if (!sets.length) continue;
        let ex = S.exercises.find((e) => e.name.toLowerCase() === exName.toLowerCase());
        if (!ex) ex = S.addExercise(exName, 'Other', 'Other');
        entries.push({ exerciseId: ex.id, notes: '', sets });
      }
      if (!entries.length) continue;
      const start = U.parseKey(w.date).getTime() + 12 * 3600000;
      S.workouts.push({ id: 'w' + U.uid(), date: w.date, name: w.name, startedAt: start, endedAt: start + 3600000, notes: '', entries, imported: true });
      imported++;
    }
    S.workouts.sort((a, b) => (a.date < b.date ? 1 : -1));
    S.save('workouts', 'exercises');
    return imported;
  };

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((x) => x !== '')) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x !== '')) rows.push(row);
    return rows;
  }
})();
