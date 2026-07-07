"use client";

import { useState } from "react";
import { DayFertility } from "@/lib/predictions";

interface DailyInsightProps {
  fertility: DayFertility;
}

const ZONE_COPY: Record<DayFertility["zone"], { title: string; blurb: string }> = {
  period: { title: "Period day", blurb: "Bleeding phase of the cycle. Pregnancy is very unlikely on a typical period day, but not impossible in unusually short cycles." },
  fertile: { title: "Fertile window", blurb: "Sperm can survive up to 5 days, so days leading into ovulation carry real conception risk if sex is unprotected." },
  ovulation: { title: "Ovulation day (peak fertility)", blurb: "The egg is released and viable for roughly 12–24 hours — this is the single highest-probability day in the cycle." },
  luteal: { title: "Luteal phase", blurb: "After ovulation, the egg is no longer viable. Probability drops sharply but isn't literally zero due to date-prediction uncertainty." },
  low: { title: "Lower-fertility day", blurb: "Outside the estimated fertile window. Risk is low but this is a statistical estimate, not a guarantee." },
};

const TOOLTIPS: Record<string, string> = {
  ovulation: "Ovulation is when a mature egg is released from the ovary. It's the single most fertile moment of the cycle and typically happens once, about 12–16 days before the next period starts.",
  mucus: "Cervical mucus changes texture across the cycle — from dry/sticky, to creamy, to a stretchy 'egg white' consistency right before ovulation, which helps sperm travel.",
  bbt: "Basal body temperature (BBT) is your resting temperature taken first thing in the morning. It rises slightly (~0.3–0.5°C) after ovulation due to progesterone, which can help confirm ovulation happened after the fact.",
};

export default function DailyInsight({ fertility }: DailyInsightProps) {
  const [openTip, setOpenTip] = useState<string | null>(null);
  const copy = ZONE_COPY[fertility.zone];

  return (
    <div className="neo-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">{new Date(fertility.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
        {fertility.cycleDay && <span className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark">Cycle day {fertility.cycleDay}</span>}
      </div>

      <div className="neo-inset rounded-neo p-5 space-y-2">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{copy.blurb}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-ink-muted-dark mb-1">
          If unprotected sex occurs today
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl">{fertility.pregnancyProbabilityLabel}</span>
          <span className="font-mono text-sm text-ink-muted dark:text-ink-muted-dark">
            ~{fertility.pregnancyProbabilityPct[0]}–{fertility.pregnancyProbabilityPct[1]}% estimated chance
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/40 dark:border-white/5">
        {Object.keys(TOOLTIPS).map((key) => (
          <button
            key={key}
            onClick={() => setOpenTip(openTip === key ? null : key)}
            className="neo-btn text-xs px-3 py-1.5 capitalize"
            aria-expanded={openTip === key}
          >
            {key === "bbt" ? "Basal body temp?" : key === "mucus" ? "Cervical mucus?" : "What's ovulation?"}
          </button>
        ))}
      </div>
      {openTip && (
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark neo-inset rounded-neo p-4">
          {TOOLTIPS[openTip]}
        </p>
      )}

      <p className="text-xs text-ink-muted dark:text-ink-muted-dark pt-2 border-t border-white/40 dark:border-white/5">
        Estimates are based on cycle-timing statistics, not your individual biology. This is educational information,
        not a substitute for medical advice or a validated contraceptive method — talk to a clinician about the right
        approach for you.
      </p>
    </div>
  );
}
