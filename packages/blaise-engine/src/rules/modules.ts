/**
 * Transport-module geometry rules.
 * Modules are 3m wide; a building wider than 3.4m is split into multiple
 * modules joined with tee-section kits.
 */
export const MODULE_WIDTH_M = 3.0;
export const SINGLE_MODULE_MAX_WIDTH_M = 3.4;

export function moduleCount(widthM: number): number {
  if (widthM <= SINGLE_MODULE_MAX_WIDTH_M) return 1;
  return Math.ceil(widthM / MODULE_WIDTH_M);
}

export function teeJoinCount(widthM: number): number {
  return moduleCount(widthM) - 1;
}

export function perimeterLm(lengthM: number, widthM: number): number {
  return 2 * (lengthM + widthM);
}
