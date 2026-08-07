/**
 * API contract tests — SPEC Security rules #2 and #3.
 */
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type {
  InternalEstimate,
  PriceRequest,
  PricingErrorBody,
  PublicEstimate,
} from "@atom/contracts";

const TOKEN = "test-secret-token";
const app = createApp({ internalApiToken: TOKEN });

function officeSiteRequest(mode: "public" | "internal"): PriceRequest {
  return {
    mode,
    site: {
      windRegion: "AB",
      buildings: [
        {
          id: "office-1",
          use: "Office",
          lengthM: 6,
          widthM: 3,
          ffl_mm: 765,
          chassis: "office",
          panels: { type: "EPS-FR", wallMm: 50, ceilingMm: 50, colour: "Surfmist" },
          rooms: [],
          fitout: [{ sku: "DOOR-920-SC", qty: 1 }],
        },
      ],
      siteKit: [{ sku: "STEPS-DOUBLE", qty: 1 }],
    },
  };
}

async function postPrice(body: unknown, headers: Record<string, string> = {}) {
  return app.request("/price", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /price — public mode", () => {
  it("returns sale prices with no auth required", async () => {
    const res = await postPrice(officeSiteRequest("public"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as PublicEstimate;
    expect(json.mode).toBe("public");
    expect(json.total_exGst).toBeGreaterThan(0);
    expect(json.total_incGst).toBeCloseTo(json.total_exGst + json.gst, 2);
  });

  it("CONTRACT: public response contains no cost/GP field at any depth", async () => {
    const res = await postPrice(officeSiteRequest("public"));
    const raw = await res.text();
    for (const forbidden of ["standardCost", "gpPercent", "costPerSqm", "pricePerSqm", "salePrice", "totals"]) {
      expect(raw.includes(forbidden), `public response leaked "${forbidden}"`).toBe(false);
    }
  });
});

describe("POST /price — internal mode auth", () => {
  it("rejects internal mode without a token", async () => {
    const res = await postPrice(officeSiteRequest("internal"));
    expect(res.status).toBe(401);
  });

  it("rejects internal mode with a wrong token", async () => {
    const res = await postPrice(officeSiteRequest("internal"), {
      authorization: "Bearer wrong",
    });
    expect(res.status).toBe(401);
  });

  it("returns the full estimate with a valid token", async () => {
    const res = await postPrice(officeSiteRequest("internal"), {
      authorization: `Bearer ${TOKEN}`,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as InternalEstimate;
    expect(json.mode).toBe("internal");
    expect(json.totals.standardCost).toBeGreaterThan(0);
    expect(json.perBuilding[0]!.gpPercent).toBeGreaterThan(0);
  });

  it("default-denies internal mode when no token is configured", async () => {
    const noTokenApp = createApp({ internalApiToken: undefined });
    const res = await noTokenApp.request("/price", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer anything",
      },
      body: JSON.stringify(officeSiteRequest("internal")),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /price — validation", () => {
  it("unknown SKU returns 422 MANUAL_PRICE_REQUIRED, never a $0 line", async () => {
    const bad = officeSiteRequest("public");
    bad.site.buildings[0]!.fitout.push({ sku: "NOT-A-SKU", qty: 1 });
    const res = await postPrice(bad);
    expect(res.status).toBe(422);
    const json = (await res.json()) as PricingErrorBody;
    expect(json.error).toBe("MANUAL_PRICE_REQUIRED");
    expect(json.detail?.sku).toBe("NOT-A-SKU");
  });

  it("bad mode returns 400", async () => {
    const res = await postPrice({ mode: "nope", site: {} });
    expect(res.status).toBe(400);
  });
});
