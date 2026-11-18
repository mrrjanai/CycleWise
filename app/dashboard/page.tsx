"use client";

import { useMemo, useState } from "react";
import { getDayFertility, formatISODate } from "@/lib/predictions";
import { symptomPatterns, upcomingPatterns } from "@/lib/insights";
import { useCycleData } from "@/lib/useCycleData";
import CycleDial from "@/components/CycleDial";
import Calendar from "@/components/Calendar";
import DailyInsight from "@/components/DailyInsight";
import LogPeriodModal from "@/components/LogPeriodModal";
import Sidebar from "@/components/Sidebar";
import PinGate from "@/components/PinGate";
import TodayCard from "@/components/TodayCard";

export default function DashboardPage() {
  const { loading, model, prediction, logs, entries, goal, today, reload } = useCycleData({ requireOnboarded: true });
  const settings = model.settings;
  const [selectedDate, setSelectedDate] = useState(today);
  const [showModal, setShowModal] = useState(false);
  const [futureDateMessage, setFutureDateMessage] = useState<string | null>(null);

  const loggedDates = useMemo(() => {
    const map: Record<string, { hasPeriod?: boolean; hasLog?: boolean }> = {};
    for (const l of logs) map[l.date] = { hasLog: true, hasPeriod: !!(l.flow && l.flow !== "none") };
    return map;
  }, [logs]);

  const headsUp = useMemo(
    () => upcomingPatterns(symptomPatterns(model.history, logs, settings), prediction, today),
    [model.history, logs, settings, prediction, today]
  );

  if (loading) {
    return (
      <PinGate>
        <div className="flex min-h-screen bg-base dark:bg-base-dark">
          <Sidebar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-ink-muted dark:text-ink-muted-dark font-body">Loading your cycle…</p>
          </main>
        </div>
      </PinGate>
    );
  }

  const fertility = getDayFertility(selectedDate, prediction, settings, prediction.lastPeriodStart);
  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;
  const logButtonLabel = isToday
    ? "+ Log today"
    : `+ Log ${formatISODate(selectedDate, { month: "short", day: "numeric" })}`;

  const handleLogClick = () => {
    if (isFuture) {
      setFutureDateMessage("You can't log a day that hasn't happened yet — the most recent day you can log is today.");
      return;
    }
    setFutureDateMessage(null);
    setShowModal(true);
  };

  const nextPeriodValue = prediction.daysLate > 0
    ? `${prediction.daysLate}d late`
    : formatISODate(prediction.nextPeriodStart, { month: "short", day: "numeric" });

  return (
    <PinGate>
      <div className="flex flex-col md:flex-row min-h-screen bg-base dark:bg-base-dark">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full">
          <header className="flex items-center justify-between mb-8">
            <h1 className="font-display text-3xl hidden md:block">Dashboard</h1>
            <div className="ml-auto flex flex-col items-end gap-1">
              <button
                onClick={handleLogClick}
                className="neo-btn px-5 py-2.5 font-medium bg-gradient-to-br from-rose to-violet text-white"
              >
                {logButtonLabel}
              </button>
              {futureDateMessage && <p className="text-xs text-rose max-w-xs text-right">{futureDateMessage}</p>}
            </div>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <CycleDial prediction={prediction} settings={settings} />
              <div className="neo-card p-6 space-y-3">
                <h3 className="font-display text-lg">Overview</h3>
                <Stat label="Next period" value={nextPeriodValue} />
                <Stat
                  label={prediction.ovulationSource === "bbt" ? "Ovulation (confirmed)" : "Ovulation"}
                  value={formatISODate(prediction.ovulationDate, { month: "short", day: "numeric" })}
                />
                <Stat label="Avg cycle length" value={`${prediction.cycleLengthUsed} days`} />
                <Stat label="Avg period length" value={`${settings.avgPeriodLength} days${settings.periodLengthLearned ? "" : " (est.)"}`} />
                <Stat label="Prediction confidence" value={prediction.confidence} />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <TodayCard prediction={prediction} settings={settings} goal={goal} headsUp={headsUp} today={today} />
              <Calendar
                prediction={prediction}
                settings={settings}
                loggedDates={loggedDates}
                selectedDate={selectedDate}
                onSelectDate={(d) => { setSelectedDate(d); setFutureDateMessage(null); }}
              />
              {/* Tap any day above (past or future) to select it — the insight
                  panel always reflects the selected day, but logging is only
                  allowed for today or earlier. */}
              <DailyInsight fertility={fertility} loggedEntry={entries[selectedDate] ?? null} ovulationSource={prediction.ovulationSource} />
            </div>
          </section>

          {showModal && (
            <LogPeriodModal
              date={selectedDate}
              existingEntry={entries[selectedDate] ?? null}
              onClose={() => setShowModal(false)}
              onSaved={reload}
            />
          )}
        </main>
      </div>
    </PinGate>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-muted dark:text-ink-muted-dark">{label}</span>
      <span className="font-mono text-sm capitalize">{value}</span>
    </div>
  );
}
