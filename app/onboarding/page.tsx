"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CYCLE_LENGTH_OPTIONS = [21, 28, 35] as const;
const PERIOD_LENGTH_OPTIONS = [2, 3, 4, 5, 6, 7] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [lastPeriodStart, setLastPeriodStart] = useState("");
  const [lastPeriodEnd, setLastPeriodEnd] = useState("");

  const [cycleLengthChoice, setCycleLengthChoice] = useState<number | "other" | null>(null);
  const [cycleLengthOther, setCycleLengthOther] = useState("");

  const [regularity, setRegularity] = useState<"regular" | "irregular" | null>(null);

  const [periodLengthChoice, setPeriodLengthChoice] = useState<number | "other" | null>(null);
  const [periodLengthOther, setPeriodLengthOther] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedCycleLength = cycleLengthChoice === "other" ? parseInt(cycleLengthOther, 10) : cycleLengthChoice;
  const resolvedPeriodLength = periodLengthChoice === "other" ? parseInt(periodLengthOther, 10) : periodLengthChoice;

  const canSubmit =
    !!lastPeriodStart &&
    !!resolvedCycleLength && resolvedCycleLength >= 15 && resolvedCycleLength <= 60 &&
    !!regularity &&
    !!resolvedPeriodLength && resolvedPeriodLength >= 1 && resolvedPeriodLength <= 14;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // 1. Log the last period as the user's first cycle record.
      const period_length = lastPeriodEnd
        ? Math.round((new Date(lastPeriodEnd).getTime() - new Date(lastPeriodStart).getTime()) / 86_400_000) + 1
        : resolvedPeriodLength;

      const { error: cycleError } = await supabase.from("cycles").insert({
        user_id: user.id,
        start_date: lastPeriodStart,
        end_date: lastPeriodEnd || null,
        period_length,
      });
      if (cycleError) throw cycleError;

      // 2. Also record it as a daily_logs entry for that start day, so it
      // shows up consistently with anything logged later through the modal.
      await supabase.from("daily_logs").upsert(
        {
          user_id: user.id,
          log_date: lastPeriodStart,
          flow_intensity: "medium",
          symptoms: "[]",
          mood: "[]",
        },
        { onConflict: "user_id,log_date" }
      );

      // 3. Save the user's stated averages + regularity, mark onboarding done.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avg_cycle_length: resolvedCycleLength,
          avg_period_length: resolvedPeriodLength,
          cycle_regularity: regularity,
          onboarding_complete: true,
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-lg p-8 space-y-7">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl">Let's set up your cycle</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            A few quick questions so predictions start out accurate. You can always adjust these later in Settings.
          </p>
        </div>

        {/* Question 1: last period start/end */}
        <section className="space-y-2">
          <p className="text-sm font-medium">When was your last period?</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="lp-start" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Start date</label>
              <input
                id="lp-start" type="date" required max={todayISO()}
                value={lastPeriodStart} onChange={(e) => setLastPeriodStart(e.target.value)}
                className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
              />
            </div>
            <div>
              <label htmlFor="lp-end" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">End date (optional)</label>
              <input
                id="lp-end" type="date" max={todayISO()} min={lastPeriodStart || undefined}
                value={lastPeriodEnd} onChange={(e) => setLastPeriodEnd(e.target.value)}
                className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
              />
            </div>
          </div>
        </section>

        {/* Question 2: average cycle length */}
        <section className="space-y-2">
          <p className="text-sm font-medium">What is your average cycle length?</p>
          <div className="flex gap-2 flex-wrap">
            {CYCLE_LENGTH_OPTIONS.map((n) => (
              <button key={n} onClick={() => setCycleLengthChoice(n)}
                className={`neo-btn px-4 py-2 text-sm ${cycleLengthChoice === n ? "neo-pressed" : ""}`}>
                {n} days
              </button>
            ))}
            <button onClick={() => setCycleLengthChoice("other")}
              className={`neo-btn px-4 py-2 text-sm ${cycleLengthChoice === "other" ? "neo-pressed" : ""}`}>
              Other
            </button>
          </div>
          {cycleLengthChoice === "other" && (
            <input
              type="number" min={15} max={60} placeholder="Enter number of days (15–60)"
              value={cycleLengthOther} onChange={(e) => setCycleLengthOther(e.target.value)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
            />
          )}
        </section>

        {/* Question 3: regularity */}
        <section className="space-y-2">
          <p className="text-sm font-medium">Are your periods regular or irregular?</p>
          <div className="flex gap-2">
            <button onClick={() => setRegularity("regular")}
              className={`neo-btn px-4 py-2 text-sm flex-1 ${regularity === "regular" ? "neo-pressed" : ""}`}>
              Regular
            </button>
            <button onClick={() => setRegularity("irregular")}
              className={`neo-btn px-4 py-2 text-sm flex-1 ${regularity === "irregular" ? "neo-pressed" : ""}`}>
              Irregular
            </button>
          </div>
        </section>

        {/* Question 4: average period length */}
        <section className="space-y-2">
          <p className="text-sm font-medium">What is your average period length?</p>
          <div className="flex gap-2 flex-wrap">
            {PERIOD_LENGTH_OPTIONS.map((n) => (
              <button key={n} onClick={() => setPeriodLengthChoice(n)}
                className={`neo-btn px-4 py-2 text-sm ${periodLengthChoice === n ? "neo-pressed" : ""}`}>
                {n} days
              </button>
            ))}
            <button onClick={() => setPeriodLengthChoice("other")}
              className={`neo-btn px-4 py-2 text-sm ${periodLengthChoice === "other" ? "neo-pressed" : ""}`}>
              Other
            </button>
          </div>
          {periodLengthChoice === "other" && (
            <input
              type="number" min={1} max={14} placeholder="Enter number of days (1–14)"
              value={periodLengthOther} onChange={(e) => setPeriodLengthOther(e.target.value)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
            />
          )}
        </section>

        {error && <p className="text-sm text-rose">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-50"
        >
          {saving ? "Setting up…" : "Continue to my dashboard"}
        </button>
      </div>
    </main>
  );
}
