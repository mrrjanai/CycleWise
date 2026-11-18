"use client";

import Link from "next/link";
import { addDays, currentPhase, diffDays, formatISODate, type CyclePrediction, type UserFertilitySettings } from "@/lib/predictions";
import { describeWindow, type HeadsUp } from "@/lib/insights";
import { PHASE_INFO } from "@/lib/phaseTips";
import type { TrackingGoal } from "@/lib/useCycleData";

interface TodayCardProps {
  prediction: CyclePrediction;
  settings: UserFertilitySettings;
  goal: TrackingGoal;
  headsUp: HeadsUp[];
  today: string;
}

const short = (iso: string) => formatISODate(iso, { month: "short", day: "numeric" });

const OVULATION_SIGNAL: Record<Exclude<CyclePrediction["ovulationSource"], "calendar">, (d: string) => string> = {
  bbt: (d) => `Ovulation confirmed on ${d} by your temperature shift.`,
  lh: (d) => `Ovulation expected around ${d}, based on your positive LH test.`,
  mucus: (d) => `Ovulation likely around ${d}, based on your cervical mucus peak.`,
};

/** "Today" summary: phase + tip, late period, ovulation signal, symptom heads-up and goal guidance. */
export default function TodayCard({ prediction, settings, goal, headsUp, today }: TodayCardProps) {
  const phase = currentPhase(prediction, settings);
  const info = phase ? PHASE_INFO[phase] : null;
  const tip = info ? info.tips[(prediction.currentCycleDay ?? 0) % info.tips.length] : null;
  const dueToday = prediction.daysLate === 0 && prediction.nextPeriodStart === today;

  return (
    <div className="neo-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg">Today</h3>
        {info && <span className="zone-chip bg-violet-soft text-violet">{info.name}</span>}
      </div>

      {prediction.daysLate > 0 && (
        <div className="neo-inset rounded-neo p-4 space-y-1" role="status">
          <p className="font-medium text-amber">
            Your period is {prediction.daysLate} day{prediction.daysLate === 1 ? "" : "s"} late
          </p>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            Late periods are common: stress, travel, illness and changes in routine can all shift a cycle. If there&apos;s a
            chance you could be pregnant, a home test is most reliable from the first day of a missed period.
          </p>
        </div>
      )}
      {dueToday && (
        <p className="neo-inset rounded-neo p-4 text-sm" role="status">
          Your period is expected <span className="font-medium">today</span>. Log it when it starts.
        </p>
      )}

      {info ? (
        <div className="space-y-1">
          <p className="text-sm">{info.summary}</p>
          {tip && <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Tip: {tip}</p>}
        </div>
      ) : (
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Log your last period to see your cycle phase and daily tips.</p>
      )}

      {prediction.ovulationSource !== "calendar" && (
        <p className="text-sm flex gap-2 items-start">
          <span aria-hidden className="text-peak">●</span>
          <span>{OVULATION_SIGNAL[prediction.ovulationSource](short(prediction.ovulationDate))}</span>
        </p>
      )}

      {headsUp.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark">Heads up</p>
          <ul className="space-y-1">
            {headsUp.slice(0, 3).map(({ pattern, inDays }) => (
              <li key={`${pattern.kind}:${pattern.name}`} className="text-sm">
                <span className="font-medium">{pattern.name}</span>{" "}
                <span className="text-ink-muted dark:text-ink-muted-dark">
                  usually shows up {describeWindow(pattern)}, so {inDays === 0 ? "it may show up today" : inDays === 1 ? "expect it from tomorrow" : `expect it in about ${inDays} days`}.
                </span>
              </li>
            ))}
          </ul>
          <Link href="/insights" className="text-xs text-violet hover:underline">See all your patterns →</Link>
        </div>
      )}

      <GoalGuidance prediction={prediction} goal={goal} today={today} />
    </div>
  );
}

function GoalGuidance({ prediction, goal, today }: { prediction: CyclePrediction; goal: TrackingGoal; today: string }) {
  if (goal === "general") return null;

  // Use this cycle's window, or the next cycle's once this one has passed.
  const passed = today > prediction.fertileWindowEnd;
  const ovulation = passed ? addDays(prediction.nextPeriodStart, prediction.ovulationCycleDay - 1) : prediction.ovulationDate;
  const windowStart = passed ? addDays(ovulation, -4) : prediction.fertileWindowStart;
  const windowEnd = passed ? addDays(ovulation, 4) : prediction.fertileWindowEnd;
  const label = passed ? "Next cycle" : "This cycle";

  if (goal === "conceive") {
    const lhStart = addDays(ovulation, -4);
    const daysToLh = diffDays(today, lhStart);
    return (
      <div className="pt-3 border-t border-white/40 dark:border-white/5 space-y-1">
        <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark">Trying to conceive · {label}</p>
        <p className="text-sm">
          Best days to try: <span className="font-medium">{short(addDays(ovulation, -2))} – {short(ovulation)}</span>
        </p>
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
          {daysToLh > 0
            ? `Start daily ovulation (LH) tests on ${short(lhStart)}. A positive test sharpens your prediction.`
            : "Keep taking daily ovulation (LH) tests until you get a positive. Logging it sharpens your prediction."}
        </p>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-white/40 dark:border-white/5 space-y-1">
      <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark">
        {goal === "contraception" ? "On birth control" : "Avoiding pregnancy"} · {label}
      </p>
      {goal === "contraception" ? (
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
          Hormonal birth control usually stops ovulation, so the fertile-window estimates may not apply to you. Keep
          logging bleeding and symptoms. It&apos;s useful history to share with your clinician.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Higher-risk days: <span className="font-medium">{short(windowStart)} – {short(windowEnd)}</span>
          </p>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark">
            Calendar estimates aren&apos;t reliable birth control on their own. Use protection on every day you want to
            avoid pregnancy, and talk to a clinician about a method that suits you.
          </p>
        </>
      )}
    </div>
  );
}
