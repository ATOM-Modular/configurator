import { BuildingControls } from "./BuildingControls";
import { Palette } from "./Palette";
import { useConfigurator } from "../state/store";

/**
 * The docked catalogue rail: building sizer on top, then the manifest palette
 * — every option browsable from the one manifest that also prices it.
 */
export function Catalogue() {
  const scope = useConfigurator((s) => s.scope);

  return (
    <aside className="studio-catalogue">
      <h2>Catalogue</h2>
      <div className="cat-group">
        <div className="cat-group-title">Building</div>
        <BuildingControls />
      </div>
      <p className="muted">
        {scope === "site"
          ? "Size the building, or add site kit. Tap an item, then tap the site."
          : "Tap a fit-out item, then tap the plan to place it. Every item is priced live."}
      </p>
      <Palette />
    </aside>
  );
}
