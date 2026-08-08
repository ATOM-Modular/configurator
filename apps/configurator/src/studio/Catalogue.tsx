import { CATALOGUE, type CatalogueItem } from "./catalogueData";
import { setDragged } from "./drag";
import { useConfigurator } from "../state/store";

/**
 * The single catalogue rail — every Blaise option as a draggable card,
 * grouped by category. Dragging a card starts a placement; where you drop it
 * (site / room / wall) is decided by the target and the item kind.
 */
export function Catalogue() {
  const scope = useConfigurator((s) => s.scope);

  return (
    <aside className="studio-catalogue">
      <h2>Catalogue</h2>
      <p className="muted">
        {scope === "site"
          ? "Drag a building or site-kit item onto the site."
          : "Drag fit-out into a room, or an opening onto a wall."}
      </p>
      {CATALOGUE.map((group) => (
        <div className="cat-group" key={group.category}>
          <div className="cat-group-title">{group.category}</div>
          <div className="cat-items">
            {group.items.map((item) => (
              <CatalogueCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
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
