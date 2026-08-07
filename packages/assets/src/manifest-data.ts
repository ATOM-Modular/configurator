import rawManifest from "../manifest.json";
import { parseManifest, type Manifest } from "./manifest.js";

let cached: Manifest | undefined;

/** The validated manifest — single source of truth (config → meshes → SKUs). */
export function loadManifest(): Manifest {
  cached ??= parseManifest(rawManifest);
  return cached;
}
