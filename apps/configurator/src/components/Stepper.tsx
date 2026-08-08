import { useConfigurator, type WizardStep } from "../state/store";

const STEPS: { n: WizardStep; label: string }[] = [
  { n: 1, label: "Project setup" },
  { n: 2, label: "Choose a building" },
  { n: 3, label: "Design & price" },
];

export function Stepper() {
  const step = useConfigurator((s) => s.step);
  const setStep = useConfigurator((s) => s.setStep);
  return (
    <nav className="stepper" aria-label="Configuration steps">
      {STEPS.map((s) => (
        <button
          key={s.n}
          className={`step ${step === s.n ? "active" : ""} ${step > s.n ? "done" : ""}`}
          onClick={() => setStep(s.n)}
          disabled={s.n > step}
        >
          <span className="step-n">{s.n}</span>
          <span className="step-label">{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
