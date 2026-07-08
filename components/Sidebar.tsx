"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◐" },
  { href: "/cycles", label: "Cycles", icon: "◷" },
  { href: "/profile", label: "Profile", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "◍" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <>
      {/* Mobile top bar with menu toggle */}
      <div className="md:hidden flex items-center justify-between p-4">
        <span className="font-display text-xl">CycleWise</span>
        <button onClick={() => setOpen(!open)} className="neo-btn w-10 h-10 flex items-center justify-center" aria-label="Toggle menu">
          {open ? "✕" : "☰"}
        </button>
      </div>

      <aside className={`
        ${open ? "block" : "hidden"} md:block
        w-full md:w-60 shrink-0 md:min-h-screen bg-surface dark:bg-surface-dark
        md:shadow-neo dark:md:shadow-neo-dark p-5 md:p-6
      `}>
        <div className="hidden md:block font-display text-2xl mb-8">CycleWise</div>

        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-neo text-sm font-medium transition-shadow ${
                  active ? "neo-inset text-violet" : "neo-btn text-ink dark:text-ink-dark"
                }`}
              >
                <span aria-hidden>{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-6 border-t border-ink-muted/20 space-y-2">
          <Link href="/terms" className="block px-4 py-2 text-xs text-ink-muted dark:text-ink-muted-dark hover:text-violet">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="block px-4 py-2 text-xs text-ink-muted dark:text-ink-muted-dark hover:text-violet">Privacy Policy</Link>
          <button onClick={logout} className="w-full text-left px-4 py-2 text-xs text-rose hover:underline">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
