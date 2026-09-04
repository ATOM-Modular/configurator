import { CHASSIS_SIZES } from "@atom/contracts";
import { useActiveBuilding, useConfigurator } from "../state/store";

/**
 * Building sizer — length + width sliders that CLICK to the discrete ATOM
 * chassis sizes (the range steps over size indices, so dragging snaps to a
 * real size). Labelled ticks under each slider double as direct size buttons.
 *
 * Length steps through the standard chassis module lengths. Width is a MODULE
 * ENVELOPE: 3m or 3.4m is a single module; wider joins 3m modules (6→2, 9→3,
 * 12→4, 15→5), matching the engine's moduleCount = ceil(width / 3).
 */
const LENGTHS = [...new Set(CHASSIS_SIZES.map((c) => c.lengthM))].sort((a, b) => a - b);

const MODULE_WIDTH_M = 3;
const SINGLE_MODULE_MAX_WIDTH_M = 3.4;
const WIDTHS = [3, 3.4, 6, 9, 12, 15];
const moduleCount = (widthM: number) =>
  widthM <= SINGLE_MODULE_MAX_WIDTH_M ? 1 : Math.ceil(widthM / MODULE_WIDTH_M);

const nearestIndex = (values: number[], v: number) =>
  values.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(values[best]! - v) ? i : best), 0);
const nearest = (values: number[], v: number) => values[nearestIndex(values, v)]!;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function BuildingControls() {
  const b = useActiveBuilding();
  const s = useConfigurator();

  const L = nearest(LENGTHS, b.lengthM);
  const W = nearest(WIDTHS, b.widthM);
  const li = nearestIndex(LENGTHS, b.lengthM);
  const wi = nearestIndex(WIDTHS, b.widthM);
  const mods = moduleCount(W);
  const area = L * W;

  return (
    <div className="building-controls">
      <div className="bc-readout">
        <strong>{fmt(L)} × {fmt(W)} m</strong>
        <span>
          {area.toFixed(1)} m² · {mods} module{mods > 1 ? "s" : ""}
        </span>
      </div>

      <button
        className="bc-add"
        onClick={() =>
          s.addChassis({
            lengthM: b.lengthM,
            widthM: b.widthM,
            chassisType: b.use === "Toilet & Amenities" ? "toilet" : "office",
          })
        }
      >
        <i className="ti ti-plus" aria-hidden="true" /> Add building
      </button>

      {/* Sliders snap to the discrete chassis sizes (index-stepped); the tick
          marks show the snap points. Current size is read from the header
          above, so no numeric labels here (they were a double-up). */}
      <label className="bc-slider">
        <span>Length (m)</span>
        <input
          type="range"
          list="bc-len-ticks"
          min={0}
          max={LENGTHS.length - 1}
          step={1}
          value={li}
          onChange={(e) => s.setDims(LENGTHS[Number(e.target.value)]!, W)}
        />
        <datalist id="bc-len-ticks">
          {LENGTHS.map((_, i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </label>

      <label className="bc-slider">
        <span>Width (m)</span>
        <input
          type="range"
          list="bc-wid-ticks"
          min={0}
          max={WIDTHS.length - 1}
          step={1}
          value={wi}
          onChange={(e) => s.setDims(L, WIDTHS[Number(e.target.value)]!)}
        />
        <datalist id="bc-wid-ticks">
          {WIDTHS.map((_, i) => (
            <option key={i} value={i} />
          ))}
        </datalist>
      </label>

      {/* DDA gates accessible fixtures/groups (engine rule); needs a control */}
      <label className="bc-dda">
        <input type="checkbox" checked={b.dda} onChange={(e) => s.updateActive({ dda: e.target.checked })} />
        <span>Accessible (DDA) — enables accessible fixtures &amp; sets</span>
      </label>
    </div>
  );
}
