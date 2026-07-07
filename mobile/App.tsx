/**
 * CycleWise — Mobile (Expo / React Native)
 * -----------------------------------------------------------------------
 * Feature parity with web: auth, calendar, daily insight, logging modal,
 * dashboard. Reuses lib/predictions.ts verbatim (pure TS, no DOM/Node APIs)
 * — copy that file into mobile/lib/predictions.ts or hoist both apps into
 * a monorepo with a shared `packages/core` workspace (recommended, see
 * docs/SETUP_GUIDE.md §6).
 *
 * Install:
 *   npx create-expo-app cyclewise-mobile -t expo-template-blank-typescript
 *   cd cyclewise-mobile
 *   npx expo install @supabase/supabase-js react-native-url-polyfill
 *   npx expo install @react-navigation/native @react-navigation/native-stack
 *   npx expo install react-native-screens react-native-safe-area-context
 *   npx expo install @react-native-async-storage/async-storage
 *   npx expo install expo-secure-store expo-sqlite expo-network
 */
import "react-native-url-polyfill/auto";
import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return null; // splash screen would go here (expo-splash-screen)

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
