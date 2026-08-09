import { CHASSIS_SIZES } from "@atom/contracts";
import { useActiveBuilding, useConfigurator } from "../state/store";

/**
 * Building sizer — length + width sliders that click to the allowed Blaise
 * chassis dimensions (Lists → Chassis Size). Replaces the fixed size cards:
 * the sliders resize the active building live, and "Add building" creates a
 * new one at the current size/type.
 */
const LENGTHS = [...new Set(CHASSIS_SIZES.map((c) => c.lengthM))].sort((a, b) => a - b);
const WIDTHS = [...new Set(CHASSIS_SIZES.map((c) => c.widthM))].sort((a, b) => a - b);

const nearestIndex = (values: number[], v: number) =>
  values.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(values[best]! - v) ? i : best), 0);

export function BuildingControls() {
  const b = useActiveBuilding();
  const s = useConfigurator();
  const isToilet = b.use === "Toilet & Amenities";

  return (
    <div className="building-controls">
      <label className="bc-slider">
        <span>Length <strong>{b.lengthM}m</strong></span>
        <input
          type="range"
          min={0}
          max={LENGTHS.length - 1}
          step={1}
          value={nearestIndex(LENGTHS, b.lengthM)}
          onChange={(e) => s.setDims(LENGTHS[Number(e.target.value)]!, b.widthM)}
        />
      </label>
      <label className="bc-slider">
        <span>Width <strong>{b.widthM}m</strong></span>
        <input
          type="range"
          min={0}
          max={WIDTHS.length - 1}
          step={1}
          value={nearestIndex(WIDTHS, b.widthM)}
          onChange={(e) => s.setDims(b.lengthM, WIDTHS[Number(e.target.value)]!)}
        />
      </label>

      <div className="bc-type">
        {(["office", "toilet"] as const).map((t) => (
          <button
            key={t}
            className={(t === "toilet") === isToilet ? "active" : ""}
            onClick={() => s.updateActive({ use: t === "toilet" ? "Toilet & Amenities" : "Office" })}
          >
            {t === "toilet" ? "Amenities" : "Office"}
          </button>
        ))}
      </div>

      <button
        className="bc-add"
        onClick={() =>
          s.addChassis({
            lengthM: b.lengthM,
            widthM: b.widthM,
            chassisType: isToilet ? "toilet" : "office",
          })
        }
      >
        <i className="ti ti-plus" aria-hidden="true" /> Add building
      </button>
    </div>
  );
}
