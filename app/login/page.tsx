"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Social sign-in buttons to show. Empty until the providers are enabled in
 * Supabase → Authentication → Providers (each needs a client ID/secret from
 * Google Cloud / Apple Developer). Add "google" and/or "apple" here then.
 */
const OAUTH_PROVIDERS: ("google" | "apple")[] = [];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  // Set by /auth/callback when an email link was confirmed but couldn't sign
  // the user in (e.g. opened in another browser), or when it failed.
  const confirmed = searchParams.get("confirmed") === "1";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);

  // Full page loads (location.assign) on purpose after auth: they guarantee the
  // new session cookie is sent with the next request, so proxy.ts sees it.
  /* eslint-disable @next/next/no-location-assign-relative-destination */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else window.location.assign("/dashboard");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
      });
      setLoading(false);
      if (error) setError(error.message);
      // If email confirmation is off, Supabase returns a session immediately —
      // send the user straight into onboarding instead of the verify-email page.
      else if (data.session) window.location.assign("/onboarding");
      else window.location.assign(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  /* eslint-enable @next/next/no-location-assign-relative-destination */

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback?next=/dashboard` } });
    if (error) setError(error.message);
  };

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-3xl">CycleWise</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Your cycle, your data, your call.</p>
        </div>

        {confirmed && (
          <p className="neo-inset rounded-neo p-3 text-sm text-center" role="status">
            Your email is confirmed. Sign in to continue.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark block">Password</label>
              {mode === "signin" && <Link href="/forgot-password" className="text-xs text-violet">Forgot password?</Link>}
            </div>
            <input id="password" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet" />
          </div>
          {error && <p className="text-sm text-rose" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="neo-btn w-full py-3 font-medium sk-primary disabled:opacity-60">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {OAUTH_PROVIDERS.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-xs text-ink-muted dark:text-ink-muted-dark">
              <div className="flex-1 h-px bg-ink-muted/20" /> or <div className="flex-1 h-px bg-ink-muted/20" />
            </div>

            <div className="space-y-2">
              {OAUTH_PROVIDERS.map((p) => (
                <button key={p} onClick={() => handleOAuth(p)} className="neo-btn w-full py-2.5 text-sm font-medium">
                  Continue with {p === "google" ? "Google" : "Apple"}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-sm text-violet w-full text-center">
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
