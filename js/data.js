/* data.js — seed exercise library and food quick-adds */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});

  // [name, muscle, equipment]
  const EX = [
    // --- Powerlifting core ---
    ['Squat (Barbell)', 'Quads', 'Barbell'],
    ['Bench Press (Barbell)', 'Chest', 'Barbell'],
    ['Deadlift (Barbell)', 'Back', 'Barbell'],
    ['Overhead Press (Barbell)', 'Shoulders', 'Barbell'],
    ['Front Squat (Barbell)', 'Quads', 'Barbell'],
    ['Pause Bench Press', 'Chest', 'Barbell'],
    ['Pause Squat', 'Quads', 'Barbell'],
    ['Deficit Deadlift', 'Back', 'Barbell'],
    ['Romanian Deadlift (Barbell)', 'Hamstrings', 'Barbell'],
    ['Sumo Deadlift', 'Back', 'Barbell'],
    ['Close-Grip Bench Press', 'Triceps', 'Barbell'],
    ['Incline Bench Press (Barbell)', 'Chest', 'Barbell'],
    ['Rack Pull', 'Back', 'Barbell'],
    ['Box Squat', 'Quads', 'Barbell'],
    ['Good Morning', 'Hamstrings', 'Barbell'],
    ['Barbell Row', 'Back', 'Barbell'],
    ['Pendlay Row', 'Back', 'Barbell'],
    ['Hip Thrust (Barbell)', 'Glutes', 'Barbell'],
    ['Barbell Curl', 'Biceps', 'Barbell'],
    ['EZ-Bar Curl', 'Biceps', 'Barbell'],
    ['Skullcrusher (EZ-Bar)', 'Triceps', 'Barbell'],
    ['Barbell Shrug', 'Traps', 'Barbell'],
    ['Push Press', 'Shoulders', 'Barbell'],
    // --- Dumbbell ---
    ['Dumbbell Bench Press', 'Chest', 'Dumbbell'],
    ['Incline Dumbbell Press', 'Chest', 'Dumbbell'],
    ['Dumbbell Fly', 'Chest', 'Dumbbell'],
    ['Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell'],
    ['Lateral Raise', 'Shoulders', 'Dumbbell'],
    ['Rear Delt Fly', 'Shoulders', 'Dumbbell'],
    ['Front Raise', 'Shoulders', 'Dumbbell'],
    ['Dumbbell Row', 'Back', 'Dumbbell'],
    ['Dumbbell Curl', 'Biceps', 'Dumbbell'],
    ['Hammer Curl', 'Biceps', 'Dumbbell'],
    ['Incline Dumbbell Curl', 'Biceps', 'Dumbbell'],
    ['Concentration Curl', 'Biceps', 'Dumbbell'],
    ['Overhead Triceps Extension (DB)', 'Triceps', 'Dumbbell'],
    ['Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell'],
    ['Goblet Squat', 'Quads', 'Dumbbell'],
    ['Bulgarian Split Squat', 'Quads', 'Dumbbell'],
    ['Walking Lunge', 'Quads', 'Dumbbell'],
    ['Dumbbell Shrug', 'Traps', 'Dumbbell'],
    ['Dumbbell Pullover', 'Chest', 'Dumbbell'],
    // --- Machine / Cable ---
    ['Lat Pulldown', 'Back', 'Cable'],
    ['Seated Cable Row', 'Back', 'Cable'],
    ['Cable Fly', 'Chest', 'Cable'],
    ['Triceps Pushdown', 'Triceps', 'Cable'],
    ['Overhead Cable Extension', 'Triceps', 'Cable'],
    ['Cable Curl', 'Biceps', 'Cable'],
    ['Cable Lateral Raise', 'Shoulders', 'Cable'],
    ['Face Pull', 'Shoulders', 'Cable'],
    ['Cable Crunch', 'Abs', 'Cable'],
    ['Straight-Arm Pulldown', 'Back', 'Cable'],
    ['Leg Press', 'Quads', 'Machine'],
    ['Hack Squat', 'Quads', 'Machine'],
    ['Leg Extension', 'Quads', 'Machine'],
    ['Leg Curl (Lying)', 'Hamstrings', 'Machine'],
    ['Leg Curl (Seated)', 'Hamstrings', 'Machine'],
    ['Calf Raise (Standing)', 'Calves', 'Machine'],
    ['Calf Raise (Seated)', 'Calves', 'Machine'],
    ['Chest Press Machine', 'Chest', 'Machine'],
    ['Pec Deck', 'Chest', 'Machine'],
    ['Shoulder Press Machine', 'Shoulders', 'Machine'],
    ['Machine Row', 'Back', 'Machine'],
    ['Hip Abduction Machine', 'Glutes', 'Machine'],
    ['Hip Adduction Machine', 'Glutes', 'Machine'],
    ['Smith Machine Squat', 'Quads', 'Machine'],
    ['Smith Machine Bench Press', 'Chest', 'Machine'],
    ['Reverse Pec Deck', 'Shoulders', 'Machine'],
    ['Preacher Curl Machine', 'Biceps', 'Machine'],
    // --- Bodyweight ---
    ['Pull-Up', 'Back', 'Bodyweight'],
    ['Chin-Up', 'Back', 'Bodyweight'],
    ['Dip', 'Triceps', 'Bodyweight'],
    ['Push-Up', 'Chest', 'Bodyweight'],
    ['Inverted Row', 'Back', 'Bodyweight'],
    ['Hanging Leg Raise', 'Abs', 'Bodyweight'],
    ['Ab Wheel Rollout', 'Abs', 'Bodyweight'],
    ['Plank', 'Abs', 'Bodyweight'],
    ['Back Extension', 'Hamstrings', 'Bodyweight'],
    ['Nordic Curl', 'Hamstrings', 'Bodyweight'],
  ];

  FT.seedExercises = () =>
    EX.map(([name, muscle, equipment], i) => ({
      id: 'ex' + i,
      name, muscle, equipment,
      isCustom: false,
    }));

  FT.MUSCLES = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes', 'Biceps', 'Triceps', 'Traps', 'Calves', 'Abs', 'Other'];
  FT.EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Other'];

  // Common quick-add foods (per serving) to seed the food library
  FT.seedFoods = () => [
    { id: 'f1', name: 'Chicken Breast (8 oz raw)', kcal: 250, protein: 52, carbs: 0, fat: 3 },
    { id: 'f2', name: 'Whey Protein (1 scoop)', kcal: 120, protein: 24, carbs: 3, fat: 1.5 },
    { id: 'f3', name: 'White Rice (1 cup cooked)', kcal: 205, protein: 4, carbs: 45, fat: 0.5 },
    { id: 'f4', name: 'Eggs (2 large)', kcal: 140, protein: 12, carbs: 1, fat: 10 },
    { id: 'f5', name: 'Oats (1/2 cup dry)', kcal: 150, protein: 5, carbs: 27, fat: 3 },
    { id: 'f6', name: 'Banana', kcal: 105, protein: 1, carbs: 27, fat: 0.5 },
    { id: 'f7', name: 'Greek Yogurt (1 cup nonfat)', kcal: 130, protein: 23, carbs: 9, fat: 0.5 },
    { id: 'f8', name: 'Peanut Butter (2 tbsp)', kcal: 190, protein: 8, carbs: 7, fat: 16 },
    { id: 'f9', name: '93/7 Ground Beef (8 oz raw)', kcal: 340, protein: 46, carbs: 0, fat: 16 },
    { id: 'f10', name: 'Olive Oil (1 tbsp)', kcal: 120, protein: 0, carbs: 0, fat: 14 },
  ];
})();
