import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@atom/contracts": r("./packages/contracts/src/index.ts"),
      "@atom/catalog": r("./packages/catalog/src/index.ts"),
      "@atom/blaise-engine": r("./packages/blaise-engine/src/index.ts"),
      "@atom/assets": r("./packages/assets/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
  },
});
