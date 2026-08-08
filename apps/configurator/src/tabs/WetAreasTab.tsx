import { useConfigurator, type WetState } from "../state/store";

const ITEMS: { key: keyof Omit<WetState, "kitchen">; label: string }[] = [
  { key: "pans", label: "Toilet pans" },
  { key: "basins", label: "Basins" },
  { key: "showers", label: "Showers" },
  { key: "urinals", label: "Urinals" },
  { key: "partitions", label: "Partitions" },
  { key: "mfSets", label: "M/F standard sets" },
  { key: "accessibleSets", label: "Accessible (DDA) sets" },
];

export function WetAreasTab() {
  const { wet, dda, setWet, setDda } = useConfigurator();
  const isWet =
    ITEMS.some((i) => wet[i.key] > 0) || wet.kitchen !== null;
  const gasLikely = wet.showers >= 3;

  return (
    <div className="tab-body">
      <label className="checkbox">
        <input type="checkbox" checked={dda} onChange={(e) => setDda(e.target.checked)} />
        DDA-compliant build (required for accessible sets)
      </label>

      <div className="qty-grid">
        {ITEMS.map((i) => (
          <label key={i.key} className={i.key === "accessibleSets" && !dda ? "disabled" : ""}>
            {i.label}
            <input
              type="number"
              min={0}
              max={10}
              value={wet[i.key]}
              disabled={i.key === "accessibleSets" && !dda}
              onChange={(e) => setWet({ [i.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>

      <label>
        Kitchen
        <select
          value={wet.kitchen ?? "none"}
          onChange={(e) =>
            setWet({ kitchen: e.target.value === "none" ? null : (e.target.value as WetState["kitchen"]) })
          }
        >
          <option value="none">None</option>
          <option value="1500">Kitchenette 1500</option>
          <option value="2100">Kitchenette 2100</option>
          <option value="3600">Kitchen 3600</option>
        </select>
      </label>

      {isWet && (
        <p className="muted">
          Hot water is auto-included on wet builds —{" "}
          {gasLikely ? "gas (shower demand)" : "electric"} HWS will appear in the price lines.
        </p>
      )}
    </div>
  );
}
