# CycleWise

Private, empowering cycle & fertility tracking — web (Next.js) + mobile (Expo/React Native), both backed by Supabase.

## Architecture

```
                     ┌────────────────────┐
                     │   Supabase (Postgres)│
                     │  profiles / cycles /  │
                     │  daily_logs / settings│
                     │  + RLS on every table │
                     └─────────┬───────────┘
                               │ supabase-js (RLS-scoped by session)
              ┌────────────────┴────────────────┐
      ┌───────▼────────┐                ┌───────▼────────┐
      │  Next.js (web)  │                │ Expo (mobile)   │
      │  /app/api/*      │                │ screens + RN    │
      │  route handlers  │                │ Supabase client │
      │  server + client │                │ offline queue   │
      └───────┬────────┘                └───────┬────────┘
              │                                    │
              └──────────────┬─────────────────────┘
                              ▼
                 lib/predictions.ts (shared, pure TS)
                 cycle averaging · ovulation estimate ·
                 fertile window · pregnancy probability
```

- **Auth**: Supabase Auth (email/password + Google/Apple OAuth). Web sessions live in httpOnly cookies via `@supabase/ssr`; mobile refresh tokens live in the OS keychain via `expo-secure-store`.
- **Data ownership**: every table is scoped by Postgres RLS to `auth.uid()`, enforced at the database layer — not just in application code.
- **Shared logic**: `lib/predictions.ts` is pure, dependency-free TypeScript, copied (or workspace-shared) into both apps so web and mobile never disagree on a prediction.
- **Offline**: mobile queues writes locally (AsyncStorage) when offline and flushes them on reconnect; web relies on standard browser caching + can be extended with a service worker for full offline support.
- **Route protection**: `proxy.ts` (Next.js 16's name for middleware) refreshes the Supabase session on every request and redirects logged-out visitors away from `/dashboard`, `/onboarding`, `/cycles`, `/profile` and `/settings`. API routes return `401` without a session.

## Prediction model

`lib/predictions.ts` is a deliberately simple, transparent calendar model:

- **Cycle length**: rolling average of the last 6 logged cycles (15–60 days only), 28 by default. The spread (std dev) and number of cycles set a `high` / `medium` / `low` confidence.
- **Ovulation**: cycle day 14, with a fertile window of ±4 days around it.
- **Future cycles are projected** by repeating the average length, so the calendar shows next month's period, fertile window and ovulation too, and the current cycle rolls forward if a new period hasn't been logged yet.
- **Dates are timezone-safe**: all math runs in UTC on `YYYY-MM-DD` strings and "today" comes from the user's local calendar. Tests run in UTC and Africa/Nairobi in CI.

## Repo layout
```
cyclewise/
  supabase/                 # schema.sql + migration_002 + migration_003 (run in order)
  lib/predictions.ts        # cycle prediction & fertility engine (+ predictions.test.ts)
  lib/pinLock.ts            # app PIN hashing + per-session unlock
  lib/supabase/             # web Supabase clients (browser + server)
  proxy.ts                  # session refresh + route protection
  app/                      # landing, auth, onboarding, dashboard, cycles, profile, settings, terms, privacy + API routes
  components/               # CycleDial, Calendar, DailyInsight, LogPeriodModal, Sidebar, Navbar, PinGate
  mobile/                   # Expo app (App.tsx, screens/, lib/, theme.ts)
  .github/workflows/        # CI (lint, typecheck, tests, build) + Supabase keep-alive
  docs/                     # setup guide, testing & privacy plan
```

## Design direction — Neomorphism

The palette is a single soft-lilac hue family (`#E9E4F5` base) so raised/pressed
neomorphic surfaces read correctly — neomorphism only works on a near-monochrome
base. Rose→violet gradients mark primary actions. The calendar uses four
colors so it is scannable without reading labels: **orange** = period,
**purple** = fertile window, **red** = ovulation, **green** = lower fertility.

Typography pairs **Fraunces** (a soft, warm display serif for headings and the
big "day of cycle" number) with **Inter** for body text and **IBM Plex Mono**
for data/stats, so numbers feel precise against the otherwise soft, rounded UI.

The signature element is the **Cycle Dial** (`components/CycleDial.tsx`): a
circular progress ring carved into the surface with a raised gradient arc,
styled like a soft-touch instrument dial rather than a chart — echoing a
compact mirror or thermostat rather than generic app-dashboard iconography.

Accessibility: neomorphism's low inherent contrast is offset with an explicit
3px high-contrast focus ring on every interactive element (`:focus-visible` in
`globals.css`), `aria-pressed`/`aria-label` on all calendar day buttons, and
`prefers-reduced-motion` support.

## Tech stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (Auth, Postgres, RLS) · Recharts · Expo / React Native · Vitest · ESLint · GitHub Actions

## Quick start
See `docs/SETUP_GUIDE.md` for full instructions. TL;DR (Node 20.9+):
```bash
# 1. In the Supabase SQL editor run, in order:
#    supabase/schema.sql, supabase/migration_002_onboarding.sql, supabase/migration_003_pin_lock.sql
# 2. Web
cp .env.example .env.local && npm install && npm run dev
# 3. Mobile
cd mobile && npx expo start
```

## Checks
```bash
npm run lint        # ESLint (next/core-web-vitals + typescript)
npm run typecheck   # tsc --noEmit
npm test            # Vitest: prediction engine
npm run build       # production build
```
CI runs all of these on every push.

## Disclaimer
CycleWise provides statistical, educational estimates of ovulation and
conception probability based on cycle-timing data you enter. It is not a
diagnostic tool and is not a substitute for medical advice or a clinically
validated contraceptive method. Consult a healthcare provider for
individualized guidance.
