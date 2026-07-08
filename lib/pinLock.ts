/**
 * Lightweight app-lock PIN helpers, shared by onboarding, settings, and
 * PinGate. The PIN itself is never stored — only a SHA-256 hash, via the
 * browser's built-in SubtleCrypto (no extra dependency).
 *
 * This gates access to the app UI on a given device/browser session; it is
 * NOT the same as OS-level biometric authentication (Face ID / fingerprint),
 * which requires WebAuthn on web or a native API like expo-local-authentication
 * on mobile. See the note in migration_003_pin_lock.sql.
 */

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const UNLOCK_KEY = "cyclewise:pin_unlocked";

// The PIN gate only needs to be passed once per browser session (i.e. once
// per login), not on every page navigation.
export function isUnlockedThisSession(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(UNLOCK_KEY) === "true";
}

export function markUnlockedThisSession() {
  sessionStorage.setItem(UNLOCK_KEY, "true");
}

export function clearUnlock() {
  sessionStorage.removeItem(UNLOCK_KEY);
}
