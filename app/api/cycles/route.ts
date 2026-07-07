import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/cycles — list the current user's cycles (most recent first)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("cycles")
    .select("*")
    .eq("user_id", user.id)
    .order("start_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ cycles: data });
}

// POST /api/cycles — log a new period start (creates a new cycle row)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { start_date, end_date, notes } = body;

  if (!start_date) {
    return NextResponse.json({ error: "start_date is required" }, { status: 422 });
  }

  const period_length = end_date
    ? Math.round((new Date(end_date).getTime() - new Date(start_date).getTime()) / 86_400_000) + 1
    : null;

  const { data, error } = await supabase
    .from("cycles")
    .insert({ user_id: user.id, start_date, end_date, period_length, notes })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ cycle: data }, { status: 201 });
}
