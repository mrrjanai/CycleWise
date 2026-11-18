/**
 * CycleWise — Cycle Prediction & Fertility Estimation Engine
 * -----------------------------------------------------------------------
 * Pure functions, no I/O. Shared between the Next.js web app and the
 * Expo mobile app (copy this file into both, or publish as a workspace
 * package `@cyclewise/core`).
 *
 * METHODOLOGY (calendar model + optional body signals, not a diagnostic tool):
 *  - Ovulation is placed one luteal phase before the next period
 *    (cycle length − luteal length; day 14 for a 28-day cycle with the
 *    default 14-day luteal phase). The luteal phase is the most stable part
 *    of the cycle, so this adapts to long and short cycles better than a
 *    fixed "day 14" rule. The same approach is used by Clue and Flo.
 *  - When the user's own signals pin down ovulation in the current cycle
 *    (a basal-body-temperature shift, a positive LH test, or a cervical
 *    mucus peak — see lib/insights.ts), that observed date replaces the
 *    calendar estimate and the next period is projected from it, the way
 *    Natural Cycles and other fertility-awareness apps do.
 *  - Predicted fertile window = ovulation ± 4 days. Sperm survive up to ~5
 *    days and the egg ~12–24h. Once ovulation is observed, the window closes
 *    one day after it.
 *  - Cycle length uses a rolling average of the user's last 6 cycles
 *    (falls back to the user's setting, default 28), with variability
 *    (std dev) used to set prediction confidence.
 *  - A period that hasn't arrived yet is reported as late for up to 14
 *    days, so the app can say so instead of silently starting a new cycle.
 *    After that the user has most likely stopped logging, and cycles are
 *    projected forward from the last logged period.
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
  lutealPhaseLength: number;   // default 14; places ovulation relative to the next period
  avgPeriodLength: number;     // default 5
}

/** Ovulation pinned down by the user's own body signals (see lib/insights.ts). */
export interface ObservedOvulation {
  date: string;
  method: "bbt" | "lh" | "mucus";
  /** true only for a BBT shift — the one signal that confirms ovulation already happened. */
  confirmed: boolean;
  /** BBT coverline (highest of the 6 readings before the shift), when method is "bbt". */
  coverline?: number;
}

export type OvulationSource = "calendar" | ObservedOvulation["method"];

export interface CyclePrediction {
  lastPeriodStart: string | null;
  /** Start of the cycle "today" falls in (projected if the user stopped logging). */
  currentCycleStart: string | null;
  nextPeriodStart: string;
  nextPeriodEnd: string;
  ovulationDate: string;
  /** Cycle day ovulation is expected on in a typical cycle. */
  ovulationCycleDay: number;
  ovulationSource: OvulationSource;
  fertileWindowStart: string;
  fertileWindowEnd: string;
  cycleLengthUsed: number;
  cycleLengthStdDev: number;
  confidence: "high" | "medium" | "low"; // based on # of logged cycles + variability
  currentCycleDay: number | null;
  /** Days past the expected period start with no new period logged (0 if not late). */
  daysLate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cycle day ovulation falls on in a 28-day cycle with a 14-day luteal phase. */
export const OVULATION_CYCLE_DAY = 14;

/** How long an overdue period is reported as "late" before cycles are projected forward. */
export const LATE_GRACE_DAYS = 14;

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

/** Add (or subtract) whole days to a 'YYYY-MM-DD' date. */
export const addDays = (iso: string, days: number) => toISO(new Date(toDate(iso).getTime() + days * DAY_MS));

/** Whole days from `a` to `b` (positive when b is later). */
export const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);

/**
 * Cycle day (period start = day 1) ovulation is expected on: one luteal
 * phase before the next period, clamped so very short or long settings
 * still give a sensible day.
 */
export function ovulationCycleDay(cycleLength: number, lutealPhaseLength: number): number {
  return Math.min(Math.max(cycleLength - lutealPhaseLength, 6), cycleLength - 1);
}

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
function projectedCycleStart(anchorStart: string, date: string, cycleLength: number): string {
  const elapsed = diffDays(anchorStart, date);
  if (elapsed < 0) return anchorStart;
  return addDays(anchorStart, Math.floor(elapsed / cycleLength) * cycleLength);
}

/**
 * Predict the next period, ovulation date, and fertile window from cycle
 * history. `cycles` should be sorted most-recent-first. `observed` is the
 * ovulation detected from the user's signals in their latest logged cycle,
 * if any.
 */
export function predictCycle(
  cycles: CycleRecord[],
  settings: UserFertilitySettings,
  today: string = localDateISO(),
  observed: ObservedOvulation | null = null
): CyclePrediction {
  const stats = computeCycleStats(cycles, settings.avgCycleLength);
  const lastPeriodStart = cycles[0]?.startDate ?? null;
  const cycleLengthUsed = stats.avg;
  const ovDay = ovulationCycleDay(cycleLengthUsed, settings.lutealPhaseLength);
  const confidence: CyclePrediction["confidence"] =
    stats.sampleSize >= 4 && stats.stdDev <= 4 ? "high" : stats.sampleSize >= 2 ? "medium" : "low";

  let currentCycleStart: string | null = null;
  let nextPeriodStart: string;
  let ovulationDate: string;
  let ovulationSource: OvulationSource = "calendar";
  let daysLate = 0;

  const obs = observed && lastPeriodStart && observed.date >= lastPeriodStart ? observed : null;

  if (!lastPeriodStart) {
    nextPeriodStart = addDays(today, cycleLengthUsed);
    ovulationDate = addDays(today, ovDay - 1);
  } else {
    // When the period is expected, from the last logged start. An observed
    // ovulation moves it: the luteal phase is stable, so period ≈ ovulation
    // + luteal length + 1.
    const expected = obs ? addDays(obs.date, settings.lutealPhaseLength + 1) : addDays(lastPeriodStart, cycleLengthUsed);
    const overdue = diffDays(expected, today);

    if (overdue <= LATE_GRACE_DAYS) {
      // Still in the last logged cycle (on time, due today, or late).
      currentCycleStart = lastPeriodStart;
      daysLate = Math.max(overdue, 0);
      // A late period is expected any day now, so predict it from today.
      nextPeriodStart = overdue > 0 ? today : expected;
      ovulationDate = obs ? obs.date : addDays(lastPeriodStart, ovDay - 1);
      if (obs) ovulationSource = obs.method;
    } else {
      // No period logged for a long time: the user has most likely stopped
      // logging, so project cycles forward from the last logged start and
      // never point at a date that has already passed.
      currentCycleStart = projectedCycleStart(lastPeriodStart, today, cycleLengthUsed);
      nextPeriodStart = addDays(currentCycleStart, cycleLengthUsed);
      ovulationDate = addDays(currentCycleStart, ovDay - 1);
    }
  }

  const nextPeriodEnd = addDays(nextPeriodStart, settings.avgPeriodLength - 1);
  const fertileWindowStart = addDays(ovulationDate, -4);
  // An observed ovulation closes the window a day later (egg lives ~12–24h);
  // a calendar estimate keeps a symmetric margin for error.
  const fertileWindowEnd = addDays(ovulationDate, ovulationSource === "calendar" ? 4 : 1);
  const currentCycleDay = currentCycleStart ? diffDays(currentCycleStart, today) + 1 : null;

  return {
    lastPeriodStart,
    currentCycleStart,
    nextPeriodStart,
    nextPeriodEnd,
    ovulationDate,
    ovulationCycleDay: ovDay,
    ovulationSource,
    fertileWindowStart,
    fertileWindowEnd,
    cycleLengthUsed,
    cycleLengthStdDev: stats.stdDev,
    confidence,
    currentCycleDay,
    daysLate,
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
  anchorStart: string | null
): DayFertility {
  // Work out which cycle `date` falls in, so future months show their own
  // projected period, fertile window and ovulation day — not just the
  // current cycle's.
  const L = prediction.cycleLengthUsed;
  let cycleStart: string | null = null;
  let ovulationDate = prediction.ovulationDate;
  let fertileStart = prediction.fertileWindowStart;
  let fertileEnd = prediction.fertileWindowEnd;

  const setProjected = (start: string) => {
    cycleStart = start;
    ovulationDate = addDays(start, prediction.ovulationCycleDay - 1);
    fertileStart = addDays(ovulationDate, -4);
    fertileEnd = addDays(ovulationDate, 4);
  };

  if (anchorStart && date >= anchorStart) {
    const current = prediction.currentCycleStart;
    if (current && date >= current && date < prediction.nextPeriodStart) {
      cycleStart = current; // keeps the current cycle's (possibly observed) ovulation
    } else if (date >= prediction.nextPeriodStart) {
      setProjected(projectedCycleStart(prediction.nextPeriodStart, date, L));
    } else {
      setProjected(projectedCycleStart(anchorStart, date, L));
    }
  }

  const start: string | null = cycleStart;
  const offsetFromOvulation = diffDays(ovulationDate, date);
  const isInPeriod = start != null && diffDays(start, date) < settings.avgPeriodLength;
  const cycleDay = start ? diffDays(start, date) + 1 : null;

  let zone: FertilityZone;
  let pct: [number, number];

  if (isInPeriod) {
    zone = "period";
    pct = [0, 1];
  } else if (offsetFromOvulation === 0) {
    zone = "ovulation";
    pct = DAY_OFFSET_PROBABILITY["0"];
  } else if (date >= fertileStart && date <= fertileEnd) {
    zone = "fertile";
    pct = DAY_OFFSET_PROBABILITY[String(offsetFromOvulation)] ?? [1, 5];
  } else {
    // Everything outside the fertile window (both pre- and post-ovulation)
    // is treated as one "low fertility" zone, per the simplified 4-color
    // scheme: green (low), red (ovulation), purple (fertile), orange (period).
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
  anchorStart: string | null
): DayFertility[] {
  const days: DayFertility[] = [];
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    days.push(getDayFertility(iso, prediction, settings, anchorStart));
  }
  return days;
}

// -------------------------------------------------------------------------
// Cycle phases
// -------------------------------------------------------------------------

export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

/** The phase a cycle day falls in, given that cycle's period length and ovulation day. */
export function phaseForCycleDay(cycleDay: number, periodLength: number, ovulationDay: number): CyclePhase {
  if (cycleDay <= periodLength) return "menstrual";
  if (Math.abs(cycleDay - ovulationDay) <= 1) return "ovulatory";
  return cycleDay < ovulationDay ? "follicular" : "luteal";
}

/** Today's phase from a prediction. */
export function currentPhase(prediction: CyclePrediction, settings: UserFertilitySettings): CyclePhase | null {
  if (prediction.currentCycleDay == null || !prediction.currentCycleStart) return null;
  const ovDay = diffDays(prediction.currentCycleStart, prediction.ovulationDate) + 1;
  return phaseForCycleDay(prediction.currentCycleDay, settings.avgPeriodLength, ovDay);
}
