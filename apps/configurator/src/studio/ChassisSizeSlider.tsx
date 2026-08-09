import { SIZE_PRESETS } from "../state/presets";
import { useActiveBuilding, useConfigurator } from "../state/store";

/**
 * A size slider that "clicks" through the allowed Blaise chassis sizes
 * (Lists → Chassis Size). Dragging steps to the next valid size rather than
 * a free dimension — you can't build a size Blaise can't price.
 */
export function ChassisSizeSlider() {
  const b = useActiveBuilding();
  const setDims = useConfigurator((s) => s.setDims);

  // index of the current size, or the nearest by floor area
  const exact = SIZE_PRESETS.findIndex((p) => p.lengthM === b.lengthM && p.widthM === b.widthM);
  const area = b.lengthM * b.widthM;
  const index =
    exact >= 0
      ? exact
      : SIZE_PRESETS.reduce(
          (best, p, i) =>
            Math.abs(p.lengthM * p.widthM - area) <
            Math.abs(SIZE_PRESETS[best]!.lengthM * SIZE_PRESETS[best]!.widthM - area)
              ? i
              : best,
          0,
        );
  const current = SIZE_PRESETS[index]!;

  return (
    <label className="chassis-slider">
      <span>
        Size <strong>{current.lengthM} × {current.widthM}m</strong>
      </span>
      <input
        type="range"
        min={0}
        max={SIZE_PRESETS.length - 1}
        step={1}
        value={index}
        list="chassis-ticks"
        onChange={(e) => {
          const p = SIZE_PRESETS[Number(e.target.value)]!;
          setDims(p.lengthM, p.widthM);
        }}
      />
      <datalist id="chassis-ticks">
        {SIZE_PRESETS.map((_, i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
    </label>
  );
}
