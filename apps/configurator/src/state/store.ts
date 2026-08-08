import { create } from "zustand";
import type { BuildingUse, SiteConfig, WindRegion } from "@atom/contracts";
import {
  getPart,
  loadManifest,
  tileWallRun,
  type Elevation,
  type WallOpeningSpec,
} from "@atom/assets";
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

export type WizardStep = 1 | 2 | 3;

export interface ConfiguratorState {
  step: WizardStep;

  // step 1
  auState: AuState;
  postcode: string;
  use: BuildingUse;
  windRegion: WindRegion;
  windRegionTouched: boolean;

  // step 2/3 — structure
  lengthM: number;
  widthM: number;
  panelType: string;
  panelMm: number;
  colour: string;
  gutters: boolean;
  ffl_mm: number;

  // openings
  openings: OpeningInstance[];
  pendingOpeningPartId: string | null;
  openingError: string | null;

  // interior
  partitionsX: number[];
  roomMeta: RoomMeta[];

  // wet areas
  wet: WetState;
  dda: boolean;

  // pricing
  internalToken: string;

  // actions
  setStep: (s: WizardStep) => void;
  setSetup: (p: { auState?: AuState; postcode?: string; use?: BuildingUse }) => void;
  setWindRegion: (w: WindRegion) => void;
  setDims: (lengthM: number, widthM: number) => void;
  setPanel: (p: { panelType?: string; panelMm?: number; colour?: string }) => void;
  setGutters: (on: boolean) => void;
  setPendingOpening: (partId: string | null) => void;
  placePendingOpening: (elevation: Elevation, bay: number) => void;
  removeOpening: (id: string) => void;
  addPartition: () => void;
  movePartition: (index: number, xM: number) => void;
  removePartition: (index: number) => void;
  updateRoom: (index: number, patch: Partial<RoomMeta>) => void;
  setWet: (patch: Partial<WetState>) => void;
  setDda: (on: boolean) => void;
  setInternalToken: (token: string) => void;
}

let idSeq = 0;
const nextId = () => `o${++idSeq}`;

const defaultRoom = (i: number): RoomMeta => ({
  name: `Zone ${i + 1}`,
  gpoQty: 2,
  lightQty: 2,
  dataQty: 0,
  acOverrideKw: null,
});

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
      tileWallRun(runM, openingSpecs([...keep.filter((k) => k.elevation === o.elevation), o]), manifest);
      keep.push(o);
    } catch {
      // silently dropped — wall shrank underneath it
    }
  }
  return keep;
}

export const useConfigurator = create<ConfiguratorState>((set, get) => ({
  step: 1,
  auState: "VIC",
  postcode: "3438",
  use: "Office",
  windRegion: "AB",
  windRegionTouched: false,

  lengthM: 6,
  widthM: 3,
  panelType: "EPS-FR",
  panelMm: 50,
  colour: "Surfmist",
  gutters: true,
  ffl_mm: 450,

  openings: [],
  pendingOpeningPartId: null,
  openingError: null,

  partitionsX: [],
  roomMeta: [defaultRoom(0)],

  wet: {
    pans: 0,
    basins: 0,
    showers: 0,
    urinals: 0,
    partitions: 0,
    mfSets: 0,
    accessibleSets: 0,
    kitchen: null,
  },
  dda: false,

  internalToken: "",

  setStep: (step) => set({ step }),

  setSetup: (p) =>
    set((s) => {
      const auState = p.auState ?? s.auState;
      const postcode = p.postcode ?? s.postcode;
      const next: Partial<ConfiguratorState> = { auState, postcode, ...(p.use ? { use: p.use } : {}) };
      if (!s.windRegionTouched) next.windRegion = defaultWindRegion(auState, postcode);
      return next;
    }),

  setWindRegion: (windRegion) => set({ windRegion, windRegionTouched: true }),

  setDims: (lengthM, widthM) =>
    set((s) => {
      const L = Math.max(2.4, Math.min(15, lengthM));
      const W = Math.max(2.4, Math.min(9, widthM));
      return {
        lengthM: L,
        widthM: W,
        openings: sanitizeOpenings(s.openings, L, W),
        partitionsX: s.partitionsX.filter((x) => x > 0.6 && x < L - 0.6),
        roomMeta: s.roomMeta, // re-derived length handled in updateRoomCount below
      };
    }),

  setPanel: (p) => set(p),
  setGutters: (gutters) => set({ gutters }),

  setPendingOpening: (pendingOpeningPartId) =>
    set({ pendingOpeningPartId, openingError: null }),

  placePendingOpening: (elevation, bay) => {
    const s = get();
    const partId = s.pendingOpeningPartId;
    if (!partId) return;
    const candidate: OpeningInstance = { id: nextId(), elevation, partId, startBay: bay };
    const runM = elevation === "south" || elevation === "north" ? s.lengthM : s.widthM;
    try {
      tileWallRun(
        runM,
        openingSpecs([...s.openings.filter((o) => o.elevation === elevation), candidate]),
        manifest,
      );
      set({
        openings: [...s.openings, candidate],
        pendingOpeningPartId: null,
        openingError: null,
      });
    } catch (e) {
      set({ openingError: e instanceof Error ? e.message : String(e) });
    }
  },

  removeOpening: (id) => set((s) => ({ openings: s.openings.filter((o) => o.id !== id) })),

  addPartition: () =>
    set((s) => {
      // split the widest zone at its midpoint
      const edges = [0, ...s.partitionsX, s.lengthM];
      let widest = 0;
      for (let i = 0; i < edges.length - 1; i++) {
        if (edges[i + 1]! - edges[i]! > edges[widest + 1]! - edges[widest]!) widest = i;
      }
      const x = (edges[widest]! + edges[widest + 1]!) / 2;
      const partitionsX = [...s.partitionsX, x].sort((a, b) => a - b);
      const roomMeta = Array.from({ length: partitionsX.length + 1 }, (_, i) => s.roomMeta[i] ?? defaultRoom(i));
      return { partitionsX, roomMeta };
    }),

  movePartition: (index, xM) =>
    set((s) => {
      const lo = (s.partitionsX[index - 1] ?? 0) + 0.6;
      const hi = (s.partitionsX[index + 1] ?? s.lengthM) - 0.6;
      const clamped = Math.max(lo, Math.min(hi, xM));
      const partitionsX = s.partitionsX.map((x, i) => (i === index ? clamped : x));
      return { partitionsX };
    }),

  removePartition: (index) =>
    set((s) => {
      const partitionsX = s.partitionsX.filter((_, i) => i !== index);
      const roomMeta = s.roomMeta.slice(0, partitionsX.length + 1);
      return { partitionsX, roomMeta };
    }),

  updateRoom: (index, patch) =>
    set((s) => ({
      roomMeta: s.roomMeta.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    })),

  setWet: (patch) => set((s) => ({ wet: { ...s.wet, ...patch } })),
  setDda: (dda) => set({ dda }),
  setInternalToken: (internalToken) => set({ internalToken }),
}));

// ---------------------------------------------------------------------------
// Derivations (pure — unit-tested)
// ---------------------------------------------------------------------------

export interface DerivedRoom {
  id: string;
  name: string;
  x0M: number;
  x1M: number;
  areaM2: number;
  meta: RoomMeta;
}

export function deriveRooms(s: {
  lengthM: number;
  widthM: number;
  partitionsX: number[];
  roomMeta: RoomMeta[];
}): DerivedRoom[] {
  const edges = [0, ...s.partitionsX, s.lengthM];
  const rooms: DerivedRoom[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const meta = s.roomMeta[i] ?? defaultRoom(i);
    rooms.push({
      id: `r${i + 1}`,
      name: meta.name,
      x0M: edges[i]!,
      x1M: edges[i + 1]!,
      areaM2: (edges[i + 1]! - edges[i]!) * s.widthM,
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

type ConfigSlice = Pick<
  ConfiguratorState,
  | "use"
  | "windRegion"
  | "lengthM"
  | "widthM"
  | "ffl_mm"
  | "panelType"
  | "panelMm"
  | "colour"
  | "gutters"
  | "openings"
  | "partitionsX"
  | "roomMeta"
  | "wet"
  | "dda"
>;

/** ONE config state drives BOTH the 3D assembly and this pricing request. */
export function buildSiteConfig(s: ConfigSlice): SiteConfig {
  const rooms = deriveRooms(s);

  const fitout: { sku: string; qty: number; roomId?: string }[] = [];

  // openings → SKUs (aggregated)
  const openingCounts = new Map<string, number>();
  for (const o of s.openings) {
    const sku = openingSku(o.partId);
    openingCounts.set(sku, (openingCounts.get(sku) ?? 0) + 1);
  }
  for (const [sku, qty] of openingCounts) fitout.push({ sku, qty });

  // per-room electrical
  for (const room of rooms) {
    if (room.meta.gpoQty > 0) fitout.push({ sku: "GPO-DOUBLE", qty: room.meta.gpoQty, roomId: room.id });
    if (room.meta.lightQty > 0) fitout.push({ sku: "LIGHT-LED-PANEL", qty: room.meta.lightQty, roomId: room.id });
    if (room.meta.dataQty > 0) fitout.push({ sku: "DATA-POINT", qty: room.meta.dataQty, roomId: room.id });
  }

  // wet areas
  const w = s.wet;
  if (w.pans > 0) fitout.push({ sku: "BATH-PAN", qty: w.pans });
  if (w.basins > 0) fitout.push({ sku: "BATH-BASIN", qty: w.basins });
  if (w.showers > 0) fitout.push({ sku: "BATH-SHOWER", qty: w.showers });
  if (w.urinals > 0) fitout.push({ sku: "BATH-URINAL", qty: w.urinals });
  if (w.partitions > 0) fitout.push({ sku: "BATH-PARTITION", qty: w.partitions });
  if (w.mfSets > 0) fitout.push({ sku: "BATH-ASSY-MF-STD", qty: w.mfSets });
  if (w.accessibleSets > 0) fitout.push({ sku: "BATH-ASSY-ACCESSIBLE", qty: w.accessibleSets });
  if (w.kitchen) fitout.push({ sku: `KITCHEN-${w.kitchen}`, qty: 1 });

  return {
    windRegion: s.windRegion,
    buildings: [
      {
        id: "building-1",
        use: s.use,
        lengthM: s.lengthM,
        widthM: s.widthM,
        ffl_mm: s.ffl_mm,
        chassis: s.use === "Toilet & Amenities" ? "toilet" : "office",
        panels: {
          type: s.panelType,
          wallMm: s.panelMm,
          ceilingMm: s.panelMm,
          colour: s.colour,
        },
        rooms: rooms.map((r) => ({
          id: r.id,
          name: r.name,
          areaM2: r.areaM2,
          ...(r.meta.acOverrideKw !== null ? { acOverrideKw: r.meta.acOverrideKw } : {}),
        })),
        fitout,
        flags: { dda: s.dda, gutters: s.gutters },
      },
    ],
    siteKit: [],
  };
}
