import { useRef } from "react";
import { deriveRooms, useActiveBuilding, useConfigurator, type DerivedRoom } from "../state/store";
import { CATALOGUE_BY_SKU } from "./catalogueData";
import { getDragged } from "./drag";
import type { Elevation } from "@atom/assets";

/**
 * 2D floor plan of the active building. Rooms are drop targets: counted items
 * increment a per-room count (shown as badges with steppers); openings snap to
 * the nearest wall bay; internal walls add a partition.
 */
export function BuildingPlan2D() {
  const b = useActiveBuilding();
  const s = useConfigurator();
  const rooms = deriveRooms(b);
  const svgRef = useRef<SVGSVGElement>(null);

  const PAD = 0.6;
  const L = b.lengthM;
  const W = b.widthM;

  const toM = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      xM: ((clientX - r.left) / r.width) * (L + 2 * PAD) - PAD,
      zM: ((clientY - r.top) / r.height) * (W + 2 * PAD) - PAD,
    };
  };

  const roomAt = (xM: number): DerivedRoom =>
    rooms.find((r) => xM >= r.x0M && xM <= r.x1M) ?? rooms[0]!;

  const nearestBay = (elevation: Elevation, xM: number, zM: number) => {
    const along = elevation === "south" || elevation === "north" ? xM : zM;
    return Math.max(0, Math.floor(along / 1.2));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const item = getDragged();
    if (!item) return;
    const { xM, zM } = toM(e.clientX, e.clientY);

    if (item.kind === "counted" && item.sku) {
      s.dropCounted(roomAt(xM).id, item.sku, 1);
    } else if (item.kind === "partition") {
      s.addPartition();
    } else if (item.kind === "opening" && item.partId) {
      // nearest edge → elevation
      const dist = { south: zM, north: W - zM, west: xM, east: L - xM };
      const elevation = (Object.entries(dist).sort((a, c) => a[1] - c[1])[0]![0]) as Elevation;
      s.setPendingOpening(item.partId);
      s.placePendingOpening(elevation, nearestBay(elevation, xM, zM));
    }
  };

  const scale = 320 / (L + 2 * PAD);
  const viewH = (W + 2 * PAD) * scale;

  return (
    <div className="building-plan-wrap">
      <svg
        ref={svgRef}
        className="building-plan"
        viewBox={`${-PAD} ${-PAD} ${L + 2 * PAD} ${W + 2 * PAD}`}
        style={{ height: viewH }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {/* rooms */}
        {rooms.map((r) => (
          <g key={r.id}>
            <rect
              x={r.x0M}
              y={0}
              width={r.x1M - r.x0M}
              height={W}
              className="plan-room"
            />
            <text x={(r.x0M + r.x1M) / 2} y={0.5} className="plan-room-name">
              {r.name}
            </text>
          </g>
        ))}
        {/* building outline + openings */}
        <rect x={0} y={0} width={L} height={W} className="plan-outline" />
        {b.openings.map((o) => {
          const along = o.startBay * 1.2 + 0.6;
          const p =
            o.elevation === "south"
              ? { x: along, y: 0 }
              : o.elevation === "north"
                ? { x: along, y: W }
                : o.elevation === "west"
                  ? { x: 0, y: along }
                  : { x: L, y: along };
          return (
            <circle key={o.id} cx={p.x} cy={p.y} r={0.18} className="plan-opening" />
          );
        })}
      </svg>

      {/* per-room count badges + steppers */}
      <div className="room-badges">
        {rooms.map((r) => {
          const counts = Object.entries(b.roomCounts[r.id] ?? {});
          return (
            <div className="room-badge-col" key={r.id}>
              <div className="room-badge-title">{r.name}</div>
              {counts.length === 0 && <span className="muted">drag fit-out here</span>}
              {counts.map(([sku, qty]) => (
                <div className="room-badge" key={sku}>
                  <i className={`ti ${CATALOGUE_BY_SKU[sku]?.icon ?? "ti-cube"}`} aria-hidden="true" />
                  <span className="rb-label">{CATALOGUE_BY_SKU[sku]?.label ?? sku}</span>
                  <button aria-label="less" onClick={() => s.dropCounted(r.id, sku, -1)}>
                    −
                  </button>
                  <span className="rb-qty">{qty}</span>
                  <button aria-label="more" onClick={() => s.dropCounted(r.id, sku, 1)}>
                    +
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
