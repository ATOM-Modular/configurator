import { useConfigurator } from "../state/store";

const OPENING_TYPES = [
  { partId: "door-920-single", label: "Door 920 (closer)" },
  { partId: "door-820-single", label: "Door 820 (closer)" },
  { partId: "door-1600-double", label: "Double door 1600" },
  { partId: "window-sliding-1175", label: "Sliding window 1175" },
  { partId: "window-fixed-1175", label: "Fixed window 1175" },
  { partId: "window-toilet-600x300", label: "Toilet window 600×300" },
];

export function OpeningsTab() {
  const { openings, pendingOpeningPartId, openingError, setPendingOpening, removeOpening } =
    useConfigurator();

  return (
    <div className="tab-body">
      <p className="muted">
        Pick a type, then <strong>click a wall panel</strong> in the 3D view to place it.
        Openings snap to the 1200mm panel grid.
      </p>
      <div className="opening-types">
        {OPENING_TYPES.map((t) => (
          <button
            key={t.partId}
            className={`opening-type ${pendingOpeningPartId === t.partId ? "selected" : ""}`}
            onClick={() =>
              setPendingOpening(pendingOpeningPartId === t.partId ? null : t.partId)
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {pendingOpeningPartId && (
        <p className="place-hint">Placing: click a highlighted wall panel…</p>
      )}
      {openingError && <p className="warn-inline">{openingError}</p>}

      <h4>Placed ({openings.length})</h4>
      <ul className="opening-list">
        {openings.map((o) => (
          <li key={o.id}>
            <span>
              {OPENING_TYPES.find((t) => t.partId === o.partId)?.label ?? o.partId} — {o.elevation}{" "}
              wall, bay {o.startBay + 1}
            </span>
            <button className="remove" onClick={() => removeOpening(o.id)}>
              ✕
            </button>
          </li>
        ))}
        {openings.length === 0 && <li className="muted">None yet.</li>}
      </ul>
    </div>
  );
}
