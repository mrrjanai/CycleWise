import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { localDateISO, predictCycle } from "@/lib/predictions";
import { buildCycleModel, toCycleRecords, type DayLog } from "@/lib/insights";

const parse = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};

// GET /api/predictions?today=YYYY-MM-DD — next period, ovulation, fertile
// window for the user, using the same personalised model as the web app.
// Pass the client's local date as `today`; the server's clock may be in a
// different timezone.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayParam = new URL(request.url).searchParams.get("today");
  const today = todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : localDateISO();

  const [{ data: profile }, { data: cycles, error }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("avg_cycle_length, avg_period_length, luteal_phase_length").eq("id", user.id).single(),
    supabase.from("cycles").select("start_date").eq("user_id", user.id),
    supabase.from("daily_logs").select("log_date, flow_intensity, symptoms, mood, basal_body_temp, cervical_mucus, tests").eq("user_id", user.id),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const logs: DayLog[] = (rows ?? []).map((l) => ({
    date: l.log_date,
    flow: l.flow_intensity,
    symptoms: parse<string[]>(l.symptoms, []),
    mood: parse<string[]>(l.mood, []),
    bbt: l.basal_body_temp == null ? null : Number(l.basal_body_temp),
    mucus: l.cervical_mucus,
    tests: parse<{ type: string; result: string }[]>(l.tests, []),
  }));

  const model = buildCycleModel(
    (cycles ?? []).map((c) => c.start_date),
    logs,
    {
      avgCycleLength: profile?.avg_cycle_length ?? 28,
      lutealPhaseLength: profile?.luteal_phase_length ?? 14,
      avgPeriodLength: profile?.avg_period_length ?? 5,
    }
  );
  const prediction = predictCycle(toCycleRecords(model.history), model.settings, today, model.observed);

  return NextResponse.json({ prediction });
}
