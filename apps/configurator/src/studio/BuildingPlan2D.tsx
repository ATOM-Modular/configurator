import { useRef, useState } from "react";
import { useActiveBuilding, useConfigurator, wallLengthM } from "../state/store";
import { CATALOGUE_BY_SKU } from "./catalogueData";
import { getDragged } from "./drag";

type Mode = "select" | "wall";

/**
 * Floorplanner-style 2D editor inside the fixed chassis shell.
 *   - Draw Wall: click a start then an end → an internal-wall segment with a
 *     live length label; segments are selectable + deletable. Total l.m. is
 *     Blaise's "Internal Walls Lm".
 *   - Fit-out: drag a catalogue card onto the plan → a positioned object;
 *     drag to move, select to rotate / delete. Count per SKU drives the price.
 */
export function BuildingPlan2D() {
  const b = useActiveBuilding();
  const s = useConfigurator();
  const svgRef = useRef<SVGSVGElement>(null);

  const [mode, setMode] = useState<Mode>("select");
  const [wallStart, setWallStart] = useState<{ xM: number; zM: number } | null>(null);
  const [cursor, setCursor] = useState<{ xM: number; zM: number } | null>(null);
  const [sel, setSel] = useState<{ kind: "item" | "wall"; id: string } | null>(null);
  const dragItem = useRef<string | null>(null);

  const PAD = 0.8;
  const L = b.lengthM;
  const W = b.widthM;

  const toM = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      xM: ((clientX - r.left) / r.width) * (L + 2 * PAD) - PAD,
      zM: ((clientY - r.top) / r.height) * (W + 2 * PAD) - PAD,
    };
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const item = getDragged();
    if (!item) return;
    const { xM, zM } = toM(e.clientX, e.clientY);

    if (item.kind === "counted" && item.sku) {
      setSel({ kind: "item", id: s.placeItem(item.sku, xM, zM) });
    } else if (item.kind === "partition") {
      // the internal-wall card just arms the Draw Wall tool
      setMode("wall");
      setWallStart(null);
    } else if (item.kind === "opening" && item.partId) {
      const dist = { south: zM, north: W - zM, west: xM, east: L - xM };
      const elevation = Object.entries(dist).sort((a, c) => a[1] - c[1])[0]![0] as
        | "south"
        | "north"
        | "east"
        | "west";
      const along = elevation === "south" || elevation === "north" ? xM : zM;
      s.setPendingOpening(item.partId);
      s.placePendingOpening(elevation, Math.max(0, Math.floor(along / 1.2)));
    }
  };

  const onSvgClick = (e: React.MouseEvent) => {
    const { xM, zM } = toM(e.clientX, e.clientY);
    if (mode === "wall") {
      if (!wallStart) setWallStart({ xM, zM });
      else {
        s.addWall(wallStart.xM, wallStart.zM, xM, zM);
        setWallStart(null);
      }
      return;
    }
    // select mode: clicking empty space deselects
    if ((e.target as Element).classList.contains("plan-bg")) setSel(null);
  };

  const totalWallLm = b.internalWalls.reduce((sum, w) => sum + wallLengthM(w), 0);
  const scale = 360 / (L + 2 * PAD);

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
            ? wallStart
              ? "Click the wall's end point"
              : "Click the wall's start point"
            : "Drag fit-out from the catalogue · click an item to select"}
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
              onClick={() => {
                if (sel.kind === "item") s.removeItem(sel.id);
                else s.removeWall(sel.id);
                setSel(null);
              }}
              title="delete"
            >
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        className="fp-svg"
        viewBox={`${-PAD} ${-PAD} ${L + 2 * PAD} ${W + 2 * PAD}`}
        style={{ height: (W + 2 * PAD) * scale }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={onSvgClick}
        onMouseMove={(e) => mode === "wall" && setCursor(toM(e.clientX, e.clientY))}
      >
        <defs>
          <pattern id="fp-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0 L0 0 0 1" fill="none" stroke="var(--border)" strokeWidth="0.015" />
          </pattern>
        </defs>
        <rect className="plan-bg" x={-PAD} y={-PAD} width={L + 2 * PAD} height={W + 2 * PAD} fill="url(#fp-grid)" />

        {/* fixed chassis shell */}
        <rect x={0} y={0} width={L} height={W} className="fp-shell" />

        {/* internal walls with dimension labels */}
        {b.internalWalls.map((w) => {
          const len = wallLengthM(w);
          const selected = sel?.kind === "wall" && sel.id === w.id;
          return (
            <g key={w.id} onClick={(e) => { e.stopPropagation(); setSel({ kind: "wall", id: w.id }); }}>
              <line
                x1={w.x1}
                y1={w.z1}
                x2={w.x2}
                y2={w.z2}
                className={`fp-wall ${selected ? "sel" : ""}`}
              />
              <text x={(w.x1 + w.x2) / 2} y={(w.z1 + w.z2) / 2 - 0.12} className="fp-dim">
                {len.toFixed(2)}m
              </text>
            </g>
          );
        })}

        {/* wall-draw preview */}
        {mode === "wall" && wallStart && cursor && (
          <line x1={wallStart.xM} y1={wallStart.zM} x2={cursor.xM} y2={cursor.zM} className="fp-wall preview" />
        )}

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
                (e.target as Element).setPointerCapture(e.pointerId);
                dragItem.current = p.id;
                setSel({ kind: "item", id: p.id });
              }}
              onPointerMove={(e) => {
                if (dragItem.current === p.id) {
                  const m = toM(e.clientX, e.clientY);
                  s.moveItem(p.id, m.xM, m.zM);
                }
              }}
              onPointerUp={() => (dragItem.current = null)}
            >
              <circle r={0.26} className={`fp-item-dot ${selected ? "sel" : ""}`} />
              <text y={0.42} className="fp-item-label">
                {(cat?.label ?? p.sku).split(" ")[0]}
              </text>
              <title>{cat?.label ?? p.sku}</title>
            </g>
          );
        })}
      </svg>

      <div className="fp-footer">
        <span>{b.placedItems.length} items placed</span>
        <span>Internal walls: {totalWallLm.toFixed(2)} l.m.</span>
      </div>
    </div>
  );
}
