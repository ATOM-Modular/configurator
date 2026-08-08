import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/**
 * SECURITY (SPEC rule #1): internal-only UI must never reach the public
 * bundle. Unless VITE_INTERNAL=true, `src/internal/InternalMetrics` is
 * aliased to a stub containing none of the forbidden cost/GP strings.
 * CI greps dist/ to prove it.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isInternal = env.VITE_INTERNAL === "true";

  return {
    plugins: [react()],
    resolve: {
      alias: isInternal
        ? []
        : [
            {
              find: /^(?:\.\.?\/)+internal\/InternalMetrics$/,
              replacement: fileURLToPath(
                new URL("./src/internal/InternalMetrics.stub.tsx", import.meta.url),
              ),
            },
          ],
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // The app never computes a dollar — it POSTs config to the pricing API.
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
