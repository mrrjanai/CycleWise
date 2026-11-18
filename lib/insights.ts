/**
 * CycleWise — Insights engine
 * -----------------------------------------------------------------------
 * Pure functions, no I/O (same rules as lib/predictions.ts). Turns the raw
 * period starts + daily logs into the things popular cycle apps surface:
 *
 *  - A clean cycle history derived from what was actually logged, with
 *    real period lengths (Clue / Apple Health).
 *  - Ovulation detected from body signals: a basal-body-temperature shift
 *    (3-over-6 rule), a positive LH test, or a cervical-mucus peak
 *    (Natural Cycles, Kindara, Premom).
 *  - Personalised period and luteal-phase lengths learned from that history.
 *  - Cycle health checks for irregular, short/long, prolonged or spotting
 *    patterns (Apple Health "cycle deviations", Flo).
 *  - Recurring symptom and mood patterns and "heads up" forecasts (Clue, Flo).
 *
 * None of this is diagnostic. Health checks are worded as prompts to keep
 * an eye on things or talk to a clinician, never as conclusions.
 */

import {
  addDays,
  diffDays,
  ovulationCycleDay,
  phaseForCycleDay,
  type CyclePhase,
  type CyclePrediction,
  type CycleRecord,
  type ObservedOvulation,
  type UserFertilitySettings,
} from "./predictions";

export type Flow = "spotting" | "light" | "medium" | "heavy";
export type Mucus = "dry" | "sticky" | "creamy" | "watery" | "egg_white";

/** One day's log, in the shape the engine needs. */
export interface DayLog {
  date: string;
  flow?: string | null;
  symptoms?: string[] | null;
  mood?: string[] | null;
  bbt?: number | null;
  mucus?: string | null;
  tests?: { type: string; result: string }[] | null;
}

export interface CycleSummary {
  startDate: string;
  /** Days until the next period started; null for the current cycle. */
  cycleLength: number | null;
  /** Bleeding days counted from the logged flow; null if flow wasn't logged. */
  periodLength: number | null;
  ovulation: ObservedOvulation | null;
  /** Days from ovulation to the next period, when both are known. */
  lutealLength: number | null;
}

/** Two period starts closer than this are treated as the same period. */
const MIN_GAP_BETWEEN_PERIODS = 10;
const BLEEDING: ReadonlySet<string> = new Set(["light", "medium", "heavy"]);
const ANY_FLOW: ReadonlySet<string> = new Set(["spotting", "light", "medium", "heavy"]);

const sortAsc = (logs: DayLog[]) => [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// -------------------------------------------------------------------------
// Ovulation detection from body signals
// -------------------------------------------------------------------------

/**
 * Detect ovulation inside one cycle's logs (sorted by date).
 *
 * Priority: BBT shift (confirms ovulation happened) > positive LH test
 * (ovulation usually 24–36h later) > cervical-mucus peak (last egg-white
 * day, once a drier day has been logged after it).
 */
export function detectOvulation(cycleLogs: DayLog[]): ObservedOvulation | null {
  const logs = sortAsc(cycleLogs);
  return detectBbtShift(logs) ?? detectLhSurge(logs) ?? detectMucusPeak(logs);
}

/**
 * The "3 over 6" rule used in fertility awareness: three consecutive
 * readings above the highest of the previous six, with the third at least
 * 0.2°C above it. Ovulation is placed on the day before the first high reading.
 */
function detectBbtShift(logs: DayLog[]): ObservedOvulation | null {
  const temps = logs.filter((l): l is DayLog & { bbt: number } => typeof l.bbt === "number" && l.bbt >= 35 && l.bbt <= 38.5);
  for (let i = 6; i + 2 < temps.length; i++) {
    const coverline = Math.max(...temps.slice(i - 6, i).map((t) => t.bbt));
    const [a, b, c] = [temps[i], temps[i + 1], temps[i + 2]];
    if (a.bbt > coverline && b.bbt > coverline && c.bbt >= coverline + 0.2 - 1e-9) {
      return { date: addDays(a.date, -1), method: "bbt", confirmed: true, coverline };
    }
  }
  return null;
}

function detectLhSurge(logs: DayLog[]): ObservedOvulation | null {
  const positive = logs.find((l) => (l.tests ?? []).some((t) => t.type === "ovulation" && t.result === "positive"));
  return positive ? { date: addDays(positive.date, 1), method: "lh", confirmed: false } : null;
}

function detectMucusPeak(logs: DayLog[]): ObservedOvulation | null {
  const withMucus = logs.filter((l) => l.mucus);
  for (let i = withMucus.length - 2; i >= 0; i--) {
    if (withMucus[i].mucus === "egg_white" && withMucus[i + 1].mucus !== "egg_white") {
      return { date: withMucus[i].date, method: "mucus", confirmed: false };
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Cycle history
// -------------------------------------------------------------------------

/**
 * Build the cycle history (most recent first) from stored period starts
 * plus logged flow. Duplicate starts inside one period (e.g. a row created
 * for every bleeding day) collapse into one, and a period whose flow was
 * logged a day earlier than its stored start moves back to that day.
 */
export function buildCycleHistory(storedStarts: string[], logs: DayLog[]): CycleSummary[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const flowOn = (d: string) => byDate.get(d)?.flow ?? null;
  const bleeds = (d: string) => BLEEDING.has(flowOn(d) ?? "");
  const anyFlow = (d: string) => ANY_FLOW.has(flowOn(d) ?? "");

  const flowStarts = logs.filter((l) => bleeds(l.date) && !bleeds(addDays(l.date, -1)) && !bleeds(addDays(l.date, -2))).map((l) => l.date);
  const candidates = [...new Set([...storedStarts, ...flowStarts])].sort();

  const starts: string[] = [];
  for (const c of candidates) {
    if (starts.length === 0 || diffDays(starts[starts.length - 1], c) >= MIN_GAP_BETWEEN_PERIODS) starts.push(c);
  }

  const sorted = sortAsc(logs);
  const history: CycleSummary[] = starts.map((start, i) => {
    const next = starts[i + 1] ?? null;
    const cycleLength = next ? diffDays(start, next) : null;

    let periodLength: number | null = null;
    if (anyFlow(start)) {
      let last = start;
      for (let k = 1; k < 14; k++) {
        const d = addDays(start, k);
        if (anyFlow(d)) last = d;
        else if (!anyFlow(addDays(d, 1))) break; // allow a single missed day
      }
      periodLength = diffDays(start, last) + 1;
    }

    const cycleLogs = sorted.filter((l) => l.date >= start && (!next || l.date < next));
    const ovulation = detectOvulation(cycleLogs);
    const luteal = ovulation && next ? diffDays(ovulation.date, next) - 1 : null;

    return { startDate: start, cycleLength, periodLength, ovulation, lutealLength: luteal };
  });

  return history.reverse();
}

/** The history in the shape predictCycle expects. */
export function toCycleRecords(history: CycleSummary[]): CycleRecord[] {
  return history.map((c) => ({ startDate: c.startDate, cycleLength: c.cycleLength, periodLength: c.periodLength }));
}

// -------------------------------------------------------------------------
// Personalisation
// -------------------------------------------------------------------------

export interface PersonalizedSettings extends UserFertilitySettings {
  periodLengthLearned: boolean;
  lutealLengthLearned: boolean;
}

const average = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * Replace the default period and luteal lengths with the user's own once
 * there are at least two cycles of evidence. Luteal length is only learned
 * from a BBT shift or LH test, not a mucus peak.
 */
export function personalizeSettings(history: CycleSummary[], base: UserFertilitySettings): PersonalizedSettings {
  const periods = history
    .map((c) => c.periodLength)
    .filter((n): n is number => n != null && n >= 1 && n <= 14)
    .slice(0, 6);
  const luteals = history
    .filter((c) => c.ovulation && c.ovulation.method !== "mucus")
    .map((c) => c.lutealLength)
    .filter((n): n is number => n != null && n >= 8 && n <= 20)
    .slice(0, 6);

  return {
    avgCycleLength: base.avgCycleLength,
    avgPeriodLength: periods.length >= 2 ? average(periods) : base.avgPeriodLength,
    lutealPhaseLength: luteals.length >= 2 ? average(luteals) : base.lutealPhaseLength,
    periodLengthLearned: periods.length >= 2,
    lutealLengthLearned: luteals.length >= 2,
  };
}

// -------------------------------------------------------------------------
// Cycle health checks
// -------------------------------------------------------------------------

export interface HealthCheck {
  id: "cycle-range" | "irregular" | "long-period" | "spotting" | "no-period";
  title: string;
  detail: string;
}

/**
 * Patterns worth keeping an eye on, using commonly cited guidance
 * (ACOG / NHS): typical cycles run 21–35 days, vary by up to ~7–9 days,
 * and periods last up to 7 days.
 */
export function cycleHealthChecks(history: CycleSummary[], today: string): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const completed = history.filter((c) => c.cycleLength != null).slice(0, 6);
  const lengths = completed.map((c) => c.cycleLength as number);

  const outOfRange = lengths.filter((n) => n < 21 || n > 35);
  if (outOfRange.length >= 2) {
    checks.push({
      id: "cycle-range",
      title: "Cycles outside the usual 21–35 days",
      detail: `${outOfRange.length} of your last ${lengths.length} cycles were ${outOfRange.join(", ")} days. If this keeps happening, it's worth mentioning to a clinician.`,
    });
  }

  if (lengths.length >= 4) {
    const spread = Math.max(...lengths) - Math.min(...lengths);
    if (spread >= 10) {
      checks.push({
        id: "irregular",
        title: "Cycle length varies a lot",
        detail: `Your last ${lengths.length} cycles ranged from ${Math.min(...lengths)} to ${Math.max(...lengths)} days (${spread} days apart). Predictions are less reliable when cycles vary this much.`,
      });
    }
  }

  const longPeriods = history.slice(0, 6).filter((c) => (c.periodLength ?? 0) > 7);
  if (longPeriods.length > 0) {
    checks.push({
      id: "long-period",
      title: "Periods longer than 7 days",
      detail: `${longPeriods.length === 1 ? "One recent period" : `${longPeriods.length} recent periods`} lasted more than a week. Bleeding that often runs longer than 7 days is worth checking with a clinician.`,
    });
  }

  if (history.length > 0 && diffDays(history[0].startDate, today) >= 60) {
    checks.push({
      id: "no-period",
      title: "No period logged in 60+ days",
      detail: "If you've had periods since, log them to keep predictions accurate. If you haven't, consider a pregnancy test or checking in with a clinician.",
    });
  }

  return checks;
}

/** Cycles (most recent 6) with spotting logged outside the period itself. */
export function spottingBetweenPeriods(history: CycleSummary[], logs: DayLog[]): number {
  let cycles = 0;
  for (const [i, c] of history.slice(0, 6).entries()) {
    const nextStart = i === 0 ? null : history[i - 1].startDate;
    const periodEnd = addDays(c.startDate, (c.periodLength ?? 5) - 1);
    const spotted = logs.some((l) => l.flow === "spotting" && l.date > periodEnd && (!nextStart || l.date < nextStart));
    if (spotted) cycles++;
  }
  return cycles;
}

/** Health checks including the spotting check, which needs the raw logs. */
export function allHealthChecks(history: CycleSummary[], logs: DayLog[], today: string): HealthCheck[] {
  const checks = cycleHealthChecks(history, today);
  const spotting = spottingBetweenPeriods(history, logs);
  if (spotting >= 2) {
    checks.push({
      id: "spotting",
      title: "Spotting between periods",
      detail: `You logged spotting outside your period in ${spotting} recent cycles. Occasional spotting is common; if it keeps happening, mention it to a clinician.`,
    });
  }
  return checks;
}

// -------------------------------------------------------------------------
// Symptom & mood patterns
// -------------------------------------------------------------------------

export type PatternPhase = CyclePhase | "premenstrual";

export interface SymptomPattern {
  name: string;
  kind: "symptom" | "mood";
  /** Cycles the item was logged in, out of cycles with any symptom/mood logged. */
  cyclesWith: number;
  cyclesLogged: number;
  phase: PatternPhase;
  /** Typical window: cycle days, or days before the next period for premenstrual patterns. */
  window: { type: "cycleDay" | "beforePeriod"; from: number; to: number };
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))];

interface Occurrence { cycleIndex: number; cycleDay: number; daysBefore: number | null; phase: PatternPhase }

/**
 * Find symptoms and moods that keep coming back at the same point in the
 * cycle: logged in at least 2 cycles, with at least 60% of occurrences in
 * one phase.
 */
export function symptomPatterns(history: CycleSummary[], logs: DayLog[], settings: UserFertilitySettings): SymptomPattern[] {
  const asc = [...history].reverse();
  const occurrences = new Map<string, { name: string; kind: SymptomPattern["kind"]; list: Occurrence[] }>();
  const cyclesWithAnyLog = new Set<number>();

  for (const log of logs) {
    const items: [string, SymptomPattern["kind"]][] = [
      ...(log.symptoms ?? []).map((s): [string, SymptomPattern["kind"]] => [s, "symptom"]),
      ...(log.mood ?? []).map((m): [string, SymptomPattern["kind"]] => [m, "mood"]),
    ];
    if (items.length === 0) continue;

    const idx = asc.findIndex((c, i) => log.date >= c.startDate && (i === asc.length - 1 || log.date < asc[i + 1].startDate));
    if (idx === -1) continue;
    const cycle = asc[idx];
    const next = asc[idx + 1]?.startDate ?? null;
    const cycleDay = diffDays(cycle.startDate, log.date) + 1;
    const length = cycle.cycleLength ?? settings.avgCycleLength;
    const periodLength = cycle.periodLength ?? settings.avgPeriodLength;
    const ovDay = cycle.ovulation
      ? diffDays(cycle.startDate, cycle.ovulation.date) + 1
      : ovulationCycleDay(length, settings.lutealPhaseLength);
    const daysBefore = next ? diffDays(log.date, next) : null;

    let phase: PatternPhase = phaseForCycleDay(cycleDay, periodLength, ovDay);
    if (phase === "luteal" && daysBefore != null && daysBefore <= 7) phase = "premenstrual";

    cyclesWithAnyLog.add(idx);
    for (const [name, kind] of items) {
      const key = `${kind}:${name.trim().toLowerCase()}`;
      const entry = occurrences.get(key) ?? { name: name.trim(), kind, list: [] };
      entry.list.push({ cycleIndex: idx, cycleDay, daysBefore, phase });
      occurrences.set(key, entry);
    }
  }

  const patterns: SymptomPattern[] = [];
  for (const { name, kind, list } of occurrences.values()) {
    const cyclesWith = new Set(list.map((o) => o.cycleIndex)).size;
    if (cyclesWith < 2) continue;

    const byPhase = new Map<PatternPhase, Occurrence[]>();
    for (const o of list) byPhase.set(o.phase, [...(byPhase.get(o.phase) ?? []), o]);
    const [phase, inPhase] = [...byPhase.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (inPhase.length / list.length < 0.6) continue;

    const usesBefore = phase === "premenstrual";
    const values = inPhase.map((o) => (usesBefore ? (o.daysBefore as number) : o.cycleDay)).sort((a, b) => a - b);
    const from = quantile(values, 0.25);
    const to = quantile(values, 0.75);

    patterns.push({
      name,
      kind,
      cyclesWith,
      cyclesLogged: cyclesWithAnyLog.size,
      phase,
      window: { type: usesBefore ? "beforePeriod" : "cycleDay", from, to },
    });
  }

  return patterns.sort((a, b) => b.cyclesWith - a.cyclesWith || a.name.localeCompare(b.name));
}

export interface HeadsUp {
  pattern: SymptomPattern;
  /** 0 = today, 1 = tomorrow, … */
  inDays: number;
}

/** Patterns expected within the next `horizon` days, soonest first. */
export function upcomingPatterns(patterns: SymptomPattern[], prediction: CyclePrediction, today: string, horizon = 3): HeadsUp[] {
  if (prediction.currentCycleDay == null) return [];
  const result: HeadsUp[] = [];
  for (const pattern of patterns) {
    for (let k = 0; k <= horizon; k++) {
      const date = addDays(today, k);
      // Days on or after the next period belong to the next cycle.
      const cycleDay =
        date >= prediction.nextPeriodStart ? diffDays(prediction.nextPeriodStart, date) + 1 : prediction.currentCycleDay + k;
      const value = pattern.window.type === "cycleDay" ? cycleDay : diffDays(date, prediction.nextPeriodStart);
      if (value >= pattern.window.from && value <= pattern.window.to) {
        result.push({ pattern, inDays: k });
        break;
      }
    }
  }
  return result.sort((a, b) => a.inDays - b.inDays);
}

/** Plain-language description of a pattern's timing. */
export function describeWindow(p: SymptomPattern): string {
  const { from, to, type } = p.window;
  if (type === "beforePeriod") {
    return from === to ? `about ${from} day${from === 1 ? "" : "s"} before your period` : `${from}–${to} days before your period`;
  }
  return from === to ? `around cycle day ${from}` : `cycle days ${from}–${to}`;
}

// -------------------------------------------------------------------------
// Quick stats
// -------------------------------------------------------------------------

export interface CycleStats {
  cyclesTracked: number;
  avgCycleLength: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  avgPeriodLength: number | null;
  avgLutealLength: number | null;
}

export function cycleStats(history: CycleSummary[]): CycleStats {
  const lengths = history.map((c) => c.cycleLength).filter((n): n is number => n != null && n >= 15 && n <= 60).slice(0, 6);
  const periods = history.map((c) => c.periodLength).filter((n): n is number => n != null).slice(0, 6);
  const luteals = history.map((c) => c.lutealLength).filter((n): n is number => n != null && n >= 8 && n <= 20).slice(0, 6);
  return {
    cyclesTracked: history.length,
    avgCycleLength: lengths.length ? average(lengths) : null,
    shortestCycle: lengths.length ? Math.min(...lengths) : null,
    longestCycle: lengths.length ? Math.max(...lengths) : null,
    avgPeriodLength: periods.length ? average(periods) : null,
    avgLutealLength: luteals.length ? average(luteals) : null,
  };
}

// -------------------------------------------------------------------------
// One-call helper used by the pages
// -------------------------------------------------------------------------

export interface CycleModel {
  history: CycleSummary[];
  settings: PersonalizedSettings;
  /** Ovulation observed in the latest logged cycle, if any. */
  observed: ObservedOvulation | null;
}

/** Derive history, personalised settings and the current cycle's observed ovulation. */
export function buildCycleModel(storedStarts: string[], logs: DayLog[], base: UserFertilitySettings): CycleModel {
  const history = buildCycleHistory(storedStarts, logs);
  return {
    history,
    settings: personalizeSettings(history, base),
    observed: history[0]?.ovulation ?? null,
  };
}
