/**
 * Real-world constants taken from ATOM "FOR MANUFACTURE" drawings.
 * These replace the earlier assumed values — each is cited to its source.
 *
 * Sources:
 *   [R6x3]  RhinoSite Office 6x3 (PLAN + PANEL) 23.06.26
 *   [CD12x9] Central Darling Shire 12x9 (PLAN) 06.08.26
 *   [ZIN]   Zinfra VIC Craigieburn Footing Details 3, 08.04.26
 */

// --- Panel system -----------------------------------------------------------

/** Standard wall panel bay width. [R6x3 panels #1–#9: all 1200] */
export const PANEL_BAY_M = 1.2;

/** Standard panel thickness (50mm EPS-FR). [R6x3 wall schedule] */
export const PANEL_THICKNESS_M = 0.05;

/**
 * Wall panel height at the eave. Panels are trapezoidal — the roof is a
 * shallow 2° gable, so heights run 2470 (eave) → 2570 (ridge).
 * [R6x3 panels: 2470 / 2510 / 2550 / 2570 stepping to the centre]
 */
export const WALL_HEIGHT_EAVE_M = 2.47;
export const WALL_HEIGHT_RIDGE_M = 2.57;

/** Roof pitch each side of the central ridge. [R6x3 + CD12x9 roof plans: "2° 2°"] */
export const ROOF_PITCH_DEG = 2;

// --- Chassis / floor --------------------------------------------------------

/** Chassis section depth. [R6x3 chassis section: 175] */
export const CHASSIS_DEPTH_M = 0.175;

/**
 * FFL − footing block height, i.e. the chassis + floor build-up a footing
 * sits under. [ZIN: lunchroom 535−292=243; elevated office 765−521=244]
 */
export const BUILDING_FLOOR_BUILDUP_M = 0.243;

/** Same for a Rapta walkway deck. [ZIN: 525−298=227; 755−527=228] */
export const WALKWAY_FLOOR_BUILDUP_M = 0.227;

// --- Transport modules ------------------------------------------------------

/**
 * Transport block width. Buildings are built as 3m-wide blocks; a "12x9"
 * is TWO 12x3 blocks either side of a 3m covered walkway, not one 9m span.
 * [CD12x9 chassis schedule: "Standard Block QTY 2, SIZE 12x3m"]
 */
export const MODULE_WIDTH_M = 3.0;

/** Widths above this need more than one block. */
export const SINGLE_MODULE_MAX_WIDTH_M = 3.4;

// --- Footings ---------------------------------------------------------------

/** Max spacing between footing positions along the length. [CD12x9: 2600 bays] */
export const FOOTING_MAX_SPACING_M = 2.6;

/** Combined end setback used when spacing footings. [ZIN 6x3: 804+804≈1.6] */
export const FOOTING_END_SETBACK_TOTAL_M = 1.6;

/** Surefoot pad size. [CD12x9 + ZIN footing plans: 450×450] */
export const FOOTING_PAD_M = 0.45;

/**
 * Footing positions along the length, then doubled for the two bearer lines.
 *   4.8m → 3 positions → 6 blocks  [ZIN toilet: 604/1800/1800/604]
 *   6.0m → 3 positions → 6 blocks  [ZIN 6x3:   804/2200/2200/804]
 *  12.0m → 5 positions → 10 blocks [CD12x9:    808/2600×4/808]
 */
export function footingPositionsAlongLength(lengthM: number): number {
  const bays = Math.max(
    2,
    Math.ceil((lengthM - FOOTING_END_SETBACK_TOTAL_M) / FOOTING_MAX_SPACING_M),
  );
  return bays + 1;
}

/** Total Surefoot blocks for one 3m-wide block of the given length. */
export function footingCountForBlock(lengthM: number): number {
  return 2 * footingPositionsAlongLength(lengthM);
}

/** Bearer-line insets across the 3m width. [all footing plans: 615 / 1775 / 615] */
export const BEARER_INSET_M = 0.615;

// --- Openings ---------------------------------------------------------------

/**
 * Real door and window types from the drawings. Openings are CUT into a
 * 1200 panel bay rather than replacing it, but one opening still occupies
 * one bay, so the bay-swap model holds visually.
 *   Doors:   1020×2040 [R6x3, CD12x9], 920×2040 [CD12x9]
 *   Windows: 1200×1200 sliding [R6x3], 600×300 sliding [CD12x9]
 */
export const DOOR_SIZES_MM = [
  { key: "1020x2040", widthMm: 1020, heightMm: 2040 },
  { key: "920x2040", widthMm: 920, heightMm: 2040 },
] as const;

export const WINDOW_SIZES_MM = [
  { key: "1200x1200", widthMm: 1200, heightMm: 1200 },
  { key: "600x300", widthMm: 600, heightMm: 300 },
] as const;

// --- Services ---------------------------------------------------------------

/**
 * AC sizing: an 18m² office (6x3) is fitted with a 2.7kW box unit
 * [R6x3 airconditioning schedule: "Box Type AC 2.7kW (RAPTA)"] — exactly
 * 0.15 kW/m², which confirms the sizing coefficient.
 */
export const AC_KW_PER_M2 = 0.15;
export const AC_SIZES_KW = [2.7, 3.5, 5.0, 7.1] as const;
