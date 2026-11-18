"use client";

import { currentPhase, type CyclePrediction, type UserFertilitySettings } from "@/lib/predictions";
import { PHASE_INFO } from "@/lib/phaseTips";

interface CycleDialProps {
  prediction: CyclePrediction;
  settings: UserFertilitySettings;
}

/**
 * The app's signature element: an embossed circular dial that reads like a
 * soft-touch instrument dial rather than a chart. The ring is carved into
 * the surface (inset shadow) with a raised, glowing progress arc on top —
 * literally "pressed into" the neomorphic surface, echoing a soft-touch
 * thermostat or a compact mirror. Center shows day-of-cycle as the hero
 * number; the arc color eases from rose (period) through violet (follicular)
 * to peak magenta (ovulation) and back, giving an at-a-glance phase read.
 */
export default function CycleDial({ prediction, settings }: CycleDialProps) {
  const cycleLength = prediction.cycleLengthUsed;
  const day = prediction.currentCycleDay ?? 1;
  const progress = Math.min(day / cycleLength, 1);

  const size = 220;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const phase = currentPhase(prediction, settings);
  const late = prediction.daysLate;
  const caption = late > 0
    ? `Period ${late} day${late === 1 ? "" : "s"} late`
    : phase ? PHASE_INFO[phase].name : "Log a period to start";

  return (
    <div className="neo-card p-8 flex flex-col items-center gap-4" role="group" aria-label="Cycle progress">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="cycleArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF8FAB" />
              <stop offset="55%" stopColor="#8B6BC7" />
              <stop offset="100%" stopColor="#E0524F" />
            </linearGradient>
          </defs>
          {/* carved track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="currentColor" strokeWidth={stroke}
            className="text-surface dark:text-surface-dark"
          />
          {/* progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="url(#cycleArc)" strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark tracking-widest">DAY</span>
          <span className="font-display text-5xl leading-none">{prediction.currentCycleDay ?? "–"}</span>
          <span className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark mt-1">of {cycleLength}</span>
        </div>
      </div>
      <p className={`text-sm ${late > 0 ? "text-amber font-medium" : "text-ink-muted dark:text-ink-muted-dark"}`}>{caption}</p>
    </div>
  );
}
