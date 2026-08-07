/**
 * SECURITY BOUNDARY (SPEC.md — Security rules #1)
 *
 * apps/configurator is the PUBLIC bundle. It must NEVER import the pricing
 * engine or the rate catalog. Types it needs live in @atom/contracts.
 * CI additionally greps the built public bundle for cost/GP strings.
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  ignorePatterns: ["dist/", "node_modules/", "*.cjs", "*.mjs"],
  overrides: [
    {
      // The public app: hard boundary against engine/catalog.
      files: ["apps/configurator/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@atom/blaise-engine", "@atom/blaise-engine/*"],
                message:
                  "SECURITY: the public configurator must never import the pricing engine. Use @atom/contracts types and call the pricing API.",
              },
              {
                group: ["@atom/catalog", "@atom/catalog/*"],
                message:
                  "SECURITY: the public configurator must never import the rate catalog. Rates stay server-side.",
              },
              {
                group: ["**/blaise-engine/**", "**/catalog/**"],
                message:
                  "SECURITY: no relative-path escape hatch into engine/catalog packages.",
              },
            ],
          },
        ],
      },
    },
  ],
};
