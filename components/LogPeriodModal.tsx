"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LoggedEntry } from "@/components/DailyInsight";

const SYMPTOMS = ["Cramps", "Headache", "Bloating", "Fatigue", "Tender breasts", "Acne", "Backache"];
const MOODS = ["Happy", "Anxious", "Irritable", "Calm", "Sad", "Energetic"];
// "none" removed — a day with no flow selected simply isn't a period day.
// Tap a selected flow again to deselect it (e.g. to undo a mistaken entry).
const FLOWS = ["spotting", "light", "medium", "heavy"] as const;

interface LogModalProps {
  date: string;
  existingEntry?: LoggedEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function LogPeriodModal({ date, existingEntry, onClose, onSaved }: LogModalProps) {
  const supabase = createClient();
  const initialFlow = existingEntry?.flow_intensity && existingEntry.flow_intensity !== "none"
    ? (existingEntry.flow_intensity as typeof FLOWS[number])
    : null;

  const [flow, setFlow] = useState<typeof FLOWS[number] | null>(initialFlow);
  const [symptoms, setSymptoms] = useState<string[]>(existingEntry?.symptoms ?? []);
  const [mood, setMood] = useState<string[]>(existingEntry?.mood ?? []);
  const [otherSymptomInput, setOtherSymptomInput] = useState("");
  const [otherMoodInput, setOtherMoodInput] = useState("");
  const [showOtherSymptom, setShowOtherSymptom] = useState(false);
  const [showOtherMood, setShowOtherMood] = useState(false);
  const [sexActivity, setSexActivity] = useState(!!existingEntry?.sexual_activity?.occurred);
  const [protection, setProtection] = useState(existingEntry?.sexual_activity?.protection || "none");
  const [bbt, setBbt] = useState(existingEntry?.basal_body_temp ? String(existingEntry.basal_body_temp) : "");
  const [notes, setNotes] = useState(existingEntry?.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const addOther = (
    value: string,
    list: string[],
    set: (v: string[]) => void,
    clearInput: () => void,
    hideInput: () => void
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!list.includes(trimmed)) set([...list, trimmed]);
    clearInput();
    hideInput();
  };

  const hasExistingRow = !!existingEntry && (
    existingEntry.flow_intensity ||
    (existingEntry.symptoms && existingEntry.symptoms.length > 0) ||
    (existingEntry.mood && existingEntry.mood.length > 0) ||
    existingEntry.sexual_activity?.occurred ||
    existingEntry.basal_body_temp ||
    existingEntry.notes
  );

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
          flow_intensity: flow, // null when no flow selected — no "none" string anymore
          symptoms: JSON.stringify(symptoms),
          mood: JSON.stringify(mood),
          sexual_activity: JSON.stringify({ occurred: sexActivity, protection: sexActivity ? protection : null }),
          basal_body_temp: bbt ? parseFloat(bbt) : null,
          notes: notes || null,
        },
        { onConflict: "user_id,log_date" }
      );
      if (upsertError) throw upsertError;

      // Only create a new cycle row the first time flow is set for this date.
      if (flow && !initialFlow) {
        await supabase.from("cycles").insert({ user_id: user.id, start_date: date }).select().maybeSingle();
        // Note: in production, check for an existing nearby cycle before inserting
        // to avoid duplicate cycle rows — omitted here for brevity.
      }
      // If the user removed a flow that used to mark a period start, clean up
      // the matching cycle row so predictions don't stay anchored to it.
      if (!flow && initialFlow) {
        await supabase.from("cycles").delete().eq("user_id", user.id).eq("start_date", date);
      }

      setSaved(true);
      onSaved();
      setTimeout(() => onClose(), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async () => {
    if (!confirm(`Delete everything logged for ${new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      await supabase.from("daily_logs").delete().eq("user_id", user.id).eq("log_date", date);
      // Best-effort: also remove a cycle row that started on this exact date,
      // e.g. if this was logged as a period start by mistake.
      await supabase.from("cycles").delete().eq("user_id", user.id).eq("start_date", date);

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this entry. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={`Log entry for ${date}`}>
      <div className="neo-card w-full max-w-md p-6 space-y-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Log — {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</h2>
          <button onClick={onClose} aria-label="Close" className="neo-btn w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {saved ? (
          <div className="neo-inset rounded-neo p-8 flex flex-col items-center gap-2 text-center">
            <span className="text-3xl">✓</span>
            <p className="font-display text-lg">Saved</p>
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
              Your entry for {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} was recorded.
            </p>
          </div>
        ) : (
          <>
            <section>
              <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2">
                Flow {flow && <span className="normal-case text-ink-muted dark:text-ink-muted-dark">(tap again to clear)</span>}
              </p>
              <div className="flex gap-2 flex-wrap">
                {FLOWS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFlow(flow === f ? null : f)}
                    className={`neo-btn px-3 py-1.5 text-sm capitalize ${flow === f ? "neo-pressed" : ""}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {!flow && <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1.5">No flow selected — not a period day.</p>}
            </section>

            <section>
              <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2">Symptoms</p>
              <div className="flex gap-2 flex-wrap">
                {SYMPTOMS.map((s) => (
                  <button key={s} onClick={() => toggle(symptoms, setSymptoms, s)} className={`neo-btn px-3 py-1.5 text-sm ${symptoms.includes(s) ? "neo-pressed" : ""}`}>
                    {s}
                  </button>
                ))}
                {symptoms.filter((s) => !SYMPTOMS.includes(s)).map((custom) => (
                  <button key={custom} onClick={() => toggle(symptoms, setSymptoms, custom)} className="neo-btn neo-pressed px-3 py-1.5 text-sm">
                    {custom} ✕
                  </button>
                ))}
                <button onClick={() => setShowOtherSymptom(true)} className="neo-btn px-3 py-1.5 text-sm">+ Other</button>
              </div>
              {showOtherSymptom && (
                <div className="flex gap-2 mt-2">
                  <input
                    autoFocus type="text" value={otherSymptomInput}
                    onChange={(e) => setOtherSymptomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addOther(otherSymptomInput, symptoms, setSymptoms, () => setOtherSymptomInput(""), () => setShowOtherSymptom(false))}
                    placeholder="Describe a symptom..."
                    className="neo-inset-sm rounded-neo flex-1 p-2.5 text-sm bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
                  />
                  <button
                    onClick={() => addOther(otherSymptomInput, symptoms, setSymptoms, () => setOtherSymptomInput(""), () => setShowOtherSymptom(false))}
                    className="neo-btn px-3 py-1.5 text-sm"
                  >Add</button>
                </div>
              )}
            </section>

            <section>
              <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2">Mood</p>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map((m) => (
                  <button key={m} onClick={() => toggle(mood, setMood, m)} className={`neo-btn px-3 py-1.5 text-sm ${mood.includes(m) ? "neo-pressed" : ""}`}>
                    {m}
                  </button>
                ))}
                {mood.filter((m) => !MOODS.includes(m)).map((custom) => (
                  <button key={custom} onClick={() => toggle(mood, setMood, custom)} className="neo-btn neo-pressed px-3 py-1.5 text-sm">
                    {custom} ✕
                  </button>
                ))}
                <button onClick={() => setShowOtherMood(true)} className="neo-btn px-3 py-1.5 text-sm">+ Other</button>
              </div>
              {showOtherMood && (
                <div className="flex gap-2 mt-2">
                  <input
                    autoFocus type="text" value={otherMoodInput}
                    onChange={(e) => setOtherMoodInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addOther(otherMoodInput, mood, setMood, () => setOtherMoodInput(""), () => setShowOtherMood(false))}
                    placeholder="Describe a mood..."
                    className="neo-inset-sm rounded-neo flex-1 p-2.5 text-sm bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
                  />
                  <button
                    onClick={() => addOther(otherMoodInput, mood, setMood, () => setOtherMoodInput(""), () => setShowOtherMood(false))}
                    className="neo-btn px-3 py-1.5 text-sm"
                  >Add</button>
                </div>
              )}
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
              <input id="bbt" type="number" step="0.01" value={bbt} onChange={(e) => setBbt(e.target.value)} className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/25" placeholder="36.60" />
            </section>

            <section>
              <label htmlFor="notes" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-2 block">Notes</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none resize-none border border-ink-muted/25" placeholder="Anything else you want to remember..." />
            </section>

            {error && <p className="text-sm text-rose">{error}</p>}

            <button onClick={save} disabled={saving || deleting} className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save entry"}
            </button>

            {hasExistingRow && (
              <button
                onClick={deleteEntry}
                disabled={saving || deleting}
                className="w-full py-2.5 text-sm text-rose underline disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete this day's log"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
