import { useEffect } from "react";
import type { BuildingUse } from "@atom/contracts";
import { Stepper } from "./components/Stepper";
import { BUILDING_USES } from "./state/presets";
import { useConfigurator, type WizardStep } from "./state/store";
import { AU_STATES, type AuState } from "./state/windRegion";
import { Step1Setup } from "./steps/Step1Setup";
import { Step2Catalog } from "./steps/Step2Catalog";
import { Step3Design } from "./steps/Step3Design";

/** SPEC step 1: selections persist as URL query params (deep-linkable). */
function useUrlSync() {
  const { step, auState, postcode, use, lengthM, widthM, setStep, setSetup, setDims } =
    useConfigurator();

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

export default function App() {
  useUrlSync();
  const step = useConfigurator((s) => s.step);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">ATOM MODULAR</span>
        <Stepper />
      </header>
      <main className={`content step-${step}`}>
        {step === 1 && <Step1Setup />}
        {step === 2 && <Step2Catalog />}
        {step === 3 && <Step3Design />}
      </main>
    </div>
  );
}
