import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/logs?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase.from("daily_logs").select("*").eq("user_id", user.id);
  if (from) query = query.gte("log_date", from);
  if (to) query = query.lte("log_date", to);

  const { data, error } = await query.order("log_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ logs: data });
}

// POST /api/logs — upsert a day's log (one row per user per date)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.log_date) {
    return NextResponse.json({ error: "log_date is required" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("daily_logs")
    .upsert({ ...body, user_id: user.id }, { onConflict: "user_id,log_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ log: data }, { status: 200 });
}
