import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase sends people back to after confirming their email or
 * signing in with Google/Apple. It turns the one-time `code` (PKCE) or
 * `token_hash` (email template link) into a session cookie, then redirects
 * to `next`.
 *
 * This has to happen on an unprotected route: sending the link straight to
 * /dashboard made proxy.ts redirect the not-yet-signed-in visitor to /login
 * and drop the code, so the sign-in never completed.
 *
 * Add <site>/auth/callback to Supabase → Authentication → URL Configuration
 * → Redirect URLs (for both the Vercel domain and http://localhost:3000).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  // Only allow same-site relative paths, never an open redirect.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`);

  // Opening the confirmation link in a different browser can't finish the
  // sign-in (the PKCE verifier lives in the original browser), but Supabase
  // has already confirmed the email by this point, so ask them to sign in.
  const errorDescription = searchParams.get("error_description");
  const url = new URL("/login", origin);
  url.searchParams.set(errorDescription ? "error" : "confirmed", errorDescription ?? "1");
  return NextResponse.redirect(url);
}
