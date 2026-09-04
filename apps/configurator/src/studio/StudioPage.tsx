import { useEffect, useMemo } from "react";
import type { WindRegion } from "@atom/contracts";
import { buildSiteConfig, useConfigurator } from "../state/store";
import { ConfigStage } from "../scene/ConfigStage";
import { SiteCanvas } from "../site/SiteCanvas";
import { PricePanel } from "../components/PricePanel";
import { Wordmark } from "../brand/Wordmark";
import { Catalogue } from "./Catalogue";
import { BuildingPlan2D } from "./BuildingPlan2D";
import { WalkTouchControls } from "./WalkTouchControls";
import { PART_BY_ID } from "./manifestCatalogue";

/** Coarse pointer (touch tablet) → show on-screen walk controls. */
const isCoarsePointer =
  typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

/** One-page drag-and-drop configurator (feature-flagged; wizard stays live). */
export function StudioPage() {
  const s = useConfigurator();

  // 3D (ConfigStage) reads store.mode → drive it from the studio scope.
  // setMode is a stable store action; only scope needs to be a dependency.
  const setMode = s.setMode;
  const scope = s.scope;
  useEffect(() => {
    setMode(scope === "site" ? "site" : "single");
  }, [scope, setMode]);

  // The estimate is always the whole project (all buildings + site kit).
  const site = useMemo(
    () =>
      buildSiteConfig({
        windRegion: s.windRegion,
        buildings: s.buildings,
        siteKit: s.siteKit,
        walkways: s.walkways,
        mode: "site",
        activeId: s.activeId,
      }),
    [s.windRegion, s.buildings, s.siteKit, s.walkways, s.activeId],
  );

  return (
    <div className="studio">
      <header className="studio-top">
        <Wordmark />
        <div className="studio-scope">
          {(["site", "building"] as const).map((sc) => (
            <button
              key={sc}
              className={s.scope === sc ? "active" : ""}
              onClick={() => s.setScope(sc)}
            >
              {sc === "site" ? "Site" : "Building"}
            </button>
          ))}
        </div>
        <div className="studio-view">
          {(["2d", "3d"] as const).map((v) => (
            <button key={v} className={s.view === v ? "active" : ""} onClick={() => s.setView(v)}>
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        {s.view === "3d" && (
          <button
            className={`studio-walk ${s.walkMode ? "active" : ""}`}
            onClick={() => s.setWalkMode(!s.walkMode)}
            title="Walk around and step inside the building"
          >
            <i className="ti ti-walk" aria-hidden="true" /> {s.walkMode ? "Exit walk" : "Walk"}
          </button>
        )}
        <label className="studio-region">
          Region
          <select value={s.windRegion} onChange={(e) => s.setWindRegion(e.target.value as WindRegion)}>
            <option value="AB">A &amp; B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </label>
        {s.scope === "building" && (
          <div className="studio-buildings">
            {s.buildings.map((b) => (
              <button
                key={b.id}
                className={b.id === s.activeId ? "active" : ""}
                onClick={() => s.selectBuilding(b.id)}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="studio-body">
        <Catalogue />

        <main className="studio-stage">
          <StudioSurface />
          {s.view === "3d" && s.walkMode && isCoarsePointer && <WalkTouchControls />}
          {s.view === "3d" && s.walkMode && (
            <div className="walk-hint">
              <i className="ti ti-walk" aria-hidden="true" />
              {isCoarsePointer ? (
                <> <strong>Left stick</strong> move · <strong>drag</strong> to look around</>
              ) : (
                <> Click to look · <strong>W A S D</strong> move · <strong>Shift</strong> run · <strong>Esc</strong> release mouse</>
              )}
            </div>
          )}
        </main>

        <PricePanel site={site} />
      </div>
    </div>
  );
}

/** The active surface for the current scope × view. */
function StudioSurface() {
  // All hooks must run every render (Rules of Hooks) — declare them before any
  // early return, even though `armed`/`setArmed` are only used in Site 2D.
  const scope = useConfigurator((s) => s.scope);
  const view = useConfigurator((s) => s.view);
  const addSiteKit = useConfigurator((s) => s.addSiteKit);
  const armed = useConfigurator((s) => s.armed);
  const setArmed = useConfigurator((s) => s.setArmed);

  if (view === "3d") {
    // ConfigStage renders active building (single) or whole site per store.mode
    return <ConfigStage />;
  }

  if (scope === "building") {
    return <BuildingPlan2D />;
  }

  // Site 2D: SiteCanvas handles move/walkways; the wrapper places an armed
  // site-kit item on click (auto-positioned for v1). Buildings are added with
  // the "Add building" control.
  const onClick = () => {
    if (armed?.kind !== "part") return;
    if (PART_BY_ID.get(armed.partId)?.category === "sitekit") {
      addSiteKit({ sku: armed.sku, partId: armed.partId, label: armed.displayName, xM: 0, zM: -2.5, rotationDeg: 0 });
      setArmed(null);
    }
  };

  return (
    <div className="site-drop" onClick={onClick}>
      <SiteCanvas />
      <p className="muted">
        {armed?.kind === "part"
          ? `Tap the site to place ${armed.displayName}`
          : "Tap a site-kit item, then tap the site · add a building from the catalogue"}
      </p>
    </div>
  );
}
