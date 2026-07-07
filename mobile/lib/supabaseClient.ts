import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Health data is sensitive, so the auth *refresh token* (long-lived) is
 * kept in the OS keychain via expo-secure-store, while short-lived session
 * cache uses AsyncStorage. This mirrors Supabase's recommended RN pattern
 * for apps handling health/financial data.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: SecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Bulk, non-sensitive read caches (e.g. last-fetched prediction, for offline
// display) can use plain AsyncStorage — see lib/offlineCache.ts.
export { AsyncStorage };
