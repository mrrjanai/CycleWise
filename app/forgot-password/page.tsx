"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-sm p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl">Reset your password</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            We'll send a reset link to your email.
          </p>
        </div>

        {sent ? (
          <p className="text-sm text-center text-ink-muted dark:text-ink-muted-dark neo-inset rounded-neo p-4">
            Check your inbox at {email} — click the link to choose a new password. It expires after a while, so use it soon.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1 block">Email</label>
              <input
                id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
              />
            </div>
            {error && <p className="text-sm text-rose" role="alert">{error}</p>}
            <button type="submit" disabled={loading} className="neo-btn w-full py-3 font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login" className="text-sm text-violet w-full text-center block">Back to sign in</Link>
      </div>
    </main>
  );
}
