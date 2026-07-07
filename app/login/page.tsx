"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else location.href = "/dashboard";
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/dashboard` },
      });
      setLoading(false);
      if (error) setError(error.message);
      // If email confirmation is off, Supabase returns a session immediately —
      // send the user straight into onboarding instead of "check your inbox".
      else if (data.session) location.href = "/onboarding";
      else setMagicSent(true);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/dashboard` } });
  };

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-3xl">CycleWise</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Your cycle, your data, your call.</p>
        </div>

        {magicSent ? (
          <p className="text-sm text-center text-ink-muted dark:text-ink-muted-dark neo-inset rounded-neo p-4">
            Check your inbox — we sent a confirmation link to {email}.
          </p>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Email</label>
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet" />
              </div>
              <div>
                <label htmlFor="password" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Password</label>
                <input id="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet" />
              </div>
              {error && <p className="text-sm text-rose" role="alert">{error}</p>}
              <button type="submit" disabled={loading} className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs text-ink-muted dark:text-ink-muted-dark">
              <div className="flex-1 h-px bg-ink-muted/20" /> or <div className="flex-1 h-px bg-ink-muted/20" />
            </div>

            <div className="space-y-2">
              <button onClick={() => handleOAuth("google")} className="neo-btn w-full py-2.5 text-sm font-medium">Continue with Google</button>
              <button onClick={() => handleOAuth("apple")} className="neo-btn w-full py-2.5 text-sm font-medium">Continue with Apple</button>
            </div>

            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-sm text-violet w-full text-center">
              {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
