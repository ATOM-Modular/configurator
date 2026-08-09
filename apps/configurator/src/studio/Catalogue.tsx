import { useMemo, useState } from "react";
import { CATALOGUE, type CatalogueItem } from "./catalogueData";
import { setDragged } from "./drag";
import { BuildingControls } from "./BuildingControls";
import { useConfigurator } from "../state/store";

/**
 * The single catalogue rail — every Blaise option as a draggable card,
 * grouped by category, with Floorplanner-style search. Dragging a card starts
 * a placement; where you drop it (site / room / wall) is decided by the target
 * and the item kind.
 */
export function Catalogue() {
  const scope = useConfigurator((s) => s.scope);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOGUE;
    return CATALOGUE.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => i.label.toLowerCase().includes(q) || g.category.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <aside className="studio-catalogue">
      <h2>Catalogue</h2>
      <div className="cat-search">
        <i className="ti ti-search" aria-hidden="true" />
        <input
          value={query}
          placeholder="Search fit-out"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="clear" onClick={() => setQuery("")}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="cat-group">
        <div className="cat-group-title">Building</div>
        <BuildingControls />
      </div>
      <p className="muted">
        {scope === "site"
          ? "Size the building, or drag site kit onto the site."
          : "Drag fit-out into the plan, or an opening onto a wall."}
      </p>
      {groups.map((group) => (
        <div className="cat-group" key={group.category}>
          <div className="cat-group-title">{group.category}</div>
          <div className="cat-items">
            {group.items.map((item) => (
              <CatalogueCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="muted">No matches for “{query}”.</p>}
    </aside>
  );
}

function CatalogueCard({ item }: { item: CatalogueItem }) {
  return (
    <button
      className="cat-card"
      draggable
      onDragStart={(e) => {
        setDragged(item);
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => setDragged(null)}
      title={item.label}
    >
      <i className={`ti ${item.icon}`} aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}
