import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { supabase } from "../lib/supabaseClient";
import { predictCycle, getDayFertility, CycleRecord, CyclePrediction, UserFertilitySettings } from "../lib/predictions"; // copy from web/lib/predictions.ts
import { colors, radius, shadow } from "../theme";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function DashboardScreen() {
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [settings, setSettings] = useState<UserFertilitySettings>({ avgCycleLength: 28, lutealPhaseLength: 14, avgPeriodLength: 5 });
  const [selectedDate] = useState(todayISO());

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profile }, { data: cycles }] = await Promise.all([
      supabase.from("profiles").select("avg_cycle_length, avg_period_length, luteal_phase_length").eq("id", user.id).single(),
      supabase.from("cycles").select("start_date, cycle_length, period_length").eq("user_id", user.id).order("start_date", { ascending: false }),
    ]);

    const s: UserFertilitySettings = {
      avgCycleLength: profile?.avg_cycle_length ?? 28,
      lutealPhaseLength: profile?.luteal_phase_length ?? 14,
      avgPeriodLength: profile?.avg_period_length ?? 5,
    };
    setSettings(s);
    const records: CycleRecord[] = (cycles ?? []).map((c) => ({ startDate: c.start_date, cycleLength: c.cycle_length, periodLength: c.period_length }));
    setPrediction(predictCycle(records, s));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!prediction) {
    return <View style={styles.screen}><Text style={{ color: colors.inkMuted }}>Loading your cycle…</Text></View>;
  }

  const fertility = getDayFertility(selectedDate, prediction, settings, prediction.lastPeriodStart);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={styles.header}>CycleWise</Text>

      <View style={[styles.card, styles.dial]}>
        <Text style={styles.dayLabel}>DAY</Text>
        <Text style={styles.dayNumber}>{prediction.currentCycleDay ?? "–"}</Text>
        <Text style={styles.dayLabel}>of {settings.avgCycleLength}</Text>
      </View>

      <View style={styles.card}>
        <Row label="Next period" value={new Date(prediction.nextPeriodStart).toDateString()} />
        <Row label="Ovulation" value={new Date(prediction.ovulationDate).toDateString()} />
        <Row label="Fertile window" value={`${prediction.fertileWindowStart} → ${prediction.fertileWindowEnd}`} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's insight</Text>
        <Text style={styles.probability}>{fertility.pregnancyProbabilityLabel}</Text>
        <Text style={{ color: colors.inkMuted, fontSize: 12 }}>
          ~{fertility.pregnancyProbabilityPct[0]}–{fertility.pregnancyProbabilityPct[1]}% if unprotected sex occurs today
        </Text>
      </View>

      <Pressable style={styles.logButton}>
        <Text style={styles.logButtonText}>+ Log today</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.inkMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base },
  header: { fontSize: 26, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, ...shadow.raised },
  cardTitle: { fontSize: 15, fontWeight: "600", color: colors.ink, marginBottom: 8 },
  dial: { alignItems: "center", paddingVertical: 32 },
  dayLabel: { fontSize: 11, letterSpacing: 2, color: colors.inkMuted },
  dayNumber: { fontSize: 48, fontWeight: "700", color: colors.ink },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  probability: { fontSize: 28, fontWeight: "700", color: colors.violet, marginBottom: 2 },
  logButton: { backgroundColor: colors.violet, borderRadius: radius.md, padding: 16, alignItems: "center" },
  logButtonText: { color: "#fff", fontWeight: "600" },
});
