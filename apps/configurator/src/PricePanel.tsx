import { useEffect, useState } from "react";
import type { PublicEstimate } from "@atom/contracts";
import { demoSiteConfig } from "./demo-site";

const aud = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; estimate: PublicEstimate };

export function PricePanel() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "public", site: demoSiteConfig }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`pricing API ${res.status}`);
        setState({ kind: "ready", estimate: (await res.json()) as PublicEstimate });
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted)
          setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <aside className="price-panel">
      <h2>Live price — public mode</h2>
      {state.kind === "loading" && <p className="muted">Pricing…</p>}
      {state.kind === "error" && (
        <p className="muted">Pricing API unavailable ({state.message}). Start it with INTERNAL_API_TOKEN unset for public-only.</p>
      )}
      {state.kind === "ready" && (
        <>
          {state.estimate.perBuilding.map((b) => (
            <div className="row" key={b.id}>
              <span>{b.id}</span>
              <span>{aud(b.subtotal_exGst)}</span>
            </div>
          ))}
          <div className="row">
            <span>site kit</span>
            <span>{aud(state.estimate.siteKit_exGst)}</span>
          </div>
          <div className="row total">
            <span>Total ex GST</span>
            <span>{aud(state.estimate.total_exGst)}</span>
          </div>
          <div className="row">
            <span>GST</span>
            <span>{aud(state.estimate.gst)}</span>
          </div>
          <div className="row total inc">
            <span>Total inc GST</span>
            <span>{aud(state.estimate.total_incGst)}</span>
          </div>
          {state.estimate.warnings.length > 0 && (
            <div className="warnings">
              {state.estimate.warnings.map((w, i) => (
                <span className="chip" key={i} title={w.message}>
                  {w.code}
                </span>
              ))}
            </div>
          )}
          <p className="muted">Placeholder rates — not a quote.</p>
        </>
      )}
    </aside>
  );
}
