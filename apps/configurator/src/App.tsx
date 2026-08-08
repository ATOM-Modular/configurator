import { useEffect } from "react";
import type { BuildingUse } from "@atom/contracts";
import { Wordmark } from "./brand/Wordmark";
import { Stepper } from "./components/Stepper";
import { BUILDING_USES } from "./state/presets";
import { activeBuilding, useConfigurator, type WizardStep } from "./state/store";
import { AU_STATES, type AuState } from "./state/windRegion";
import { Step1Setup } from "./steps/Step1Setup";
import { Step2Catalog } from "./steps/Step2Catalog";
import { Step3Design } from "./steps/Step3Design";
import { StudioPage } from "./studio/StudioPage";

function ModeToggle() {
  const mode = useConfigurator((s) => s.mode);
  const setMode = useConfigurator((s) => s.setMode);
  const step = useConfigurator((s) => s.step);
  if (step !== 3) return null;
  return (
    <div className="mode-toggle">
      {(["single", "site"] as const).map((m) => (
        <button key={m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
          {m === "single" ? "Single building" : "Site"}
        </button>
      ))}
    </div>
  );
}

/** SPEC step 1: selections persist as URL query params (deep-linkable). */
function useUrlSync() {
  const { step, auState, postcode, use, setStep, setSetup, setDims } = useConfigurator();
  const lengthM = useConfigurator((s) => activeBuilding(s).lengthM);
  const widthM = useConfigurator((s) => activeBuilding(s).widthM);

  // hydrate once from the URL
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qsState = q.get("state");
    const qsUse = q.get("use");
    setSetup({
      ...(qsState && (AU_STATES as readonly string[]).includes(qsState)
        ? { auState: qsState as AuState }
        : {}),
      ...(q.get("postcode") ? { postcode: q.get("postcode")! } : {}),
      ...(qsUse && (BUILDING_USES as string[]).includes(qsUse)
        ? { use: qsUse as BuildingUse }
        : {}),
    });
    const l = Number(q.get("l"));
    const w = Number(q.get("w"));
    if (l > 0 && w > 0) setDims(l, w);
    const qStep = Number(q.get("step"));
    if (qStep === 2 || qStep === 3) setStep(qStep as WizardStep);
    // hydrate-once on mount: store actions are stable, so no deps needed
  }, []);

  // reflect state back into the URL
  useEffect(() => {
    const q = new URLSearchParams({
      step: String(step),
      state: auState,
      postcode,
      use,
      l: String(lengthM),
      w: String(widthM),
    });
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [step, auState, postcode, use, lengthM, widthM]);
}

/** Feature flag: ?studio=1 opens the one-page drag-and-drop configurator. */
function useStudioFlag(): boolean {
  return new URLSearchParams(window.location.search).get("studio") === "1";
}

export default function App() {
  const studio = useStudioFlag();
  if (studio) return <StudioPage />;
  return <Wizard />;
}

function Wizard() {
  useUrlSync();
  const step = useConfigurator((s) => s.step);

  return (
    <div className="app">
      <header className="topbar">
        <Wordmark />
        <Stepper />
        <ModeToggle />
      </header>
      <main className={`content step-${step}`}>
        {step === 1 && <Step1Setup />}
        {step === 2 && <Step2Catalog />}
        {step === 3 && <Step3Design />}
      </main>
    </div>
  );
}
