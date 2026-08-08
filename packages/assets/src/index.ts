/**
 * @atom/assets — public entry.
 *
 * Safe to import from the public configurator: geometry metadata, assembly
 * math, and placeholder generators only. NEVER rates.
 */
export * from "./manifest.js";
export * from "./spec-constants.js";
export { loadManifest } from "./manifest-data.js";

export * from "./assembly/types.js";
export {
  tileWallRun,
  getPart,
  WALL_PANEL_ID,
  WALL_CUT_ID,
  type WallRunOpening,
  type WallRunPlacement,
  type WallRunResult,
} from "./assembly/wall.js";
export {
  assembleBuilding,
  buildingModuleCount,
  countByPart,
  MODULE_WIDTH_M,
  SINGLE_MODULE_MAX_WIDTH_M,
  type BuildingAssemblyInput,
} from "./assembly/building.js";
export {
  assembleWalkway,
  type WalkwayRunInput,
  type WalkwayRunResult,
} from "./assembly/walkway.js";

export { createPlaceholderPart } from "./placeholders/generate.js";
