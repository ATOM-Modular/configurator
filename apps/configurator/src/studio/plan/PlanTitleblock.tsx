/**
 * ATOM drawing-mode titleblock — mirrors the manufacture GA sheet layout (logo,
 * project, client, date, scale) BUT stamps the status as a concept, not
 * "FOR MANUFACTURE". The CONCEPT status is deliberate: this artifact aligns
 * sales/client/production but does NOT replace the controlled drafting + review
 * path to the floor. The stamp is required on every drawing-mode view and any
 * export of it.
 */
export const CONCEPT_STAMP = "CONCEPT — NOT FOR CONSTRUCTION";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function auDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

export function PlanTitleblock({
  projectName,
  client,
  scale = "1:50 (nominal)",
}: {
  projectName: string;
  client?: string;
  scale?: string;
}) {
  return (
    <div className="dwg-titleblock">
      <div className="dwg-tb-logo">
        <span className="dwg-tb-atom">ATOM</span>
        <span className="dwg-tb-modular">MODULAR</span>
      </div>
      <div className="dwg-tb-cells">
        <Cell label="Project name" value={projectName} />
        <Cell label="Client" value={client || "—"} />
        <Cell label="Date" value={auDate(new Date())} />
        <Cell label="Scale" value={scale} />
        <Cell label="Drawing" value="Floor Plan — GA (concept)" />
      </div>
      <div className="dwg-tb-stamp" role="note" aria-label="status">
        {CONCEPT_STAMP}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="dwg-tb-cell">
      <span className="dwg-tb-k">{label}</span>
      <span className="dwg-tb-v">{value}</span>
    </div>
  );
}
