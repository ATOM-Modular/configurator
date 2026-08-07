import type {
  InternalEstimate,
  PriceLine,
  PublicBuildingEstimate,
  PublicEstimate,
} from "@atom/contracts";

/**
 * Strip every cost/GP field from an internal estimate.
 *
 * SECURITY-CRITICAL. The public response is constructed FIELD-BY-FIELD —
 * never via object spread — so a new internal field can never leak by
 * default. The contract test additionally deep-scans the serialized output
 * for forbidden keys.
 */
export function toPublic(internal: InternalEstimate): PublicEstimate {
  const perBuilding: PublicBuildingEstimate[] = internal.perBuilding.map((b) => ({
    id: b.id,
    subtotal_exGst: b.subtotal_exGst,
    lines: b.lines.map(stripLine),
  }));

  return {
    mode: "public",
    total_exGst: internal.total_exGst,
    gst: internal.gst,
    total_incGst: internal.total_incGst,
    perBuilding,
    siteKit_exGst: internal.siteKit_exGst,
    warnings: internal.warnings.map((w) => ({
      code: w.code,
      message: w.message,
      ...(w.buildingId !== undefined ? { buildingId: w.buildingId } : {}),
    })),
  };
}

function stripLine(line: PriceLine): PriceLine {
  return {
    label: line.label,
    qty: line.qty,
    amount_exGst: line.amount_exGst,
    ...(line.sku !== undefined ? { sku: line.sku } : {}),
  };
}
