# CycleWise — Setup & Deployment Guide

## 1. Create the Supabase project
1. Create a project at supabase.com → note the **Project URL** and **anon public key** (Settings → API).
2. Open the SQL editor → paste and run `supabase/schema.sql`. This creates all tables, triggers, and RLS policies.
3. Authentication → Providers: enable **Email** (with "Confirm email" on) and **Google** / **Apple** OAuth if you want social login. For Apple sign-in you'll need an Apple Developer account and Services ID; for Google, an OAuth Client ID from Google Cloud Console. Add both callback URLs from Supabase's provider settings into each provider's console.
4. Authentication → URL Configuration: set your production domain and `cyclewise://` (mobile deep link) as allowed redirect URLs.

## 2. Web app (Next.js) — local dev
```bash
cd cyclewise
cp .env.example .env.local        # fill in your Supabase URL + anon key
npm install
npm run dev                       # http://localhost:3000
```
Visit `/login` to create an account, then `/dashboard`.

## 3. Deploy the web app (Vercel)
1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the repo → framework preset auto-detects Next.js.
3. Add environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel's Project Settings → Environment Variables.
4. Deploy. Add the resulting `https://your-app.vercel.app` domain to Supabase's allowed redirect URLs.
(Netlify works the same way — set the same two env vars and use the Next.js runtime plugin.)

## 4. Mobile app (Expo) — local dev
```bash
npx create-expo-app cyclewise-mobile -t expo-template-blank-typescript
cd cyclewise-mobile
# copy in mobile/App.tsx, mobile/screens, mobile/lib, mobile/theme.ts from this project
npx expo install @supabase/supabase-js react-native-url-polyfill \
  @react-navigation/native @react-navigation/native-stack \
  react-native-screens react-native-safe-area-context \
  @react-native-async-storage/async-storage expo-secure-store expo-network
```
Create `.env` (Expo reads `EXPO_PUBLIC_*` vars automatically):
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
Run: `npx expo start` → open in Expo Go, or a simulator.

## 5. Deploy the mobile app (App Store / Play Store via EAS)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios       # produces a signed .ipa
eas build --platform android   # produces a signed .aab
eas submit --platform ios      # uploads to App Store Connect
eas submit --platform android  # uploads to Play Console
```
- iOS: you'll need an Apple Developer Program membership ($99/yr), an App Store Connect listing, and privacy-nutrition-label answers (see privacy doc — this app collects Health & Fitness data).
- Android: a Play Console account ($25 one-time), and a completed **Data safety** form (same disclosures as Apple's nutrition label).
- Both stores scrutinize reproductive-health apps closely — be explicit in your listing about local data handling, and budget extra review time.

## 6. Recommended: monorepo for shared logic
To avoid maintaining two copies of `predictions.ts`, convert to a workspace:
```
cyclewise/
  packages/core/         # predictions.ts, types — published as @cyclewise/core
  apps/web/               # this Next.js app
  apps/mobile/            # this Expo app
```
Use `npm workspaces` or `pnpm workspaces`; both apps import `from "@cyclewise/core"` instead of relative copies.

## 7. Environment variable summary
| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Web `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web `.env.local` | Public anon key (RLS-protected) |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile `.env` | Same, for Expo |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile `.env` | Same, for Expo |

Never generate or expose the Supabase **service_role** key in either client — it bypasses RLS entirely and must only ever live in a server-only environment (e.g. a Supabase Edge Function used for admin tasks).
