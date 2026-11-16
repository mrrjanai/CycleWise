/**
 * CycleWise — Cycle Prediction & Fertility Estimation Engine
 * -----------------------------------------------------------------------
 * Pure functions, no I/O. Shared between the Next.js web app and the
 * Expo mobile app (copy this file into both, or publish as a workspace
 * package `@cyclewise/core`).
 *
 * METHODOLOGY (simplified calendar model, not a diagnostic tool):
 *  - Ovulation is estimated at day 14 of the current cycle (counting the
 *    period start as day 1) — the familiar "day 14" rule. A luteal-phase
 *    model (ovulation ≈ next period − luteal length) adapts better to
 *    long/short cycles; `lutealPhaseLength` is kept in settings so the
 *    model can be switched later without a schema change.
 *  - Fertile window = ovulation day ± 4 days (symmetric). Sperm survive up
 *    to ~5 days and the egg ~12–24h, so this brackets the high-risk days.
 *  - Cycle length uses a rolling average of the user's last 6 cycles
 *    (falls back to a 28-day default for new users), with variability
 *    (std dev) used to widen prediction confidence bands.
 *
 * DISCLAIMER: This is a statistical estimate for educational purposes only.
 * It is NOT a substitute for a clinically validated contraceptive method
 * (e.g. hormonal contraception, copper IUD) and should not be relied upon
 * as a sole method of pregnancy prevention. Always consult a clinician.
 */

export interface CycleRecord {
  startDate: string;      // ISO date 'YYYY-MM-DD'
  cycleLength?: number | null;  // days until next cycle started (null for current/ongoing)
  periodLength?: number | null;
}

export interface UserFertilitySettings {
  avgCycleLength: number;      // fallback / manual override, default 28
  lutealPhaseLength: number;   // default 14 (reserved for a luteal-phase model)
  avgPeriodLength: number;     // default 5
}

export interface CyclePrediction {
  lastPeriodStart: string | null;
  nextPeriodStart: string;
  nextPeriodEnd: string;
  ovulationDate: string;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  cycleLengthUsed: number;
  cycleLengthStdDev: number;
  confidence: "high" | "medium" | "low"; // based on # of logged cycles + variability
  currentCycleDay: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cycle day (period start = day 1) the model places ovulation on. */
export const OVULATION_CYCLE_DAY = 14;

// All date math runs in UTC on plain 'YYYY-MM-DD' strings. Mixing local-time
// parsing with UTC formatting shifts every date by a day in timezones east of
// UTC (e.g. Nairobi, UTC+3) and around daylight-saving changes.
const toDate = (iso: string) => new Date(iso + "T00:00:00Z");
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");

/** Format a 'YYYY-MM-DD' string for display without timezone drift. */
export function formatISODate(iso: string, options: Intl.DateTimeFormatOptions): string {
  return toDate(iso).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });
}

/** Today's date in the user's own timezone, as 'YYYY-MM-DD'. */
export function localDateISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const addDays = (iso: string, days: number) => toISO(new Date(toDate(iso).getTime() + days * DAY_MS));
const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);

/** Rolling average + std dev of the user's last N completed cycle lengths. */
function computeCycleStats(cycles: CycleRecord[], fallback: number) {
  const lengths = cycles
    .map((c) => c.cycleLength)
    .filter((n): n is number => typeof n === "number" && n >= 15 && n <= 60)
    .slice(0, 6); // most recent 6

  if (lengths.length === 0) return { avg: fallback, stdDev: 0, sampleSize: 0 };

  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - avg) ** 2, 0) / lengths.length;
  return { avg: Math.round(avg), stdDev: Math.round(Math.sqrt(variance) * 10) / 10, sampleSize: lengths.length };
}

/** Start of the (possibly projected) cycle that contains `date`. */
function projectedCycleStart(lastPeriodStart: string, date: string, cycleLength: number): string {
  const elapsed = diffDays(lastPeriodStart, date);
  if (elapsed < 0) return lastPeriodStart;
  return addDays(lastPeriodStart, Math.floor(elapsed / cycleLength) * cycleLength);
}

/**
 * Predict the next period, ovulation date, and fertile window from cycle
 * history. `cycles` should be sorted most-recent-first.
 */
export function predictCycle(
  cycles: CycleRecord[],
  settings: UserFertilitySettings,
  today: string = localDateISO()
): CyclePrediction {
  const stats = computeCycleStats(cycles, settings.avgCycleLength);
  const lastPeriodStart = cycles[0]?.startDate ?? null;

  const cycleLengthUsed = stats.avg;
  const confidence: CyclePrediction["confidence"] =
    stats.sampleSize >= 4 && stats.stdDev <= 4 ? "high" : stats.sampleSize >= 2 ? "medium" : "low";

  // The cycle "today" falls in. If no new period has been logged for a while,
  // cycles are projected forward from the last logged start by the average
  // length, so predictions never point at a date that has already passed.
  const currentCycleStart = lastPeriodStart ? projectedCycleStart(lastPeriodStart, today, cycleLengthUsed) : null;
  const nextPeriodStart = currentCycleStart ? addDays(currentCycleStart, cycleLengthUsed) : addDays(today, cycleLengthUsed);

  const nextPeriodEnd = addDays(nextPeriodStart, settings.avgPeriodLength - 1);

  // Ovulation model: fixed day 14 of the current cycle (counting the period
  // start as day 1), with a symmetric ±4 day fertile window around it. This
  // is the simplified "day 14" rule many people are already familiar with,
  // as opposed to a luteal-phase-relative estimate.
  const ovulationDate = addDays(currentCycleStart ?? today, OVULATION_CYCLE_DAY - 1);
  const fertileWindowStart = addDays(ovulationDate, -4);
  const fertileWindowEnd = addDays(ovulationDate, 4);

  const currentCycleDay = currentCycleStart ? diffDays(currentCycleStart, today) + 1 : null;

  return {
    lastPeriodStart,
    nextPeriodStart,
    nextPeriodEnd,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    cycleLengthUsed,
    cycleLengthStdDev: stats.stdDev,
    confidence,
    currentCycleDay,
  };
}

// -------------------------------------------------------------------------
// Pregnancy probability model for a given calendar date
// -------------------------------------------------------------------------

export type FertilityZone = "period" | "fertile" | "ovulation" | "low" | "luteal";

export interface DayFertility {
  date: string;
  zone: FertilityZone;
  pregnancyProbabilityLabel: "Very Low" | "Low" | "Moderate" | "High" | "Peak";
  pregnancyProbabilityPct: [number, number]; // range, e.g. [3, 9]
  cycleDay: number | null;
}

/**
 * Per-cycle-day probability-of-conception-if-unprotected-sex-occurs,
 * expressed relative to ovulation day (day 0). Figures approximate the
 * ranges reported in fertility-awareness literature (e.g. Wilcox et al.,
 * "Timing of sexual intercourse in relation to ovulation", NEJM 1995) and
 * are presented as ranges, not false-precision point estimates.
 */
const DAY_OFFSET_PROBABILITY: Record<string, [number, number]> = {
  "-4": [1, 4],
  "-3": [5, 10],
  "-2": [10, 20],
  "-1": [17, 26],
  "0": [23, 33],   // ovulation day (peak)
  "1": [17, 26],
  "2": [8, 15],
  "3": [3, 8],
  "4": [1, 3],
};

export function getDayFertility(
  date: string,
  prediction: CyclePrediction,
  settings: UserFertilitySettings,
  currentCycleStart: string | null
): DayFertility {
  // Evaluate each date against the cycle it falls in, so future months show
  // their own projected period, fertile window and ovulation day — not just
  // the current cycle's.
  const cycleStart =
    currentCycleStart && diffDays(currentCycleStart, date) >= 0
      ? projectedCycleStart(currentCycleStart, date, prediction.cycleLengthUsed)
      : null;
  const ovulationDate = cycleStart ? addDays(cycleStart, OVULATION_CYCLE_DAY - 1) : prediction.ovulationDate;
  const offsetFromOvulation = diffDays(ovulationDate, date);
  const isInPeriod = cycleStart != null && diffDays(cycleStart, date) < settings.avgPeriodLength;

  const cycleDay = cycleStart ? diffDays(cycleStart, date) + 1 : null;

  let zone: FertilityZone;
  let pct: [number, number];

  if (isInPeriod) {
    zone = "period";
    pct = [0, 1];
  } else if (offsetFromOvulation === 0) {
    zone = "ovulation";
    pct = DAY_OFFSET_PROBABILITY["0"];
  } else if (offsetFromOvulation >= -4 && offsetFromOvulation <= 4) {
    zone = "fertile";
    pct = DAY_OFFSET_PROBABILITY[String(offsetFromOvulation)] ?? [1, 5];
  } else {
    // Everything outside the +/-4 day fertile window (both pre- and
    // post-ovulation) is treated as one "low fertility" zone, per the
    // simplified 4-color scheme: green (low), red (ovulation),
    // purple (fertile window), orange (period).
    zone = "low";
    pct = [0, 2];
  }

  const label: DayFertility["pregnancyProbabilityLabel"] =
    pct[1] <= 2 ? "Very Low" : pct[1] <= 10 ? "Low" : pct[1] <= 20 ? "Moderate" : pct[1] <= 28 ? "High" : "Peak";

  return { date, zone, pregnancyProbabilityLabel: label, pregnancyProbabilityPct: pct, cycleDay };
}

/** Convenience: build a fertility map for every day in a visible month. */
export function getMonthFertility(
  year: number,
  month: number, // 0-indexed
  prediction: CyclePrediction,
  settings: UserFertilitySettings,
  currentCycleStart: string | null
): DayFertility[] {
  const days: DayFertility[] = [];
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    days.push(getDayFertility(iso, prediction, settings, currentCycleStart));
  }
  return days;
}
