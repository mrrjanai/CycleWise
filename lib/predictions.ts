/**
 * CycleWise — Cycle Prediction & Fertility Estimation Engine
 * -----------------------------------------------------------------------
 * Pure functions, no I/O. Shared between the Next.js web app and the
 * Expo mobile app (copy this file into both, or publish as a workspace
 * package `@cyclewise/core`).
 *
 * METHODOLOGY (evidence-informed, not a diagnostic tool):
 *  - Ovulation is estimated using the "luteal phase is fixed" model:
 *    ovulation_date ≈ next_period_start − luteal_phase_length
 *    (luteal phase is typically 12–14 days and much less variable than the
 *    follicular phase — this is the same logic used by clinical calendar
 *    methods and apps like Clue/Natural Cycles' baseline mode).
 *  - Fertile window = 5 days before ovulation + ovulation day + 1 day after
 *    (sperm survive up to 5 days; the egg survives ~12-24h) — the standard
 *    range cited by ACOG and the CDC's "Effectiveness of FAM" guidance.
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
  lutealPhaseLength: number;   // default 14
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

const toDate = (iso: string) => new Date(iso + "T00:00:00");
const toISO = (d: Date) => d.toISOString().slice(0, 10);
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

/**
 * Predict the next period, ovulation date, and fertile window from cycle
 * history. `cycles` should be sorted most-recent-first.
 */
export function predictCycle(
  cycles: CycleRecord[],
  settings: UserFertilitySettings,
  today: string = toISO(new Date())
): CyclePrediction {
  const stats = computeCycleStats(cycles, settings.avgCycleLength);
  const lastPeriodStart = cycles[0]?.startDate ?? null;

  const cycleLengthUsed = stats.avg;
  const confidence: CyclePrediction["confidence"] =
    stats.sampleSize >= 4 && stats.stdDev <= 4 ? "high" : stats.sampleSize >= 2 ? "medium" : "low";

  let nextPeriodStart: string;
  if (lastPeriodStart) {
    // If the predicted date has already passed, roll forward by the average
    // length repeatedly (handles the user opening the app mid-cycle or late).
    nextPeriodStart = addDays(lastPeriodStart, cycleLengthUsed);
    while (diffDays(today, nextPeriodStart) < 0) {
      nextPeriodStart = addDays(nextPeriodStart, cycleLengthUsed);
    }
  } else {
    nextPeriodStart = addDays(today, cycleLengthUsed);
  }

  const nextPeriodEnd = addDays(nextPeriodStart, settings.avgPeriodLength - 1);
  const ovulationDate = addDays(nextPeriodStart, -settings.lutealPhaseLength);
  const fertileWindowStart = addDays(ovulationDate, -5);
  const fertileWindowEnd = addDays(ovulationDate, 1);

  const currentCycleDay = lastPeriodStart ? diffDays(lastPeriodStart, today) + 1 : null;

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
const DAY_OFFSET_PROBABILITY: Record<number, [number, number]> = {
  "-5": [0, 2],
  "-4": [3, 9],
  "-3": [7, 17],
  "-2": [14, 25],
  "-1": [19, 28],
  "0": [23, 33],   // ovulation day (peak)
  "1": [8, 15],
};

export function getDayFertility(
  date: string,
  prediction: CyclePrediction,
  settings: UserFertilitySettings,
  currentCycleStart: string | null
): DayFertility {
  const offsetFromOvulation = diffDays(prediction.ovulationDate, date);
  const isInPeriod =
    currentCycleStart != null &&
    diffDays(currentCycleStart, date) >= 0 &&
    diffDays(currentCycleStart, date) < settings.avgPeriodLength;

  const cycleDay = currentCycleStart ? diffDays(currentCycleStart, date) + 1 : null;

  let zone: FertilityZone;
  let pct: [number, number];

  if (isInPeriod) {
    zone = "period";
    pct = [0, 1];
  } else if (offsetFromOvulation === 0) {
    zone = "ovulation";
    pct = DAY_OFFSET_PROBABILITY["0"];
  } else if (offsetFromOvulation >= -5 && offsetFromOvulation <= 1) {
    zone = "fertile";
    pct = DAY_OFFSET_PROBABILITY[String(offsetFromOvulation)] ?? [1, 5];
  } else if (offsetFromOvulation > 1) {
    zone = "luteal";
    pct = [0, 2];
  } else {
    zone = "low";
    pct = [1, 4];
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
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(new Date(year, month, d));
    days.push(getDayFertility(iso, prediction, settings, currentCycleStart));
  }
  return days;
}
