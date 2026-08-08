import { useEffect, useState } from "react";
import type { PublicEstimate, SiteConfig } from "@atom/contracts";
import {
  moduleCountFor,
  presetName,
  SIZE_PRESETS,
  suggestedOccupancy,
  type SizePreset,
} from "../state/presets";
import { useConfigurator } from "../state/store";

const aud = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

/** Base-shell config used for indicative from-pricing (1 door, 1 window). */
function fromPriceConfig(
  p: { lengthM: number; widthM: number },
  use: string,
  windRegion: SiteConfig["windRegion"],
): SiteConfig {
  return {
    windRegion,
    buildings: [
      {
        id: "card",
        use,
        lengthM: p.lengthM,
        widthM: p.widthM,
        ffl_mm: 450,
        chassis: use === "Toilet & Amenities" ? "toilet" : "office",
        panels: { type: "EPS-FR", wallMm: 50, ceilingMm: 50, colour: "Surfmist" },
        rooms: [],
        fitout: [
          { sku: use === "Toilet & Amenities" ? "DOOR-820-SC" : "DOOR-920-SC", qty: 1 },
          { sku: "WINDOW-SLIDING-1175", qty: 1 },
        ],
      },
    ],
    siteKit: [],
  };
}

function useFromPrice(p: { lengthM: number; widthM: number } | null) {
  const use = useConfigurator((s) => s.use);
  const windRegion = useConfigurator((s) => s.windRegion);
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!p) return;
    const ctrl = new AbortController();
    setPrice(null);
    fetch("/api/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "public", site: fromPriceConfig(p, use, windRegion) }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const est = (await res.json()) as PublicEstimate;
        setPrice(est.total_exGst);
      })
      .catch(() => setPrice(null));
    return () => ctrl.abort();
  }, [p?.lengthM, p?.widthM, use, windRegion]);

  return price;
}

/** Top-view footprint sketch — placeholder for render thumbnails. */
function Footprint({ p }: { p: SizePreset }) {
  const scale = 9;
  const w = p.lengthM * scale;
  const h = p.widthM * scale;
  const modules = moduleCountFor(p.widthM);
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} className="footprint" aria-hidden>
      <rect x="0" y="0" width={w} height={h} rx="2" />
      {Array.from({ length: modules - 1 }, (_, i) => (
        <line key={i} x1="0" x2={w} y1={(i + 1) * 3 * scale} y2={(i + 1) * 3 * scale} />
      ))}
    </svg>
  );
}

function PresetCard({ p }: { p: SizePreset }) {
  const use = useConfigurator((s) => s.use);
  const setDims = useConfigurator((s) => s.setDims);
  const setStep = useConfigurator((s) => s.setStep);
  const price = useFromPrice(p);
  const area = p.lengthM * p.widthM;
  const occupancy = suggestedOccupancy(area, use);
  const modules = moduleCountFor(p.widthM);

  return (
    <button
      className="catalog-card"
      onClick={() => {
        setDims(p.lengthM, p.widthM);
        setStep(3);
      }}
    >
      <Footprint p={p} />
      <h3>{presetName(p, use)}</h3>
      <dl>
        <div>
          <dt>Floor area</dt>
          <dd>{area.toFixed(1)} m²</dd>
        </div>
        {occupancy !== null && (
          <div>
            <dt>Suggested occupancy</dt>
            <dd>{occupancy} people</dd>
          </div>
        )}
        <div>
          <dt>Transport modules</dt>
          <dd>{modules}</dd>
        </div>
      </dl>
      <div className="from-price">
        {price !== null ? (
          <>
            from <strong>{aud(price)}</strong> ex GST
          </>
        ) : (
          <span className="muted">pricing…</span>
        )}
      </div>
    </button>
  );
}

function CustomCard() {
  const setDims = useConfigurator((s) => s.setDims);
  const setStep = useConfigurator((s) => s.setStep);
  const [len, setLen] = useState(7.2);
  const [wid, setWid] = useState(3);
  const modules = moduleCountFor(wid);
  const price = useFromPrice({ lengthM: len, widthM: wid });

  return (
    <div className="catalog-card custom">
      <h3>Custom size</h3>
      <label>
        Length (m)
        <input
          type="number"
          min={2.4}
          max={15}
          step={0.3}
          value={len}
          onChange={(e) => setLen(Number(e.target.value))}
        />
      </label>
      <label>
        Width (m)
        <input
          type="number"
          min={2.4}
          max={9}
          step={0.3}
          value={wid}
          onChange={(e) => setWid(Number(e.target.value))}
        />
      </label>
      <p className="module-feedback">
        {modules} transport module{modules > 1 ? "s" : ""}
        {modules > 1 && " — multi-module build (tee joins added)"}
      </p>
      <div className="from-price">
        {price !== null && (
          <>
            from <strong>{aud(price)}</strong> ex GST
          </>
        )}
      </div>
      <button
        className="primary"
        onClick={() => {
          setDims(len, wid);
          setStep(3);
        }}
      >
        Design this size →
      </button>
    </div>
  );
}

export function Step2Catalog() {
  const use = useConfigurator((s) => s.use);
  return (
    <section className="step-page">
      <h1>{use} buildings</h1>
      <p className="muted">
        Sizes step in 3m transport-module increments. Prices are indicative base-shell
        figures ex GST — placeholder rates.
      </p>
      <div className="catalog-grid">
        {SIZE_PRESETS.map((p) => (
          <PresetCard key={p.key} p={p} />
        ))}
        <CustomCard />
      </div>
    </section>
  );
}
