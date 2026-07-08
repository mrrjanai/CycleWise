"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { hashPin, isUnlockedThisSession, markUnlockedThisSession } from "@/lib/pinLock";

/**
 * Wrap any authenticated page's content with <PinGate>{children}</PinGate>.
 * If the user has app_pin_enabled = true and hasn't unlocked yet this
 * session, it shows a full-screen PIN prompt over the content. Renders
 * children immediately (no gate) if PIN lock is off or already unlocked.
 */
export default function PinGate({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isUnlockedThisSession()) { setChecking(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      const { data: profile } = await supabase.from("profiles").select("app_pin_enabled, app_pin_hash").eq("id", user.id).single();
      if (profile?.app_pin_enabled && profile.app_pin_hash) {
        setPinHash(profile.app_pin_hash);
        setLocked(true);
      }
      setChecking(false);
    })();
  }, [supabase]);

  const submit = async () => {
    setError(null);
    const attemptHash = await hashPin(entry);
    if (attemptHash === pinHash) {
      markUnlockedThisSession();
      setLocked(false);
    } else {
      setError("Incorrect PIN.");
      setEntry("");
    }
  };

  if (checking) return null;

  if (!locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-xs p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-full neo-inset flex items-center justify-center text-2xl text-violet mx-auto">◍</div>
        <h2 className="font-display text-xl">Enter your PIN</h2>
        <input
          type="password" inputMode="numeric" maxLength={4} autoFocus
          value={entry}
          onChange={(e) => setEntry(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && entry.length === 4 && submit()}
          className="neo-inset-sm rounded-neo w-full p-4 text-center text-2xl tracking-[0.5em] bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
          placeholder="••••"
        />
        {error && <p className="text-sm text-rose">{error}</p>}
        <button
          onClick={submit}
          disabled={entry.length !== 4}
          className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-50"
        >
          Unlock
        </button>
      </div>
    </div>
  );
}
