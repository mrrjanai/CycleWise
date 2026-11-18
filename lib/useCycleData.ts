"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildCycleModel, toCycleRecords, type CycleModel, type DayLog } from "@/lib/insights";
import { localDateISO, predictCycle, type CyclePrediction, type UserFertilitySettings } from "@/lib/predictions";
import type { LoggedEntry } from "@/components/DailyInsight";

export type TrackingGoal = "general" | "conceive" | "avoid_pregnancy" | "contraception";

// Full row shape returned from daily_logs (jsonb columns may arrive as JSON
// strings, because the logging modal stores them stringified).
interface DailyLogRow {
  log_date: string;
  flow_intensity: string | null;
  symptoms: unknown;
  mood: unknown;
  sexual_activity: unknown;
  basal_body_temp: number | string | null;
  cervical_mucus: string | null;
  medications: unknown;
  tests: unknown;
  notes: string | null;
}

export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface CycleData {
  loading: boolean;
  model: CycleModel;
  prediction: CyclePrediction;
  logs: DayLog[];
  entries: Record<string, LoggedEntry>;
  /** The settings as stored on the profile (before learning from history). */
  profileSettings: UserFertilitySettings;
  goal: TrackingGoal;
  regularity: string | null;
  today: string;
  reload: () => Promise<void>;
}

const BASE: UserFertilitySettings = { avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 };
const EMPTY_MODEL: CycleModel = buildCycleModel([], [], BASE);

/**
 * Loads the signed-in user's profile, period starts and daily logs, and
 * derives the cycle model + prediction every page shares. Redirects to
 * /login when signed out, and to /onboarding when `requireOnboarded`.
 */
export function useCycleData({ requireOnboarded = false } = {}): CycleData {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState(BASE);
  const [starts, setStarts] = useState<string[]>([]);
  const [rows, setRows] = useState<DailyLogRow[]>([]);
  const [goal, setGoal] = useState<TrackingGoal>("general");
  const [regularity, setRegularity] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [{ data: profile }, { data: cycles }, { data: logs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("avg_cycle_length, avg_period_length, luteal_phase_length, onboarding_complete, tracking_goal, cycle_regularity")
        .eq("id", user.id)
        .single(),
      supabase.from("cycles").select("start_date").eq("user_id", user.id),
      supabase
        .from("daily_logs")
        .select("log_date, flow_intensity, symptoms, mood, sexual_activity, basal_body_temp, cervical_mucus, medications, tests, notes")
        .eq("user_id", user.id)
        .returns<DailyLogRow[]>(),
    ]);

    if (requireOnboarded && profile && profile.onboarding_complete === false) {
      router.push("/onboarding");
      return;
    }

    setBase({
      avgCycleLength: profile?.avg_cycle_length ?? 28,
      lutealPhaseLength: profile?.luteal_phase_length ?? 14,
      avgPeriodLength: profile?.avg_period_length ?? 5,
    });
    setGoal((profile?.tracking_goal as TrackingGoal) ?? "general");
    setRegularity(profile?.cycle_regularity ?? null);
    setStarts((cycles ?? []).map((c) => c.start_date));
    setRows(logs ?? []);
    setLoading(false);
  }, [supabase, router, requireOnboarded]);

  // Data fetch on mount: state is only set after the awaited queries resolve.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  const derived = useMemo(() => {
    const entries: Record<string, LoggedEntry> = {};
    const logs: DayLog[] = rows.map((l) => {
      const entry: LoggedEntry = {
        flow_intensity: l.flow_intensity,
        symptoms: parseJsonField<string[]>(l.symptoms, []),
        mood: parseJsonField<string[]>(l.mood, []),
        sexual_activity: parseJsonField<{ occurred?: boolean; protection?: string | null }>(l.sexual_activity, { occurred: false }),
        basal_body_temp: l.basal_body_temp == null ? null : Number(l.basal_body_temp),
        cervical_mucus: l.cervical_mucus,
        medications: parseJsonField<{ name: string; dose: string }[]>(l.medications, []),
        tests: parseJsonField<{ type: string; result: string }[]>(l.tests, []),
        notes: l.notes,
      };
      entries[l.log_date] = entry;
      return {
        date: l.log_date,
        flow: entry.flow_intensity,
        symptoms: entry.symptoms,
        mood: entry.mood,
        bbt: entry.basal_body_temp,
        mucus: entry.cervical_mucus,
        tests: entry.tests,
      };
    });

    const today = localDateISO();
    const model = loading ? EMPTY_MODEL : buildCycleModel(starts, logs, base);
    const prediction = predictCycle(toCycleRecords(model.history), model.settings, today, model.observed);
    return { entries, logs, model, prediction, today };
  }, [rows, starts, base, loading]);

  return { loading, goal, regularity, reload, profileSettings: base, ...derived };
}
