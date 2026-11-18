import type { Config } from "tailwindcss";

// ---------------------------------------------------------------------
// CycleWise design tokens — skeuomorphic, navy / cream / coral
//
// Colors are CSS variables (RGB triplets) defined in app/globals.css for
// light mode and redefined under `.dark`, so every `bg-*` / `text-*` class
// switches theme on its own. The `dark` keys point at the same variables,
// which keeps existing `dark:bg-base-dark`-style classes working.
//
//   navy  #14213D — ink, leather sidebar, ovulation
//   cream #F4EDE0 — paper surfaces
//   coral #FF6B5B — primary actions, period, progress
// ---------------------------------------------------------------------
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#14213D",
        cream: "#F4EDE0",
        coral: "#FF6B5B",
        base: { DEFAULT: v("base"), dark: v("base") },          // page background (paper / navy)
        surface: { DEFAULT: v("surface"), dark: v("surface") }, // cards
        ink: {
          DEFAULT: v("ink"),
          muted: v("ink-muted"),
          dark: v("ink"),
          "muted-dark": v("ink-muted"),
        },
        rose: { DEFAULT: v("rose"), soft: v("rose-soft") },       // coral accent
        violet: { DEFAULT: v("violet"), soft: v("violet-soft") }, // navy accent / fertile window
        sage: { DEFAULT: v("sage"), soft: v("sage-soft") },       // low-fertility days
        amber: { DEFAULT: v("amber"), soft: v("amber-soft") },    // period days (coral)
        peak: { DEFAULT: v("peak"), soft: v("peak-soft") },       // ovulation (navy tile)
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Raised object: top highlight + contact shadow + soft drop shadow
        "neo": "inset 0 1px 0 rgb(var(--hi) / var(--hi-a)), 0 1px 1px rgb(var(--sh) / .16), 0 8px 20px -6px rgb(var(--sh) / .28)",
        "neo-sm": "inset 0 1px 0 rgb(var(--hi) / var(--hi-a)), 0 1px 1px rgb(var(--sh) / .18), 0 3px 6px -2px rgb(var(--sh) / .25)",
        // Recessed well, like a slot pressed into the surface
        "neo-inset": "inset 0 2px 5px rgb(var(--sh) / .28), inset 0 -1px 0 rgb(var(--hi) / var(--hi-a))",
        "neo-inset-sm": "inset 0 1px 3px rgb(var(--sh) / .25), inset 0 -1px 0 rgb(var(--hi) / var(--hi-a))",
        "neo-dark": "inset 0 1px 0 rgb(var(--hi) / var(--hi-a)), 0 1px 1px rgb(var(--sh) / .16), 0 8px 20px -6px rgb(var(--sh) / .28)",
        "neo-inset-dark": "inset 0 2px 5px rgb(var(--sh) / .28), inset 0 -1px 0 rgb(var(--hi) / var(--hi-a))",
      },
      borderRadius: {
        "neo": "0.875rem",
        "neo-lg": "0.75rem",
      },
      keyframes: {
        "press": { "0%": { transform: "translateY(0)" }, "50%": { transform: "translateY(1px)" }, "100%": { transform: "translateY(0)" } },
      },
      animation: {
        press: "press 160ms ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
