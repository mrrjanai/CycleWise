import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-base dark:bg-base-dark">
      <Navbar />
      <article className="max-w-2xl mx-auto px-4 sm:px-8 pb-20">
        <div className="neo-card p-8 sm:p-10 space-y-6">
          <h1 className="font-display text-3xl">Terms &amp; Conditions</h1>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Last updated: July 2026</p>

          <Section title="1. What CycleWise is">
            CycleWise is a personal cycle-tracking tool. You enter information about your menstrual cycle, symptoms,
            and related data, and we show you statistical estimates — including predicted ovulation, fertile windows,
            and conception-probability ranges — based on that information.
          </Section>

          <Section title="2. Not medical advice">
            CycleWise does not diagnose, treat, or provide medical advice. Predictions are statistical estimates based
            on cycle-timing averages, not an assessment of your individual biology. CycleWise is not a substitute for
            a clinically validated contraceptive method, and should not be relied upon as your sole method of
            pregnancy prevention or achievement. Always consult a licensed healthcare provider for medical guidance.
          </Section>

          <Section title="3. Your account">
            You're responsible for keeping your login credentials secure. You must be at least 16 years old (or the
            age of digital consent in your region, if higher) to create an account.
          </Section>

          <Section title="4. Your data">
            You own the data you enter. You can export it or delete your account at any time from the Profile page —
            deletion permanently removes your data from our systems. See our Privacy Policy for full details on how
            your data is handled.
          </Section>

          <Section title="5. Acceptable use">
            Don't use CycleWise to harm others, attempt to access another user's data, or reverse-engineer the
            service. We may suspend accounts that violate this.
          </Section>

          <Section title="6. Changes to these terms">
            We may update these terms occasionally. Continued use of the app after a change means you accept the
            updated terms. Material changes will be communicated in-app where feasible.
          </Section>

          <Section title="7. Limitation of liability">
            CycleWise is provided "as is." To the fullest extent permitted by law, we are not liable for decisions
            made based on predictions or estimates shown in the app, including decisions related to pregnancy
            planning or prevention.
          </Section>

          <Section title="8. Contact">
            Questions about these terms can be sent to the support contact listed on our website.
          </Section>
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg">{title}</h2>
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark leading-relaxed">{children}</p>
    </section>
  );
}
