# IronLog

A personal, no-subscription fitness PWA: powerlifting + bodybuilding workout logging, body-weight trend tracking, macro tracking, progress charts, AI-ready export, and Fitbit/Google Health sync. All data lives on your device — no account, no paywall, works offline.

## Features

**Workout logging**
- Unlimited routines (templates), created from scratch or saved from any finished workout — routines auto-update to what you actually performed
- Per-set weight, reps, RPE, and set type (normal / warm-up / failure); per-exercise and per-workout notes
- "Prev" column ghosts your last session — tap it to copy the values
- Auto-starting rest timer pill (adjustable ±15 s, skip, haptic + beep)
- Plate calculator, PR detection with workout summary, ~80 seeded exercises + custom ones

**Progress**
- Estimated 1RM (Epley) line chart and session-volume chart per exercise
- All-time records (best e1RM, heaviest set), weekly set counts by muscle group

**Body & nutrition**
- Daily weigh-ins with smoothed trend line (EMA) — 7/30-day trend changes
- Macro targets, per-day food log with quick-add library, 14-day stacked calorie chart

**Data freedom**
- Full JSON backup/restore; CSV exports (workouts, body, nutrition)
- **AI digest**: one tap copies a markdown summary of your last 8 weeks (records, weekly volume, full logs, nutrition averages) to paste into Claude/ChatGPT for coaching analysis
- Import your history from a Strong app CSV export

**Fitbit / Google Health sync**
- OAuth 2.0 + PKCE directly from the app (no server): push weigh-ins and workouts to Fitbit, pull Fitbit weigh-ins. Since Fitbit is Google's health platform, synced data feeds the Fitbit app and Google's health coaching.

## Run locally

```
node scripts/serve.mjs 8787
# open http://localhost:8787
```

## Put it on your iPhone

The app must be served over HTTPS for PWA install + Fitbit sync. Two easy free options:

**GitHub Pages**
1. Create a repo, push this folder, enable Pages (Settings → Pages → deploy from branch).
2. Open the Pages URL in Safari on your iPhone → Share → **Add to Home Screen**. It installs like a native app and works offline.

**Netlify Drop** — drag the `dist/` folder (after `node scripts/build-single.mjs`) onto https://app.netlify.com/drop.

> Data is stored per-browser (IndexedDB). Export a JSON backup regularly from ⚙ → Export & backup.

## Fitbit sync setup (one time)

1. Go to https://dev.fitbit.com → Register an app:
   - OAuth 2.0 Application Type: **Client**
   - Callback URL: the **exact** URL where you host IronLog (e.g. `https://you.github.io/ironlog/`)
2. Copy the **Client ID** into IronLog: ⚙ → Fitbit / Google Health sync → paste → **Connect Fitbit**.
3. Turn on auto-sync for weigh-ins and/or workouts.

## Builds

- `node scripts/build-single.mjs` → `dist/index.html`, the whole app in one self-contained file (host it anywhere).
- `node scripts/build-artifact.mjs [out]` → body-fragment variant for hosts that wrap content in their own HTML skeleton.

## Stack

Zero dependencies. Vanilla JS (15 small modules), hand-rolled SVG charts, IndexedDB with localStorage fallback, service-worker offline cache. Weights are stored canonically in kg and displayed in your unit (lb/kg switchable).
