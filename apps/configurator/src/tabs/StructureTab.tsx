import { panelUpgradeMinimums, type WindRegion } from "@atom/contracts";
import {
  CEILING_PANEL_THICKNESSES_MM,
  COLORBOND_COLOURS,
  moduleCountFor,
  PANEL_THICKNESSES_MM,
  PANEL_TYPES,
} from "../state/presets";
import { useActiveBuilding, useConfigurator } from "../state/store";

/** Base thicknesses plus any region-enforced upgrade + the current value. */
function thicknessOptions(base: readonly number[], min: number, current: number): number[] {
  return [...new Set([...base, min, current])].filter((t) => t >= min).sort((a, b) => a - b);
}

export function StructureTab() {
  const s = useConfigurator();
  const b = useActiveBuilding();
  const modules = moduleCountFor(b.widthM);
  const min = panelUpgradeMinimums(s.windRegion);
  const wallOptions = thicknessOptions(PANEL_THICKNESSES_MM, min.externalMinMm, b.panelMm);
  const ceilingOptions = thicknessOptions(
    CEILING_PANEL_THICKNESSES_MM,
    min.ceilingMinMm,
    b.ceilingMm,
  );

  return (
    <div className="tab-body">
      <label>
        Length: {b.lengthM.toFixed(1)}m
        <input
          type="range"
          min={2.4}
          max={15}
          step={0.3}
          value={b.lengthM}
          onChange={(e) => s.setDims(Number(e.target.value), b.widthM)}
        />
      </label>
      <label>
        Width: {b.widthM.toFixed(1)}m
        <input
          type="range"
          min={2.4}
          max={9}
          step={0.3}
          value={b.widthM}
          onChange={(e) => s.setDims(b.lengthM, Number(e.target.value))}
        />
      </label>
      <p className="module-feedback">
        {modules} transport module{modules > 1 ? "s" : ""}
        {modules > 1 && " — tee-section joints included"}
      </p>

      <label>
        Floor level (FFL): {b.ffl_mm}mm
        <input
          type="range"
          min={0}
          max={1200}
          step={5}
          value={b.ffl_mm}
          onChange={(e) => s.setFfl(Number(e.target.value))}
        />
      </label>

      <label>
        Panel type
        <select value={b.panelType} onChange={(e) => s.setPanel({ panelType: e.target.value })}>
          {PANEL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Wall panel thickness
        <select value={b.panelMm} onChange={(e) => s.setPanel({ panelMm: Number(e.target.value) })}>
          {wallOptions.map((t) => (
            <option key={t} value={t}>
              {t}mm
            </option>
          ))}
        </select>
      </label>
      <label>
        Ceiling panel thickness
        <select value={b.ceilingMm} onChange={(e) => s.setPanel({ ceilingMm: Number(e.target.value) })}>
          {ceilingOptions.map((t) => (
            <option key={t} value={t}>
              {t}mm
            </option>
          ))}
        </select>
      </label>
      {s.windRegion !== "AB" && (
        <p className="muted">
          Region {s.windRegion}: panels auto-upgraded to Blaise minimums (
          {panelUpgradeMinimums(s.windRegion).externalMinMm}mm wall /{" "}
          {panelUpgradeMinimums(s.windRegion).ceilingMinMm}mm ceiling).
        </p>
      )}

      <fieldset className="swatches">
        <legend>Wall panel colour</legend>
        {COLORBOND_COLOURS.map((c) => (
          <button
            key={c.name}
            title={c.name}
            className={`swatch ${b.colour === c.name ? "selected" : ""}`}
            style={{ background: c.hex }}
            onClick={() => s.setPanel({ colour: c.name })}
          />
        ))}
        <span className="swatch-name">{b.colour}</span>
      </fieldset>

      <fieldset className="swatches">
        <legend>Roof, cappings &amp; gutter</legend>
        {COLORBOND_COLOURS.map((c) => (
          <button
            key={c.name}
            title={c.name}
            className={`swatch ${b.roofColour === c.name ? "selected" : ""}`}
            style={{ background: c.hex }}
            onClick={() => s.setPanel({ roofColour: c.name })}
          />
        ))}
        <span className="swatch-name">{b.roofColour}</span>
      </fieldset>

      <label>
        Wind region
        <select value={s.windRegion} onChange={(e) => s.setWindRegion(e.target.value as WindRegion)}>
          <option value="AB">A &amp; B</option>
          <option value="C">C (cyclonic)</option>
          <option value="D">D (severe cyclonic)</option>
        </select>
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={b.colourbondRoof}
          onChange={(e) => s.setColourbondRoof(e.target.checked)}
        />
        Colourbond roof
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={b.gutters} onChange={(e) => s.setGutters(e.target.checked)} />
        Colourbond gutters &amp; downpipes
      </label>
      {!b.gutters && (
        <p className="warn-inline">Removing stormwater management adds a site risk warning.</p>
      )}
    </div>
  );
}
