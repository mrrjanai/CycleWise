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
  peak: "#E0524F",
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
