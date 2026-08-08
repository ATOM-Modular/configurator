/**
 * INTERNAL BUILD ONLY — never compiled into the public bundle.
 *
 * vite.config.ts aliases this module to ./InternalMetrics.stub.tsx unless
 * VITE_INTERNAL=true, so the cost/GP field names below cannot reach a
 * public build (CI greps dist/ for exactly these strings).
 */
import type { InternalEstimate } from "@atom/contracts";

const aud = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export function InternalMetrics({ estimate }: { estimate: InternalEstimate }) {
  const building = estimate.perBuilding[0];
  if (!building) return null;
  return (
    <div className="internal-metrics">
      <div className="row">
        <span>Standard cost</span>
        <span>{aud(estimate.totals.standardCost)}</span>
      </div>
      <div className="row">
        <span>GP%</span>
        <span>{estimate.totals.gpPercent.toFixed(1)}%</span>
      </div>
      <div className="row">
        <span>Cost / m²</span>
        <span>{aud(building.costPerSqm)}</span>
      </div>
      <div className="row">
        <span>Price / m²</span>
        <span>{aud(building.pricePerSqm)}</span>
      </div>
    </div>
  );
}
