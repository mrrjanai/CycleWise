"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { predictCycle, CycleRecord, CyclePrediction, UserFertilitySettings } from "@/lib/predictions";
import Sidebar from "@/components/Sidebar";

interface CycleRow {
  id: string;
  start_date: string;
  end_date: string | null;
  cycle_length: number | null;
  period_length: number | null;
}

export default function CyclesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [settings, setSettings] = useState<UserFertilitySettings>({ avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 });
  const [regularity, setRegularity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable settings form state
  const [editCycleLength, setEditCycleLength] = useState(28);
  const [editPeriodLength, setEditPeriodLength] = useState(5);
  const [editRegularity, setEditRegularity] = useState<"regular" | "irregular">("regular");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [{ data: profile }, { data: cycleRows }] = await Promise.all([
      supabase.from("profiles").select("avg_cycle_length, avg_period_length, luteal_phase_length, cycle_regularity").eq("id", user.id).single(),
      supabase.from("cycles").select("id, start_date, end_date, cycle_length, period_length").eq("user_id", user.id).order("start_date", { ascending: false }),
    ]);

    const s: UserFertilitySettings = {
      avgCycleLength: profile?.avg_cycle_length ?? 28,
      lutealPhaseLength: profile?.luteal_phase_length ?? 14,
      avgPeriodLength: profile?.avg_period_length ?? 5,
    };
    setSettings(s);
    setEditCycleLength(s.avgCycleLength);
    setEditPeriodLength(s.avgPeriodLength);
    setRegularity(profile?.cycle_regularity ?? null);
    setEditRegularity((profile?.cycle_regularity as "regular" | "irregular") ?? "regular");

    const rows = cycleRows ?? [];
    setCycles(rows);

    const records: CycleRecord[] = rows.map((c) => ({ startDate: c.start_date, cycleLength: c.cycle_length, periodLength: c.period_length }));
    setPrediction(predictCycle(records, s));
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({
      avg_cycle_length: editCycleLength,
      avg_period_length: editPeriodLength,
      cycle_regularity: editRegularity,
    }).eq("id", user.id);
    setSavingSettings(false);
    setSettingsSaved(true);
    load();
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const chartData = [...cycles]
    .filter((c) => c.cycle_length)
    .reverse()
    .map((c) => ({ date: new Date(c.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), length: c.cycle_length }));

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
        {prediction && (
          <div className="neo-card p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Next period" value={new Date(prediction.nextPeriodStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
            <Stat label="Ovulation" value={new Date(prediction.ovulationDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
            <Stat label="Avg cycle length" value={`${prediction.cycleLengthUsed}d`} />
            <Stat label="Regularity" value={regularity ?? "—"} />
          </div>
        )}

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
          {cycles.length === 0 ? (
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark">No cycles logged yet.</p>
          ) : (
            <div className="space-y-2">
              {cycles.map((c) => (
                <div key={c.id} className="neo-inset rounded-neo p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {new Date(c.start_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {c.end_date && ` – ${new Date(c.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                    </p>
                    <p className="text-ink-muted dark:text-ink-muted-dark text-xs mt-0.5">
                      {c.period_length ? `${c.period_length} day period` : "Period length not recorded"}
                    </p>
                  </div>
                  <span className="font-mono text-ink-muted dark:text-ink-muted-dark">
                    {c.cycle_length ? `${c.cycle_length}d cycle` : "current"}
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
            These power your predictions. Update them any time your averages change.
          </p>

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
