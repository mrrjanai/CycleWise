"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, diffDays, formatISODate, ovulationCycleDay } from "@/lib/predictions";
import { allHealthChecks, cycleStats, describeWindow, symptomPatterns, type PatternPhase } from "@/lib/insights";
import { useCycleData } from "@/lib/useCycleData";
import Sidebar from "@/components/Sidebar";
import PinGate from "@/components/PinGate";

const PHASE_LABEL: Record<PatternPhase, string> = {
  menstrual: "During your period",
  follicular: "After your period",
  ovulatory: "Around ovulation",
  luteal: "After ovulation",
  premenstrual: "Before your period",
};

const METHOD_LABEL = { bbt: "temperature shift", lh: "positive LH test", mucus: "cervical mucus peak" } as const;

export default function InsightsPage() {
  const { loading, model, logs, today } = useCycleData();
  const { history, settings } = model;
  const [cycleIndex, setCycleIndex] = useState(0);

  const stats = useMemo(() => cycleStats(history), [history]);
  const checks = useMemo(() => allHealthChecks(history, logs, today), [history, logs, today]);
  const patterns = useMemo(() => symptomPatterns(history, logs, settings), [history, logs, settings]);
  const completedCycles = history.filter((c) => c.cycleLength != null).length;

  const cycle = history[cycleIndex] ?? null;
  const bbtData = useMemo(() => {
    if (!cycle) return [];
    const end = cycleIndex === 0 ? addDays(today, 1) : history[cycleIndex - 1].startDate;
    return logs
      .filter((l) => l.bbt != null && l.date >= cycle.startDate && l.date < end)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((l) => ({ day: diffDays(cycle.startDate, l.date) + 1, temp: l.bbt as number, date: l.date }));
  }, [cycle, cycleIndex, history, logs, today]);
  const ovulationDay = cycle?.ovulation ? diffDays(cycle.startDate, cycle.ovulation.date) + 1 : null;

  if (loading) {
    return (
      <PinGate>
        <div className="flex min-h-screen bg-base dark:bg-base-dark">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-ink-muted dark:text-ink-muted-dark">Loading your insights…</p>
          </main>
        </div>
      </PinGate>
    );
  }

  return (
    <PinGate>
      <div className="flex flex-col md:flex-row min-h-screen bg-base dark:bg-base-dark">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-display text-3xl">Insights</h1>
            <Link href="/report" className="neo-btn px-4 py-2 text-sm">Doctor report</Link>
          </div>

          {/* Stats */}
          <div className="neo-card p-6 grid grid-cols-2 sm:grid-cols-3 gap-5">
            <Tile label="Cycles tracked" value={String(stats.cyclesTracked)} />
            <Tile label="Avg cycle" value={stats.avgCycleLength ? `${stats.avgCycleLength} days` : "—"} />
            <Tile
              label="Range"
              value={stats.shortestCycle ? `${stats.shortestCycle}–${stats.longestCycle} days` : "—"}
            />
            <Tile
              label="Avg period"
              value={stats.avgPeriodLength ? `${stats.avgPeriodLength} days` : "—"}
              note={settings.periodLengthLearned ? "Learned from your logs" : "Log flow each day to learn this"}
            />
            <Tile
              label="Luteal phase"
              value={`${settings.lutealPhaseLength} days`}
              note={settings.lutealLengthLearned ? "Learned from your LH tests / temperature" : "Default, until 2 cycles with LH or BBT data"}
            />
            <Tile
              label="Ovulation day"
              value={`Day ${ovulationCycleDay(stats.avgCycleLength ?? settings.avgCycleLength, settings.lutealPhaseLength)}`}
              note="Typical, from cycle and luteal length"
            />
          </div>

          {/* Health checks */}
          <section className="neo-card p-6 space-y-4">
            <h2 className="font-display text-lg">Cycle health</h2>
            {completedCycles < 3 && checks.length === 0 ? (
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
                Log at least 3 periods and CycleWise will check your cycles for irregular timing, long periods and spotting.
              </p>
            ) : checks.length === 0 ? (
              <p className="text-sm">
                <span className="text-sage font-medium">Nothing unusual.</span>{" "}
                <span className="text-ink-muted dark:text-ink-muted-dark">
                  Your recent cycles are within the typical ranges for length, variation and period length.
                </span>
              </p>
            ) : (
              <ul className="space-y-3">
                {checks.map((c) => (
                  <li key={c.id} className="neo-inset rounded-neo p-4">
                    <p className="font-medium text-sm">{c.title}</p>
                    <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1">{c.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
              These checks use common guidance (typical cycles are 21–35 days and periods up to 7 days). They aren&apos;t
              a diagnosis. Talk to a clinician about anything that worries you.
            </p>
          </section>

          {/* Patterns */}
          <section className="neo-card p-6 space-y-4">
            <h2 className="font-display text-lg">Your patterns</h2>
            {patterns.length === 0 ? (
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
                Log symptoms and moods across a couple of cycles and CycleWise will spot the ones that keep coming back at
                the same point in your cycle, then warn you ahead of time on the dashboard.
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-3">
                {patterns.map((p) => (
                  <li key={`${p.kind}:${p.name}`} className="neo-inset rounded-neo p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{p.name}</p>
                      <span className="text-xs text-ink-muted dark:text-ink-muted-dark capitalize">{p.kind}</span>
                    </div>
                    <p className="text-sm mt-1">{PHASE_LABEL[p.phase]}, usually {describeWindow(p)}</p>
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1 font-mono">
                      in {p.cyclesWith} of {p.cyclesLogged} logged cycles
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* BBT chart */}
          <section className="neo-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg">Temperature chart</h2>
              {history.length > 1 && (
                <select
                  value={cycleIndex}
                  onChange={(e) => setCycleIndex(Number(e.target.value))}
                  aria-label="Choose a cycle"
                  className="neo-inset-sm rounded-neo p-2 text-sm bg-transparent outline-none border border-ink-muted/30"
                >
                  {history.slice(0, 12).map((c, i) => (
                    <option key={c.startDate} value={i}>
                      {i === 0 ? "Current cycle" : `Cycle from ${formatISODate(c.startDate, { month: "short", day: "numeric", year: "numeric" })}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {bbtData.length >= 3 ? (
              <>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={bbtData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                      <CartesianGrid stroke="#8C93A6" strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="day" type="number" domain={["dataMin", "dataMax"]} tick={{ fontSize: 11, fill: "#8C93A6" }} label={{ value: "Cycle day", position: "insideBottom", offset: -2, fontSize: 11, fill: "#8C93A6" }} height={36} />
                      <YAxis tick={{ fontSize: 11, fill: "#8C93A6" }} domain={["dataMin - 0.1", "dataMax + 0.1"]} tickFormatter={(v: number) => v.toFixed(1)} width={48} />
                      <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} °C`, "BBT"]} labelFormatter={(d) => `Cycle day ${d}`} />
                      {cycle?.ovulation?.coverline != null && (
                        <ReferenceLine y={cycle.ovulation.coverline} stroke="#8C93A6" strokeDasharray="5 4" label={{ value: "coverline", position: "insideTopLeft", fontSize: 11, fill: "#8C93A6" }} />
                      )}
                      {ovulationDay != null && (
                        <ReferenceLine x={ovulationDay} stroke="#5B7DB1" label={{ value: "ovulation", position: "top", fontSize: 11, fill: "#5B7DB1" }} />
                      )}
                      <Line type="monotone" dataKey="temp" stroke="#FF6B5B" strokeWidth={2.5} dot={{ fill: "#FF6B5B", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
                  {cycle?.ovulation
                    ? `Ovulation ${cycle.ovulation.confirmed ? "confirmed" : "estimated"} on cycle day ${ovulationDay} from your ${METHOD_LABEL[cycle.ovulation.method]}.`
                    : "No temperature shift detected yet. Ovulation is confirmed once three readings sit above the highest of the six before them."}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
                Log your basal body temperature most mornings. After ovulation it rises about 0.2–0.5 °C and stays up, and
                CycleWise uses that shift to confirm ovulation and sharpen your next period prediction.
              </p>
            )}
          </section>
        </main>
      </div>
    </PinGate>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{label}</p>
      <p className="font-mono text-base mt-0.5">{value}</p>
      {note && <p className="text-[11px] text-ink-muted dark:text-ink-muted-dark mt-0.5 leading-snug">{note}</p>}
    </div>
  );
}
