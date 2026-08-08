import type { BuildingUse } from "@atom/contracts";
import { BUILDING_USES } from "../state/presets";
import { useConfigurator } from "../state/store";
import { AU_STATES, type AuState } from "../state/windRegion";

const USE_ICONS: Record<string, string> = {
  Office: "🗂️",
  Lunchroom: "🍴",
  "Toilet & Amenities": "🚿",
  Accommodation: "🛏️",
  Lab: "🧪",
  Classroom: "📚",
};

export function Step1Setup() {
  const { auState, postcode, use, windRegion, setSetup, setStep } = useConfigurator();

  return (
    <section className="step-page">
      <h1>Where is the project, and what do you need?</h1>

      <div className="setup-row">
        <label>
          State
          <select
            value={auState}
            onChange={(e) => setSetup({ auState: e.target.value as AuState })}
          >
            {AU_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Postcode
          <input
            value={postcode}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => setSetup({ postcode: e.target.value.replace(/\D/g, "") })}
          />
        </label>
        <div className="wind-note">
          Wind region default: <strong>{windRegion === "AB" ? "A & B" : windRegion}</strong>
          {windRegion !== "AB" && <span className="chip">cyclonic — engineering applies</span>}
        </div>
      </div>

      <h2>Building use</h2>
      <div className="use-grid">
        {BUILDING_USES.map((u: BuildingUse) => (
          <button
            key={u}
            className={`use-card ${use === u ? "selected" : ""}`}
            onClick={() => setSetup({ use: u })}
          >
            <span className="use-icon">{USE_ICONS[u]}</span>
            <span>{u}</span>
          </button>
        ))}
      </div>

      <div className="step-actions">
        <button className="primary" onClick={() => setStep(2)} disabled={postcode.length !== 4}>
          Browse buildings →
        </button>
      </div>
    </section>
  );
}
