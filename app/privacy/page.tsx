import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-base dark:bg-base-dark">
      <Navbar />
      <article className="max-w-2xl mx-auto px-4 sm:px-8 pb-20">
        <div className="neo-card p-8 sm:p-10 space-y-6">
          <h1 className="font-display text-3xl">Privacy Policy</h1>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Last updated: July 2026</p>

          <Section title="Our commitment">
            Menstrual and fertility data is deeply personal. We built CycleWise around one rule: your data is yours,
            it's used only to run the app for you, and it's never sold or shared with advertisers or data brokers —
            full stop.
          </Section>

          <Section title="What we collect">
            Your email address (for login), the cycle and symptom data you choose to log (period dates, flow,
            symptoms, mood, sexual activity, basal body temperature, medications, tests, and notes), and basic
            account preferences (units, reminder settings, PIN lock preference).
          </Section>

          <Section title="What we don't do">
            We don't sell your data. We don't share it with advertisers. We don't use third-party analytics SDKs
            that fingerprint or track you across other apps. We don't display ads.
          </Section>

          <Section title="Who can see your data">
            Only you. Every piece of data in CycleWise is protected by database-level access rules tied to your
            account, so even we can't casually browse it outside of responding to a support request you initiate.
          </Section>

          <Section title="Where your data lives">
            Your data is stored in a Postgres database (via Supabase) with encryption at rest and in transit.
          </Section>

          <Section title="Your rights">
            You can export a copy of your data or permanently delete your account and all associated data at any
            time from the Profile page. Deletion is immediate and permanent — we don't retain a shadow copy.
          </Section>

          <Section title="Optional app lock">
            If you enable a PIN lock, we store only a one-way hash of your PIN — never the PIN itself — and it's used
            solely to gate access to the app on your device.
          </Section>

          <Section title="Changes to this policy">
            If this policy changes in a material way, we'll surface that in-app rather than only updating this page
            silently.
          </Section>

          <Section title="Contact">
            Questions about this policy or a request to access/delete your data can be sent to the support contact
            listed on our website.
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
