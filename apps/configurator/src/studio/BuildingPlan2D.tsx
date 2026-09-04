import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  axisSnapEnd,
  deriveRooms,
  instanceLengthM,
  useActiveBuilding,
  useConfigurator,
} from "../state/store";
import { partLabel, PART_BY_ID } from "./manifestCatalogue";
import { snapToGuides } from "./snapping";
import { planSymbol } from "./plan/planSymbols";
import { PlanTitleblock, CONCEPT_STAMP } from "./plan/PlanTitleblock";
import {
  isWetRoom,
  lengthDimChain,
  PARTITION_THICKNESS_M,
  roomLabel,
  wallThicknessM,
} from "./plan/planDrawing";

type Mode = "select" | "wall";
type Sel = { kind: "item" | "wall" | "opening"; id: string } | null;
type Box = { vx: number; vy: number; vw: number; vh: number };

const PAD = 1.6; // margin around the building so the dimension strings fit
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

  // partition segments (drawn walls) vs point fixtures — one placed model
  const partitions = b.placedInstances.filter((p) => p.x2M !== undefined && p.y2M !== undefined);
  const fixtures = b.placedInstances.filter((p) => p.x2M === undefined);

  const [mode, setMode] = useState<Mode>("select");
  const [wallStart, setWallStart] = useState<{ xM: number; zM: number } | null>(null);
  const [cursor, setCursor] = useState<{ xM: number; zM: number } | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [box, setBox] = useState<Box>({ vx: -PAD, vy: -PAD, vw: L + 2 * PAD, vh: W + 2 * PAD });
  const [guides, setGuides] = useState<{ gx: number | null; gz: number | null }>({ gx: null, gz: null });
  const [toast, setToast] = useState<string | null>(null);
  const [bayHint, setBayHint] = useState<{ elevation: string; bay: number } | null>(null);
  const toastTimer = useRef(0);
  const armed = useConfigurator((st) => st.armed);

  // Esc cancels an armed placement
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") s.setArmed(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s]);

  // candidate alignment lines from the shell, walls, other items and openings
  const snapLines = (excludeItemId?: string) => {
    const xs = [0, L];
    const zs = [0, W];
    for (const p of partitions) {
      xs.push(p.xM, p.x2M!);
      zs.push(p.yM, p.y2M!);
    }
    for (const it of fixtures) if (it.instanceId !== excludeItemId) { xs.push(it.xM); zs.push(it.yM); }
    for (const o of b.openings) { const p = openingPos(o); xs.push(p.x); zs.push(p.z); }
    return { xs, zs };
  };
  const SNAP_THR = 0.15;

  // reset the view when the building changes
  useEffect(() => {
    setBox({ vx: -PAD, vy: -PAD, vw: L + 2 * PAD, vh: W + 2 * PAD });
    setSel(null);
  }, [b.id, L, W]);

  const drag = useRef<
    | { kind: "item" | "opening" | "rotate"; id: string }
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

  // nearest wall + 1200 bay for a plan point (wall-mounted openings)
  const nearestBay = (xM: number, zM: number) => {
    const dist = { south: zM, north: W - zM, west: xM, east: L - xM };
    const elevation = Object.entries(dist).sort((a, c) => a[1] - c[1])[0]![0] as
      | "south" | "north" | "east" | "west";
    const along = elevation === "south" || elevation === "north" ? xM : zM;
    return { elevation, bay: Math.max(0, Math.floor(along / BAY)) };
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  // Click-to-place: an armed catalogue item is dropped at the clicked point.
  // One interaction for mouse AND touch — returns true if it handled the click.
  const placeArmed = (xM: number, zM: number): boolean => {
    const item = useConfigurator.getState().armed;
    if (!item) return false;
    if (item.kind === "group") {
      s.dropGroup(item.groupId, xM, zM);
      s.setArmed(null);
      return true;
    }
    if (item.placementMode === "floor-free") {
      setSel({ kind: "item", id: s.placeInstance(item.partId, xM, zM) });
      s.setArmed(null);
    } else if (item.placementMode === "wall-mounted") {
      const { elevation, bay } = nearestBay(xM, zM);
      s.setPendingOpening(item.partId);
      s.placePendingOpening(elevation, bay);
      // validated via tileWallRun; on overlap/out-of-range it adds nothing.
      if (useConfigurator.getState().openingError) flash("That bay already has an opening.");
      else s.setArmed(null); // keep armed on error so the user can retry elsewhere
      setBayHint(null);
    } else if (item.placementMode === "partition") {
      setMode("wall");
      setWallStart(null);
      s.setArmed(null);
    } else {
      s.setArmed(null); // bay-grid isn't user-placed
    }
    return true;
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
      const { xs, zs } = snapLines(d.id);
      const sn = snapToGuides(m.xM, m.zM, xs, zs, SNAP_THR);
      setGuides({ gx: sn.guideX, gz: sn.guideZ });
      s.moveItem(d.id, sn.x, sn.z);
    } else if (d?.kind === "opening") {
      const o = b.openings.find((x) => x.id === d.id);
      if (o) {
        const m = toM(e.clientX, e.clientY);
        const along = o.elevation === "south" || o.elevation === "north" ? m.xM : m.zM;
        s.moveOpeningBay(d.id, Math.max(0, Math.floor(along / BAY)));
      }
    } else if (d?.kind === "rotate") {
      const it = b.placedInstances.find((x) => x.instanceId === d.id);
      if (it) {
        const m = toM(e.clientX, e.clientY);
        const deg = (Math.atan2(m.xM - it.xM, -(m.zM - it.yM)) * 180) / Math.PI;
        s.setItemRotation(d.id, Math.round(deg / 15) * 15); // snap to 15°
      }
    } else if (d?.kind === "wallnode") {
      const m = toM(e.clientX, e.clientY);
      const { xs, zs } = snapLines();
      const sn = snapToGuides(m.xM, m.zM, xs, zs, SNAP_THR);
      setGuides({ gx: sn.guideX, gz: sn.guideZ });
      s.moveInstanceNode(d.id, d.end, sn.x, sn.z);
    } else if (mode === "wall") {
      setCursor(toM(e.clientX, e.clientY));
    } else if (armed?.kind === "part" && armed.placementMode === "wall-mounted") {
      const m = toM(e.clientX, e.clientY);
      setBayHint(nearestBay(m.xM, m.zM)); // preview the bay that a tap will fill
    } else if (bayHint) {
      setBayHint(null);
    }
  };

  const onSvgClick = (e: React.MouseEvent) => {
    const { xM, zM } = toM(e.clientX, e.clientY);
    if (placeArmed(xM, zM)) return; // an armed catalogue item drops here
    if (mode !== "wall") return;
    if (!wallStart) setWallStart({ xM, zM });
    else {
      const end = axisSnapEnd(wallStart.xM, wallStart.zM, xM, zM);
      s.drawPartition(wallStart.xM, wallStart.zM, end.x, end.z);
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

  const totalWallLm = partitions.reduce((sum, p) => sum + instanceLengthM(p), 0);
  const unassignedCount = fixtures.filter((p) => !p.roomId).length;

  // --- drawing-mode derived geometry (real construction values) ---
  const wallT = wallThicknessM(b.panelMm); // real external panel thickness
  // The wall poché is a STROKED outline (~0.04 wide, centred on each face), so
  // an opening's white mask must bleed past the wall band on both faces to
  // actually clear those strokes — otherwise the wall line survives across the
  // opening and the door/window just floats on an unbroken wall.
  const WALL_BLEED = 0.03;
  // Door leaf slab thickness (ATOM GA plans draw the leaf as a ~40mm panel
  // swung to 90°, not a hairline). Metres.
  const LEAF_T = 0.045;
  const pt = PARTITION_THICKNESS_M;
  const rooms = deriveRooms(b);
  const dimSegs = lengthDimChain(L, b.partitionsX, pt);

  return (
    <div className="fp-editor">
      <div className="fp-toolbar">
        <button className={mode === "select" ? "active" : ""} onClick={() => { setMode("select"); setWallStart(null); }}>
          <i className="ti ti-pointer" aria-hidden="true" /> Select
        </button>
        <button className={mode === "wall" ? "active" : ""} onClick={() => { setMode("wall"); setSel(null); }}>
          <i className="ti ti-wall" aria-hidden="true" /> Draw wall
        </button>
        <button
          className="fp-autospec"
          title="Auto-spec lights, GPOs, AC & exhaust from the building size (Blaise rules)"
          onClick={() => {
            const n = s.autoSpec();
            setSel(null);
            flash(`Auto-spec: ${n} fixture${n === 1 ? "" : "s"} placed from size`);
          }}
        >
          <i className="ti ti-wand" aria-hidden="true" /> Auto-spec
        </button>
        <span className="fp-hint">
          {armed
            ? `Tap the plan to place ${armed.displayName} · Esc to cancel`
            : mode === "wall"
              ? wallStart ? "Click the wall's end point" : "Click the wall's start point"
              : "Tap a catalogue item, then tap the plan · drag to move · scroll to zoom"}
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
                if (sel.kind === "item" || sel.kind === "wall") s.removeItem(sel.id);
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
        className={armed ? "fp-svg arming" : "fp-svg"}
        viewBox={`${box.vx} ${box.vy} ${box.vw} ${box.vh}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={() => {
          drag.current = null;
          setGuides({ gx: null, gz: null });
        }}
        onClick={onSvgClick}
        onWheel={onWheel}
      >
        <defs>
          {/* wet-area cross-hatch — thin black diagonals both ways */}
          <pattern id="dwg-hatch" width="0.34" height="0.34" patternUnits="userSpaceOnUse">
            <path d="M0 0.34 L0.34 0 M-0.05 0.05 L0.05 -0.05 M0.29 0.39 L0.39 0.29" className="dwg-hatchline" />
            <path d="M0 0 L0.34 0.34 M-0.05 0.29 L0.05 0.39 M0.29 -0.05 L0.39 0.05" className="dwg-hatchline" />
          </pattern>
        </defs>

        {/* white drawing sheet */}
        <rect className="dwg-bg" x={box.vx} y={box.vy} width={box.vw} height={box.vh} />

        {/* wet-area waterproofing hatch (behind linework), keyed to room use */}
        {rooms.filter((r) => isWetRoom(r, b.use)).map((r) => {
          const x0 = Math.max(r.x0M, wallT);
          const x1 = Math.min(r.x1M, L - wallT);
          return (
            <rect
              key={`wet-${r.id}`}
              className="dwg-wet"
              x={x0}
              y={wallT}
              width={Math.max(0, x1 - x0)}
              height={W - 2 * wallT}
            />
          );
        })}

        {/* external walls as poché — outer + inner line offset by real thickness */}
        <rect className="dwg-wall" x={0} y={0} width={L} height={W} />
        <rect className="dwg-wall" x={wallT} y={wallT} width={L - 2 * wallT} height={W - 2 * wallT} />

        {/* room-divider partitions (partitionsX) as poché, mitred to the walls */}
        {b.partitionsX.map((px, i) => (
          <g key={`div-${i}`} className="dwg-wall">
            <line x1={px - pt / 2} y1={wallT} x2={px - pt / 2} y2={W - wallT} />
            <line x1={px + pt / 2} y1={wallT} x2={px + pt / 2} y2={W - wallT} />
            <line x1={px - pt / 2} y1={wallT} x2={px + pt / 2} y2={wallT} />
            <line x1={px - pt / 2} y1={W - wallT} x2={px + pt / 2} y2={W - wallT} />
          </g>
        ))}

        {/* nearest-1200-bay highlight while dragging a wall-mounted opening */}
        {bayHint && (() => {
          const t = 0.18;
          const b0 = bayHint.bay * BAY;
          if (bayHint.elevation === "south") return <rect className="fp-bayhint" x={b0} y={-t / 2} width={BAY} height={t} />;
          if (bayHint.elevation === "north") return <rect className="fp-bayhint" x={b0} y={W - t / 2} width={BAY} height={t} />;
          if (bayHint.elevation === "west") return <rect className="fp-bayhint" x={-t / 2} y={b0} width={t} height={BAY} />;
          return <rect className="fp-bayhint" x={L - t / 2} y={b0} width={t} height={BAY} />;
        })()}

        {/* live alignment guides while dragging */}
        {guides.gx !== null && (
          <line x1={guides.gx} y1={box.vy} x2={guides.gx} y2={box.vy + box.vh} className="fp-guide" />
        )}
        {guides.gz !== null && (
          <line x1={box.vx} y1={guides.gz} x2={box.vx + box.vw} y2={guides.gz} className="fp-guide" />
        )}

        {/* partition segments with dimension labels + endpoint handles when selected */}
        {partitions.map((w) => {
          const selected = sel?.kind === "wall" && sel.id === w.instanceId;
          const x2 = w.x2M!;
          const y2 = w.y2M!;
          // poché: offset perpendicular by ±pt/2
          const len = Math.hypot(x2 - w.xM, y2 - w.yM) || 1;
          const nx = (-(y2 - w.yM) / len) * (pt / 2);
          const ny = ((x2 - w.xM) / len) * (pt / 2);
          return (
            <g key={w.instanceId}>
              <g className={`dwg-wall ${selected ? "sel" : ""}`}>
                <line x1={w.xM + nx} y1={w.yM + ny} x2={x2 + nx} y2={y2 + ny} />
                <line x1={w.xM - nx} y1={w.yM - ny} x2={x2 - nx} y2={y2 - ny} />
                <line x1={w.xM + nx} y1={w.yM + ny} x2={w.xM - nx} y2={w.yM - ny} />
                <line x1={x2 + nx} y1={y2 + ny} x2={x2 - nx} y2={y2 - ny} />
              </g>
              {/* invisible hit line for selection */}
              <line
                x1={w.xM}
                y1={w.yM}
                x2={x2}
                y2={y2}
                className="dwg-hit"
                onClick={(e) => { e.stopPropagation(); setSel({ kind: "wall", id: w.instanceId }); }}
              />
              <text x={(w.xM + x2) / 2} y={(w.yM + y2) / 2 - 0.12} className="dwg-dimtxt">
                {instanceLengthM(w).toFixed(2)}m
              </text>
              {selected &&
                ([1, 2] as const).map((end) => (
                  <circle
                    key={end}
                    cx={end === 1 ? w.xM : x2}
                    cy={end === 1 ? w.yM : y2}
                    r={0.14}
                    className="fp-node"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture(e.pointerId);
                      drag.current = { kind: "wallnode", id: w.instanceId, end };
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

        {/* openings — doors show leaf + swing arc, windows a sill/head break;
            both cut the wall poché. Sized to the real opening width. */}
        {b.openings.map((o) => {
          const p = openingPos(o);
          const selected = sel?.kind === "opening" && sel.id === o.id;
          // Real opening width from the part id (mm). TODO(mfg-dim): the shop
          // drawing adds a +25mm EPS window cutout allowance to the frame size;
          // that dimension isn't modelled, so we render the nominal opening —
          // no fabricated tolerance. Replace with the real cutout when modelled.
          const owM = (() => { const m = /(\d{3,4})/.exec(o.partId); return m?.[1] ? +m[1] / 1000 : 0.9; })();
          const isDoor = o.partId.includes("door");
          const half = owM / 2;
          let art: ReactElement | null = null;

          if (p.horiz) {
            // south (z=0) / north (z=W) — opening runs along x
            const inner = o.elevation === "south" ? wallT : W - wallT;
            const din = o.elevation === "south" ? 1 : -1;
            const gap = (
              <>
                <rect className="dwg-break" x={p.x - half} y={(o.elevation === "south" ? 0 : W - wallT) - WALL_BLEED} width={owM} height={wallT + 2 * WALL_BLEED} />
                <line className="dwg-thin" x1={p.x - half} y1={p.z} x2={p.x - half} y2={inner} />
                <line className="dwg-thin" x1={p.x + half} y1={p.z} x2={p.x + half} y2={inner} />
              </>
            );
            art = isDoor ? (
              <g className="dwg-door">
                {gap}
                <path d={`M ${p.x - half} ${inner + din * owM} A ${owM} ${owM} 0 0 ${din > 0 ? 0 : 1} ${p.x + half} ${inner}`} />
                <rect className="dwg-leaf" x={p.x - half} y={din > 0 ? inner : inner - owM} width={LEAF_T} height={owM} />
              </g>
            ) : (
              <g className="dwg-window">
                <rect className="dwg-break" x={p.x - half} y={(o.elevation === "south" ? 0 : W - wallT) - WALL_BLEED} width={owM} height={wallT + 2 * WALL_BLEED} />
                <line className="dwg-thin" x1={p.x - half} y1={p.z} x2={p.x - half} y2={inner} />
                <line className="dwg-thin" x1={p.x + half} y1={p.z} x2={p.x + half} y2={inner} />
                <line x1={p.x - half} y1={p.z + din * wallT * 0.33} x2={p.x + half} y2={p.z + din * wallT * 0.33} />
                <line x1={p.x - half} y1={p.z + din * wallT * 0.66} x2={p.x + half} y2={p.z + din * wallT * 0.66} />
              </g>
            );
          } else {
            const inner = o.elevation === "west" ? wallT : L - wallT;
            const din = o.elevation === "west" ? 1 : -1;
            art = isDoor ? (
              <g className="dwg-door">
                <rect className="dwg-break" x={(o.elevation === "west" ? 0 : L - wallT) - WALL_BLEED} y={p.z - half} width={wallT + 2 * WALL_BLEED} height={owM} />
                <line className="dwg-thin" x1={p.x} y1={p.z - half} x2={inner} y2={p.z - half} />
                <line className="dwg-thin" x1={p.x} y1={p.z + half} x2={inner} y2={p.z + half} />
                <path d={`M ${inner + din * owM} ${p.z - half} A ${owM} ${owM} 0 0 ${din > 0 ? 1 : 0} ${inner} ${p.z + half}`} />
                <rect className="dwg-leaf" x={din > 0 ? inner : inner - owM} y={p.z - half} width={owM} height={LEAF_T} />
              </g>
            ) : (
              <g className="dwg-window">
                <rect className="dwg-break" x={(o.elevation === "west" ? 0 : L - wallT) - WALL_BLEED} y={p.z - half} width={wallT + 2 * WALL_BLEED} height={owM} />
                <line className="dwg-thin" x1={p.x} y1={p.z - half} x2={inner} y2={p.z - half} />
                <line className="dwg-thin" x1={p.x} y1={p.z + half} x2={inner} y2={p.z + half} />
                <line x1={p.x + din * wallT * 0.33} y1={p.z - half} x2={p.x + din * wallT * 0.33} y2={p.z + half} />
                <line x1={p.x + din * wallT * 0.66} y1={p.z - half} x2={p.x + din * wallT * 0.66} y2={p.z + half} />
              </g>
            );
          }

          return (
            <g key={o.id} className={selected ? "dwg-sel" : ""}>
              {art}
              <rect
                x={p.x - (p.horiz ? half : 0.15)}
                y={p.z - (p.horiz ? 0.15 : half)}
                width={p.horiz ? owM : 0.3}
                height={p.horiz ? 0.3 : owM}
                className="dwg-hit"
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

        {/* placed fit-out objects (point fixtures; partitions render as lines) */}
        {fixtures.map((p) => {
          const selected = sel?.kind === "item" && sel.id === p.instanceId;
          const label = partLabel(p.partId);
          const dims = PART_BY_ID.get(p.partId)?.dimensions;
          const unassigned = !p.roomId;
          return (
            <g
              key={p.instanceId}
              className={`fp-item ${unassigned ? "unassigned" : ""}`}
              transform={`translate(${p.xM} ${p.yM}) rotate(${p.rotationDeg})`}
              onClick={(e) => { e.stopPropagation(); setSel({ kind: "item", id: p.instanceId }); }}
              onPointerDown={(e) => {
                if (mode !== "select") return;
                e.stopPropagation();
                (e.target as Element).setPointerCapture(e.pointerId);
                drag.current = { kind: "item", id: p.instanceId };
                setSel({ kind: "item", id: p.instanceId });
              }}
            >
              {/* thin-line plan symbol (to real footprint), unassigned → amber */}
              {planSymbol(p.sku, dims?.x ?? 0.4, dims?.z ?? 0.4)}
              {selected && dims && (
                <rect
                  className="dwg-selbox"
                  x={-dims.x / 2 - 0.06}
                  y={-dims.z / 2 - 0.06}
                  width={dims.x + 0.12}
                  height={dims.z + 0.12}
                />
              )}
              {/* transparent hit target so thin symbols are easy to grab */}
              <rect
                className="dwg-hit"
                x={-(dims?.x ?? 0.4) / 2 - 0.05}
                y={-(dims?.z ?? 0.4) / 2 - 0.05}
                width={(dims?.x ?? 0.4) + 0.1}
                height={(dims?.z ?? 0.4) + 0.1}
              />
              {selected && (
                <>
                  <line x1={0} y1={-(dims?.z ?? 0.4) / 2} x2={0} y2={-(dims?.z ?? 0.4) / 2 - 0.26} className="dwg-thin" />
                  <circle
                    cx={0}
                    cy={-(dims?.z ?? 0.4) / 2 - 0.26}
                    r={0.11}
                    className="dwg-rot-handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture(e.pointerId);
                      drag.current = { kind: "rotate", id: p.instanceId };
                    }}
                  />
                </>
              )}
              <title>{label}</title>
            </g>
          );
        })}

        {/* room labels — uppercase, centred. Skip the generic default "Zone N"
            so a sales plan doesn't show placeholder names. */}
        {rooms
          .filter((r) => r.name && !/^zone\s*\d+$/i.test(r.name.trim()))
          .map((r) => (
            <text key={`lbl-${r.id}`} className="dwg-label" x={(r.x0M + r.x1M) / 2} y={W / 2}>
              {roomLabel(r.name)}
            </text>
          ))}

        {/* chained dimension strings — top (chain + overall) and bottom, plus
            left height. Thin lines, ticks, mm text; partition thicknesses
            called out as their own segments. */}
        {(() => {
          const faces = [...new Set(dimSegs.flatMap((s) => [s.x0, s.x1]))].sort((a, b) => a - b);
          const tick = (x: number, y: number, k: string) => (
            <line key={k} className="dwg-thin" x1={x - 0.06} y1={y + 0.06} x2={x + 0.06} y2={y - 0.06} />
          );
          const chain = (y: number, tag: string) => (
            <g className="dwg-dim" key={tag}>
              <line x1={0} y1={y} x2={L} y2={y} />
              {faces.map((x) => tick(x, y, `${tag}-t-${x.toFixed(3)}`))}
              {dimSegs.map((s, i) => (
                <text key={`${tag}-${i}`} className={`dwg-dimtxt ${s.thickness ? "thk" : ""}`} x={s.mid} y={y - 0.06}>
                  {s.mm}
                </text>
              ))}
            </g>
          );
          const topY = -0.55, ovY = -1.05, botY = W + 0.6;
          return (
            <>
              {faces.map((x) => (
                <line key={`ext-${x.toFixed(3)}`} className="dwg-thin" x1={x} y1={0} x2={x} y2={topY} />
              ))}
              {chain(topY, "top")}
              <g className="dwg-dim">
                <line x1={0} y1={ovY} x2={L} y2={ovY} />
                {tick(0, ovY, "ov0")}
                {tick(L, ovY, "ovL")}
                <text className="dwg-dimtxt" x={L / 2} y={ovY - 0.06}>{Math.round(L * 1000)}</text>
              </g>
              {faces.map((x) => (
                <line key={`exb-${x.toFixed(3)}`} className="dwg-thin" x1={x} y1={W} x2={x} y2={botY} />
              ))}
              {chain(botY, "bot")}
              <line className="dwg-thin" x1={0} y1={0} x2={-0.55} y2={0} />
              <line className="dwg-thin" x1={0} y1={W} x2={-0.55} y2={W} />
              <g className="dwg-dim">
                <line x1={-0.5} y1={0} x2={-0.5} y2={W} />
                {tick(-0.5, 0, "lv0")}
                {tick(-0.5, W, "lvW")}
              </g>
              <text className="dwg-dimtxt" x={-0.62} y={W / 2} transform={`rotate(-90 ${-0.62} ${W / 2})`}>
                {Math.round(W * 1000)}
              </text>
            </>
          );
        })()}
      </svg>

      {toast && <div className="fp-toast">{toast}</div>}
      <div className="dwg-stamp-overlay">{CONCEPT_STAMP}</div>

      <div className="fp-footer">
        <span>
          {fixtures.length} items · {partitions.length} partitions · {b.openings.length} openings
          {unassignedCount > 0 && (
            <span className="fp-chip warn" title="Fixture dropped outside any room">
              {unassignedCount} unassigned
            </span>
          )}
        </span>
        <span>Partitions: {totalWallLm.toFixed(2)} l.m.</span>
      </div>

      <PlanTitleblock projectName={b.name} />
    </div>
  );
}
