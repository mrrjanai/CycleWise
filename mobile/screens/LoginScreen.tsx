import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "../lib/supabaseClient";
import { colors, radius, shadow } from "../theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>CycleWise</Text>
        <Text style={styles.subtitle}>Your cycle, your data, your call.</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.inkMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={signIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.base, alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 28, ...shadow.raised },
  title: { fontSize: 30, fontWeight: "600", color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.inkMuted, textAlign: "center", marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 14, color: colors.ink, ...shadow.inset },
  button: { backgroundColor: colors.violet, borderRadius: radius.md, padding: 16, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  error: { color: colors.rose, fontSize: 13, marginBottom: 8 },
});
