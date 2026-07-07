import type { Config } from "tailwindcss";

// ---------------------------------------------------------------------
// CycleWise design tokens
// Palette: soft lilac base, embossed/pressed neomorphic surfaces,
// rose→violet gradient for primary actions, sage for "safe" days,
// amber for period days, deep violet for ovulation/peak fertility.
// ---------------------------------------------------------------------
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#E9E4F5",   // page background, light mode
          dark: "#211D2E",      // page background, dark mode
        },
        surface: {
          DEFAULT: "#EDE8F7",
          dark: "#28243A",
        },
        ink: {
          DEFAULT: "#453F58",   // primary text
          muted: "#8A82A3",     // secondary text
          dark: "#EDE9F7",
          "muted-dark": "#A79FC4",
        },
        rose: { DEFAULT: "#FF8FAB", soft: "#FFD7E2" },
        violet: { DEFAULT: "#8B6BC7", soft: "#DCD1F5" },
        sage: { DEFAULT: "#7FBF8F", soft: "#DCF0DF" },     // safe / low-fertility days
        amber: { DEFAULT: "#F0A860", soft: "#FBE3C7" },     // period days
        peak: { DEFAULT: "#E0524F", soft: "#FBDAD9" },      // ovulation (red)
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Raised neomorphic surface (light mode)
        "neo": "8px 8px 16px #C7C1DD, -8px -8px 16px #FFFFFF",
        "neo-sm": "4px 4px 8px #C7C1DD, -4px -4px 8px #FFFFFF",
        // Pressed / inset neomorphic surface (active state, e.g. logged day)
        "neo-inset": "inset 5px 5px 10px #C7C1DD, inset -5px -5px 10px #FFFFFF",
        "neo-inset-sm": "inset 3px 3px 6px #C7C1DD, inset -3px -3px 6px #FFFFFF",
        // Dark mode variants
        "neo-dark": "8px 8px 16px #17141F, -8px -8px 16px #383153",
        "neo-inset-dark": "inset 5px 5px 10px #17141F, inset -5px -5px 10px #383153",
      },
      borderRadius: {
        "neo": "1.25rem",
        "neo-lg": "2rem",
      },
      keyframes: {
        "press": { "0%": { transform: "scale(1)" }, "50%": { transform: "scale(0.97)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        press: "press 200ms ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
