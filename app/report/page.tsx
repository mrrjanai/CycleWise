"use client";

import { useMemo } from "react";
import { addDays, formatISODate, ovulationCycleDay } from "@/lib/predictions";
import { allHealthChecks, cycleStats, describeWindow, symptomPatterns } from "@/lib/insights";
import { useCycleData, type TrackingGoal } from "@/lib/useCycleData";
import Sidebar from "@/components/Sidebar";
import PinGate from "@/components/PinGate";

const GOAL_LABEL: Record<TrackingGoal, string> = {
  general: "General tracking",
  conceive: "Trying to conceive",
  avoid_pregnancy: "Avoiding pregnancy",
  contraception: "Using birth control",
};
const METHOD = { bbt: "BBT", lh: "LH test", mucus: "Mucus" } as const;
const fmt = (iso: string) => formatISODate(iso, { month: "short", day: "numeric", year: "numeric" });

/**
 * A one-page cycle summary to print or save as PDF for a clinician
 * appointment (like Clue's and Flo's health reports). Built entirely in the
 * browser from the user's own data; nothing is sent anywhere.
 */
export default function ReportPage() {
  const { loading, model, logs, prediction, goal, today } = useCycleData();
  const { history, settings } = model;

  const stats = useMemo(() => cycleStats(history), [history]);
  const checks = useMemo(() => allHealthChecks(history, logs, today), [history, logs, today]);
  const patterns = useMemo(() => symptomPatterns(history, logs, settings), [history, logs, settings]);

  const rows = useMemo(() => history.slice(0, 12).map((c, i) => {
    const end = i === 0 ? addDays(today, 1) : history[i - 1].startDate;
    const counts = new Map<string, number>();
    for (const l of logs) {
      if (l.date < c.startDate || l.date >= end) continue;
      for (const s of l.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
    return { ...c, top };
  }), [history, logs, today]);

  if (loading) {
    return (
      <PinGate>
        <div className="flex min-h-screen bg-base dark:bg-base-dark">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-ink-muted dark:text-ink-muted-dark">Preparing your report…</p>
          </main>
        </div>
      </PinGate>
    );
  }

  return (
    <PinGate>
      <div className="flex flex-col md:flex-row min-h-screen bg-base dark:bg-base-dark print:bg-white print:block">
        <div className="print:hidden"><Sidebar /></div>
        <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 print:p-0 print:max-w-none print:text-black">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <h1 className="font-display text-3xl">Doctor report</h1>
            <button onClick={() => window.print()} className="neo-btn px-5 py-2.5 text-sm font-medium bg-gradient-to-br from-rose to-violet text-white">
              Print / save as PDF
            </button>
          </div>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark print:hidden">
            A one-page summary of your cycles to bring to an appointment. It&apos;s generated on this device from your
            own logs.
          </p>

          <article className="neo-card p-6 sm:p-8 space-y-6 print:shadow-none print:p-0 print:bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-muted/20 pb-4">
              <h2 className="font-display text-2xl print:text-black">Cycle summary</h2>
              <p className="font-mono text-xs text-ink-muted">Generated {fmt(today)} · CycleWise</p>
            </header>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <Fact label="Tracking goal" value={GOAL_LABEL[goal]} />
              <Fact label="Cycles logged" value={String(stats.cyclesTracked)} />
              <Fact label="Last period started" value={prediction.lastPeriodStart ? fmt(prediction.lastPeriodStart) : "—"} />
              <Fact label="Average cycle" value={stats.avgCycleLength ? `${stats.avgCycleLength} days` : "—"} />
              <Fact label="Cycle range" value={stats.shortestCycle ? `${stats.shortestCycle}–${stats.longestCycle} days` : "—"} />
              <Fact label="Average period" value={stats.avgPeriodLength ? `${stats.avgPeriodLength} days` : "—"} />
              <Fact label="Luteal phase" value={stats.avgLutealLength ? `${stats.avgLutealLength} days (measured)` : "Not measured"} />
              <Fact label="Typical ovulation" value={`Cycle day ${ovulationCycleDay(stats.avgCycleLength ?? settings.avgCycleLength, settings.lutealPhaseLength)}`} />
              <Fact
                label="Current status"
                value={prediction.daysLate > 0 ? `Period ${prediction.daysLate} days late` : prediction.currentCycleDay ? `Cycle day ${prediction.currentCycleDay}` : "—"}
              />
            </section>

            <section>
              <h3 className="font-display text-lg mb-2 print:text-black">Recent cycles</h3>
              {rows.length === 0 ? (
                <p className="text-sm text-ink-muted">No cycles logged yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                        <th className="py-2 pr-3 font-medium">Started</th>
                        <th className="py-2 pr-3 font-medium">Cycle</th>
                        <th className="py-2 pr-3 font-medium">Period</th>
                        <th className="py-2 pr-3 font-medium">Ovulation</th>
                        <th className="py-2 font-medium">Most-logged symptoms</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {rows.map((r) => (
                        <tr key={r.startDate} className="border-t border-ink-muted/15">
                          <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.startDate)}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{r.cycleLength ? `${r.cycleLength} d` : "current"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{r.periodLength ? `${r.periodLength} d` : "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {r.ovulation ? `${formatISODate(r.ovulation.date, { month: "short", day: "numeric" })} (${METHOD[r.ovulation.method]})` : "—"}
                          </td>
                          <td className="py-2 font-body">{r.top.length ? r.top.join(", ") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="font-display text-lg mb-2 print:text-black">Things to discuss</h3>
              {checks.length === 0 ? (
                <p className="text-sm text-ink-muted">No unusual cycle patterns flagged.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {checks.map((c) => <li key={c.id}><span className="font-medium">{c.title}.</span> {c.detail}</li>)}
                </ul>
              )}
            </section>

            <section>
              <h3 className="font-display text-lg mb-2 print:text-black">Recurring symptoms &amp; moods</h3>
              {patterns.length === 0 ? (
                <p className="text-sm text-ink-muted">None recurring yet.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {patterns.map((p) => (
                    <li key={`${p.kind}:${p.name}`}>
                      <span className="font-medium">{p.name}</span>: {describeWindow(p)} ({p.cyclesWith} of {p.cyclesLogged} cycles)
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-ink-muted border-t border-ink-muted/20 pt-4">
              Self-reported data from the CycleWise app. Cycle and ovulation figures are estimates from logged dates,
              temperatures and tests, not clinical measurements.
            </p>
          </article>
        </main>
      </div>
    </PinGate>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}
