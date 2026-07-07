import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { supabase } from "./supabaseClient";

/**
 * Minimal offline-first write queue for daily_logs.
 * - Writes are applied optimistically to local cache immediately.
 * - If offline, the write is queued in AsyncStorage under 'pending_writes'.
 * - Call `flushPendingWrites()` on app foreground / network reconnect
 *   (wire this to `Network.addNetworkStateListener` in App.tsx).
 */
const PENDING_KEY = "cyclewise:pending_writes";
const CACHE_PREFIX = "cyclewise:cache:";

interface PendingWrite {
  table: "daily_logs" | "cycles";
  payload: Record<string, unknown>;
  conflictKey?: string;
  queuedAt: string;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
  return raw ? JSON.parse(raw) : null;
}

export async function cacheSet(key: string, value: unknown) {
  await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
}

export async function saveLogOfflineFirst(payload: Record<string, unknown>) {
  // 1. Update local cache immediately so the UI reflects the change.
  const cacheKey = `log:${payload.log_date}`;
  await cacheSet(cacheKey, payload);

  // 2. Try to write through to Supabase; queue on failure.
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected) {
    await enqueueWrite({ table: "daily_logs", payload, conflictKey: "user_id,log_date", queuedAt: new Date().toISOString() });
    return { synced: false };
  }

  const { error } = await supabase.from("daily_logs").upsert(payload, { onConflict: "user_id,log_date" });
  if (error) {
    await enqueueWrite({ table: "daily_logs", payload, conflictKey: "user_id,log_date", queuedAt: new Date().toISOString() });
    return { synced: false, error };
  }
  return { synced: true };
}

async function enqueueWrite(write: PendingWrite) {
  const existing = (await cacheGet<PendingWrite[]>(PENDING_KEY)) ?? [];
  existing.push(write);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(existing));
}

export async function flushPendingWrites() {
  const queue = (await cacheGet<PendingWrite[]>(PENDING_KEY)) ?? [];
  if (queue.length === 0) return;

  const remaining: PendingWrite[] = [];
  for (const write of queue) {
    const { error } = await supabase.from(write.table).upsert(write.payload, { onConflict: write.conflictKey });
    if (error) remaining.push(write); // keep for next attempt
  }
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
}
