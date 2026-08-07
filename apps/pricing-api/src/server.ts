import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const app = createApp({ internalApiToken: process.env.INTERNAL_API_TOKEN });

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`pricing-api listening on http://localhost:${info.port}`);
  if (!process.env.INTERNAL_API_TOKEN) {
    // eslint-disable-next-line no-console
    console.warn("INTERNAL_API_TOKEN not set — internal mode is DISABLED (default-deny).");
  }
});
