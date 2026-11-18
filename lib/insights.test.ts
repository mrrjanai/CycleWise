import { describe, expect, it } from "vitest";
import {
  allHealthChecks,
  buildCycleHistory,
  buildCycleModel,
  cycleHealthChecks,
  cycleStats,
  describeWindow,
  detectOvulation,
  personalizeSettings,
  symptomPatterns,
  upcomingPatterns,
  type DayLog,
} from "./insights";
import { addDays, predictCycle, type UserFertilitySettings } from "./predictions";

const settings: UserFertilitySettings = { avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 };

/** Flow logs for a period of `days` days starting on `start`. */
const period = (start: string, days: number, flow = "medium"): DayLog[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), flow }));

describe("detectOvulation", () => {
  it("finds a BBT shift with the 3-over-6 rule", () => {
    const low = [36.3, 36.4, 36.3, 36.35, 36.4, 36.3];
    const high = [36.55, 36.6, 36.7];
    const logs: DayLog[] = [...low, ...high].map((bbt, i) => ({ date: addDays("2026-03-08", i), bbt }));
    // First high reading is on Mar 14, so ovulation is placed on Mar 13.
    expect(detectOvulation(logs)).toEqual({ date: "2026-03-13", method: "bbt", confirmed: true, coverline: 36.4 });
  });

  it("needs the third high reading to clear the coverline by 0.2°C", () => {
    const temps = [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.45, 36.5, 36.55];
    const logs: DayLog[] = temps.map((bbt, i) => ({ date: addDays("2026-03-08", i), bbt }));
    expect(detectOvulation(logs)).toBeNull();
  });

  it("places ovulation the day after a positive LH test", () => {
    const logs: DayLog[] = [
      { date: "2026-03-11", tests: [{ type: "ovulation", result: "negative" }] },
      { date: "2026-03-12", tests: [{ type: "ovulation", result: "positive" }] },
    ];
    expect(detectOvulation(logs)).toMatchObject({ date: "2026-03-13", method: "lh", confirmed: false });
  });

  it("uses the last egg-white mucus day once a drier day follows it", () => {
    const logs: DayLog[] = [
      { date: "2026-03-10", mucus: "creamy" },
      { date: "2026-03-12", mucus: "egg_white" },
      { date: "2026-03-13", mucus: "egg_white" },
    ];
    expect(detectOvulation(logs)).toBeNull(); // peak not over yet
    expect(detectOvulation([...logs, { date: "2026-03-14", mucus: "sticky" }])).toMatchObject({ date: "2026-03-13", method: "mucus" });
  });

  it("prefers a BBT shift over an LH test", () => {
    const temps = [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.55, 36.6, 36.7];
    const logs: DayLog[] = temps.map((bbt, i) => ({ date: addDays("2026-03-08", i), bbt }));
    logs.push({ date: "2026-03-09", tests: [{ type: "ovulation", result: "positive" }] });
    expect(detectOvulation(logs)?.method).toBe("bbt");
  });
});

describe("buildCycleHistory", () => {
  it("collapses a stored start for every bleeding day into one period", () => {
    const starts = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-29", "2026-03-30"];
    const logs = [...period("2026-03-01", 5), ...period("2026-03-29", 4)];
    const history = buildCycleHistory(starts, logs);
    expect(history.map((c) => c.startDate)).toEqual(["2026-03-29", "2026-03-01"]);
    expect(history[1]).toMatchObject({ cycleLength: 28, periodLength: 5 });
    expect(history[0]).toMatchObject({ cycleLength: null, periodLength: 4 });
  });

  it("moves a period start back when flow was logged earlier", () => {
    const history = buildCycleHistory(["2026-03-03"], period("2026-03-01", 5));
    expect(history[0].startDate).toBe("2026-03-01");
  });

  it("finds periods from flow logs alone and ignores lone spotting", () => {
    const logs = [...period("2026-01-05", 5), { date: "2026-01-20", flow: "spotting" }, ...period("2026-02-02", 5)];
    expect(buildCycleHistory([], logs).map((c) => c.startDate)).toEqual(["2026-02-02", "2026-01-05"]);
  });

  it("counts trailing spotting and bridges a single missed day", () => {
    const logs: DayLog[] = [...period("2026-03-01", 3), { date: "2026-03-05", flow: "light" }, { date: "2026-03-06", flow: "spotting" }];
    expect(buildCycleHistory(["2026-03-01"], logs)[0].periodLength).toBe(6);
  });

  it("leaves period length unknown when no flow was logged", () => {
    expect(buildCycleHistory(["2026-03-01"], [])[0].periodLength).toBeNull();
  });

  it("attaches ovulation and luteal length to each cycle", () => {
    const logs = [
      ...period("2026-03-01", 5),
      { date: "2026-03-15", tests: [{ type: "ovulation", result: "positive" }] },
      ...period("2026-03-30", 5),
    ];
    const [, march] = buildCycleHistory(["2026-03-01", "2026-03-30"], logs);
    expect(march.ovulation?.date).toBe("2026-03-16");
    expect(march.lutealLength).toBe(13);
  });
});

describe("personalizeSettings", () => {
  it("learns period length after two logged periods", () => {
    const logs = [...period("2026-01-01", 4), ...period("2026-01-29", 4), ...period("2026-02-26", 4)];
    const s = personalizeSettings(buildCycleHistory([], logs), settings);
    expect(s.avgPeriodLength).toBe(4);
    expect(s.periodLengthLearned).toBe(true);
  });

  it("keeps the default luteal length without two LH or BBT confirmations", () => {
    const logs = [
      ...period("2026-01-01", 4),
      { date: "2026-01-14", tests: [{ type: "ovulation", result: "positive" }] },
      ...period("2026-01-29", 4),
    ];
    const s = personalizeSettings(buildCycleHistory([], logs), settings);
    expect(s.lutealPhaseLength).toBe(14);
    expect(s.lutealLengthLearned).toBe(false);
  });

  it("learns luteal length from LH tests", () => {
    const lh = (d: string): DayLog => ({ date: d, tests: [{ type: "ovulation", result: "positive" }] });
    const logs = [
      ...period("2026-01-01", 4), lh("2026-01-16"),
      ...period("2026-01-29", 4), lh("2026-02-13"),
      ...period("2026-02-26", 4),
    ];
    // Ovulation Jan 17 → next period Jan 29: 11 luteal days; Feb 14 → Feb 26: 11.
    const s = personalizeSettings(buildCycleHistory([], logs), settings);
    expect(s.lutealPhaseLength).toBe(11);
    expect(s.lutealLengthLearned).toBe(true);
  });
});

describe("health checks", () => {
  const startsEvery = (first: string, lengths: number[]) => {
    const starts = [first];
    for (const len of lengths) starts.push(addDays(starts[starts.length - 1], len));
    return starts;
  };

  it("is quiet for regular cycles", () => {
    const history = buildCycleHistory(startsEvery("2026-01-01", [28, 29, 27, 28]), []);
    expect(cycleHealthChecks(history, "2026-05-01")).toEqual([]);
  });

  it("flags irregular and out-of-range cycles", () => {
    const history = buildCycleHistory(startsEvery("2026-01-01", [24, 40, 26, 38]), []);
    const ids = cycleHealthChecks(history, "2026-05-20").map((c) => c.id);
    expect(ids).toContain("irregular");
    expect(ids).toContain("cycle-range");
  });

  it("flags periods longer than 7 days", () => {
    const history = buildCycleHistory([], period("2026-03-01", 9));
    expect(cycleHealthChecks(history, "2026-03-15").map((c) => c.id)).toEqual(["long-period"]);
  });

  it("flags a 60+ day gap since the last period", () => {
    const history = buildCycleHistory(["2026-01-01"], []);
    expect(cycleHealthChecks(history, "2026-03-05").map((c) => c.id)).toEqual(["no-period"]);
  });

  it("flags spotting between periods in two or more cycles", () => {
    const logs = [
      ...period("2026-01-01", 5), { date: "2026-01-15", flow: "spotting" },
      ...period("2026-01-29", 5), { date: "2026-02-12", flow: "spotting" },
      ...period("2026-02-26", 5),
    ];
    const history = buildCycleHistory([], logs);
    expect(allHealthChecks(history, logs, "2026-03-05").map((c) => c.id)).toContain("spotting");
  });
});

describe("symptomPatterns", () => {
  const starts = ["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"];
  const logs: DayLog[] = [
    // Cramps on days 1–2 of three cycles.
    ...starts.slice(0, 3).flatMap((s) => [
      { date: s, flow: "heavy", symptoms: ["Cramps"] },
      { date: addDays(s, 1), flow: "medium", symptoms: ["Cramps"] },
    ]),
    // Irritable 3 days before the next period, in two cycles.
    { date: addDays(starts[1], -3), mood: ["Irritable"] },
    { date: addDays(starts[2], -3), mood: ["Irritable"] },
    // A one-off headache.
    { date: "2026-02-10", symptoms: ["Headache"] },
  ];
  const history = buildCycleHistory(starts, logs);
  const patterns = symptomPatterns(history, logs, settings);

  it("finds recurring symptoms and their phase", () => {
    const cramps = patterns.find((p) => p.name === "Cramps");
    expect(cramps).toMatchObject({ kind: "symptom", phase: "menstrual", cyclesWith: 3, window: { type: "cycleDay", from: 1, to: 2 } });
    expect(describeWindow(cramps!)).toBe("cycle days 1–2");
  });

  it("anchors premenstrual moods to the next period", () => {
    const irritable = patterns.find((p) => p.name === "Irritable");
    expect(irritable).toMatchObject({ phase: "premenstrual", window: { type: "beforePeriod", from: 3, to: 3 } });
    expect(describeWindow(irritable!)).toBe("about 3 days before your period");
  });

  it("ignores one-offs", () => {
    expect(patterns.find((p) => p.name === "Headache")).toBeUndefined();
  });

  it("gives a heads-up for patterns in the next few days", () => {
    const p = predictCycle([{ startDate: "2026-03-26", cycleLength: null }], settings, "2026-04-20");
    // Next period Apr 23: irritable expected 3 days before = today.
    const soon = upcomingPatterns(patterns, p, "2026-04-20");
    expect(soon.map((h) => [h.pattern.name, h.inDays])).toEqual([["Irritable", 0], ["Cramps", 3]]);
  });
});

describe("cycleStats + buildCycleModel", () => {
  it("summarises the history", () => {
    const logs = [...period("2026-01-01", 5), ...period("2026-01-27", 4), ...period("2026-02-26", 5)];
    const model = buildCycleModel([], logs, settings);
    expect(cycleStats(model.history)).toEqual({
      cyclesTracked: 3,
      avgCycleLength: 28,
      shortestCycle: 26,
      longestCycle: 30,
      avgPeriodLength: 5,
      avgLutealLength: null,
    });
    expect(model.observed).toBeNull();
  });
});
