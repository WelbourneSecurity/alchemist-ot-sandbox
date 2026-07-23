import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  { ignores: ["dist", "coverage", "*.config.js", "*.config.ts"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // react-hooks v6 ships two experimental rules that flag correct, common
      // patterns here — the latest-handler ref (useKeyboardShortcuts) and a
      // modal resetting its step on open. Off until they stabilise.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // Accessibility is enforced as warnings on this existing codebase: the
      // gate stays green while the pre-existing findings (mostly redundant
      // click-to-close backdrops that already close on Escape) are burned down
      // separately. Correctness rules above remain errors and block merges.
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/no-noninteractive-tabindex": "warn",
    },
  },
  // Test files: allow node + vitest globals.
  {
    files: ["src/**/*.test.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
);
