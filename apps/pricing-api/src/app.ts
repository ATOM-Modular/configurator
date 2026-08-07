/**
 * POST /price — the ONLY pricing surface the configurator talks to.
 *
 *   mode=public   → sale prices only (no auth)
 *   mode=internal → full estimate incl. cost/GP (Bearer token auth;
 *                   Microsoft 365 SSO later)
 */
import { Hono } from "hono";
import { loadCatalog } from "@atom/catalog";
import { price, PricingValidationError } from "@atom/blaise-engine";
import type { PriceRequest, PricingErrorBody } from "@atom/contracts";

export interface AppEnv {
  /** Shared-secret for internal mode. Unset ⇒ internal mode is disabled. */
  internalApiToken: string | undefined;
}

export function createApp(env: AppEnv) {
  const app = new Hono();
  const catalog = loadCatalog();

  app.get("/health", (c) =>
    c.json({ ok: true, catalogVersion: catalog.version, placeholderRates: catalog.placeholder }),
  );

  app.post("/price", async (c) => {
    let body: PriceRequest;
    try {
      body = await c.req.json<PriceRequest>();
    } catch {
      return c.json<PricingErrorBody>(
        { error: "VALIDATION_ERROR", message: "Body must be JSON: { mode, site }" },
        400,
      );
    }

    if (body.mode !== "public" && body.mode !== "internal") {
      return c.json<PricingErrorBody>(
        { error: "VALIDATION_ERROR", message: 'mode must be "public" or "internal"' },
        400,
      );
    }

    // Internal mode is auth-gated. Default-deny when no token is configured.
    if (body.mode === "internal") {
      const auth = c.req.header("authorization");
      const expected = env.internalApiToken;
      if (!expected || auth !== `Bearer ${expected}`) {
        return c.json<PricingErrorBody>(
          { error: "UNAUTHORIZED", message: "Internal mode requires a valid bearer token" },
          401,
        );
      }
    }

    try {
      return c.json(price(body, catalog));
    } catch (e) {
      if (e instanceof PricingValidationError) {
        const detail: { sku?: string; buildingId?: string } = {};
        if (e.sku !== undefined) detail.sku = e.sku;
        if (e.buildingId !== undefined) detail.buildingId = e.buildingId;
        return c.json<PricingErrorBody>(
          { error: e.code, message: e.message, detail },
          422,
        );
      }
      throw e;
    }
  });

  return app;
}
