"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◐" },
  { href: "/cycles", label: "Cycles", icon: "◷" },
  { href: "/insights", label: "Insights", icon: "◈" },
  { href: "/report", label: "Doctor report", icon: "▤" },
  { href: "/profile", label: "Profile", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "◍" },
];

/** Stitched navy-leather sidebar with embossed cream tabs. */
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
      <div className="md:hidden sk-leather flex items-center justify-between px-5 py-4">
        <span className="font-display text-xl text-cream">CycleWise</span>
        <button onClick={() => setOpen(!open)} className="sk-tab-active w-10 h-10 rounded-lg flex items-center justify-center" aria-label="Toggle menu" aria-expanded={open}>
          {open ? "✕" : "☰"}
        </button>
      </div>

      <aside className={`
        ${open ? "block" : "hidden"} md:block sk-leather
        w-full md:w-60 shrink-0 md:min-h-screen p-6 md:p-7
      `}>
        <div className="hidden md:flex items-center gap-2 mb-8">
          <span aria-hidden className="w-7 h-7 rounded-full bg-coral shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_1px_2px_rgba(0,0,0,.4)]" />
          <span className="font-display text-2xl text-cream">CycleWise</span>
        </div>

        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${active ? "sk-tab-active" : "sk-tab"}`}
              >
                <span aria-hidden className={active ? "text-coral" : ""}>{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-6 border-t border-cream/15 space-y-1">
          <Link href="/terms" className="block px-4 py-1.5 text-xs text-cream/70 hover:text-cream">Terms &amp; Conditions</Link>
          <Link href="/privacy" className="block px-4 py-1.5 text-xs text-cream/70 hover:text-cream">Privacy Policy</Link>
          <button onClick={logout} className="w-full text-left px-4 py-1.5 text-xs text-coral hover:underline">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
