/** Hard validation failure — unknown SKU or $0 line. Never priced as $0, never silent. */
export class PricingValidationError extends Error {
  readonly code: "MANUAL_PRICE_REQUIRED" | "VALIDATION_ERROR";
  readonly sku: string | undefined;
  readonly buildingId: string | undefined;

  constructor(
    code: "MANUAL_PRICE_REQUIRED" | "VALIDATION_ERROR",
    message: string,
    detail?: { sku?: string; buildingId?: string },
  ) {
    super(message);
    this.name = "PricingValidationError";
    this.code = code;
    this.sku = detail?.sku;
    this.buildingId = detail?.buildingId;
  }
}
