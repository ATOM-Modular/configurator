import { useMemo, useState } from "react";
import { buildSiteConfig, useConfigurator } from "../state/store";
import { ConfigStage } from "../scene/ConfigStage";
import { PricePanel } from "../components/PricePanel";
import { StructureTab } from "../tabs/StructureTab";
import { OpeningsTab } from "../tabs/OpeningsTab";
import { InteriorTab } from "../tabs/InteriorTab";
import { WetAreasTab } from "../tabs/WetAreasTab";

const TABS = [
  { key: "structure", label: "Structure", el: <StructureTab /> },
  { key: "openings", label: "Openings", el: <OpeningsTab /> },
  { key: "interior", label: "Interior", el: <InteriorTab /> },
  { key: "wet", label: "Wet areas", el: <WetAreasTab /> },
] as const;

export function Step3Design() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("structure");
  const s = useConfigurator();

  const site = useMemo(
    () =>
      buildSiteConfig({
        use: s.use,
        windRegion: s.windRegion,
        lengthM: s.lengthM,
        widthM: s.widthM,
        ffl_mm: s.ffl_mm,
        panelType: s.panelType,
        panelMm: s.panelMm,
        colour: s.colour,
        gutters: s.gutters,
        openings: s.openings,
        partitionsX: s.partitionsX,
        roomMeta: s.roomMeta,
        wet: s.wet,
        dda: s.dda,
      }),
    [
      s.use,
      s.windRegion,
      s.lengthM,
      s.widthM,
      s.ffl_mm,
      s.panelType,
      s.panelMm,
      s.colour,
      s.gutters,
      s.openings,
      s.partitionsX,
      s.roomMeta,
      s.wet,
      s.dda,
    ],
  );

  return (
    <section className="design-layout">
      <div className="config-tabs">
        <div className="tab-buttons">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? "active" : ""}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {TABS.find((t) => t.key === tab)!.el}
      </div>

      <div className="stage-wrap">
        <ConfigStage />
      </div>

      <PricePanel site={site} />
    </section>
  );
}
