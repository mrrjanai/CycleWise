/**
 * Shared theme tokens — mirrors tailwind.config.ts on web so the two apps
 * feel like the same product. React Native has no native box-shadow, so
 * "neomorphism" here is approximated with two stacked shadow layers
 * (see shadow.raised / shadow.inset below); iOS gets true dual shadows,
 * Android falls back to elevation + a single tinted shadow.
 */
import { Platform } from "react-native";

export const colors = {
  base: "#E9E4F5",
  surface: "#EDE8F7",
  ink: "#453F58",
  inkMuted: "#8A82A3",
  rose: "#FF8FAB",
  violet: "#8B6BC7",
  sage: "#7FBF8F",
  amber: "#F0A860",
  peak: "#B4569E",
};

export const radius = { sm: 12, md: 20, lg: 28 };

export const shadow = Platform.select({
  ios: {
    raised: {
      shadowColor: "#C7C1DD",
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
    },
    inset: {
      // True inset shadows aren't supported natively on iOS either;
      // approximate with a subtle border + light shadow, or use
      // `react-native-inner-shadow` for a closer match if desired.
      shadowColor: "#C7C1DD",
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
    },
  },
  default: {
    raised: { elevation: 6, shadowColor: "#C7C1DD" },
    inset: { elevation: 1, shadowColor: "#C7C1DD" },
  },
})!;
