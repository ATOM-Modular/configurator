import { useRef, useState } from "react";
import { footprint, walkwayGeometry, WALKWAY_WIDTH_M } from "./geometry";
import { siteKitDef } from "./siteKitCatalog";
import { SNAP_M, useConfigurator } from "../state/store";
import { PlanTitleblock, CONCEPT_STAMP } from "../studio/plan/PlanTitleblock";

const PAD_M = 3;

/** Top-down site plan: drag buildings/kit on a 0.1m snap grid. */
export function SiteCanvas() {
  const s = useConfigurator();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<
    | { kind: "building" | "kit"; id: string; dxM: number; dzM: number }
    | null
  >(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // view bounds cover every element plus padding
  const bounds = (() => {
    let x0 = 0, x1 = 12, z0 = 0, z1 = 8;
    for (const b of s.buildings) {
      const f = footprint(b);
      x0 = Math.min(x0, f.x0); x1 = Math.max(x1, f.x1);
      z0 = Math.min(z0, f.z0); z1 = Math.max(z1, f.z1);
    }
    for (const k of s.siteKit) {
      const def = siteKitDef(k.sku);
      const [w, d] = def?.sizeM ?? [1, 1];
      x0 = Math.min(x0, k.xM); x1 = Math.max(x1, k.xM + w);
      z0 = Math.min(z0, k.zM); z1 = Math.max(z1, k.zM + d);
    }
    return { x0: x0 - PAD_M, x1: x1 + PAD_M, z0: z0 - PAD_M, z1: z1 + PAD_M };
  })();

  const viewW = bounds.x1 - bounds.x0;
  const viewH = bounds.z1 - bounds.z0;

  const toSite = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      xM: bounds.x0 + ((clientX - r.left) / r.width) * viewW,
      zM: bounds.z0 + ((clientY - r.top) / r.height) * viewH,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toSite(e.clientX, e.clientY);
    const { kind, id, dxM, dzM } = drag.current;
    if (kind === "building") s.moveBuilding(id, p.xM - dxM, p.zM - dzM);
    else s.moveSiteKit(id, p.xM - dxM, p.zM - dzM);
  };

  const endDrag = () => (drag.current = null);

  const activeBuilding = s.buildings.find((b) => b.id === s.activeId);

  return (
    <div className="site-canvas-wrap">
      <svg
        ref={svgRef}
        className="site-canvas"
        viewBox={`${bounds.x0} ${bounds.z0} ${viewW} ${viewH}`}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <defs>
          <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e5e5e5" strokeWidth="0.02" />
          </pattern>
        </defs>
        {/* white drawing sheet + faint site grid — matches the building GA look */}
        <rect x={bounds.x0} y={bounds.z0} width={viewW} height={viewH} fill="#fff" />
        <rect x={bounds.x0} y={bounds.z0} width={viewW} height={viewH} fill="url(#grid)" />

        {/* walkways (drawn under buildings) */}
        {s.walkways.map((w) => {
          const from = s.buildings.find((b) => b.id === w.fromBuildingId);
          const to = s.buildings.find((b) => b.id === w.toBuildingId);
          if (!from || !to) return null;
          const link = walkwayGeometry(from, to);
          if (!link) return null;
          const [ox, , oz] = link.origin;
          const isX = link.axis === "x";
          return (
            <rect
              key={w.id}
              x={ox}
              y={oz}
              width={isX ? link.gapM : WALKWAY_WIDTH_M}
              height={isX ? WALKWAY_WIDTH_M : link.gapM}
              className={`plan-walkway ${w.elevated ? "elevated" : ""}`}
              onClick={() => s.toggleWalkwayElevated(w.id)}
            />
          );
        })}

        {/* site kit */}
        {s.siteKit.map((k) => {
          const def = siteKitDef(k.sku);
          const [w, d] = def?.sizeM ?? [1, 1];
          return (
            <g key={k.id}>
              <rect
                x={k.xM}
                y={k.zM}
                width={w}
                height={d}
                className="plan-kit"
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  const p = toSite(e.clientX, e.clientY);
                  drag.current = { kind: "kit", id: k.id, dxM: p.xM - k.xM, dzM: p.zM - k.zM };
                }}
                onDoubleClick={() => s.removeSiteKit(k.id)}
              >
                <title>{k.label} (double-click to remove)</title>
              </rect>
            </g>
          );
        })}

        {/* buildings */}
        {s.buildings.map((b) => {
          const f = footprint(b);
          const selected = b.id === s.activeId;
          const linking = s.walkwayFromId === b.id;
          return (
            <g key={b.id}>
              <rect
                x={f.x0}
                y={f.z0}
                width={f.x1 - f.x0}
                height={f.z1 - f.z0}
                className={`plan-building ${selected ? "selected" : ""} ${linking ? "linking" : ""} ${
                  hoverId === b.id ? "hover" : ""
                }`}
                onPointerEnter={() => setHoverId(b.id)}
                onPointerLeave={() => setHoverId(null)}
                onPointerDown={(e) => {
                  if (s.walkwayFromId) {
                    s.completeWalkway(b.id);
                    return;
                  }
                  (e.target as Element).setPointerCapture(e.pointerId);
                  s.selectBuilding(b.id);
                  const p = toSite(e.clientX, e.clientY);
                  drag.current = {
                    kind: "building",
                    id: b.id,
                    dxM: p.xM - b.placement.xM,
                    dzM: p.zM - b.placement.zM,
                  };
                }}
              />
              <text
                x={(f.x0 + f.x1) / 2}
                y={(f.z0 + f.z1) / 2}
                className="plan-building-label"
              >
                {b.name.toUpperCase()}
              </text>
              <text x={f.x0 + 0.15} y={f.z1 - 0.2} className="plan-ffl">
                FFL {b.ffl_mm}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="dwg-stamp-overlay">{CONCEPT_STAMP}</div>
      <p className="muted">
        Grid 1m · snap {SNAP_M * 1000}mm · drag to move · double-click kit to remove
      </p>
      <PlanTitleblock projectName={activeBuilding?.name ?? "Site"} scale="Site plan (concept)" />
    </div>
  );
}
