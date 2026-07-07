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

## Repo layout
```
cyclewise/
  supabase/schema.sql        # DB schema + RLS (run this first)
  lib/predictions.ts          # cycle prediction & fertility engine
  lib/supabase/               # web Supabase clients (browser + server)
  middleware.ts                # session refresh + route protection
  app/                          # Next.js App Router pages + API routes
  components/                  # CycleDial, Calendar, DailyInsight, LogPeriodModal
  mobile/                       # Expo app (App.tsx, screens/, lib/, theme.ts)
  docs/                         # setup guide, testing & privacy plan
```

## Design direction — Neomorphism

The palette is a single soft-lilac hue family (`#E9E4F5` base) so raised/pressed
neomorphic surfaces read correctly — neomorphism only works on a near-monochrome
base. Rose→violet gradients mark primary actions; sage marks lower-fertility
("safer") days, amber marks period days, and a deep magenta ("peak") marks
ovulation — so the calendar is scannable by color without reading labels.

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

## Quick start
See `docs/SETUP_GUIDE.md` for full instructions. TL;DR:
```bash
# 1. Run supabase/schema.sql in your Supabase project's SQL editor
# 2. Web
cp .env.example .env.local && npm install && npm run dev
# 3. Mobile
cd mobile && npx expo start
```

## Disclaimer
CycleWise provides statistical, educational estimates of ovulation and
conception probability based on cycle-timing data you enter. It is not a
diagnostic tool and is not a substitute for medical advice or a clinically
validated contraceptive method. Consult a healthcare provider for
individualized guidance.
