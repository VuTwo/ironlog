/* store.js — app state, persistence, and derived stats */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util;

  const DEFAULT_SETTINGS = {
    units: 'lb',                     // 'lb' | 'kg'
    theme: 'auto',                   // 'auto' | 'dark' | 'light'
    restSeconds: 150,
    autoStartTimer: true,
    barKg: 20.4117,                  // 45 lb bar
    plateSetLb: [45, 35, 25, 10, 5, 2.5],
    macroTargets: { kcal: 2800, protein: 200, carbs: 300, fat: 80 },
    fitbit: { clientId: '', accessToken: '', refreshToken: '', expiresAt: 0, userId: '', scopes: '' },
  };

  const S = (FT.store = {
    settings: { ...DEFAULT_SETTINGS },
    exercises: [],
    workouts: [],        // finished workouts, newest first
    templates: [],
    bodyLog: [],         // {id, date, weightKg, bodyFat?, notes?} newest first
    nutrition: {},       // dateKey -> {entries:[{id,name,kcal,protein,carbs,fat}]}
    foods: [],
    activeWorkout: null, // in-progress workout or null
    loaded: false,
  });

  const KEYS = ['settings', 'exercises', 'workouts', 'templates', 'bodyLog', 'nutrition', 'foods', 'activeWorkout'];

  S.load = async function () {
    const vals = await Promise.all(KEYS.map((k) => FT.db.get(k)));
    KEYS.forEach((k, i) => { if (vals[i] !== undefined && vals[i] !== null) S[k] = vals[i]; });
    S.settings = { ...DEFAULT_SETTINGS, ...S.settings, macroTargets: { ...DEFAULT_SETTINGS.macroTargets, ...(S.settings.macroTargets || {}) }, fitbit: { ...DEFAULT_SETTINGS.fitbit, ...(S.settings.fitbit || {}) } };
    if (!S.exercises.length) S.exercises = FT.seedExercises();
    if (!S.foods.length) S.foods = FT.seedFoods();
    S.loaded = true;
  };

  S.save = function (...keys) {
    (keys.length ? keys : KEYS).forEach((k) => FT.db.set(k, S[k]));
  };

  // ---------- exercises ----------
  S.exercise = (id) => S.exercises.find((e) => e.id === id);
  S.addExercise = (name, muscle, equipment) => {
    const ex = { id: 'c' + U.uid(), name: name.trim(), muscle: muscle || 'Other', equipment: equipment || 'Other', isCustom: true };
    S.exercises.push(ex);
    S.save('exercises');
    return ex;
  };

  // ---------- workout lifecycle ----------
  S.startWorkout = (template) => {
    S.activeWorkout = {
      id: 'w' + U.uid(),
      date: U.todayKey(),
      name: template ? template.name : 'Workout',
      startedAt: Date.now(),
      notes: '',
      entries: template
        ? template.entries.map((en) => ({
            exerciseId: en.exerciseId,
            notes: '',
            sets: en.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, rpe: null, type: s.type || 'normal', done: false })),
          }))
        : [],
    };
    S.save('activeWorkout');
    return S.activeWorkout;
  };

  S.finishWorkout = () => {
    const w = S.activeWorkout;
    if (!w) return null;
    w.endedAt = Date.now();
    // drop entries with no completed sets; drop undone sets
    w.entries = w.entries
      .map((en) => ({ ...en, sets: en.sets.filter((s) => s.done) }))
      .filter((en) => en.sets.length);
    S.activeWorkout = null;
    if (w.entries.length) S.workouts.unshift(w);
    S.save('workouts', 'activeWorkout');
    return w.entries.length ? w : null;
  };

  S.discardWorkout = () => { S.activeWorkout = null; S.save('activeWorkout'); };

  S.deleteWorkout = (id) => {
    S.workouts = S.workouts.filter((w) => w.id !== id);
    S.save('workouts');
  };

  S.saveTemplateFromWorkout = (w, name) => {
    const t = {
      id: 't' + U.uid(),
      name: name || w.name,
      entries: w.entries.map((en) => ({
        exerciseId: en.exerciseId,
        sets: en.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, type: s.type || 'normal' })),
      })),
    };
    S.templates.push(t);
    S.save('templates');
    return t;
  };

  S.deleteTemplate = (id) => { S.templates = S.templates.filter((t) => t.id !== id); S.save('templates'); };

  // ---------- derived stats ----------
  // Last performance of an exercise: {date, sets} from most recent finished workout containing it
  S.lastPerformance = (exerciseId) => {
    for (const w of S.workouts) {
      const en = w.entries.find((e) => e.exerciseId === exerciseId);
      if (en && en.sets.length) return { date: w.date, sets: en.sets };
    }
    return null;
  };

  // Full history for an exercise: [{date, sets, bestE1rm, topSet, volume}] oldest→newest
  S.exerciseHistory = (exerciseId) => {
    const out = [];
    for (const w of S.workouts) {
      const en = w.entries.find((e) => e.exerciseId === exerciseId);
      if (!en || !en.sets.length) continue;
      const work = en.sets.filter((s) => s.type !== 'warmup');
      const sets = work.length ? work : en.sets;
      let best = null;
      for (const s of sets) {
        const e = U.e1rm(s.weightKg || 0, s.reps || 0);
        if (!best || e > best.e1rm) best = { e1rm: e, set: s };
      }
      out.push({
        date: w.date, workoutId: w.id, sets: en.sets,
        bestE1rm: best ? best.e1rm : 0,
        topSet: best ? best.set : null,
        volume: U.sum(sets, U.setVolume),
      });
    }
    return out.reverse();
  };

  // All-time records per exercise: best e1RM, best weight, best set volume
  S.records = (exerciseId) => {
    const hist = S.exerciseHistory(exerciseId);
    let bestE1rm = null, bestWeight = null, bestVolumeDay = null;
    for (const h of hist) {
      if (!bestE1rm || h.bestE1rm > bestE1rm.value) bestE1rm = { value: h.bestE1rm, date: h.date, set: h.topSet };
      for (const s of h.sets) {
        if (s.type === 'warmup') continue;
        if (!bestWeight || (s.weightKg || 0) > bestWeight.value) bestWeight = { value: s.weightKg || 0, date: h.date, set: s };
      }
      if (!bestVolumeDay || h.volume > bestVolumeDay.value) bestVolumeDay = { value: h.volume, date: h.date };
    }
    return { bestE1rm, bestWeight, bestVolumeDay };
  };

  // Returns list of PRs achieved in a finished workout (compared against all prior history)
  S.detectPRs = (workout) => {
    const prs = [];
    for (const en of workout.entries) {
      const priorBest = { e1rm: 0, weight: 0 };
      for (const w of S.workouts) {
        if (w.id === workout.id || w.date > workout.date) continue;
        const p = w.entries.find((e) => e.exerciseId === en.exerciseId);
        if (!p) continue;
        for (const s of p.sets) {
          if (s.type === 'warmup') continue;
          priorBest.e1rm = Math.max(priorBest.e1rm, U.e1rm(s.weightKg || 0, s.reps || 0));
          priorBest.weight = Math.max(priorBest.weight, s.weightKg || 0);
        }
      }
      let bestNew = null;
      for (const s of en.sets) {
        if (s.type === 'warmup') continue;
        const e = U.e1rm(s.weightKg || 0, s.reps || 0);
        if (e > priorBest.e1rm && (!bestNew || e > bestNew.e1rm)) bestNew = { e1rm: e, set: s };
      }
      if (bestNew && priorBest.e1rm > 0) prs.push({ exerciseId: en.exerciseId, ...bestNew });
    }
    return prs;
  };

  S.workoutVolume = (w) => U.sum(w.entries, (en) => U.sum(en.sets.filter((s) => s.type !== 'warmup' && s.done !== false), U.setVolume));
  S.workoutSets = (w) => U.sum(w.entries, (en) => en.sets.filter((s) => s.type !== 'warmup' && s.done !== false).length);

  // Weekly volume per muscle group over last n weeks: [{weekStart, byMuscle:{}}] oldest→newest
  S.weeklyMuscleVolume = (weeks) => {
    const today = U.parseKey(U.todayKey());
    const day = (today.getDay() + 6) % 7; // Monday start
    const thisMonday = U.addDays(U.todayKey(), -day);
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = U.addDays(thisMonday, -7 * i);
      out.push({ weekStart: start, byMuscle: {}, sets: 0 });
    }
    for (const w of S.workouts) {
      const wk = out.find((o) => w.date >= o.weekStart && w.date < U.addDays(o.weekStart, 7));
      if (!wk) continue;
      for (const en of w.entries) {
        const ex = S.exercise(en.exerciseId);
        const muscle = ex ? ex.muscle : 'Other';
        const workSets = en.sets.filter((s) => s.type !== 'warmup');
        wk.byMuscle[muscle] = (wk.byMuscle[muscle] || 0) + workSets.length;
        wk.sets += workSets.length;
      }
    }
    return out;
  };

  // ---------- body ----------
  S.logWeight = (dateKey, weightKg, bodyFat, notes) => {
    S.bodyLog = S.bodyLog.filter((b) => b.date !== dateKey);
    S.bodyLog.push({ id: 'b' + U.uid(), date: dateKey, weightKg, bodyFat: bodyFat || null, notes: notes || '' });
    S.bodyLog.sort((a, b) => (a.date < b.date ? 1 : -1));
    S.save('bodyLog');
  };
  S.deleteBodyEntry = (id) => { S.bodyLog = S.bodyLog.filter((b) => b.id !== id); S.save('bodyLog'); };

  // ---------- nutrition ----------
  S.day = (dateKey) => S.nutrition[dateKey] || { entries: [] };
  S.addFoodEntry = (dateKey, entry) => {
    if (!S.nutrition[dateKey]) S.nutrition[dateKey] = { entries: [] };
    S.nutrition[dateKey].entries.push({ id: 'n' + U.uid(), ...entry });
    S.save('nutrition');
  };
  S.deleteFoodEntry = (dateKey, id) => {
    const d = S.nutrition[dateKey];
    if (!d) return;
    d.entries = d.entries.filter((e) => e.id !== id);
    S.save('nutrition');
  };
  S.dayMacros = (dateKey) => {
    const d = S.day(dateKey);
    return {
      kcal: U.sum(d.entries, (e) => e.kcal || 0),
      protein: U.sum(d.entries, (e) => e.protein || 0),
      carbs: U.sum(d.entries, (e) => e.carbs || 0),
      fat: U.sum(d.entries, (e) => e.fat || 0),
    };
  };
  S.saveFood = (food) => {
    const existing = S.foods.find((f) => f.name.toLowerCase() === food.name.toLowerCase());
    if (!existing) { S.foods.unshift({ id: 'f' + U.uid(), ...food }); S.save('foods'); }
  };
})();
