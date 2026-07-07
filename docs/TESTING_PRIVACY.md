# CycleWise — Testing Plan & Privacy Best Practices

## Testing plan

### 1. Unit tests (`lib/predictions.ts`)
Pure functions — highest-value tests, no mocking needed.
- `predictCycle`: no history → defaults to `avgCycleLength`; 1 cycle → low confidence; 6 regular cycles → high confidence, correct average; irregular cycles → correct std-dev-driven confidence downgrade.
- `getDayFertility`: date inside period → `zone: "period"`; ovulation day → `zone: "ovulation"` with peak probability range; ±5 days around ovulation → `zone: "fertile"`; deep luteal/pre-fertile → low probability.
- Edge cases: cycle spanning a year boundary (Dec→Jan), a leap-day cycle, a user who opens the app mid-cycle with a stale `lastPeriodStart`.

Suggested tooling: Vitest or Jest, e.g.:
```bash
npm install -D vitest
npx vitest run lib/predictions.test.ts
```

### 2. Integration tests (API routes)
Using Supabase's local dev stack (`supabase start`) against a seeded test DB:
- Auth required: every `/api/*` route returns 401 without a session.
- RLS enforcement: user A cannot read/write user B's cycles or logs, even via direct `supabase-js` calls with A's session (test by attempting `select * from cycles where user_id = <B's id>` — should return zero rows, not an error, confirming RLS filters rather than errors).
- `POST /api/cycles` creates a row and correctly backfills the previous cycle's `cycle_length` (test the trigger).
- `POST /api/logs` upserts correctly on a repeat call for the same date (no duplicate rows).

### 3. Component / UI tests (React Testing Library)
- `Calendar`: correct zone color-coding for a known prediction fixture; keyboard navigation (`Tab` reaches every day cell; `Enter`/`Space` selects).
- `DailyInsight`: tooltip toggles show/hide; probability label matches the fixture's zone.
- `LogPeriodModal`: form validation, save/error states, modal traps focus and closes on `Escape`.

### 4. End-to-end tests (Playwright / Detox)
- Sign up → confirm email (use Supabase's test inbox or a mailinator-style catch-all) → log first period → dashboard shows correct predicted next period and ovulation date.
- Log a full cycle's worth of days → verify calendar reflects logged period days and the next cycle's prediction updates once a new period start is logged.
- Mobile (Detox): offline mode — toggle airplane mode, log a day, verify it appears immediately (optimistic UI) and syncs once connectivity returns (`flushPendingWrites`).

### 5. Accuracy validation (not a substitute for clinical validation)
Before any public release making fertility claims, cross-check `getDayFertility`'s probability ranges against current literature (e.g. ACOG patient guidance, CDC FAM effectiveness data) and consider an external clinical reviewer — this is a health-adjacent claim, not just a UI feature.

---

## Privacy best practices

Menstrual and fertility data is uniquely sensitive: it can reveal pregnancy, pregnancy loss, sexual activity, and reproductive intent, and in some jurisdictions has been subpoenaed in legal proceedings. Design accordingly:

**Data minimization**
- Collect only what powers a feature. Don't add "nice to have" fields (e.g. precise GPS, contacts) without a concrete feature need.
- Let users delete individual log entries and their entire account (hard delete, not soft-delete-and-retain) — implement a `DELETE /api/account` route that cascades via `on delete cascade` (already set up in the schema) and also purges any backups per your retention policy.

**Access control**
- RLS policies (already in `schema.sql`) ensure the database itself refuses cross-user reads/writes — don't rely on API-layer checks alone.
- Never use the Supabase `service_role` key in a client app. Keep it server-only, and only in functions that truly need to bypass RLS (e.g. scheduled jobs).
- Add an optional **app-level PIN/biometric lock** (`settings.privacy_lock_enabled`) so the app itself doesn't display data to someone who picks up an unlocked phone.

**Encryption**
- Data in transit: enforced automatically by Supabase (TLS).
- Data at rest: Supabase/Postgres encrypts the underlying disk by default (AES-256).
- Optional column-level encryption for free-text `notes` via Supabase Vault / pgsodium if you need defense-in-depth beyond disk encryption (documented in `schema.sql` §7).

**Legal & compliance**
- Publish a plain-language privacy policy stating exactly what's collected, why, who can access it (nobody but the user — no ad networks, no analytics SDKs that fingerprint by default), and how to delete it.
- If operating in/for the EU, GDPR applies (right to access/erasure — build the export/delete flows now, not later). If handling US users, note that HIPAA generally does *not* apply to a consumer app like this (no covered entity involved), which makes your own privacy commitments the main protection — be conservative.
- Avoid third-party analytics/crash SDKs that transmit identifiable usage data by default (e.g. default Firebase Analytics config); if used, disable advertising ID collection and review what's actually being sent.
- Do not sell or share data with data brokers or advertisers — full stop. This is both an ethical baseline for this category of app and, in some jurisdictions, effectively required given the sensitivity of the data.

**In-app UX for privacy**
- Show a "your data, exported" JSON/CSV download in settings — make data portability effortless, not a support ticket.
- Make account deletion a first-class settings option, not buried behind a support email.
- Be explicit in onboarding about what predictions are (statistical estimates) vs. what they are not (a diagnosis or a validated contraceptive method).
