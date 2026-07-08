"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      setDisplayName(profile?.display_name ?? "");
      setLoading(false);
    })();
  }, [supabase, router]);

  const changePassword = async () => {
    setPwMessage(null);
    setPwError(null);
    if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwError("Passwords don't match."); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) setPwError(error.message);
    else {
      setPwMessage("Password updated.");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Pulls everything tied to the user and offers it as a downloadable JSON file.
  const downloadData = async () => {
    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: cycles }, { data: logs }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("cycles").select("*").eq("user_id", user.id),
        supabase.from("daily_logs").select("*").eq("user_id", user.id),
      ]);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        account_email: user.email,
        profile,
        cycles,
        daily_logs: logs,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cyclewise-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // Permanently deletes all of the user's rows, then signs them out.
  // Note: this does NOT delete the auth.users row itself (that requires the
  // service_role key server-side — see docs/SETUP_GUIDE.md for wiring up an
  // admin Edge Function for full account deletion). This removes all health
  // data immediately, which is the sensitive part.
  const deleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("daily_logs").delete().eq("user_id", user.id);
      await supabase.from("cycles").delete().eq("user_id", user.id);
      await supabase.from("settings").delete().eq("user_id", user.id);
      // profiles row cascades from auth.users, left in place until the
      // account itself is removed server-side; onboarding_complete stays
      // true so a re-login doesn't re-trigger onboarding unexpectedly.

      await supabase.auth.signOut();
      router.push("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
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
        <h1 className="font-display text-3xl mb-2">Profile</h1>

        <div className="neo-card p-6 space-y-2">
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark">Signed in as</p>
          <p className="font-medium">{email}</p>
          {displayName && <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{displayName}</p>}
        </div>

        <div className="neo-card p-6 space-y-4">
          <h2 className="font-display text-lg">Change password</h2>
          <input
            type="password" placeholder="New password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
          />
          <input
            type="password" placeholder="Confirm new password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-ink-muted/30 focus:border-violet"
          />
          {pwError && <p className="text-sm text-rose">{pwError}</p>}
          {pwMessage && <p className="text-sm text-sage">{pwMessage}</p>}
          <button onClick={changePassword} disabled={pwSaving} className="neo-btn px-5 py-2.5 text-sm font-medium bg-gradient-to-br from-rose to-violet text-white disabled:opacity-60">
            {pwSaving ? "Saving…" : "Update password"}
          </button>
        </div>

        <div className="neo-card p-6 space-y-3">
          <h2 className="font-display text-lg">Your data</h2>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Download everything you've logged as a JSON file.</p>
          <button onClick={downloadData} disabled={exporting} className="neo-btn px-5 py-2.5 text-sm font-medium disabled:opacity-60">
            {exporting ? "Preparing…" : "Download my data"}
          </button>
        </div>

        <div className="neo-card p-6 space-y-3">
          <h2 className="font-display text-lg">Session</h2>
          <button onClick={logout} className="neo-btn px-5 py-2.5 text-sm font-medium">
            Log out
          </button>
        </div>

        <div className="neo-card p-6 space-y-3 border border-rose/30">
          <h2 className="font-display text-lg text-rose">Delete account</h2>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            This permanently deletes all your cycle and log data. This cannot be undone. Type <strong>DELETE</strong> to confirm.
          </p>
          <input
            type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="neo-inset-sm rounded-neo w-full p-3 bg-transparent outline-none border border-rose/30"
          />
          {deleteError && <p className="text-sm text-rose">{deleteError}</p>}
          <button
            onClick={deleteAccount}
            disabled={deleteConfirmText !== "DELETE" || deleting}
            className="neo-btn px-5 py-2.5 text-sm font-medium bg-rose text-white disabled:opacity-40"
          >
            {deleting ? "Deleting…" : "Permanently delete my data"}
          </button>
        </div>
      </main>
    </div>
  );
}
