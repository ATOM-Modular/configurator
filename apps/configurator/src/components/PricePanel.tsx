import { useEffect, useMemo, useState } from "react";
import type { PriceLine, SiteConfig } from "@atom/contracts";
import { isInternal, usePrice } from "../hooks/usePrice";
import { IS_INTERNAL_BUILD } from "../internal/flag";
import { InternalMetrics } from "../internal/InternalMetrics";
import { useConfigurator } from "../state/store";
import { EnquiryModal } from "./EnquiryModal";

const aud = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

/** Group price lines into display categories by SKU prefix. */
function categoryOf(line: PriceLine): string {
  const sku = line.sku ?? "";
  if (/^(CHASSIS|TEE-JOIN|FOOTING)/.test(sku)) return "Structure";
  if (/^(PANEL|CEILING|ROOF|FLOOR|GUTTER)/.test(sku)) return "Envelope";
  if (/^(DOOR|WINDOW)/.test(sku)) return "Doors & windows";
  if (/^(AC-|POWER|GPO|LIGHT|DATA)/.test(sku)) return "Electrical & AC";
  if (/^(BATH|KITCHEN|HWS)/.test(sku)) return "Wet areas & plumbing";
  return "Other";
}

const CATEGORY_ORDER = [
  "Structure",
  "Envelope",
  "Doors & windows",
  "Electrical & AC",
  "Wet areas & plumbing",
  "Other",
];

export function PricePanel({ site }: { site: SiteConfig }) {
  const internalToken = useConfigurator((s) => s.internalToken);
  const setInternalToken = useConfigurator((s) => s.setInternalToken);
  const { estimate, deltaExGst, deltaSeq, loading, error, unauthorized } = usePrice(
    site,
    internalToken,
  );
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  // The delta badge is a transient FLASH, not a persistent value — show it only
  // for a moment after each change, otherwise the last delta lingers forever.
  const [flashDelta, setFlashDelta] = useState(false);
  useEffect(() => {
    if (deltaSeq === 0) return;
    setFlashDelta(true);
    const t = setTimeout(() => setFlashDelta(false), 2400);
    return () => clearTimeout(t);
  }, [deltaSeq]);

  const categories = useMemo(() => {
    if (!estimate) return [];
    const sums = new Map<string, number>();
    for (const b of estimate.perBuilding) {
      for (const line of b.lines) {
        const cat = categoryOf(line);
        sums.set(cat, (sums.get(cat) ?? 0) + line.amount_exGst);
      }
    }
    return CATEGORY_ORDER.filter((c) => sums.has(c)).map((c) => ({
      name: c,
      amount: sums.get(c)!,
    }));
  }, [estimate]);

  const internal = estimate && isInternal(estimate) ? estimate : null;

  const exportEstimate = () => {
    if (!estimate) return;
    const blob = new Blob([JSON.stringify({ site, estimate }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "atom-estimate.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <aside className="price-panel docked">
      <h2>
        {internal ? "Estimate — internal" : "Live price"}
        {loading && <span className="pulse" aria-label="updating" />}
      </h2>

      {error && <p className="warn-inline">{error}</p>}

      {estimate && (
        <>
          <div className="total-row">
            <span className="big-total">{aud(estimate.total_exGst)}</span>
            <span className="ex">ex GST</span>
            {flashDelta && deltaExGst !== null && deltaExGst !== 0 && (
              <span
                key={deltaSeq}
                className={`delta ${deltaExGst > 0 ? "up" : "down"}`}
              >
                {deltaExGst > 0 ? "+" : "−"}
                {aud(Math.abs(deltaExGst)).replace("$", "$")}
              </span>
            )}
          </div>
          <div className="row muted-row">
            <span>inc GST</span>
            <span>{aud(estimate.total_incGst)}</span>
          </div>

          <div className="categories">
            {categories.map((c) => (
              <div className="row" key={c.name}>
                <span>{c.name}</span>
                <span>{aud(c.amount)}</span>
              </div>
            ))}
          </div>

          {internal && <InternalMetrics estimate={internal} />}

          {estimate.warnings.length > 0 && (
            <div className="warnings">
              {estimate.warnings.map((w, i) => (
                <span className="chip" key={i} title={w.message}>
                  {w.code}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {internal ? (
        <button className="primary cta" onClick={exportEstimate} disabled={!estimate}>
          Export estimate
        </button>
      ) : (
        <button className="primary cta" onClick={() => setEnquiryOpen(true)} disabled={!estimate}>
          Get a detailed quote
        </button>
      )}

      {IS_INTERNAL_BUILD && (
        <details className="internal-auth">
          <summary>Internal</summary>
          <input
            type="password"
            placeholder="Internal API token"
            value={internalToken}
            onChange={(e) => setInternalToken(e.target.value)}
          />
          {unauthorized && internalToken && <p className="warn-inline">Token rejected.</p>}
        </details>
      )}

      <p className="muted">Placeholder rates — not a quote.</p>

      {enquiryOpen && estimate && (
        <EnquiryModal site={site} totalExGst={estimate.total_exGst} onClose={() => setEnquiryOpen(false)} />
      )}
    </aside>
  );
}
