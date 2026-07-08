"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hashPin, clearUnlock } from "@/lib/pinLock";
import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinStep, setPinStep] = useState<"idle" | "set" | "confirm">("idle");
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirmDraft, setPinConfirmDraft] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  useEffect(() => {
    // Dark mode: reflect + persist via the `dark` class on <html>, using
    // localStorage so it's remembered without needing a DB round trip.
    const stored = localStorage.getItem("cyclewise:theme");
    const isDark = stored === "dark";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("app_pin_enabled").eq("id", user.id).single();
      setPinEnabled(!!profile?.app_pin_enabled);
      setLoading(false);
    })();
  }, [supabase, router]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("cyclewise:theme", next ? "dark" : "light");
  };

  const startSetPin = () => {
    setPinStep("set");
    setPinDraft("");
    setPinConfirmDraft("");
    setPinError(null);
  };

  const confirmFirstPin = () => {
    if (pinDraft.length !== 4) { setPinError("PIN must be 4 digits."); return; }
    setPinStep("confirm");
    setPinError(null);
  };

  const savePin = async () => {
    if (pinConfirmDraft !== pinDraft) { setPinError("PINs don't match."); return; }
    setPinSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const hash = await hashPin(pinDraft);
    await supabase.from("profiles").update({ app_pin_hash: hash, app_pin_enabled: true }).eq("id", user.id);
    setPinEnabled(true);
    setPinStep("idle");
    setPinSaving(false);
  };

  const removePin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ app_pin_hash: null, app_pin_enabled: false }).eq("id", user.id);
    clearUnlock();
    setPinEnabled(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-base dark:bg-base-dark">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-ink-muted dark:text-ink-muted-dark">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-base dark:bg-base-dark">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6">
        <h1 className="font-display text-3xl">Settings</h1>

        <div className="neo-card p-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg">Dark mode</h2>
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Switch between light and dark appearance.</p>
          </div>
          <button
            onClick={toggleDarkMode}
            aria-pressed={darkMode}
            className={`w-14 h-8 rounded-full relative transition-colors ${darkMode ? "bg-violet" : "bg-ink-muted/30"}`}
          >
            <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${darkMode ? "translate-x-7" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="neo-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg">App PIN lock</h2>
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
                Require a 4-digit PIN once per login before your data is shown on this device.
              </p>
            </div>
          </div>

          {pinEnabled && pinStep === "idle" && (
            <div className="flex gap-2">
              <button onClick={startSetPin} className="neo-btn px-4 py-2 text-sm">Change PIN</button>
              <button onClick={removePin} className="neo-btn px-4 py-2 text-sm text-rose">Turn off PIN</button>
            </div>
          )}
          {!pinEnabled && pinStep === "idle" && (
            <button onClick={startSetPin} className="neo-btn px-4 py-2 text-sm font-medium bg-gradient-to-br from-rose to-violet text-white">
              Set up a PIN
            </button>
          )}

          {pinStep === "set" && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark block">Choose a 4-digit PIN</label>
              <input
                type="password" inputMode="numeric" maxLength={4} value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ""))}
                className="neo-inset-sm rounded-neo w-32 p-3 text-center text-xl tracking-widest bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
              />
              {pinError && <p className="text-sm text-rose">{pinError}</p>}
              <div className="flex gap-2">
                <button onClick={confirmFirstPin} disabled={pinDraft.length !== 4} className="neo-btn px-4 py-2 text-sm disabled:opacity-50">Next</button>
                <button onClick={() => setPinStep("idle")} className="neo-btn px-4 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {pinStep === "confirm" && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark block">Confirm your PIN</label>
              <input
                type="password" inputMode="numeric" maxLength={4} value={pinConfirmDraft}
                onChange={(e) => setPinConfirmDraft(e.target.value.replace(/\D/g, ""))}
                className="neo-inset-sm rounded-neo w-32 p-3 text-center text-xl tracking-widest bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
              />
              {pinError && <p className="text-sm text-rose">{pinError}</p>}
              <div className="flex gap-2">
                <button onClick={savePin} disabled={pinSaving || pinConfirmDraft.length !== 4} className="neo-btn px-4 py-2 text-sm font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-50">
                  {pinSaving ? "Saving…" : "Save PIN"}
                </button>
                <button onClick={() => setPinStep("idle")} className="neo-btn px-4 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
