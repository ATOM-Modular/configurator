import { useMemo, useState } from "react";
import type { AssemblyGroup, ManifestPart } from "@atom/assets";
import { loadGroups } from "@atom/assets";
import { paletteGroups } from "./manifestCatalogue";
import { planSymbol } from "./plan/planSymbols";
import { useActiveBuilding, useConfigurator } from "../state/store";

const ALL_GROUPS = loadGroups().groups;

/**
 * The manifest, made browsable — the ONE catalogue. Parts tab: every manifest
 * part (mapping to Blaise SKU[s]). Groups tab: assembly groups. Placement is
 * click-to-place: tap an item to arm it, then tap the plan/site to drop it
 * (works on desktop AND touch — no HTML5 drag).
 */
export function Palette() {
  const [tab, setTab] = useState<"parts" | "groups">("parts");
  const [query, setQuery] = useState("");
  const dda = useActiveBuilding().dda;
  const armed = useConfigurator((s) => s.armed);
  const setArmed = useConfigurator((s) => s.setArmed);

  const groups = useMemo(() => paletteGroups(query), [query]);
  const assemblies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_GROUPS.filter((g) => (g.dda ? dda : true)).filter(
      (g) =>
        !q ||
        g.displayName.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [query, dda]);

  const armPart = (p: ManifestPart) => {
    const isArmed = armed?.kind === "part" && armed.partId === p.id;
    setArmed(
      isArmed
        ? null
        : { kind: "part", partId: p.id, sku: p.skus[0]!, placementMode: p.placementMode, displayName: p.displayName },
    );
  };
  const armGroup = (g: AssemblyGroup) => {
    const isArmed = armed?.kind === "group" && armed.groupId === g.id;
    setArmed(isArmed ? null : { kind: "group", groupId: g.id, displayName: g.displayName });
  };

  return (
    <div className="palette">
      <div className="palette-tabs">
        <button className={tab === "parts" ? "active" : ""} onClick={() => setTab("parts")}>Parts</button>
        <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>Groups</button>
      </div>

      <div className="cat-search">
        <i className="ti ti-search" aria-hidden="true" />
        <input
          value={query}
          placeholder={tab === "parts" ? "Search parts & tags" : "Search groups"}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="clear" onClick={() => setQuery("")}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>

      {tab === "parts" ? (
        <>
          {groups.map((g) => (
            <div className="cat-group" key={g.category}>
              <div className="cat-group-title">{g.title}</div>
              <div className="palette-tiles">
                {g.parts.map((p) => (
                  <PaletteTile
                    key={p.id}
                    part={p}
                    armed={armed?.kind === "part" && armed.partId === p.id}
                    onArm={() => armPart(p)}
                  />
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="muted">No parts match that search.</p>}
        </>
      ) : (
        <div className="cat-group">
          <div className="cat-group-title">Assembly groups</div>
          <div className="palette-groups">
            {assemblies.map((g) => (
              <GroupTile
                key={g.id}
                group={g}
                armed={armed?.kind === "group" && armed.groupId === g.id}
                onArm={() => armGroup(g)}
              />
            ))}
          </div>
          {!dda && <p className="muted">Accessible (DDA) sets appear when the building's DDA flag is on.</p>}
          {assemblies.length === 0 && <p className="muted">No groups match that search.</p>}
        </div>
      )}
    </div>
  );
}

/** Distinct thumbnail glyph so a door doesn't look like a window. */
function tileGlyph(part: ManifestPart) {
  const sku = part.skus[0] ?? "";
  if (part.placementMode === "wall-mounted") {
    if (/DOOR/i.test(sku)) {
      // door leaf + swing arc
      return (
        <svg viewBox="0 0 40 40" className="tile-glyph">
          <line x1="8" y1="30" x2="8" y2="10" />
          <path d="M8 10 A 20 20 0 0 1 28 30" fill="none" />
        </svg>
      );
    }
    // window — sill/head parallel lines
    return (
      <svg viewBox="0 0 40 40" className="tile-glyph">
        <line x1="6" y1="16" x2="34" y2="16" />
        <line x1="6" y1="24" x2="34" y2="24" />
        <line x1="20" y1="16" x2="20" y2="24" />
      </svg>
    );
  }
  if (part.placementMode === "floor-free") {
    // the SAME plan symbol used in the drawing, so the thumbnail matches the GA
    const { x: w, z: h } = part.dimensions;
    const pad = Math.max(w, h) * 0.2 + 0.05;
    return (
      <svg
        viewBox={`${-w / 2 - pad} ${-h / 2 - pad} ${w + 2 * pad} ${h + 2 * pad}`}
        className="tile-glyph tile-plan"
      >
        {planSymbol(sku, w, h)}
      </svg>
    );
  }
  // partition / structural → simple footprint box
  const ratio = part.dimensions.x / part.dimensions.z;
  const w = ratio >= 1 ? 26 : Math.max(10, Math.round(26 * ratio));
  const h = ratio >= 1 ? Math.max(10, Math.round(26 / ratio)) : 26;
  return (
    <span
      className={part.placeholder ? "wire" : "solid"}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}

function PaletteTile({ part, armed, onArm }: { part: ManifestPart; armed: boolean; onArm: () => void }) {
  const placeable = part.placementMode !== "bay-grid";
  return (
    <button
      type="button"
      className={`palette-tile ${placeable ? "placeable" : ""} ${armed ? "armed" : ""}`}
      title={`${part.displayName} — ${part.placementMode} · ${part.skus.join(", ")}`}
      data-placement={part.placementMode}
      disabled={!placeable}
      onClick={onArm}
    >
      <div className="palette-thumb">{tileGlyph(part)}</div>
      <span className="palette-label">{part.displayName}</span>
    </button>
  );
}

function GroupTile({ group, armed, onArm }: { group: AssemblyGroup; armed: boolean; onArm: () => void }) {
  const n = group.parts.length;
  return (
    <button
      type="button"
      className={`palette-group-tile ${armed ? "armed" : ""}`}
      title={`${group.displayName} — ${n} parts${group.dda ? " · DDA" : ""}`}
      onClick={onArm}
    >
      <i className="ti ti-stack-2" aria-hidden="true" />
      <span className="palette-group-name">{group.displayName}</span>
      <span className="palette-group-meta">{n} parts{group.dda ? " · DDA" : ""}</span>
    </button>
  );
}
