/* program.js — FORGED program engine: exercise resolution, target-weight math, week/day lookup.
   Pure computation + library wiring. Program *state* (maxes, completion, log) lives in store.js. */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const U = FT.util;
  const P = (FT.program = {});
  const PROG = () => FT.PROGRAM;

  // ---- map each program exercise name to a library exercise (create if missing) ----
  // value: library exercise name (string) OR {create:{muscle,equipment}} to register a new one.
  const ALIAS = {
    'Competition Squat': 'Squat (Barbell)',
    'Paused Squat (2-ct)': 'Pause Squat',
    'Competition Bench': 'Bench Press (Barbell)',
    'Touch-and-Go Bench': 'Bench Press (Barbell)',
    'Deadlift': 'Deadlift (Barbell)',
    'Romanian Deadlift': 'Romanian Deadlift (Barbell)',
    'Leg Press (feet low & narrow)': 'Leg Press',
    'Seated Leg Curl': 'Leg Curl (Seated)',
    'Standing Calf Raise': 'Calf Raise (Standing)',
    'Cable Crunch': 'Cable Crunch',
    'Weighted Pull-Up': 'Pull-Up',
    'Seated DB Shoulder Press': 'Dumbbell Shoulder Press',
    'Chest-Supported Row': { create: { muscle: 'Back', equipment: 'Machine' } },
    'EZ-Bar Curl': 'EZ-Bar Curl',
    'Overhead Cable Extension': 'Overhead Cable Extension',
    'Face Pull': 'Face Pull',
    'Bulgarian Split Squat': 'Bulgarian Split Squat',
    'Back Extension (glute bias)': 'Back Extension',
    'Walking DB Lunge': 'Walking Lunge',
    'Seated Calf Raise': 'Calf Raise (Seated)',
    'Hanging Leg Raise': 'Hanging Leg Raise',
    'Incline DB Press (30°)': 'Incline Dumbbell Press',
    'Lat Pulldown (neutral wide)': 'Lat Pulldown',
    'Single-Arm Cable Row': { create: { muscle: 'Back', equipment: 'Cable' } },
    'DB Lateral Raise': 'Lateral Raise',
    'Cable Fly (low-to-high or pec deck)': 'Cable Fly',
    'Incline DB Curl': 'Incline Dumbbell Curl',
    'Lying DB Skullcrusher': { create: { muscle: 'Triceps', equipment: 'Dumbbell' } },
    'Hammer Curl': 'Hammer Curl',
    'Rope Pressdown': 'Triceps Pushdown',
    'Reverse Pec Deck (rear delts)': 'Reverse Pec Deck',
  };

  const slug = (s) => 'pg-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Resolve a program exercise name → library exercise id, registering new ones as needed.
  P.resolveExercise = function (name) {
    const S = FT.store;
    const alias = ALIAS[name];
    const libName = typeof alias === 'string' ? alias : name;
    let ex = S.exercises.find((e) => e.name === libName);
    if (ex) return ex.id;
    // create — either an aliased brand-new exercise, or an unmapped name
    const def = (alias && alias.create) || { muscle: 'Other', equipment: 'Other' };
    ex = { id: slug(libName), name: libName, muscle: def.muscle, equipment: def.equipment, isCustom: false };
    S.exercises.push(ex);
    S.save('exercises');
    return ex.id;
  };

  // Ensure every exercise the program references exists in the library (call once on program start).
  P.ensureExercises = function () {
    for (const wk of PROG().weeks)
      for (const d of wk.days)
        for (const it of d.items) {
          if (it.t === 'ss') { P.resolveExercise(it.a); P.resolveExercise(it.b); }
          else P.resolveExercise(it.ex);
        }
  };

  // ---- lookups ----
  P.week = (n) => PROG().weeks.find((w) => w.n === n) || PROG().weeks[0];
  P.day = (n, key) => P.week(n).days.find((d) => d.key === key);
  P.cue = (id) => (id == null ? '' : (PROG().cues[id] || ''));
  P.blockLabel = (wk) => (wk.block || '').split('•')[0].trim();

  // ---- target weight: %1RM rounded to 5 lb (Excel-faithful), stored canonically in kg ----
  P.roundStep = (x, step) => Math.round(x / step) * step;
  // oneRMkg: the lift's 1RM in kg; pct: e.g. 70 → returns target load in kg
  P.targetWeightKg = function (oneRMkg, pct) {
    if (oneRMkg == null || !pct) return null;
    const lb = U.fromKg(oneRMkg, 'lb') * (pct / 100);
    return U.toKg(P.roundStep(lb, 5), 'lb');
  };

  // leading integer of a rep target ('6' → 6, '8-10' → 8, '20 steps' → 20); null if none
  P.firstRep = (reps) => { const m = String(reps || '').match(/\d+/); return m ? parseInt(m[0], 10) : null; };

  // human target line for the logger, e.g. "4×6 @ 70% · RPE 7"  /  "3×10-12 · RPE 8 · your pick"
  P.targetLine = function (it) {
    if (it.t === 'main') return `${it.sets}×${it.reps} @ ${it.pct}% · RPE ${it.rpe}`;
    return `${it.sets}×${it.reps} · RPE ${it.rpe} · your pick`;
  };

  // ---- progress / current week ----
  P.dayCompleted = (n, key) => !!(FT.store.program.completed || {})[`w${n}${key}`];
  P.weekComplete = (n) => P.week(n).days.every((d) => P.dayCompleted(n, d.key));
  // current week = first week with an unfinished day (capped at 8)
  P.currentWeek = function () {
    for (let n = 1; n <= 8; n++) if (!P.weekComplete(n)) return n;
    return 8;
  };
})();
