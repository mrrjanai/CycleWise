"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { predictCycle, getDayFertility, CycleRecord, CyclePrediction, UserFertilitySettings } from "@/lib/predictions";
import CycleDial from "@/components/CycleDial";
import Calendar from "@/components/Calendar";
import DailyInsight from "@/components/DailyInsight";
import LogPeriodModal from "@/components/LogPeriodModal";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const supabase = createClient();
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [settings, setSettings] = useState<UserFertilitySettings>({ avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 });
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [loggedDates, setLoggedDates] = useState<Record<string, { hasPeriod?: boolean; hasLog?: boolean }>>({});
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, { data: cycles }, { data: logs }] = await Promise.all([
      supabase.from("profiles").select("avg_cycle_length, avg_period_length, luteal_phase_length").eq("id", user.id).single(),
      supabase.from("cycles").select("start_date, cycle_length, period_length").eq("user_id", user.id).order("start_date", { ascending: false }),
      supabase.from("daily_logs").select("log_date, flow_intensity").eq("user_id", user.id),
    ]);

    const s: UserFertilitySettings = {
      avgCycleLength: profile?.avg_cycle_length ?? 28,
      lutealPhaseLength: profile?.luteal_phase_length ?? 14,
      avgPeriodLength: profile?.avg_period_length ?? 5,
    };
    setSettings(s);

    const records: CycleRecord[] = (cycles ?? []).map((c) => ({ startDate: c.start_date, cycleLength: c.cycle_length, periodLength: c.period_length }));
    setPrediction(predictCycle(records, s));

    const map: Record<string, { hasPeriod?: boolean; hasLog?: boolean }> = {};
    (logs ?? []).forEach((l) => {
      map[l.log_date] = { hasLog: true, hasPeriod: l.flow_intensity && l.flow_intensity !== "none" };
    });
    setLoggedDates(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !prediction) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-base dark:bg-base-dark">
        <p className="text-ink-muted dark:text-ink-muted-dark font-body">Loading your cycle…</p>
      </main>
    );
  }

  const fertility = getDayFertility(selectedDate, prediction, settings, prediction.lastPeriodStart);

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl">CycleWise</h1>
        <button
          onClick={() => setShowModal(true)}
          className="neo-btn px-5 py-2.5 font-medium bg-gradient-to-br from-rose to-violet text-white"
        >
          + Log today
        </button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <CycleDial prediction={prediction} cycleLength={settings.avgCycleLength} />
          <div className="neo-card p-6 space-y-3">
            <h3 className="font-display text-lg">Overview</h3>
            <Stat label="Next period" value={new Date(prediction.nextPeriodStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
            <Stat label="Ovulation" value={new Date(prediction.ovulationDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
            <Stat label="Avg cycle length" value={`${prediction.cycleLengthUsed} days`} />
            <Stat label="Prediction confidence" value={prediction.confidence} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Calendar
            prediction={prediction}
            settings={settings}
            loggedDates={loggedDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <DailyInsight fertility={fertility} />
        </div>
      </section>

      {showModal && (
        <LogPeriodModal date={selectedDate} onClose={() => setShowModal(false)} onSaved={loadData} />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-muted dark:text-ink-muted-dark">{label}</span>
      <span className="font-mono text-sm capitalize">{value}</span>
    </div>
  );
}
