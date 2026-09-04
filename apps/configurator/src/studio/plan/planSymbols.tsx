import type { ReactElement } from "react";

/**
 * Top-down PLAN SYMBOLS for in-plan parts — thin-line plumbing/fixture symbols
 * matching an ATOM GA floor plan (a shaded icon is not acceptable in drawing
 * mode). Each symbol is drawn centred on the origin in metres, sized to the
 * part's real footprint (w × h = manifest dimensions x × z). Stroke/weight come
 * from CSS (.dwg-sym), so everything stays monochrome.
 *
 * This is what the manifest `thumbnail2d` becomes for in-plan parts; authored
 * SVGs later replace these procedural symbols — a lookup swap, no other change.
 */
export function planSymbol(sku: string, w: number, h: number): ReactElement {
  const hw = w / 2;
  const hh = h / 2;
  const key = sku.toUpperCase();

  // toilet pan — cistern against the "back" (−h) + oval bowl
  if (key.startsWith("BATH-PAN") || key.startsWith("BATH-ACC-TOILET")) {
    const cist = h * 0.22;
    return (
      <g className="dwg-sym">
        <rect x={-hw * 0.9} y={-hh} width={w * 0.9} height={cist} rx={0.02} />
        <ellipse cx={0} cy={-hh + cist + h * 0.28} rx={hw * 0.7} ry={h * 0.3} />
      </g>
    );
  }
  // basin / hand basin — vanity rect + oval bowl + tap dot
  if (key.startsWith("BATH-BASIN") || key.startsWith("BATH-ACC-BASIN")) {
    return (
      <g className="dwg-sym">
        <rect x={-hw} y={-hh} width={w} height={h} rx={0.03} />
        <ellipse cx={0} cy={hh * 0.1} rx={hw * 0.62} ry={hh * 0.6} />
        <circle cx={0} cy={-hh + h * 0.12} r={0.03} />
      </g>
    );
  }
  // shower tray — square with a single fall line to a corner drain (GA plan
  // convention), not an X
  if (key.startsWith("BATH-SHOWER") || key.startsWith("BATH-ACC-SHOWER")) {
    const dr = Math.min(hw, hh) * 0.14;
    return (
      <g className="dwg-sym">
        <rect x={-hw} y={-hh} width={w} height={h} />
        <line x1={hw} y1={-hh} x2={-hw + dr * 1.4} y2={hh - dr * 1.4} />
        <circle cx={-hw + dr * 1.4} cy={hh - dr * 1.4} r={dr} />
      </g>
    );
  }
  // urinal — wall-hung, rounded front
  if (key.startsWith("BATH-URINAL")) {
    return (
      <g className="dwg-sym">
        <path d={`M ${-hw} ${-hh} H ${hw} V ${hh * 0.2} A ${hw} ${hh * 0.8} 0 0 1 ${-hw} ${hh * 0.2} Z`} />
        <circle cx={0} cy={0} r={0.03} />
      </g>
    );
  }
  // laundry tub — square within square + drain
  if (key.startsWith("LAUNDRY-TUB")) {
    return (
      <g className="dwg-sym">
        <rect x={-hw} y={-hh} width={w} height={h} rx={0.02} />
        <rect x={-hw * 0.7} y={-hh * 0.7} width={w * 0.7} height={h * 0.7} rx={0.02} />
        <circle cx={0} cy={0} r={0.035} />
      </g>
    );
  }
  // hot water system / tank — circle
  if (key.startsWith("HWS")) {
    return (
      <g className="dwg-sym">
        <circle cx={0} cy={0} r={Math.min(hw, hh)} />
        <line x1={-hw * 0.5} y1={0} x2={hw * 0.5} y2={0} />
      </g>
    );
  }
  // kitchenette — bench with a sink + two hobs
  if (key.startsWith("KITCHEN")) {
    return (
      <g className="dwg-sym">
        <rect x={-hw} y={-hh} width={w} height={h} />
        <rect x={-hw + w * 0.1} y={-hh + h * 0.2} width={w * 0.3} height={h * 0.6} rx={0.02} />
        <circle cx={hw - w * 0.22} cy={-hh + h * 0.3} r={h * 0.12} />
        <circle cx={hw - w * 0.22} cy={hh - h * 0.3} r={h * 0.12} />
      </g>
    );
  }
  // double GPO — the standard two-prong plan tag
  if (key.startsWith("GPO")) {
    return (
      <g className="dwg-sym">
        <path d={`M 0 0.06 L -0.09 0.2 L 0.09 0.2 Z`} />
        <line x1={0} y1={0.06} x2={0} y2={-0.02} />
        <text x={0.12} y={0.16} className="dwg-symtxt">2</text>
      </g>
    );
  }
  // LED batten light — long thin rectangle with a slash
  if (key.startsWith("LIGHT")) {
    return (
      <g className="dwg-sym">
        <rect x={-hw} y={-0.04} width={w} height={0.08} />
        <line x1={-hw} y1={-0.04} x2={-hw + 0.1} y2={0.04} />
      </g>
    );
  }
  // data / comms point — triangle tag
  if (key.startsWith("DATA")) {
    return (
      <g className="dwg-sym">
        <path d="M 0 -0.1 L 0.1 0.08 L -0.1 0.08 Z" />
      </g>
    );
  }
  // split-system head / exhaust fan — labelled rectangle
  if (key.startsWith("AC-SPLIT") || key.startsWith("EXHAUST")) {
    return (
      <g className="dwg-sym">
        <rect x={-hw} y={-hh} width={w} height={h} rx={0.02} />
        <line x1={-hw} y1={0} x2={hw} y2={0} />
      </g>
    );
  }
  // mirror — thin double line
  if (key.startsWith("MIRROR")) {
    return (
      <g className="dwg-sym">
        <line x1={-hw} y1={-0.02} x2={hw} y2={-0.02} />
        <line x1={-hw} y1={0.02} x2={hw} y2={0.02} />
      </g>
    );
  }
  // default — bounding rect with a diagonal (recognisably "to be detailed")
  return (
    <g className="dwg-sym">
      <rect x={-hw} y={-hh} width={w} height={h} />
      <line x1={-hw} y1={-hh} x2={hw} y2={hh} />
    </g>
  );
}
