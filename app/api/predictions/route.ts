import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { predictCycle, type CycleRecord } from "@/lib/predictions";

// GET /api/predictions — next period, ovulation, fertile window for the user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: cycles, error }] = await Promise.all([
    supabase.from("profiles").select("avg_cycle_length, avg_period_length, luteal_phase_length").eq("id", user.id).single(),
    supabase.from("cycles").select("start_date, cycle_length, period_length").eq("user_id", user.id).order("start_date", { ascending: false }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const records: CycleRecord[] = (cycles ?? []).map((c) => ({
    startDate: c.start_date,
    cycleLength: c.cycle_length,
    periodLength: c.period_length,
  }));

  const prediction = predictCycle(records, {
    avgCycleLength: profile?.avg_cycle_length ?? 28,
    lutealPhaseLength: profile?.luteal_phase_length ?? 14,
    avgPeriodLength: profile?.avg_period_length ?? 5,
  });

  return NextResponse.json({ prediction });
}
