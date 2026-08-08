import { create } from "zustand";
import {
  panelUpgradeMinimums,
  type BuildingUse,
  type SiteConfig,
  type WindRegion,
} from "@atom/contracts";
import {
  assembleWalkway,
  getPart,
  loadManifest,
  tileWallRun,
  type Elevation,
  type WallOpeningSpec,
} from "@atom/assets";
import { walkwayGeometry } from "../site/geometry";
import { DEFAULT_ROOF_COLOUR } from "./presets";
import { defaultWindRegion, type AuState } from "./windRegion";

const manifest = loadManifest();

export interface OpeningInstance {
  id: string;
  elevation: Elevation;
  partId: string;
  startBay: number;
}

export interface RoomMeta {
  name: string;
  gpoQty: number;
  lightQty: number;
  dataQty: number;
  acOverrideKw: number | null;
}

export interface WetState {
  pans: number;
  basins: number;
  showers: number;
  urinals: number;
  partitions: number;
  mfSets: number;
  accessibleSets: number;
  kitchen: null | "1500" | "2100" | "3600";
}

export type RotationDeg = 0 | 90 | 180 | 270;

export interface Placement {
  xM: number;
  zM: number;
  rotationDeg: RotationDeg;
}

/** One building's full configuration + where it sits on the site. */
export interface BuildingState {
  id: string;
  name: string;
  use: BuildingUse;
  lengthM: number;
  widthM: number;
  ffl_mm: number;
  panelType: string;
  /** External wall panel thickness (Blaise "Walls Thickness"). */
  panelMm: number;
  /** Ceiling panel thickness — separate from walls in Blaise. */
  ceilingMm: number;
  colour: string;
  /** Roof / cappings / gutter — specified separately from the walls. */
  roofColour: string;
  gutters: boolean;
  /** Colourbond roof upgrade (Blaise "Colourbond Roof"). */
  colourbondRoof: boolean;
  openings: OpeningInstance[];
  partitionsX: number[];
  roomMeta: RoomMeta[];
  wet: WetState;
  dda: boolean;
  /**
   * Line items that aren't covered by the wet/electrical builders — exhaust
   * fans, laundry tubs, accessible fixtures, waterproofing, extra HWS.
   * Real drawings schedule plenty of these, so the model needs a direct
   * escape hatch rather than a checkbox for every fixture.
   */
  extraFitout: { sku: string; qty: number }[];
  /**
   * Floorplanner-style placed fit-out — each item is a positioned object you
   * move / rotate / delete. Price derives from the count per SKU (Blaise count
   * model); position is real and feeds the 3D. Empty for wizard buildings.
   */
  placedItems: PlacedItem[];
  /** Drawn internal-wall segments (building-local metres). Blaise: Internal Walls Lm. */
  internalWalls: WallSegment[];
  placement: Placement;
}

export interface PlacedItem {
  id: string;
  sku: string;
  xM: number;
  zM: number;
  rotationDeg: number;
}

export interface WallSegment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export function wallLengthM(w: WallSegment): number {
  return Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
}

export interface SiteKitItem {
  id: string;
  /** Blaise SKU (pricing) */
  sku: string;
  /** manifest part (3D) */
  partId: string;
  label: string;
  xM: number;
  zM: number;
  rotationDeg: RotationDeg;
}

export interface WalkwayRun {
  id: string;
  fromBuildingId: string;
  toBuildingId: string;
  elevated: boolean;
}

export type WizardStep = 1 | 2 | 3;
export type SiteMode = "single" | "site";

/** One-page studio: which level you're looking at, and how it's drawn. */
export type StudioScope = "site" | "building";
export type StudioView = "2d" | "3d";

export interface ConfiguratorState {
  step: WizardStep;
  mode: SiteMode;

  // one-page studio view state
  scope: StudioScope;
  view: StudioView;

  // site-level
  auState: AuState;
  postcode: string;
  windRegion: WindRegion;
  windRegionTouched: boolean;

  buildings: BuildingState[];
  activeId: string;
  siteKit: SiteKitItem[];
  walkways: WalkwayRun[];

  /** step-1 use selection, seeds new buildings */
  use: BuildingUse;

  // interaction
  pendingOpeningPartId: string | null;
  openingError: string | null;
  walkwayFromId: string | null;
  siteError: string | null;

  internalToken: string;

  // actions — wizard / site
  setStep: (s: WizardStep) => void;
  setMode: (m: SiteMode) => void;
  setSetup: (p: { auState?: AuState; postcode?: string; use?: BuildingUse }) => void;
  setWindRegion: (w: WindRegion) => void;
  setInternalToken: (token: string) => void;

  // actions — one-page studio
  setScope: (s: StudioScope) => void;
  setView: (v: StudioView) => void;
  /** Drag a chassis from the catalogue onto the site → a blank building. */
  addChassis: (init: {
    lengthM: number;
    widthM: number;
    chassisType: "office" | "toilet";
    xM?: number;
    zM?: number;
  }) => string;
  /** Placed fit-out (Floorplanner-style positioned objects). */
  placeItem: (sku: string, xM: number, zM: number) => string;
  moveItem: (id: string, xM: number, zM: number) => void;
  rotateItem: (id: string, deltaDeg: number) => void;
  removeItem: (id: string) => void;
  /** Drawn internal-wall segments. */
  addWall: (x1: number, z1: number, x2: number, z2: number) => void;
  removeWall: (id: string) => void;

  // actions — buildings
  addBuilding: (init?: Partial<BuildingState>) => string;
  removeBuilding: (id: string) => void;
  selectBuilding: (id: string) => void;
  updateActive: (patch: Partial<BuildingState>) => void;
  moveBuilding: (id: string, xM: number, zM: number) => void;
  rotateBuilding: (id: string) => void;

  // actions — active building detail
  setDims: (lengthM: number, widthM: number) => void;
  setPanel: (p: {
    panelType?: string;
    panelMm?: number;
    ceilingMm?: number;
    colour?: string;
    roofColour?: string;
  }) => void;
  setGutters: (on: boolean) => void;
  setColourbondRoof: (on: boolean) => void;
  setFfl: (mm: number) => void;
  setPendingOpening: (partId: string | null) => void;
  placePendingOpening: (elevation: Elevation, bay: number) => void;
  removeOpening: (id: string) => void;
  addPartition: () => void;
  movePartition: (index: number, xM: number) => void;
  removePartition: (index: number) => void;
  updateRoom: (index: number, patch: Partial<RoomMeta>) => void;
  setWet: (patch: Partial<WetState>) => void;
  setDda: (on: boolean) => void;

  // actions — site kit / walkways
  addSiteKit: (item: Omit<SiteKitItem, "id">) => void;
  moveSiteKit: (id: string, xM: number, zM: number) => void;
  removeSiteKit: (id: string) => void;
  startWalkway: (buildingId: string) => void;
  completeWalkway: (buildingId: string) => void;
  cancelWalkway: () => void;
  toggleWalkwayElevated: (id: string) => void;
  removeWalkway: (id: string) => void;

  /** Replace the whole site (used by the Zinfra acceptance preset). */
  loadSite: (p: {
    buildings: BuildingState[];
    siteKit: Omit<SiteKitItem, "id">[];
    walkways: Omit<WalkwayRun, "id">[];
  }) => void;
}

let idSeq = 0;
const nextId = (p: string) => `${p}${++idSeq}`;

export const SNAP_M = 0.1;
export const snap = (v: number) => Math.round(v / SNAP_M) * SNAP_M;

const defaultRoom = (i: number): RoomMeta => ({
  name: `Zone ${i + 1}`,
  gpoQty: 2,
  lightQty: 2,
  dataQty: 0,
  acOverrideKw: null,
});

const emptyWet = (): WetState => ({
  pans: 0,
  basins: 0,
  showers: 0,
  urinals: 0,
  partitions: 0,
  mfSets: 0,
  accessibleSets: 0,
  kitchen: null,
});

export function makeBuilding(init: Partial<BuildingState> = {}): BuildingState {
  const id = init.id ?? nextId("b");
  return {
    id,
    name: init.name ?? "Building",
    use: init.use ?? "Office",
    lengthM: init.lengthM ?? 6,
    widthM: init.widthM ?? 3,
    ffl_mm: init.ffl_mm ?? 450,
    panelType: init.panelType ?? "EPS-FR",
    panelMm: init.panelMm ?? 50,
    ceilingMm: init.ceilingMm ?? 50,
    colour: init.colour ?? "Surfmist",
    roofColour: init.roofColour ?? DEFAULT_ROOF_COLOUR,
    gutters: init.gutters ?? true,
    colourbondRoof: init.colourbondRoof ?? true,
    openings: init.openings ?? [],
    partitionsX: init.partitionsX ?? [],
    roomMeta: init.roomMeta ?? [defaultRoom(0)],
    wet: init.wet ?? emptyWet(),
    dda: init.dda ?? false,
    extraFitout: init.extraFitout ?? [],
    placedItems: init.placedItems ?? [],
    internalWalls: init.internalWalls ?? [],
    placement: init.placement ?? { xM: 0, zM: 0, rotationDeg: 0 },
  };
}

function openingSpecs(openings: OpeningInstance[]): WallOpeningSpec[] {
  return openings.map((o) => ({
    elevation: o.elevation,
    partId: o.partId,
    startBay: o.startBay,
  }));
}

/** Drop openings that no longer fit after a dimension change. */
function sanitizeOpenings(
  openings: OpeningInstance[],
  lengthM: number,
  widthM: number,
): OpeningInstance[] {
  const keep: OpeningInstance[] = [];
  for (const o of openings) {
    const runM = o.elevation === "south" || o.elevation === "north" ? lengthM : widthM;
    try {
      tileWallRun(
        runM,
        openingSpecs([...keep.filter((k) => k.elevation === o.elevation), o]),
        manifest,
      );
      keep.push(o);
    } catch {
      // silently dropped — the wall shrank underneath it
    }
  }
  return keep;
}

const firstBuilding = makeBuilding({ name: "Building 1" });

export const useConfigurator = create<ConfiguratorState>((set, get) => {
  /** Apply a patch to the active building. */
  const patchActive = (
    fn: (b: BuildingState) => Partial<BuildingState>,
  ): Partial<ConfiguratorState> => {
    const s = get();
    return {
      buildings: s.buildings.map((b) => (b.id === s.activeId ? { ...b, ...fn(b) } : b)),
    };
  };

  return {
    step: 1,
    mode: "single",

    scope: "building",
    view: "3d",

    auState: "VIC",
    postcode: "3438",
    windRegion: "AB",
    windRegionTouched: false,

    buildings: [firstBuilding],
    activeId: firstBuilding.id,
    siteKit: [],
    walkways: [],

    use: "Office",

    pendingOpeningPartId: null,
    openingError: null,
    walkwayFromId: null,
    siteError: null,

    internalToken: "",

    setStep: (step) => set({ step }),
    setMode: (mode) => set({ mode, walkwayFromId: null, siteError: null }),

    setScope: (scope) => set({ scope }),
    setView: (view) => set({ view }),

    addChassis: ({ lengthM, widthM, chassisType, xM, zM }) => {
      const s = get();
      const maxX = s.buildings.reduce((m, b) => Math.max(m, b.placement.xM + b.lengthM), 0);
      // studio buildings start blank — you drag in every fit-out item
      const building = makeBuilding({
        name: `Building ${s.buildings.length + 1}`,
        use: chassisType === "toilet" ? "Toilet & Amenities" : "Office",
        lengthM,
        widthM,
        roomMeta: [{ name: "Zone 1", gpoQty: 0, lightQty: 0, dataQty: 0, acOverrideKw: null }],
        placement: {
          xM: xM !== undefined ? snap(xM) : snap(maxX + 4),
          zM: zM !== undefined ? snap(zM) : 0,
          rotationDeg: 0,
        },
      });
      set({
        buildings: [...s.buildings, building],
        activeId: building.id,
        scope: "building",
      });
      return building.id;
    },

    placeItem: (sku, xM, zM) => {
      const id = nextId("p");
      set(() =>
        patchActive((b) => ({
          placedItems: [...b.placedItems, { id, sku, xM: snap(xM), zM: snap(zM), rotationDeg: 0 }],
        })),
      );
      return id;
    },

    moveItem: (id, xM, zM) =>
      set(() =>
        patchActive((b) => ({
          placedItems: b.placedItems.map((p) =>
            p.id === id ? { ...p, xM: snap(xM), zM: snap(zM) } : p,
          ),
        })),
      ),

    rotateItem: (id, deltaDeg) =>
      set(() =>
        patchActive((b) => ({
          placedItems: b.placedItems.map((p) =>
            p.id === id ? { ...p, rotationDeg: (p.rotationDeg + deltaDeg + 360) % 360 } : p,
          ),
        })),
      ),

    removeItem: (id) =>
      set(() => patchActive((b) => ({ placedItems: b.placedItems.filter((p) => p.id !== id) }))),

    addWall: (x1, z1, x2, z2) =>
      set(() =>
        patchActive((b) => ({
          internalWalls: [
            ...b.internalWalls,
            { id: nextId("w"), x1: snap(x1), z1: snap(z1), x2: snap(x2), z2: snap(z2) },
          ],
        })),
      ),

    removeWall: (id) =>
      set(() => patchActive((b) => ({ internalWalls: b.internalWalls.filter((w) => w.id !== id) }))),

    setSetup: (p) =>
      set((s) => {
        const auState = p.auState ?? s.auState;
        const postcode = p.postcode ?? s.postcode;
        const next: Partial<ConfiguratorState> = { auState, postcode };
        if (p.use) {
          next.use = p.use;
          // step 1 use selection retargets the active building
          next.buildings = s.buildings.map((b) =>
            b.id === s.activeId ? { ...b, use: p.use! } : b,
          );
        }
        if (!s.windRegionTouched) next.windRegion = defaultWindRegion(auState, postcode);
        return next;
      }),

    setWindRegion: (windRegion) =>
      set((s) => {
        // Blaise enforces panel-thickness minimums by region (C/D upgrades).
        const min = panelUpgradeMinimums(windRegion);
        return {
          windRegion,
          windRegionTouched: true,
          buildings: s.buildings.map((b) => ({
            ...b,
            panelMm: Math.max(b.panelMm, min.externalMinMm),
            ceilingMm: Math.max(b.ceilingMm, min.ceilingMinMm),
          })),
        };
      }),
    setInternalToken: (internalToken) => set({ internalToken }),

    addBuilding: (init) => {
      const s = get();
      // place the new building clear of the existing ones
      const maxX = s.buildings.reduce(
        (m, b) => Math.max(m, b.placement.xM + b.lengthM),
        0,
      );
      const building = makeBuilding({
        name: `Building ${s.buildings.length + 1}`,
        use: s.use,
        ...init,
        placement: init?.placement ?? { xM: snap(maxX + 4), zM: 0, rotationDeg: 0 },
      });
      set({ buildings: [...s.buildings, building], activeId: building.id });
      return building.id;
    },

    removeBuilding: (id) =>
      set((s) => {
        if (s.buildings.length <= 1) return {};
        const buildings = s.buildings.filter((b) => b.id !== id);
        return {
          buildings,
          activeId: s.activeId === id ? buildings[0]!.id : s.activeId,
          walkways: s.walkways.filter(
            (w) => w.fromBuildingId !== id && w.toBuildingId !== id,
          ),
        };
      }),

    selectBuilding: (activeId) => set({ activeId }),
    updateActive: (patch) => set(() => patchActive(() => patch)),

    moveBuilding: (id, xM, zM) =>
      set((s) => ({
        buildings: s.buildings.map((b) =>
          b.id === id
            ? { ...b, placement: { ...b.placement, xM: snap(xM), zM: snap(zM) } }
            : b,
        ),
      })),

    rotateBuilding: (id) =>
      set((s) => ({
        buildings: s.buildings.map((b) =>
          b.id === id
            ? {
                ...b,
                placement: {
                  ...b.placement,
                  rotationDeg: (((b.placement.rotationDeg + 90) % 360) as RotationDeg),
                },
              }
            : b,
        ),
      })),

    setDims: (lengthM, widthM) =>
      set(() =>
        patchActive((b) => {
          const L = Math.max(2.4, Math.min(15, lengthM));
          const W = Math.max(2.4, Math.min(9, widthM));
          return {
            lengthM: L,
            widthM: W,
            openings: sanitizeOpenings(b.openings, L, W),
            partitionsX: b.partitionsX.filter((x) => x > 0.6 && x < L - 0.6),
          };
        }),
      ),

    setPanel: (p) => set(() => patchActive(() => p)),
    setGutters: (gutters) => set(() => patchActive(() => ({ gutters }))),
    setColourbondRoof: (colourbondRoof) =>
      set(() => patchActive(() => ({ colourbondRoof }))),
    setFfl: (mm) => set(() => patchActive(() => ({ ffl_mm: Math.max(0, Math.min(1500, mm)) }))),

    setPendingOpening: (pendingOpeningPartId) =>
      set({ pendingOpeningPartId, openingError: null }),

    placePendingOpening: (elevation, bay) => {
      const s = get();
      const partId = s.pendingOpeningPartId;
      if (!partId) return;
      const active = s.buildings.find((b) => b.id === s.activeId)!;
      const candidate: OpeningInstance = { id: nextId("o"), elevation, partId, startBay: bay };
      const runM =
        elevation === "south" || elevation === "north" ? active.lengthM : active.widthM;
      try {
        tileWallRun(
          runM,
          openingSpecs([
            ...active.openings.filter((o) => o.elevation === elevation),
            candidate,
          ]),
          manifest,
        );
        set({
          ...patchActive((b) => ({ openings: [...b.openings, candidate] })),
          pendingOpeningPartId: null,
          openingError: null,
        });
      } catch (e) {
        set({ openingError: e instanceof Error ? e.message : String(e) });
      }
    },

    removeOpening: (id) =>
      set(() => patchActive((b) => ({ openings: b.openings.filter((o) => o.id !== id) }))),

    addPartition: () =>
      set(() =>
        patchActive((b) => {
          const edges = [0, ...b.partitionsX, b.lengthM];
          let widest = 0;
          for (let i = 0; i < edges.length - 1; i++) {
            if (edges[i + 1]! - edges[i]! > edges[widest + 1]! - edges[widest]!) widest = i;
          }
          const x = (edges[widest]! + edges[widest + 1]!) / 2;
          const partitionsX = [...b.partitionsX, x].sort((p, q) => p - q);
          const roomMeta = Array.from(
            { length: partitionsX.length + 1 },
            (_, i) => b.roomMeta[i] ?? defaultRoom(i),
          );
          return { partitionsX, roomMeta };
        }),
      ),

    movePartition: (index, xM) =>
      set(() =>
        patchActive((b) => {
          const lo = (b.partitionsX[index - 1] ?? 0) + 0.6;
          const hi = (b.partitionsX[index + 1] ?? b.lengthM) - 0.6;
          const clamped = Math.max(lo, Math.min(hi, xM));
          return { partitionsX: b.partitionsX.map((x, i) => (i === index ? clamped : x)) };
        }),
      ),

    removePartition: (index) =>
      set(() =>
        patchActive((b) => {
          const partitionsX = b.partitionsX.filter((_, i) => i !== index);
          return { partitionsX, roomMeta: b.roomMeta.slice(0, partitionsX.length + 1) };
        }),
      ),

    updateRoom: (index, patch) =>
      set(() =>
        patchActive((b) => ({
          roomMeta: b.roomMeta.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        })),
      ),

    setWet: (patch) => set(() => patchActive((b) => ({ wet: { ...b.wet, ...patch } }))),
    setDda: (dda) => set(() => patchActive(() => ({ dda }))),

    addSiteKit: (item) =>
      set((s) => ({ siteKit: [...s.siteKit, { ...item, id: nextId("k") }] })),

    moveSiteKit: (id, xM, zM) =>
      set((s) => ({
        siteKit: s.siteKit.map((k) =>
          k.id === id ? { ...k, xM: snap(xM), zM: snap(zM) } : k,
        ),
      })),

    removeSiteKit: (id) => set((s) => ({ siteKit: s.siteKit.filter((k) => k.id !== id) })),

    startWalkway: (buildingId) => set({ walkwayFromId: buildingId, siteError: null }),

    completeWalkway: (buildingId) => {
      const s = get();
      const from = s.walkwayFromId;
      if (!from || from === buildingId) {
        set({ walkwayFromId: null });
        return;
      }
      const exists = s.walkways.some(
        (w) =>
          (w.fromBuildingId === from && w.toBuildingId === buildingId) ||
          (w.fromBuildingId === buildingId && w.toBuildingId === from),
      );
      if (exists) {
        set({ walkwayFromId: null, siteError: "These buildings are already linked." });
        return;
      }
      set({
        walkways: [
          ...s.walkways,
          { id: nextId("w"), fromBuildingId: from, toBuildingId: buildingId, elevated: false },
        ],
        walkwayFromId: null,
        siteError: null,
      });
    },

    cancelWalkway: () => set({ walkwayFromId: null }),

    toggleWalkwayElevated: (id) =>
      set((s) => ({
        walkways: s.walkways.map((w) => (w.id === id ? { ...w, elevated: !w.elevated } : w)),
      })),

    removeWalkway: (id) => set((s) => ({ walkways: s.walkways.filter((w) => w.id !== id) })),

    loadSite: (p) =>
      set({
        buildings: p.buildings,
        activeId: p.buildings[0]!.id,
        siteKit: p.siteKit.map((k) => ({ ...k, id: nextId("k") })),
        walkways: p.walkways.map((w) => ({ ...w, id: nextId("w") })),
        mode: "site",
        step: 3,
        walkwayFromId: null,
        siteError: null,
      }),
  };
});

// ---------------------------------------------------------------------------
// Selectors & derivations (pure — unit-tested)
// ---------------------------------------------------------------------------

export function activeBuilding(s: ConfiguratorState): BuildingState {
  return s.buildings.find((b) => b.id === s.activeId) ?? s.buildings[0]!;
}

export function useActiveBuilding(): BuildingState {
  return useConfigurator(activeBuilding);
}

export interface DerivedRoom {
  id: string;
  name: string;
  x0M: number;
  x1M: number;
  areaM2: number;
  meta: RoomMeta;
}

export function deriveRooms(b: {
  lengthM: number;
  widthM: number;
  partitionsX: number[];
  roomMeta: RoomMeta[];
}): DerivedRoom[] {
  const edges = [0, ...b.partitionsX, b.lengthM];
  const rooms: DerivedRoom[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const meta = b.roomMeta[i] ?? defaultRoom(i);
    rooms.push({
      id: `r${i + 1}`,
      name: meta.name,
      x0M: edges[i]!,
      x1M: edges[i + 1]!,
      areaM2: (edges[i + 1]! - edges[i]!) * b.widthM,
      meta,
    });
  }
  return rooms;
}

/** Opening part → its Blaise SKU, from the manifest (single source of truth). */
export function openingSku(partId: string): string {
  const sku = getPart(manifest, partId).skus[0];
  if (!sku) throw new Error(`part ${partId} has no SKU`);
  return sku;
}

function buildingFitout(b: BuildingState) {
  const rooms = deriveRooms(b);
  const fitout: { sku: string; qty: number; roomId?: string }[] = [];

  const openingCounts = new Map<string, number>();
  for (const o of b.openings) {
    const sku = openingSku(o.partId);
    openingCounts.set(sku, (openingCounts.get(sku) ?? 0) + 1);
  }
  for (const [sku, qty] of openingCounts) fitout.push({ sku, qty });

  for (const room of rooms) {
    if (room.meta.gpoQty > 0)
      fitout.push({ sku: "GPO-DOUBLE", qty: room.meta.gpoQty, roomId: room.id });
    if (room.meta.lightQty > 0)
      fitout.push({ sku: "LIGHT-LED-PANEL", qty: room.meta.lightQty, roomId: room.id });
    if (room.meta.dataQty > 0)
      fitout.push({ sku: "DATA-POINT", qty: room.meta.dataQty, roomId: room.id });
  }

  const w = b.wet;
  if (w.pans > 0) fitout.push({ sku: "BATH-PAN", qty: w.pans });
  if (w.basins > 0) fitout.push({ sku: "BATH-BASIN", qty: w.basins });
  if (w.showers > 0) fitout.push({ sku: "BATH-SHOWER", qty: w.showers });
  if (w.urinals > 0) fitout.push({ sku: "BATH-URINAL", qty: w.urinals });
  if (w.partitions > 0) fitout.push({ sku: "BATH-PARTITION", qty: w.partitions });
  if (w.mfSets > 0) fitout.push({ sku: "BATH-ASSY-MF-STD", qty: w.mfSets });
  if (w.accessibleSets > 0) fitout.push({ sku: "BATH-ASSY-ACCESSIBLE", qty: w.accessibleSets });
  if (w.kitchen) fitout.push({ sku: `KITCHEN-${w.kitchen}`, qty: 1 });

  for (const extra of b.extraFitout) {
    if (extra.qty > 0) fitout.push({ sku: extra.sku, qty: extra.qty });
  }

  // Studio placed fit-out — count per SKU (position is visual; Blaise counts).
  const placedCounts = new Map<string, number>();
  for (const p of b.placedItems) placedCounts.set(p.sku, (placedCounts.get(p.sku) ?? 0) + 1);
  for (const [sku, qty] of placedCounts) fitout.push({ sku, qty });

  // Drawn internal walls → Blaise "Internal Walls Lm" (priced per l.m.).
  const wallLm = b.internalWalls.reduce((sum, w) => sum + wallLengthM(w), 0);
  if (wallLm > 0) fitout.push({ sku: "INTERNAL-WALL-LM", qty: Math.round(wallLm * 100) / 100 });

  return { rooms, fitout };
}

export interface SiteConfigInput {
  windRegion: WindRegion;
  buildings: BuildingState[];
  siteKit: SiteKitItem[];
  walkways: WalkwayRun[];
  mode: SiteMode;
  activeId: string;
}

/**
 * ONE config state drives BOTH the 3D assembly and this pricing request.
 * In single-building mode only the active building is priced; in site mode
 * every building plus walkway bays and placed site kit.
 */
export function buildSiteConfig(s: SiteConfigInput): SiteConfig {
  const buildings =
    s.mode === "single"
      ? s.buildings.filter((b) => b.id === s.activeId)
      : s.buildings;

  const siteKitLines: { sku: string; qty: number }[] = [];

  if (s.mode === "site") {
    // walkways → bay counts (same geometry the 3D scene tiles)
    const counts = new Map<string, number>();
    for (const w of s.walkways) {
      const from = s.buildings.find((b) => b.id === w.fromBuildingId);
      const to = s.buildings.find((b) => b.id === w.toBuildingId);
      if (!from || !to) continue;
      const link = walkwayGeometry(from, to);
      if (!link) continue;
      const bays = assembleWalkway({ gapM: link.gapM }, manifest).bays;
      const sku = w.elevated ? "WALKWAY-BAY-ELEV" : "WALKWAY-BAY-STD";
      counts.set(sku, (counts.get(sku) ?? 0) + bays);
    }
    for (const k of s.siteKit) counts.set(k.sku, (counts.get(k.sku) ?? 0) + 1);
    for (const [sku, qty] of counts) siteKitLines.push({ sku, qty });
  }

  return {
    windRegion: s.windRegion,
    buildings: buildings.map((b) => {
      const { rooms, fitout } = buildingFitout(b);
      return {
        id: b.id,
        use: b.use,
        lengthM: b.lengthM,
        widthM: b.widthM,
        ffl_mm: b.ffl_mm,
        chassis: (b.use === "Toilet & Amenities" ? "toilet" : "office") as "toilet" | "office",
        panels: {
          type: b.panelType,
          wallMm: b.panelMm,
          ceilingMm: b.ceilingMm,
          colour: b.colour,
        },
        rooms: rooms.map((r) => ({
          id: r.id,
          name: r.name,
          areaM2: r.areaM2,
          ...(r.meta.acOverrideKw !== null ? { acOverrideKw: r.meta.acOverrideKw } : {}),
        })),
        fitout,
        flags: { dda: b.dda, gutters: b.gutters, colourbondRoof: b.colourbondRoof },
        placement: {
          xM: b.placement.xM,
          yM: b.placement.zM,
          rotationDeg: b.placement.rotationDeg,
        },
      };
    }),
    siteKit: siteKitLines,
  };
}
