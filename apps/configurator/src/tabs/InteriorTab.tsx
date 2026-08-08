import { useRef } from "react";
import { deriveRooms, useConfigurator } from "../state/store";

/** 2D floor-plan inset: rooms along the length, draggable partition lines. */
function FloorPlan() {
  const s = useConfigurator();
  const rooms = deriveRooms(s);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIndex = useRef<number | null>(null);

  const VIEW_W = 260;
  const scale = VIEW_W / s.lengthM;
  const viewH = s.widthM * scale;

  const toM = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * s.lengthM;
  };

  return (
    <svg
      ref={svgRef}
      className="floor-plan"
      viewBox={`0 0 ${VIEW_W} ${viewH}`}
      onPointerMove={(e) => {
        if (dragIndex.current !== null) s.movePartition(dragIndex.current, toM(e.clientX));
      }}
      onPointerUp={() => (dragIndex.current = null)}
      onPointerLeave={() => (dragIndex.current = null)}
    >
      <rect x="0" y="0" width={VIEW_W} height={viewH} className="plan-shell" />
      {rooms.map((r) => (
        <text key={r.id} x={((r.x0M + r.x1M) / 2) * scale} y={viewH / 2} className="plan-label">
          {r.name}
        </text>
      ))}
      {s.partitionsX.map((x, i) => (
        <line
          key={i}
          x1={x * scale}
          x2={x * scale}
          y1={0}
          y2={viewH}
          className="plan-partition"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            dragIndex.current = i;
          }}
        />
      ))}
    </svg>
  );
}

export function InteriorTab() {
  const s = useConfigurator();
  const rooms = deriveRooms(s);

  return (
    <div className="tab-body">
      <div className="plan-header">
        <FloorPlan />
        <div className="plan-actions">
          <button onClick={() => s.addPartition()}>+ Add partition</button>
          {s.partitionsX.length > 0 && (
            <button onClick={() => s.removePartition(s.partitionsX.length - 1)}>
              − Remove last
            </button>
          )}
          <p className="muted">Drag partition lines to resize zones.</p>
        </div>
      </div>

      {rooms.map((r, i) => (
        <details key={r.id} className="room-detail" open={rooms.length <= 2}>
          <summary>
            {r.name} — {r.areaM2.toFixed(1)} m²
          </summary>
          <label>
            Name
            <input value={r.meta.name} onChange={(e) => s.updateRoom(i, { name: e.target.value })} />
          </label>
          <label>
            AC size
            <select
              value={r.meta.acOverrideKw ?? "auto"}
              onChange={(e) =>
                s.updateRoom(i, {
                  acOverrideKw: e.target.value === "auto" ? null : Number(e.target.value),
                })
              }
            >
              <option value="auto">Auto-sized</option>
              {[2.5, 3.5, 5.0, 7.1].map((kw) => (
                <option key={kw} value={kw}>
                  {kw}kW (manual)
                </option>
              ))}
            </select>
          </label>
          {r.meta.acOverrideKw !== null && (
            <p className="warn-inline">Manual AC sizing — engineering review recommended.</p>
          )}
          <div className="qty-row">
            {(
              [
                ["gpoQty", "GPOs"],
                ["lightQty", "Lights"],
                ["dataQty", "Data"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={r.meta[key]}
                  onChange={(e) => s.updateRoom(i, { [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
