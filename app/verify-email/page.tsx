"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function VerifyEmailContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const resend = async () => {
    if (!email || cooldown > 0) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setLoading(false);
    if (error) setError(error.message);
    else {
      setResent(true);
      setCooldown(30);
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    }
  };

  return (
    <main className="min-h-screen bg-base dark:bg-base-dark flex items-center justify-center p-4">
      <div className="neo-card w-full max-w-sm p-8 space-y-6 text-center">
        <div className="w-14 h-14 rounded-full neo-inset flex items-center justify-center text-2xl text-violet mx-auto">✉</div>
        <h1 className="font-display text-2xl">Confirm your email</h1>
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
          {email ? <>We sent a confirmation link to <strong>{email}</strong>.</> : "Check your inbox for a confirmation link."}
          {" "}Click it to activate your account, then come back and sign in.
        </p>

        {error && <p className="text-sm text-rose">{error}</p>}
        {resent && cooldown > 0 && <p className="text-sm text-sage">Email resent — check your inbox.</p>}

        <button
          onClick={resend}
          disabled={loading || cooldown > 0 || !email}
          className="neo-btn w-full py-3 font-medium disabled:opacity-50"
        >
          {loading ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}
        </button>

        <Link href="/login" className="text-sm text-violet w-full text-center block">Back to sign in</Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
