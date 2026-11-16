import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Plain quotes/apostrophes in JSX text render fine in React.
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "mobile/**", "next-env.d.ts"]),
]);
