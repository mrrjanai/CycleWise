import { createBrowserClient } from "@supabase/ssr";

// Reads NEXT_PUBLIC_ env vars — safe to expose, protected by RLS server-side.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
