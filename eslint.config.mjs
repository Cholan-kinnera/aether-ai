// ESLint for the no-build frontend, the node:test helpers and the Playwright specs.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["src/aether/static/vendor/**", "node_modules/**", ".venv/**", "test-results/**", "playwright-report/**"] },
  js.configs.recommended,
  {
    files: ["src/aether/static/js/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, gsap: "readonly", ScrollTrigger: "readonly", Lenis: "readonly" },
    },
  },
  // motion.js and cursor.js are classic scripts (IIFEs), loaded after the vendored globals.
  { files: ["src/aether/static/js/motion.js", "src/aether/static/js/cursor.js"], languageOptions: { sourceType: "script" } },
  { files: ["tests/**/*.mjs", "*.mjs"], languageOptions: { globals: globals.node } },
  // Playwright callbacks passed to page.evaluate run in the browser.
  { files: ["tests/e2e/**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    rules: {
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-implicit-globals": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-console": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-param-reassign": "error",
      "no-shadow": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      curly: ["error", "multi-line"],
      complexity: ["error", 12],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ["tests/**/*.mjs"], rules: { "max-lines-per-function": "off" } },
];
