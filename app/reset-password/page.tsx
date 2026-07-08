"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase fires a PASSWORD_RECOVERY auth event once it's processed the
    // token from the emailed link's URL fragment, which establishes a
    // temporary session that updateUser() below can use.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also check immediately in case the event already fired before mount.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) setError(error.message);
    else {
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    }
  };

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-sm p-8 space-y-6 text-center">
        <h1 className="font-display text-2xl">Choose a new password</h1>

        {!ready && !done && (
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            Waiting for the reset link to verify… if this doesn't update within a few seconds, the link may have
            expired — request a new one from the <a href="/forgot-password" className="text-violet">forgot password</a> page.
          </p>
        )}

        {ready && !done && (
          <form onSubmit={submit} className="space-y-4 text-left">
            <input
              type="password" required minLength={8} placeholder="New password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
            />
            <input
              type="password" required minLength={8} placeholder="Confirm new password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
            />
            {error && <p className="text-sm text-rose">{error}</p>}
            <button type="submit" disabled={saving} className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
              {saving ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        {done && <p className="text-sm text-sage">Password updated — taking you to your dashboard…</p>}
      </div>
    </main>
  );
}
