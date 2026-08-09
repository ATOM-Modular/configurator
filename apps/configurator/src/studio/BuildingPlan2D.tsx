import { useEffect, useRef, useState, type ReactElement } from "react";
import { axisSnapEnd, useActiveBuilding, useConfigurator, wallLengthM } from "../state/store";
import { CATALOGUE_BY_SKU } from "./catalogueData";
import { getDragged } from "./drag";

type Mode = "select" | "wall";
type Sel = { kind: "item" | "wall" | "opening"; id: string } | null;
type Box = { vx: number; vy: number; vw: number; vh: number };

const PAD = 0.8;
const BAY = 1.2;

/**
 * Floorplanner-style 2D editor inside the fixed chassis shell.
 *  - Draw Wall: click start then end → internal-wall segment with a live
 *    length label; total l.m. is Blaise's "Internal Walls Lm".
 *  - Fit-out: drag a catalogue card in → a positioned object; drag to move,
 *    select to rotate / delete. Count per SKU drives the price.
 *  - Openings sit on the shell walls: select, slide along the wall, delete.
 *  - Pan (drag empty space) and zoom (wheel).
 */
export function BuildingPlan2D() {
  const b = useActiveBuilding();
  const s = useConfigurator();
  const svgRef = useRef<SVGSVGElement>(null);
  const L = b.lengthM;
  const W = b.widthM;

  const [mode, setMode] = useState<Mode>("select");
  const [wallStart, setWallStart] = useState<{ xM: number; zM: number } | null>(null);
  const [cursor, setCursor] = useState<{ xM: number; zM: number } | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [box, setBox] = useState<Box>({ vx: -PAD, vy: -PAD, vw: L + 2 * PAD, vh: W + 2 * PAD });

  // reset the view when the building changes
  useEffect(() => {
    setBox({ vx: -PAD, vy: -PAD, vw: L + 2 * PAD, vh: W + 2 * PAD });
    setSel(null);
  }, [b.id, L, W]);

  const drag = useRef<
    | { kind: "item" | "opening"; id: string }
    | { kind: "wallnode"; id: string; end: 1 | 2 }
    | { kind: "pan"; startClientX: number; startClientY: number; startBox: Box }
    | null
  >(null);

  const toM = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      xM: box.vx + ((clientX - r.left) / r.width) * box.vw,
      zM: box.vy + ((clientY - r.top) / r.height) * box.vh,
    };
  };

  // ---- opening geometry on the shell ----
  const openingPos = (o: (typeof b.openings)[number]) => {
    const bays = o.partId.includes("1600") ? 2 : 1;
    const along = o.startBay * BAY + (bays * BAY) / 2;
    if (o.elevation === "south") return { x: along, z: 0, horiz: true };
    if (o.elevation === "north") return { x: along, z: W, horiz: true };
    if (o.elevation === "west") return { x: 0, z: along, horiz: false };
    return { x: L, z: along, horiz: false };
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const item = getDragged();
    if (!item) return;
    const { xM, zM } = toM(e.clientX, e.clientY);
    if (item.kind === "counted" && item.sku) {
      setSel({ kind: "item", id: s.placeItem(item.sku, xM, zM) });
    } else if (item.kind === "partition") {
      setMode("wall");
      setWallStart(null);
    } else if (item.kind === "opening" && item.partId) {
      const dist = { south: zM, north: W - zM, west: xM, east: L - xM };
      const elevation = Object.entries(dist).sort((a, c) => a[1] - c[1])[0]![0] as
        | "south" | "north" | "east" | "west";
      const along = elevation === "south" || elevation === "north" ? xM : zM;
      s.setPendingOpening(item.partId);
      s.placePendingOpening(elevation, Math.max(0, Math.floor(along / BAY)));
    }
  };

  const onSvgPointerDown = (e: React.PointerEvent) => {
    if (mode !== "select") return;
    if ((e.target as Element).classList.contains("plan-bg")) {
      setSel(null);
      (e.target as Element).setPointerCapture(e.pointerId);
      drag.current = { kind: "pan", startClientX: e.clientX, startClientY: e.clientY, startBox: box };
    }
  };

  const onSvgPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d?.kind === "pan") {
      const r = svgRef.current!.getBoundingClientRect();
      const dx = ((e.clientX - d.startClientX) / r.width) * d.startBox.vw;
      const dy = ((e.clientY - d.startClientY) / r.height) * d.startBox.vh;
      setBox({ ...d.startBox, vx: d.startBox.vx - dx, vy: d.startBox.vy - dy });
    } else if (d?.kind === "item") {
      const m = toM(e.clientX, e.clientY);
      s.moveItem(d.id, m.xM, m.zM);
    } else if (d?.kind === "opening") {
      const o = b.openings.find((x) => x.id === d.id);
      if (o) {
        const m = toM(e.clientX, e.clientY);
        const along = o.elevation === "south" || o.elevation === "north" ? m.xM : m.zM;
        s.moveOpeningBay(d.id, Math.max(0, Math.floor(along / BAY)));
      }
    } else if (d?.kind === "wallnode") {
      const m = toM(e.clientX, e.clientY);
      s.moveWallNode(d.id, d.end, m.xM, m.zM);
    } else if (mode === "wall") {
      setCursor(toM(e.clientX, e.clientY));
    }
  };

  const onSvgClick = (e: React.MouseEvent) => {
    if (mode !== "wall") return;
    const { xM, zM } = toM(e.clientX, e.clientY);
    if (!wallStart) setWallStart({ xM, zM });
    else {
      const end = axisSnapEnd(wallStart.xM, wallStart.zM, xM, zM);
      s.addWall(wallStart.xM, wallStart.zM, end.x, end.z);
      setWallStart(null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const px = box.vx + fx * box.vw;
    const py = box.vy + fy * box.vh;
    const f = e.deltaY < 0 ? 0.9 : 1.1;
    const vw = Math.max(2, Math.min(40, box.vw * f));
    const vh = vw * (box.vh / box.vw);
    setBox({ vw, vh, vx: px - fx * vw, vy: py - fy * vh });
  };

  const totalWallLm = b.internalWalls.reduce((sum, w) => sum + wallLengthM(w), 0);

  return (
    <div className="fp-editor">
      <div className="fp-toolbar">
        <button className={mode === "select" ? "active" : ""} onClick={() => { setMode("select"); setWallStart(null); }}>
          <i className="ti ti-pointer" aria-hidden="true" /> Select
        </button>
        <button className={mode === "wall" ? "active" : ""} onClick={() => { setMode("wall"); setSel(null); }}>
          <i className="ti ti-wall" aria-hidden="true" /> Draw wall
        </button>
        <span className="fp-hint">
          {mode === "wall"
            ? wallStart ? "Click the wall's end point" : "Click the wall's start point"
            : "Drag fit-out in · drag to move · scroll to zoom · drag empty space to pan"}
        </span>
        {sel && (
          <span className="fp-selctl">
            {sel.kind === "item" && (
              <button onClick={() => s.rotateItem(sel.id, 90)} title="rotate">
                <i className="ti ti-rotate" aria-hidden="true" />
              </button>
            )}
            <button
              className="danger"
              title="delete"
              onClick={() => {
                if (sel.kind === "item") s.removeItem(sel.id);
                else if (sel.kind === "wall") s.removeWall(sel.id);
                else s.removeOpening(sel.id);
                setSel(null);
              }}
            >
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        className="fp-svg"
        viewBox={`${box.vx} ${box.vy} ${box.vw} ${box.vh}`}
        style={{ height: 360 * (box.vh / box.vw) }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={() => (drag.current = null)}
        onClick={onSvgClick}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="fp-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0 L0 0 0 1" fill="none" stroke="var(--border)" strokeWidth="0.015" />
          </pattern>
        </defs>
        <rect className="plan-bg" x={box.vx} y={box.vy} width={box.vw} height={box.vh} fill="url(#fp-grid)" />

        <rect x={0} y={0} width={L} height={W} className="fp-shell" />

        {/* internal walls with dimension labels + endpoint handles when selected */}
        {b.internalWalls.map((w) => {
          const selected = sel?.kind === "wall" && sel.id === w.id;
          return (
            <g key={w.id}>
              <line
                x1={w.x1}
                y1={w.z1}
                x2={w.x2}
                y2={w.z2}
                className={`fp-wall ${selected ? "sel" : ""}`}
                onClick={(e) => { e.stopPropagation(); setSel({ kind: "wall", id: w.id }); }}
              />
              <text x={(w.x1 + w.x2) / 2} y={(w.z1 + w.z2) / 2 - 0.12} className="fp-dim">
                {wallLengthM(w).toFixed(2)}m
              </text>
              {selected &&
                ([1, 2] as const).map((end) => (
                  <circle
                    key={end}
                    cx={end === 1 ? w.x1 : w.x2}
                    cy={end === 1 ? w.z1 : w.z2}
                    r={0.14}
                    className="fp-node"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture(e.pointerId);
                      drag.current = { kind: "wallnode", id: w.id, end };
                    }}
                  />
                ))}
            </g>
          );
        })}

        {mode === "wall" && wallStart && cursor && (() => {
          const end = axisSnapEnd(wallStart.xM, wallStart.zM, cursor.xM, cursor.zM);
          return <line x1={wallStart.xM} y1={wallStart.zM} x2={end.x} y2={end.z} className="fp-wall preview" />;
        })()}

        {/* openings on the shell — selectable + slide along the wall; doors
            show a swing arc */}
        {b.openings.map((o) => {
          const p = openingPos(o);
          const selected = sel?.kind === "opening" && sel.id === o.id;
          const w = p.horiz ? 0.9 : 0.14;
          const h = p.horiz ? 0.14 : 0.9;
          const R = 0.85;
          const isDoor = o.partId.includes("door");
          let swing: ReactElement | null = null;
          if (isDoor && p.horiz) {
            const din = o.elevation === "south" ? 1 : -1;
            const hx = p.x - 0.45;
            const hz = p.z;
            swing = (
              <g className="fp-swing">
                <line x1={hx} y1={hz} x2={hx} y2={hz + din * R} />
                <path d={`M ${hx} ${hz + din * R} A ${R} ${R} 0 0 ${din > 0 ? 1 : 0} ${hx + R} ${hz}`} />
              </g>
            );
          } else if (isDoor) {
            const din = o.elevation === "west" ? 1 : -1;
            const hx = p.x;
            const hz = p.z - 0.45;
            swing = (
              <g className="fp-swing">
                <line x1={hx} y1={hz} x2={hx + din * R} y2={hz} />
                <path d={`M ${hx + din * R} ${hz} A ${R} ${R} 0 0 ${din > 0 ? 0 : 1} ${hx} ${hz + R}`} />
              </g>
            );
          }
          return (
            <g key={o.id}>
              {swing}
              <rect
                x={p.x - w / 2}
                y={p.z - h / 2}
                width={w}
                height={h}
                className={`fp-opening ${selected ? "sel" : ""}`}
                onClick={(e) => { e.stopPropagation(); setSel({ kind: "opening", id: o.id }); }}
                onPointerDown={(e) => {
                  if (mode !== "select") return;
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture(e.pointerId);
                  drag.current = { kind: "opening", id: o.id };
                  setSel({ kind: "opening", id: o.id });
                }}
              >
                <title>{o.partId} · {o.elevation} bay {o.startBay + 1}</title>
              </rect>
            </g>
          );
        })}

        {/* placed fit-out objects */}
        {b.placedItems.map((p) => {
          const selected = sel?.kind === "item" && sel.id === p.id;
          const cat = CATALOGUE_BY_SKU[p.sku];
          return (
            <g
              key={p.id}
              className="fp-item"
              transform={`translate(${p.xM} ${p.zM}) rotate(${p.rotationDeg})`}
              onClick={(e) => { e.stopPropagation(); setSel({ kind: "item", id: p.id }); }}
              onPointerDown={(e) => {
                if (mode !== "select") return;
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                drag.current = { kind: "item", id: p.id };
                setSel({ kind: "item", id: p.id });
              }}
            >
              <circle r={0.26} className={`fp-item-dot ${selected ? "sel" : ""}`} />
              {/* direction tick — rotates with the object so orientation reads */}
              <line x1={0} y1={0} x2={0} y2={-0.26} className="fp-item-dir" />
              <text y={0.42} className="fp-item-label">{(cat?.label ?? p.sku).split(" ")[0]}</text>
              <title>{cat?.label ?? p.sku}</title>
            </g>
          );
        })}
      </svg>

      <div className="fp-footer">
        <span>{b.placedItems.length} items · {b.openings.length} openings</span>
        <span>Internal walls: {totalWallLm.toFixed(2)} l.m.</span>
      </div>
    </div>
  );
}
