import { useEffect, useRef, useState } from "react";
import type { InternalEstimate, PricedEstimate, SiteConfig } from "@atom/contracts";

const DEBOUNCE_MS = 300;

export interface PriceState {
  estimate: PricedEstimate | null;
  /** signed change of total_exGst vs the previous estimate; null until 2nd result */
  deltaExGst: number | null;
  /** monotonically increasing — key for re-triggering the delta flash */
  deltaSeq: number;
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
}

export function isInternal(e: PricedEstimate): e is InternalEstimate {
  return e.mode === "internal";
}

/**
 * SPEC price panel: 300ms debounce → POST /price → delta badge.
 * The app never computes a dollar — this hook only transports.
 */
export function usePrice(site: SiteConfig, internalToken: string): PriceState {
  const [state, setState] = useState<PriceState>({
    estimate: null,
    deltaExGst: null,
    deltaSeq: 0,
    loading: true,
    error: null,
    unauthorized: false,
  });
  const prevTotal = useRef<number | null>(null);

  // Re-fetch only when the priced content actually changes.
  const body = JSON.stringify({
    mode: internalToken ? "internal" : "public",
    site,
  });

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true }));

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/price", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(internalToken ? { authorization: `Bearer ${internalToken}` } : {}),
          },
          body,
          signal: ctrl.signal,
        });
        if (res.status === 401) {
          setState((s) => ({ ...s, loading: false, unauthorized: true, error: null }));
          return;
        }
        if (res.status === 422) {
          const err = (await res.json()) as { message?: string };
          setState((s) => ({
            ...s,
            loading: false,
            unauthorized: false,
            error: err.message ?? "Manual price required",
          }));
          return;
        }
        if (!res.ok) throw new Error(`pricing API ${res.status}`);

        const estimate = (await res.json()) as PricedEstimate;
        const delta =
          prevTotal.current !== null && prevTotal.current !== estimate.total_exGst
            ? estimate.total_exGst - prevTotal.current
            : null;
        prevTotal.current = estimate.total_exGst;
        setState((s) => ({
          estimate,
          deltaExGst: delta !== null ? delta : s.deltaExGst,
          deltaSeq: delta !== null ? s.deltaSeq + 1 : s.deltaSeq,
          loading: false,
          error: null,
          unauthorized: false,
        }));
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    }, DEBOUNCE_MS);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [body, internalToken]);

  return state;
}
