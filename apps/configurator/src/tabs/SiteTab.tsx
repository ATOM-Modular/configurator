import { footingSchedule, totalFootings, walkwayGeometry } from "../site/geometry";
import { SITE_KIT_CATALOG } from "../site/siteKitCatalog";
import { zinfraLoaded } from "../site/zinfra";
import { useConfigurator } from "../state/store";

export function SiteTab() {
  const s = useConfigurator();
  const rows = footingSchedule(s.buildings);

  return (
    <div className="tab-body">
      <div className="site-actions">
        <button onClick={() => s.addBuilding()}>+ Building</button>
        <button
          className={s.walkwayFromId ? "active" : ""}
          onClick={() =>
            s.walkwayFromId ? s.cancelWalkway() : s.startWalkway(s.activeId)
          }
        >
          {s.walkwayFromId ? "Cancel link" : "Walkway tool"}
        </button>
        <button onClick={() => s.loadSite(zinfraLoaded())}>Load Zinfra</button>
      </div>
      {s.walkwayFromId && (
        <p className="place-hint">Click the building to connect to…</p>
      )}
      {s.siteError && <p className="warn-inline">{s.siteError}</p>}

      <h4>Buildings ({s.buildings.length})</h4>
      <ul className="site-list">
        {s.buildings.map((b) => (
          <li key={b.id} className={b.id === s.activeId ? "selected" : ""}>
            <button className="pick" onClick={() => s.selectBuilding(b.id)}>
              {b.name}
              <span className="muted">
                {" "}
                {b.lengthM}×{b.widthM}m · FFL {b.ffl_mm}
              </span>
            </button>
            <button title="Rotate 90°" onClick={() => s.rotateBuilding(b.id)}>
              ⟳
            </button>
            {s.buildings.length > 1 && (
              <button className="remove" onClick={() => s.removeBuilding(b.id)}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <label>
        FFL of {s.buildings.find((b) => b.id === s.activeId)?.name} (mm)
        <input
          type="number"
          min={0}
          max={1500}
          step={5}
          value={s.buildings.find((b) => b.id === s.activeId)?.ffl_mm ?? 450}
          onChange={(e) => s.setFfl(Number(e.target.value))}
        />
      </label>

      <h4>Walkways ({s.walkways.length})</h4>
      <ul className="site-list">
        {s.walkways.map((w) => {
          const from = s.buildings.find((b) => b.id === w.fromBuildingId);
          const to = s.buildings.find((b) => b.id === w.toBuildingId);
          const link = from && to ? walkwayGeometry(from, to) : null;
          return (
            <li key={w.id}>
              <span>
                {from?.name} ↔ {to?.name}
                <span className="muted">
                  {link ? ` · ${link.gapM.toFixed(1)}m gap` : " · no facing edges"}
                </span>
              </span>
              <button onClick={() => s.toggleWalkwayElevated(w.id)}>
                {w.elevated ? "elevated" : "standard"}
              </button>
              <button className="remove" onClick={() => s.removeWalkway(w.id)}>
                ✕
              </button>
            </li>
          );
        })}
        {s.walkways.length === 0 && <li className="muted">None.</li>}
      </ul>

      <h4>Site kit</h4>
      <div className="kit-palette">
        {SITE_KIT_CATALOG.map((d) => (
          <button
            key={d.sku}
            onClick={() =>
              s.addSiteKit({
                sku: d.sku,
                partId: d.partId,
                label: d.label,
                xM: 0,
                zM: -2.5,
                rotationDeg: 0,
              })
            }
          >
            + {d.label}
          </button>
        ))}
      </div>
      <p className="muted">{s.siteKit.length} item(s) placed — drag them on the plan.</p>

      <h4>Footing schedule</h4>
      <table className="footing-table">
        <thead>
          <tr>
            <th>Building</th>
            <th>FFL</th>
            <th>Footing ht</th>
            <th>Mod</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.buildingId}>
              <td>{r.name}</td>
              <td>{r.ffl_mm}</td>
              <td>{r.footingHeightMm}</td>
              <td>{r.modules}</td>
              <td>{r.footingCount}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total Surefoot blocks</td>
            <td>{totalFootings(rows)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
