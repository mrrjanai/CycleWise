"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatISODate } from "@/lib/predictions";
import { useCycleData, type TrackingGoal } from "@/lib/useCycleData";
import Sidebar from "@/components/Sidebar";

const GOALS: { value: TrackingGoal; label: string; hint: string }[] = [
  { value: "general", label: "Just tracking", hint: "Periods, symptoms and patterns." },
  { value: "conceive", label: "Trying to conceive", hint: "Best days to try and when to start LH tests." },
  { value: "avoid_pregnancy", label: "Avoiding pregnancy", hint: "Higher-risk days, with a reminder to use protection." },
  { value: "contraception", label: "On birth control", hint: "Bleeding and symptom history; fertility estimates may not apply." },
];

export default function CyclesPage() {
  const supabase = useMemo(() => createClient(), []);
  const { loading, model, prediction, goal, regularity, profileSettings, reload } = useCycleData();
  const history = model.history;

  // Editable settings form state
  const [editCycleLength, setEditCycleLength] = useState(28);
  const [editPeriodLength, setEditPeriodLength] = useState(5);
  const [editRegularity, setEditRegularity] = useState<"regular" | "irregular">("regular");
  const [editGoal, setEditGoal] = useState<TrackingGoal>("general");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Sync the form once the profile has loaded.
  useEffect(() => {
    if (loading) return;
    // The stored settings, not the learned values, are what this form edits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditCycleLength(profileSettings.avgCycleLength);
    setEditPeriodLength(profileSettings.avgPeriodLength);
    setEditRegularity((regularity as "regular" | "irregular") ?? "regular");
    setEditGoal(goal);
    // Only on load, not on every model recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    setSettingsError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingSettings(false); return; }
    const { error } = await supabase.from("profiles").update({
      avg_cycle_length: editCycleLength,
      avg_period_length: editPeriodLength,
      cycle_regularity: editRegularity,
      tracking_goal: editGoal,
    }).eq("id", user.id);
    setSavingSettings(false);
    if (error) { setSettingsError(error.message); return; }
    setSettingsSaved(true);
    reload();
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const chartData = [...history]
    .filter((c) => c.cycleLength)
    .reverse()
    .map((c) => ({ date: formatISODate(c.startDate, { month: "short", day: "numeric" }), length: c.cycleLength }));

  if (loading) {
    return (
      <div className="flex min-h-screen bg-base dark:bg-base-dark">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-ink-muted dark:text-ink-muted-dark">Loading your cycles…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-base dark:bg-base-dark">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6">
        <h1 className="font-display text-3xl">Cycles</h1>

        {/* Upcoming */}
        <div className="neo-card p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat
            label="Next period"
            value={prediction.daysLate > 0 ? `${prediction.daysLate}d late` : formatISODate(prediction.nextPeriodStart, { month: "short", day: "numeric" })}
          />
          <Stat label="Ovulation" value={formatISODate(prediction.ovulationDate, { month: "short", day: "numeric" })} />
          <Stat label="Avg cycle length" value={`${prediction.cycleLengthUsed}d`} />
          <Stat label="Regularity" value={regularity ?? "—"} />
        </div>

        {/* Chart */}
        <div className="neo-card p-6">
          <h2 className="font-display text-lg mb-4">Cycle length over time</h2>
          {chartData.length >= 2 ? (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#C7C1DD" strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A82A3" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8A82A3" }} domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="length" stroke="#8B6BC7" strokeWidth={3} dot={{ fill: "#8B6BC7", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
              Log at least two completed cycles to see a trend chart here.
            </p>
          )}
        </div>

        {/* History */}
        <div className="neo-card p-6">
          <h2 className="font-display text-lg mb-4">Cycle history</h2>
          {history.length === 0 ? (
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark">No cycles logged yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((c) => (
                <div key={c.startDate} className="neo-inset rounded-neo p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {formatISODate(c.startDate, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-ink-muted dark:text-ink-muted-dark text-xs mt-0.5">
                      {c.periodLength ? `${c.periodLength} day period` : "Period length not recorded"}
                      {c.ovulation && ` · ovulation ${formatISODate(c.ovulation.date, { month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                  <span className="font-mono text-ink-muted dark:text-ink-muted-dark">
                    {c.cycleLength ? `${c.cycleLength}d cycle` : "current"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editable settings — same questions as onboarding, adjustable later */}
        <div className="neo-card p-6 space-y-4">
          <h2 className="font-display text-lg">Cycle settings</h2>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            These power your predictions until you&apos;ve logged enough cycles for CycleWise to learn your own averages.
          </p>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Your goal</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setEditGoal(g.value)}
                  aria-pressed={editGoal === g.value}
                  className={`neo-btn px-4 py-3 text-left ${editGoal === g.value ? "neo-pressed ring-2 ring-violet" : ""}`}
                >
                  <span className="block text-sm font-medium">{g.label}</span>
                  <span className="block text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">{g.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Average cycle length (days)</label>
            <input
              type="number" min={15} max={60} value={editCycleLength}
              onChange={(e) => setEditCycleLength(parseInt(e.target.value, 10) || 28)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Average period length (days)</label>
            <input
              type="number" min={1} max={14} value={editPeriodLength}
              onChange={(e) => setEditPeriodLength(parseInt(e.target.value, 10) || 5)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Regularity</label>
            <div className="flex gap-2">
              <button onClick={() => setEditRegularity("regular")} className={`neo-btn px-4 py-2 text-sm flex-1 ${editRegularity === "regular" ? "neo-pressed" : ""}`}>Regular</button>
              <button onClick={() => setEditRegularity("irregular")} className={`neo-btn px-4 py-2 text-sm flex-1 ${editRegularity === "irregular" ? "neo-pressed" : ""}`}>Irregular</button>
            </div>
          </div>

          {settingsError && <p className="text-sm text-rose">{settingsError}</p>}
          <button onClick={saveSettings} disabled={savingSettings} className="neo-btn px-5 py-2.5 text-sm font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
            {savingSettings ? "Saving…" : settingsSaved ? "Saved ✓" : "Save settings"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{label}</p>
      <p className="font-mono text-sm capitalize mt-0.5">{value}</p>
    </div>
  );
}
