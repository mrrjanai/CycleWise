"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { predictCycle, getDayFertility, CycleRecord, CyclePrediction, UserFertilitySettings } from "@/lib/predictions";
import CycleDial from "@/components/CycleDial";
import Calendar from "@/components/Calendar";
import DailyInsight, { LoggedEntry } from "@/components/DailyInsight";
import LogPeriodModal from "@/components/LogPeriodModal";

const todayISO = () => new Date().toISOString().slice(0, 10);

// Full row shape returned from daily_logs (jsonb columns arrive as strings
// unless the client parses them, so we normalize on read).
interface DailyLogRow {
  log_date: string;
  flow_intensity: string | null;
  symptoms: string | string[] | null;
  mood: string | string[] | null;
  sexual_activity: string | { occurred?: boolean; protection?: string | null } | null;
  basal_body_temp: number | null;
  notes: string | null;
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [settings, setSettings] = useState<UserFertilitySettings>({ avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 });
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [loggedDates, setLoggedDates] = useState<Record<string, { hasPeriod?: boolean; hasLog?: boolean }>>({});
  const [logsByDate, setLogsByDate] = useState<Record<string, LoggedEntry>>({});
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, { data: cycles }, { data: logs }] = await Promise.all([
      supabase.from("profiles").select("avg_cycle_length, avg_period_length, luteal_phase_length, onboarding_complete").eq("id", user.id).single(),
      supabase.from("cycles").select("start_date, cycle_length, period_length").eq("user_id", user.id).order("start_date", { ascending: false }),
      supabase
        .from("daily_logs")
        .select("log_date, flow_intensity, symptoms, mood, sexual_activity, basal_body_temp, notes")
        .eq("user_id", user.id)
        .returns<DailyLogRow[]>(),
    ]);

    if (profile && profile.onboarding_complete === false) {
      router.push("/onboarding");
      return;
    }

    const s: UserFertilitySettings = {
      avgCycleLength: profile?.avg_cycle_length ?? 28,
      lutealPhaseLength: profile?.luteal_phase_length ?? 14,
      avgPeriodLength: profile?.avg_period_length ?? 5,
    };
    setSettings(s);

    const records: CycleRecord[] = (cycles ?? []).map((c) => ({ startDate: c.start_date, cycleLength: c.cycle_length, periodLength: c.period_length }));
    setPrediction(predictCycle(records, s));

    const map: Record<string, { hasPeriod?: boolean; hasLog?: boolean }> = {};
    const entryMap: Record<string, LoggedEntry> = {};
    (logs ?? []).forEach((l) => {
      map[l.log_date] = { hasLog: true, hasPeriod: !!(l.flow_intensity && l.flow_intensity !== "none") };
      entryMap[l.log_date] = {
        flow_intensity: l.flow_intensity,
        symptoms: parseJsonField<string[]>(l.symptoms, []),
        mood: parseJsonField<string[]>(l.mood, []),
        sexual_activity: parseJsonField<{ occurred?: boolean; protection?: string | null }>(l.sexual_activity, { occurred: false }),
        basal_body_temp: l.basal_body_temp,
        notes: l.notes,
      };
    });
    setLoggedDates(map);
    setLogsByDate(entryMap);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !prediction) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-base dark:bg-base-dark">
        <p className="text-ink-muted dark:text-ink-muted-dark font-body">Loading your cycle…</p>
      </main>
    );
  }

  const fertility = getDayFertility(selectedDate, prediction, settings, prediction.lastPeriodStart);
  const isToday = selectedDate === todayISO();
  const logButtonLabel = isToday
    ? "+ Log today"
    : `+ Log ${new Date(selectedDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark p-4 sm:p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl">CycleWise</h1>
        <button
          onClick={() => setShowModal(true)}
          className="neo-btn px-5 py-2.5 font-medium bg-gradient-to-br from-rose to-violet text-white"
        >
          {logButtonLabel}
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
          {/* Tap any day above (past or future) to select it — the insight
              panel and "+ Log" button below always act on the selected
              day, not necessarily today. */}
          <DailyInsight fertility={fertility} loggedEntry={logsByDate[selectedDate] ?? null} />
        </div>
      </section>

      {showModal && (
        <LogPeriodModal
          date={selectedDate}
          existingEntry={logsByDate[selectedDate] ?? null}
          onClose={() => setShowModal(false)}
          onSaved={loadData}
        />
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
