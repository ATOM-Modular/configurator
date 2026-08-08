import { useMemo, useState } from "react";
import { buildSiteConfig, useConfigurator } from "../state/store";
import { ConfigStage } from "../scene/ConfigStage";
import { PricePanel } from "../components/PricePanel";
import { SiteCanvas } from "../site/SiteCanvas";
import { IS_INTERNAL_BUILD } from "../internal/flag";
import { StructureTab } from "../tabs/StructureTab";
import { OpeningsTab } from "../tabs/OpeningsTab";
import { InteriorTab } from "../tabs/InteriorTab";
import { WetAreasTab } from "../tabs/WetAreasTab";
import { SiteTab } from "../tabs/SiteTab";

type TabKey = "structure" | "openings" | "interior" | "wet" | "site";

const TABS: { key: TabKey; label: string; siteOnly?: boolean }[] = [
  { key: "structure", label: "Structure" },
  { key: "openings", label: "Openings" },
  { key: "interior", label: "Interior" },
  { key: "wet", label: "Wet areas" },
  { key: "site", label: "Site", siteOnly: true },
];

export function Step3Design() {
  const [tab, setTab] = useState<TabKey>("structure");
  const s = useConfigurator();

  const site = useMemo(
    () =>
      buildSiteConfig({
        windRegion: s.windRegion,
        buildings: s.buildings,
        siteKit: s.siteKit,
        walkways: s.walkways,
        mode: s.mode,
        activeId: s.activeId,
      }),
    [s.windRegion, s.buildings, s.siteKit, s.walkways, s.mode, s.activeId],
  );

  const visibleTabs = TABS.filter((t) => !t.siteOnly || s.mode === "site");
  const current = visibleTabs.find((t) => t.key === tab) ?? visibleTabs[0]!;

  return (
    <section className="design-layout">
      <div className="config-tabs">
        <div className="tab-buttons">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              className={current.key === t.key ? "active" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {current.key === "structure" && <StructureTab />}
        {current.key === "openings" && <OpeningsTab />}
        {current.key === "interior" && <InteriorTab />}
        {current.key === "wet" && <WetAreasTab />}
        {current.key === "site" && <SiteTab />}
      </div>

      <div className="stage-wrap">
        <ConfigStage />
        <StageControls />
        {s.mode === "site" && (
          <div className="site-plan-overlay">
            <SiteCanvas />
          </div>
        )}
      </div>

      <PricePanel site={site} />
    </section>
  );
}

/**
 * Benchmark camera + capture controls. Always offers the hero-angle snap
 * (also the "b" key); the 1920×1080 PNG export is internal-mode only, since
 * it's a sales/QA tool rather than a customer action.
 */
function StageControls() {
  return (
    <div className="stage-controls">
      <button
        title="Snap to the benchmark hero angle (b)"
        onClick={() => window.dispatchEvent(new Event("atom-benchmark"))}
      >
        Hero angle
      </button>
      {IS_INTERNAL_BUILD && (
        <button
          title="Export a 1920×1080 PNG from the benchmark camera"
          onClick={() => window.dispatchEvent(new Event("atom-capture"))}
        >
          Capture ↓
        </button>
      )}
    </div>
  );
}
