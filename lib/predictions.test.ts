import { describe, expect, it } from "vitest";
import {
  formatISODate,
  getDayFertility,
  getMonthFertility,
  localDateISO,
  predictCycle,
  type CycleRecord,
  type UserFertilitySettings,
} from "./predictions";

const settings: UserFertilitySettings = { avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 };

describe("predictCycle", () => {
  it("falls back to the user's average with no history", () => {
    const p = predictCycle([], settings, "2026-03-10");
    expect(p.lastPeriodStart).toBeNull();
    expect(p.cycleLengthUsed).toBe(28);
    expect(p.nextPeriodStart).toBe("2026-04-07");
    expect(p.confidence).toBe("low");
    expect(p.currentCycleDay).toBeNull();
  });

  it("puts ovulation on cycle day 14 with a ±4 day fertile window", () => {
    const p = predictCycle([{ startDate: "2026-03-01" }], settings, "2026-03-05");
    expect(p.ovulationDate).toBe("2026-03-14");
    expect(p.fertileWindowStart).toBe("2026-03-10");
    expect(p.fertileWindowEnd).toBe("2026-03-18");
    expect(p.currentCycleDay).toBe(5);
  });

  it("predicts the next period and its end from the average length", () => {
    const p = predictCycle([{ startDate: "2026-03-01" }], settings, "2026-03-05");
    expect(p.nextPeriodStart).toBe("2026-03-29");
    expect(p.nextPeriodEnd).toBe("2026-04-02");
  });

  it("averages only the 6 most recent valid cycle lengths", () => {
    const cycles: CycleRecord[] = [
      { startDate: "2026-06-01" },
      ...[30, 30, 30, 30, 30, 30].map((len, i) => ({ startDate: `2026-0${5 - Math.floor(i / 2)}-01`, cycleLength: len })),
      { startDate: "2025-11-01", cycleLength: 20 }, // 7th — ignored
    ];
    const p = predictCycle(cycles, settings, "2026-06-02");
    expect(p.cycleLengthUsed).toBe(30);
  });

  it("ignores implausible cycle lengths (<15 or >60 days)", () => {
    const p = predictCycle(
      [{ startDate: "2026-06-01" }, { startDate: "2026-05-01", cycleLength: 5 }, { startDate: "2026-03-01", cycleLength: 90 }],
      settings,
      "2026-06-02"
    );
    expect(p.cycleLengthUsed).toBe(28);
    expect(p.confidence).toBe("low");
  });

  it("scales confidence with sample size and regularity", () => {
    const regular = [29, 28, 28, 27].map((len) => ({ startDate: "2026-01-01", cycleLength: len }));
    const irregular = [21, 35, 24, 40].map((len) => ({ startDate: "2026-01-01", cycleLength: len }));
    const two = [28, 28].map((len) => ({ startDate: "2026-01-01", cycleLength: len }));
    const latest = { startDate: "2026-06-01" };
    expect(predictCycle([latest, ...regular], settings, "2026-06-02").confidence).toBe("high");
    expect(predictCycle([latest, ...irregular], settings, "2026-06-02").confidence).toBe("medium");
    expect(predictCycle([latest, ...two], settings, "2026-06-02").confidence).toBe("medium");
  });

  it("projects cycles forward when no new period has been logged", () => {
    // Last logged Jan 1; projected cycles start Jan 29, Feb 26, Mar 26.
    const p = predictCycle([{ startDate: "2026-01-01" }], settings, "2026-03-10");
    expect(p.nextPeriodStart).toBe("2026-03-26");
    expect(p.ovulationDate).toBe("2026-03-11"); // day 14 of the Feb 26 cycle, not Jan 14
    expect(p.currentCycleDay).toBe(13);
  });

  it("starts a new cycle on the predicted day", () => {
    const p = predictCycle([{ startDate: "2026-03-01" }], settings, "2026-03-29");
    expect(p.currentCycleDay).toBe(1);
    expect(p.nextPeriodStart).toBe("2026-04-26");
  });

  it("handles cycles spanning a year boundary and leap day", () => {
    expect(predictCycle([{ startDate: "2026-12-20" }], settings, "2026-12-21").nextPeriodStart).toBe("2027-01-17");
    expect(predictCycle([{ startDate: "2028-02-15" }], settings, "2028-02-16").ovulationDate).toBe("2028-02-28");
    expect(predictCycle([{ startDate: "2028-02-20" }], settings, "2028-02-21").ovulationDate).toBe("2028-03-04");
  });
});

describe("getDayFertility", () => {
  const p = predictCycle([{ startDate: "2026-03-01" }], settings, "2026-03-05");
  const day = (d: string) => getDayFertility(d, p, settings, "2026-03-01");

  it("marks the period days", () => {
    expect(day("2026-03-01").zone).toBe("period");
    expect(day("2026-03-05").zone).toBe("period");
    expect(day("2026-03-06").zone).not.toBe("period");
  });

  it("projects the period, fertile window and ovulation into later cycles", () => {
    // Next cycle starts Mar 29 (Mar 1 + 28); its ovulation is Apr 11.
    expect(day("2026-03-29")).toMatchObject({ zone: "period", cycleDay: 1 });
    expect(day("2026-04-02").zone).toBe("period");
    expect(day("2026-04-11")).toMatchObject({ zone: "ovulation", cycleDay: 14 });
    expect(day("2026-04-07").zone).toBe("fertile");
    expect(day("2026-04-20").zone).toBe("low");
    // Two cycles ahead: starts Apr 26, ovulation May 9.
    expect(day("2026-05-09").zone).toBe("ovulation");
  });

  it("treats days before the first logged period as unknown/low", () => {
    expect(day("2026-02-20")).toMatchObject({ zone: "low", cycleDay: null });
  });

  it("marks ovulation as peak and the window around it as fertile", () => {
    expect(day("2026-03-14")).toMatchObject({ zone: "ovulation", pregnancyProbabilityLabel: "Peak", cycleDay: 14 });
    expect(day("2026-03-10").zone).toBe("fertile");
    expect(day("2026-03-18").zone).toBe("fertile");
    expect(day("2026-03-09").zone).toBe("low");
    expect(day("2026-03-19").zone).toBe("low");
  });
});

describe("date helpers", () => {
  it("formats ISO dates without shifting the day", () => {
    expect(formatISODate("2026-03-14", { month: "numeric", day: "numeric" })).toMatch(/3\D14|14\D3/);
  });
  it("returns the local calendar date", () => {
    expect(localDateISO(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(localDateISO(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
  });
});

describe("getMonthFertility", () => {
  it("shows next month's projected cycle, not an all-green month", () => {
    const p = predictCycle([{ startDate: "2026-03-01" }], settings, "2026-03-05");
    const april = getMonthFertility(2026, 3, p, settings, p.lastPeriodStart);
    expect(april.filter((d) => d.zone === "ovulation").map((d) => d.date)).toEqual(["2026-04-11"]);
    expect(april.filter((d) => d.zone === "fertile")).toHaveLength(8);
  });

  it("returns one entry per calendar day, starting on the 1st", () => {
    const p = predictCycle([{ startDate: "2026-03-01" }], settings, "2026-03-05");
    const march = getMonthFertility(2026, 2, p, settings, "2026-03-01");
    expect(march).toHaveLength(31);
    expect(march[0].date).toBe("2026-03-01");
    expect(march[30].date).toBe("2026-03-31");
    expect(march.find((d) => d.zone === "ovulation")?.date).toBe("2026-03-14");
  });
});
