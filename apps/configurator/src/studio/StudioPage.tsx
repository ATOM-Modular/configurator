import { useEffect, useMemo } from "react";
import type { WindRegion } from "@atom/contracts";
import { buildSiteConfig, useConfigurator } from "../state/store";
import { ConfigStage } from "../scene/ConfigStage";
import { SiteCanvas } from "../site/SiteCanvas";
import { PricePanel } from "../components/PricePanel";
import { Wordmark } from "../brand/Wordmark";
import { Catalogue } from "./Catalogue";
import { BuildingPlan2D } from "./BuildingPlan2D";
import { ChassisSizeSlider } from "./ChassisSizeSlider";
import { getDragged } from "./drag";

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
        <label className="studio-region">
          Region
          <select value={s.windRegion} onChange={(e) => s.setWindRegion(e.target.value as WindRegion)}>
            <option value="AB">A &amp; B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </label>
        {s.scope === "building" && (
          <>
            <ChassisSizeSlider />
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
          </>
        )}
      </header>

      <div className="studio-body">
        <Catalogue />

        <main className="studio-stage">
          <StudioSurface />
        </main>

        <PricePanel site={site} />
      </div>
    </div>
  );
}

/** The active surface for the current scope × view. */
function StudioSurface() {
  const scope = useConfigurator((s) => s.scope);
  const view = useConfigurator((s) => s.view);
  const addChassis = useConfigurator((s) => s.addChassis);
  const addSiteKit = useConfigurator((s) => s.addSiteKit);

  if (view === "3d") {
    // ConfigStage renders active building (single) or whole site per store.mode
    return <ConfigStage />;
  }

  if (scope === "building") {
    return <BuildingPlan2D />;
  }

  // Site 2D: SiteCanvas handles move/walkways; the wrapper accepts drops to
  // create buildings (chassis) or place site kit (auto-positioned for v1).
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const item = getDragged();
    if (!item) return;
    if (item.kind === "chassis" && item.lengthM && item.widthM) {
      addChassis({
        lengthM: item.lengthM,
        widthM: item.widthM,
        chassisType: item.chassisType ?? "office",
      });
    } else if (item.kind === "sitekit" && item.sku && item.partId) {
      addSiteKit({ sku: item.sku, partId: item.partId, label: item.label, xM: 0, zM: -2.5, rotationDeg: 0 });
    }
  };

  return (
    <div className="site-drop" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <SiteCanvas />
      <p className="muted">Drag a building or site-kit item here to add it.</p>
    </div>
  );
}
