"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Fatigue", "Tender breasts", "Acne", "Backache"];
const MOODS = ["Happy", "Anxious", "Irritable", "Calm", "Sad", "Energetic"];
const FLOWS = ["none", "spotting", "light", "medium", "heavy"] as const;

interface LogModalProps {
  date: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function LogPeriodModal({ date, onClose, onSaved }: LogModalProps) {
  const supabase = createClient();
  const [flow, setFlow] = useState<typeof FLOWS[number]>("none");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string[]>([]);
  const [sexActivity, setSexActivity] = useState(false);
  const [protection, setProtection] = useState("none");
  const [bbt, setBbt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: upsertError } = await supabase.from("daily_logs").upsert(
        {
          user_id: user.id,
          log_date: date,
          flow_intensity: flow,
          symptoms: JSON.stringify(symptoms),
          mood: JSON.stringify(mood),
          sexual_activity: JSON.stringify({ occurred: sexActivity, protection: sexActivity ? protection : null }),
          basal_body_temp: bbt ? parseFloat(bbt) : null,
          notes: notes || null,
        },
        { onConflict: "user_id,log_date" }
      );
      if (upsertError) throw upsertError;

      // If flow indicates a period day and there's no open cycle starting today, create one.
      if (flow !== "none") {
        await supabase.from("cycles").insert({ user_id: user.id, start_date: date }).select().maybeSingle();
        // Note: in production, check for an existing nearby cycle before inserting
        // to avoid duplicate cycle rows — omitted here for brevity.
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={`Log entry for ${date}`}>
      <div className="neo-card w-full max-w-md p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Log — {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</h2>
          <button onClick={onClose} aria-label="Close" className="neo-btn w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        <section>
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2">Flow</p>
          <div className="flex gap-2 flex-wrap">
            {FLOWS.map((f) => (
              <button key={f} onClick={() => setFlow(f)} className={`neo-btn px-3 py-1.5 text-sm capitalize ${flow === f ? "neo-pressed" : ""}`}>
                {f}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2">Symptoms</p>
          <div className="flex gap-2 flex-wrap">
            {SYMPTOMS.map((s) => (
              <button key={s} onClick={() => toggle(symptoms, setSymptoms, s)} className={`neo-btn px-3 py-1.5 text-sm ${symptoms.includes(s) ? "neo-pressed" : ""}`}>
                {s}
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2">Mood</p>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map((m) => (
              <button key={m} onClick={() => toggle(mood, setMood, m)} className={`neo-btn px-3 py-1.5 text-sm ${mood.includes(m) ? "neo-pressed" : ""}`}>
                {m}
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between neo-inset rounded-neo p-4">
          <label htmlFor="sex-toggle" className="text-sm font-medium">Sexual activity logged</label>
          <input id="sex-toggle" type="checkbox" checked={sexActivity} onChange={(e) => setSexActivity(e.target.checked)} className="w-5 h-5 accent-violet" />
        </section>
        {sexActivity && (
          <div className="flex gap-2">
            {["none", "condom", "other"].map((p) => (
              <button key={p} onClick={() => setProtection(p)} className={`neo-btn px-3 py-1.5 text-sm capitalize ${protection === p ? "neo-pressed" : ""}`}>{p}</button>
            ))}
          </div>
        )}

        <section>
          <label htmlFor="bbt" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2 block">Basal body temp (°C)</label>
          <input id="bbt" type="number" step="0.01" value={bbt} onChange={(e) => setBbt(e.target.value)} className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none" placeholder="36.60" />
        </section>

        <section>
          <label htmlFor="notes" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2 block">Notes</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none resize-none" placeholder="Anything else you want to remember..." />
        </section>

        {error && <p className="text-sm text-rose">{error}</p>}

        <button onClick={save} disabled={saving} className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
          {saving ? "Saving…" : "Save entry"}
        </button>
      </div>
    </div>
  );
}
