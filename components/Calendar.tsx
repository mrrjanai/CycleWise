"use client";

import { useMemo, useState } from "react";
import { getMonthFertility, CyclePrediction, UserFertilitySettings, DayFertility } from "@/lib/predictions";

interface CalendarProps {
  prediction: CyclePrediction;
  settings: UserFertilitySettings;
  loggedDates: Record<string, { hasPeriod?: boolean; hasLog?: boolean }>;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}

const ZONE_STYLES: Record<DayFertility["zone"], string> = {
  period: "bg-amber-soft text-amber border border-amber/30",
  fertile: "bg-violet-soft text-violet border border-violet/30",
  ovulation: "bg-peak-soft text-peak border border-peak/40",
  luteal: "bg-transparent text-ink-muted dark:text-ink-muted-dark",
  low: "bg-sage-soft text-sage border border-sage/30",
};

export default function Calendar({ prediction, settings, loggedDates, selectedDate, onSelectDate }: CalendarProps) {
  const initial = new Date(selectedDate);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());

  const days = useMemo(
    () => getMonthFertility(year, month, prediction, settings, prediction.lastPeriodStart),
    [year, month, prediction, settings]
  );

  const firstWeekday = new Date(year, month, 1).getDay();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const changeMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div className="neo-card p-6">
      <div className="flex items-center justify-between mb-5">
        <button aria-label="Previous month" onClick={() => changeMonth(-1)} className="neo-btn w-10 h-10 flex items-center justify-center text-ink dark:text-ink-dark">‹</button>
        <h3 className="font-display text-lg">{monthLabel}</h3>
        <button aria-label="Next month" onClick={() => changeMonth(1)} className="neo-btn w-10 h-10 flex items-center justify-center text-ink dark:text-ink-dark">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-mono text-ink-muted dark:text-ink-muted-dark">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const logged = loggedDates[day.date];
          return (
            <button
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              aria-label={`${day.date}, ${day.zone} fertility${logged?.hasLog ? ", logged" : ""}`}
              aria-pressed={isSelected}
              className={[
                "aspect-square rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-0.5 transition-shadow",
                isSelected ? "neo-pressed ring-2 ring-violet" : "neo-btn",
                ZONE_STYLES[day.zone],
              ].join(" ")}
            >
              <span>{new Date(day.date).getDate()}</span>
              {logged?.hasPeriod && <span className="w-1.5 h-1.5 rounded-full bg-amber" />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-5 text-xs">
        <Legend swatch="bg-amber" label="Period" />
        <Legend swatch="bg-violet" label="Fertile window" />
        <Legend swatch="bg-peak" label="Ovulation (peak)" />
        <Legend swatch="bg-sage" label="Low fertility / safer" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-muted dark:text-ink-muted-dark">
      <span className={`w-2.5 h-2.5 rounded-full ${swatch}`} /> {label}
    </span>
  );
}
