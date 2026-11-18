import type { CyclePhase } from "./predictions";

/**
 * Short, general-wellness notes for each cycle phase (the "today's
 * insight" cards in Flo / Stardust). Written as common experiences, not
 * instructions — everyone's cycle feels different.
 */
export const PHASE_INFO: Record<CyclePhase, { name: string; summary: string; tips: string[] }> = {
  menstrual: {
    name: "Menstrual phase",
    summary: "Your period. Estrogen and progesterone are at their lowest, so many people feel lower on energy.",
    tips: [
      "Heat on the lower belly and gentle movement like walking or stretching can ease cramps.",
      "Iron-rich foods (beans, leafy greens, red meat) help replace iron lost with bleeding.",
      "Log your flow each day so CycleWise can learn your period length.",
    ],
  },
  follicular: {
    name: "Follicular phase",
    summary: "Estrogen is rising as your body prepares to ovulate. Energy and mood often lift.",
    tips: [
      "A good window for harder workouts and starting new things, if you feel up to it.",
      "Track cervical mucus. It usually gets wetter and clearer as ovulation approaches.",
    ],
  },
  ovulatory: {
    name: "Ovulation window",
    summary: "An egg is released around now. This is the most fertile point in the cycle.",
    tips: [
      "Stretchy, clear \"egg-white\" mucus and a positive LH test are both signs ovulation is close.",
      "Taking your temperature each morning lets CycleWise confirm ovulation once it has happened.",
    ],
  },
  luteal: {
    name: "Luteal phase",
    summary: "Progesterone rises after ovulation. Later in this phase some people notice PMS like bloating, cravings or mood changes.",
    tips: [
      "Regular meals, sleep and magnesium-rich foods (nuts, seeds, dark chocolate) may help with PMS.",
      "If you notice the same symptoms every cycle, CycleWise will spot the pattern and warn you ahead of time.",
    ],
  },
};
