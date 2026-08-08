import type { CatalogueItem } from "./catalogueData";

/**
 * The item currently being dragged. dataTransfer.getData() is unreadable
 * during dragover (only on drop), so we keep the payload here for hit-test
 * feedback and read it on drop.
 */
let dragged: CatalogueItem | null = null;

export function setDragged(item: CatalogueItem | null): void {
  dragged = item;
}
export function getDragged(): CatalogueItem | null {
  return dragged;
}
