import Link from "next/link";
import Navbar from "@/components/Navbar";

const FEATURES = [
  { icon: "◐", title: "Smart predictions", desc: "Ovulation, fertile window, and next period, calculated from your own cycle history — not a generic average." },
  { icon: "✎", title: "Log what matters", desc: "Flow, symptoms, mood, basal body temp, medications, and more — in seconds, from any day, past or present." },
  { icon: "◷", title: "See the full picture", desc: "Cycle history and trends over time, so patterns become visible instead of guesswork." },
  { icon: "◍", title: "Educational, not judgmental", desc: "Plain-language explanations of ovulation, cervical mucus, and BBT — right where you need them." },
];

const BENEFITS = [
  "Understand your body instead of just logging dates",
  "Plan around fertile and low-fertility days with real context",
  "Spot patterns in symptoms and mood over months, not just days",
  "Your data stays yours — no ads, no data-selling, ever",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-base dark:bg-base-dark">
      <Navbar />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-10 pb-20 text-center">
        <div className="neo-card inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-violet mb-6">
          <span aria-hidden>●</span> Private by design — your data, your call
        </div>
        <h1 className="font-display text-4xl sm:text-6xl leading-tight mb-5">
          Know your body.<br />Own your data.
        </h1>
        <p className="text-ink-muted dark:text-ink-muted-dark text-lg max-w-xl mx-auto mb-8">
          CycleWise is a calm, empowering way to track your cycle, understand your fertility, and see the patterns
          your body has been showing you all along.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="neo-btn px-7 py-3.5 font-medium bg-gradient-to-br from-rose to-violet text-white">
            Start tracking — it's free
          </Link>
        </div>

        {/* Abstract illustration — soft overlapping neomorphic circles echoing a cycle dial */}
        <div className="relative mt-16 h-56 flex items-center justify-center" aria-hidden>
          <div className="absolute w-40 h-40 rounded-full neo-card" />
          <div className="absolute w-28 h-28 rounded-full neo-inset bg-gradient-to-br from-rose/30 to-violet/30" style={{ transform: "translateX(60px)" }} />
          <div className="absolute w-20 h-20 rounded-full neo-card bg-gradient-to-br from-sage/20 to-amber/20" style={{ transform: "translateX(-70px) translateY(20px)" }} />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <h2 className="font-display text-3xl text-center mb-12">Everything you need, nothing you don't</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="neo-card p-7">
              <div className="w-12 h-12 rounded-full neo-inset flex items-center justify-center text-xl text-violet mb-4">{f.icon}</div>
              <h3 className="font-display text-xl mb-2">{f.title}</h3>
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-3xl mx-auto px-4 sm:px-8 py-16">
        <div className="neo-card p-10">
          <h2 className="font-display text-2xl mb-6 text-center">Why people switch to CycleWise</h2>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <span className="text-sage mt-0.5" aria-hidden>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-8 pb-20 text-center">
        <h2 className="font-display text-3xl mb-4">Your cycle, your data, your call.</h2>
        <p className="text-ink-muted dark:text-ink-muted-dark mb-8">Free to start. No ads. No data sold, ever.</p>
        <Link href="/login" className="neo-btn px-7 py-3.5 font-medium bg-gradient-to-br from-rose to-violet text-white">
          Create your account
        </Link>
      </section>

      <footer className="text-center text-xs text-ink-muted dark:text-ink-muted-dark pb-10">
        <Link href="/terms" className="hover:text-violet">Terms</Link> · <Link href="/privacy" className="hover:text-violet">Privacy</Link>
      </footer>
    </main>
  );
}
