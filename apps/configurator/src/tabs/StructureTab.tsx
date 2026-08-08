import type { WindRegion } from "@atom/contracts";
import {
  COLORBOND_COLOURS,
  moduleCountFor,
  PANEL_THICKNESSES_MM,
  PANEL_TYPES,
} from "../state/presets";
import { useConfigurator } from "../state/store";

export function StructureTab() {
  const s = useConfigurator();
  const modules = moduleCountFor(s.widthM);

  return (
    <div className="tab-body">
      <label>
        Length: {s.lengthM.toFixed(1)}m
        <input
          type="range"
          min={2.4}
          max={15}
          step={0.3}
          value={s.lengthM}
          onChange={(e) => s.setDims(Number(e.target.value), s.widthM)}
        />
      </label>
      <label>
        Width: {s.widthM.toFixed(1)}m
        <input
          type="range"
          min={2.4}
          max={9}
          step={0.3}
          value={s.widthM}
          onChange={(e) => s.setDims(s.lengthM, Number(e.target.value))}
        />
      </label>
      <p className="module-feedback">
        {modules} transport module{modules > 1 ? "s" : ""}
        {modules > 1 && " — tee-section joints included"}
      </p>

      <label>
        Panel type
        <select value={s.panelType} onChange={(e) => s.setPanel({ panelType: e.target.value })}>
          {PANEL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Panel thickness
        <select value={s.panelMm} onChange={(e) => s.setPanel({ panelMm: Number(e.target.value) })}>
          {PANEL_THICKNESSES_MM.map((t) => (
            <option key={t} value={t}>
              {t}mm
            </option>
          ))}
        </select>
      </label>

      <fieldset className="swatches">
        <legend>Colorbond colour</legend>
        {COLORBOND_COLOURS.map((c) => (
          <button
            key={c.name}
            title={c.name}
            className={`swatch ${s.colour === c.name ? "selected" : ""}`}
            style={{ background: c.hex }}
            onClick={() => s.setPanel({ colour: c.name })}
          />
        ))}
        <span className="swatch-name">{s.colour}</span>
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
        <input type="checkbox" checked={s.gutters} onChange={(e) => s.setGutters(e.target.checked)} />
        Gutters &amp; downpipes
      </label>
      {!s.gutters && <p className="warn-inline">Removing stormwater management adds a site risk warning.</p>}
    </div>
  );
}
