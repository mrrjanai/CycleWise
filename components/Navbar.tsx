"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-8 py-6">
      <Link href="/" className="font-display text-2xl">CycleWise</Link>
      <nav className="hidden sm:flex items-center gap-6 text-sm">
        <Link href="/#features" className="text-ink-muted dark:text-ink-muted-dark hover:text-violet">Features</Link>
        <Link href="/terms" className={pathname === "/terms" ? "text-violet" : "text-ink-muted dark:text-ink-muted-dark hover:text-violet"}>Terms</Link>
        <Link href="/privacy" className={pathname === "/privacy" ? "text-violet" : "text-ink-muted dark:text-ink-muted-dark hover:text-violet"}>Privacy</Link>
      </nav>
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm font-medium text-ink dark:text-ink-dark">Sign in</Link>
        <Link href="/login" className="neo-btn px-4 py-2 text-sm font-medium bg-gradient-to-br from-rose to-violet text-white">Get started</Link>
      </div>
    </header>
  );
}
