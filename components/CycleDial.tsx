"use client";

import { currentPhase, diffDays, type CyclePrediction, type UserFertilitySettings } from "@/lib/predictions";
import { PHASE_INFO } from "@/lib/phaseTips";

interface CycleDialProps {
  prediction: CyclePrediction;
  settings: UserFertilitySettings;
}

const SIZE = 236;
const C = SIZE / 2;
const FACE_R = 92;   // cream face radius
const TRACK_R = 76;  // where the arcs run
const NAVY = "#14213D";
const CORAL = "#FF6B5B";

// Rounded so server and browser render identical numbers (raw trig results
// can differ in the last digit and cause a hydration mismatch).
const round = (n: number) => Math.round(n * 100) / 100;

/** Point on a circle for a fraction of the cycle (0 = top, clockwise). */
const polar = (r: number, frac: number) => {
  const a = frac * 2 * Math.PI - Math.PI / 2;
  return [round(C + r * Math.cos(a)), round(C + r * Math.sin(a))] as const;
};

/** SVG arc path between two fractions of the cycle. */
function arc(r: number, from: number, to: number) {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, Math.min(to, from + 0.9999));
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * The app's signature element, as a physical instrument: a navy bezel
 * around a cream dial face with a tick for every cycle day, the period
 * and fertile window printed on the face, a coral progress arc with a
 * raised knob for today, and a glass glare over the top. The face stays
 * cream in dark mode, like a real object would.
 */
export default function CycleDial({ prediction, settings }: CycleDialProps) {
  const L = prediction.cycleLengthUsed;
  const day = prediction.currentCycleDay;
  const progress = day ? Math.min(day / L, 1) : 0;

  const fertileFrom = prediction.currentCycleStart ? diffDays(prediction.currentCycleStart, prediction.fertileWindowStart) / L : null;
  const fertileTo = prediction.currentCycleStart ? (diffDays(prediction.currentCycleStart, prediction.fertileWindowEnd) + 1) / L : null;
  const ovFrac = prediction.currentCycleStart ? (diffDays(prediction.currentCycleStart, prediction.ovulationDate) + 0.5) / L : null;

  const phase = currentPhase(prediction, settings);
  const late = prediction.daysLate;
  const caption = late > 0
    ? `Period ${late} day${late === 1 ? "" : "s"} late`
    : phase ? PHASE_INFO[phase].name : "Log a period to start";
  const [kx, ky] = polar(TRACK_R, progress);

  return (
    <div className="neo-card p-7 flex flex-col items-center gap-4" role="group" aria-label={`Cycle day ${day ?? "unknown"} of ${L}. ${caption}`}>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
          <defs>
            <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3A4A6E" />
              <stop offset="45%" stopColor={NAVY} />
              <stop offset="100%" stopColor="#0A1226" />
            </linearGradient>
            <radialGradient id="face" cx="50%" cy="38%" r="70%">
              <stop offset="0%" stopColor="#FFFDF8" />
              <stop offset="70%" stopColor="#F4EDE0" />
              <stop offset="100%" stopColor="#E4D8C2" />
            </radialGradient>
            <linearGradient id="glare" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity=".55" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="knob" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#FFB3A9" />
              <stop offset="60%" stopColor={CORAL} />
              <stop offset="100%" stopColor="#C9402F" />
            </radialGradient>
            <clipPath id="faceClip"><circle cx={C} cy={C} r={FACE_R + 14} /></clipPath>
            <filter id="soft"><feGaussianBlur stdDeviation="4" /></filter>
          </defs>

          {/* Bezel */}
          <circle cx={C} cy={C} r={C - 2} fill="url(#bezel)" />
          <circle cx={C} cy={C} r={C - 3} fill="none" stroke="#fff" strokeOpacity=".18" />
          {/* Face, sunk into the bezel (shadow along its top edge) */}
          <circle cx={C} cy={C} r={FACE_R + 14} fill="url(#face)" />
          <g clipPath="url(#faceClip)">
            <circle cx={C} cy={C + 4} r={FACE_R + 20} fill="none" stroke={NAVY} strokeOpacity=".45" strokeWidth={10} filter="url(#soft)" />
          </g>

          {/* Day ticks */}
          {Array.from({ length: L }, (_, i) => {
            const major = i % 7 === 0;
            const [x1, y1] = polar(FACE_R + 10, i / L);
            const [x2, y2] = polar(FACE_R + (major ? 1 : 5), i / L);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={NAVY} strokeOpacity={major ? 0.7 : 0.35} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
          })}

          {/* Printed bands: period and fertile window */}
          <path d={arc(TRACK_R, 0, settings.avgPeriodLength / L)} stroke={CORAL} strokeOpacity=".28" strokeWidth={14} fill="none" />
          {fertileFrom != null && fertileTo != null && (
            <path d={arc(TRACK_R, Math.max(fertileFrom, 0), fertileTo)} stroke={NAVY} strokeOpacity=".16" strokeWidth={14} fill="none" />
          )}
          {ovFrac != null && (() => {
            const [ox, oy] = polar(TRACK_R, ovFrac);
            return <circle cx={ox} cy={oy} r={3.5} fill={NAVY} />;
          })()}

          {/* Engraved track + progress */}
          <circle cx={C} cy={C} r={TRACK_R} fill="none" stroke={NAVY} strokeOpacity=".12" strokeWidth={4} />
          {progress > 0 && (
            <path d={arc(TRACK_R, 0, progress)} stroke={CORAL} strokeWidth={5} strokeLinecap="round" fill="none" style={{ transition: "d 600ms ease" }} />
          )}
          {day != null && (
            <g>
              <circle cx={kx} cy={ky + 1.5} r={9} fill={NAVY} opacity=".3" />
              <circle cx={kx} cy={ky} r={9} fill="url(#knob)" stroke="#B23A2B" strokeWidth={1} />
              <circle cx={kx - 2.5} cy={ky - 3} r={2.5} fill="#fff" opacity=".6" />
            </g>
          )}

          {/* Glass glare */}
          <ellipse cx={C} cy={C - 46} rx={70} ry={38} fill="url(#glare)" opacity=".7" />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-navy pointer-events-none">
          <span className="font-mono text-[10px] tracking-[0.3em] opacity-60">DAY</span>
          <span className="font-display text-5xl leading-none" style={{ textShadow: "0 1px 0 #fff" }}>{day ?? "–"}</span>
          <span className="font-mono text-[11px] opacity-60 mt-1">of {L}</span>
        </div>
      </div>
      <p className={`text-sm font-medium ${late > 0 ? "text-amber" : "text-ink-muted"}`}>{caption}</p>
    </div>
  );
}
