import { beforeEach, describe, expect, it } from "vitest";
import {
  buildSiteConfig,
  deriveRooms,
  openingSku,
  useConfigurator,
} from "../src/state/store";
import { defaultWindRegion } from "../src/state/windRegion";
import { moduleCountFor, suggestedOccupancy } from "../src/state/presets";

const initial = useConfigurator.getState();
beforeEach(() => useConfigurator.setState(initial, true));

describe("wind region defaults (PLACEHOLDER heuristic)", () => {
  it("defaults to A&B for southern states", () => {
    expect(defaultWindRegion("VIC", "3438")).toBe("AB");
    expect(defaultWindRegion("NSW", "2000")).toBe("AB");
  });
  it("flags cyclonic regions", () => {
    expect(defaultWindRegion("NT", "0800")).toBe("C");
    expect(defaultWindRegion("QLD", "4740")).toBe("C");
    expect(defaultWindRegion("WA", "6760")).toBe("D");
  });
  it("store applies the default until manually overridden", () => {
    useConfigurator.getState().setSetup({ auState: "NT", postcode: "0800" });
    expect(useConfigurator.getState().windRegion).toBe("C");
    useConfigurator.getState().setWindRegion("AB");
    useConfigurator.getState().setSetup({ postcode: "0810" });
    expect(useConfigurator.getState().windRegion).toBe("AB"); // touched → sticky
  });
});

describe("presets", () => {
  it("module count feedback matches assembly rules", () => {
    expect(moduleCountFor(3)).toBe(1);
    expect(moduleCountFor(6)).toBe(2);
  });
  it("occupancy heuristics", () => {
    expect(suggestedOccupancy(18, "Office")).toBe(3);
    expect(suggestedOccupancy(18, "Toilet & Amenities")).toBeNull();
  });
});

describe("openings via the store", () => {
  it("places a valid opening and clears pending state", () => {
    const s = useConfigurator.getState();
    s.setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 2);
    const after = useConfigurator.getState();
    expect(after.openings).toHaveLength(1);
    expect(after.pendingOpeningPartId).toBeNull();
    expect(after.openingError).toBeNull();
  });

  it("rejects an overlapping placement with an error message", () => {
    const s = useConfigurator.getState();
    s.setPendingOpening("door-1600-double");
    useConfigurator.getState().placePendingOpening("south", 1);
    useConfigurator.getState().setPendingOpening("window-sliding-1175");
    useConfigurator.getState().placePendingOpening("south", 2); // covered by the double door
    const after = useConfigurator.getState();
    expect(after.openings).toHaveLength(1);
    expect(after.openingError).toMatch(/overlap/);
  });

  it("shrinking the wall drops openings that no longer fit", () => {
    const s = useConfigurator.getState();
    s.setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 4); // 6m wall, bay 4 ok
    useConfigurator.getState().setDims(3.6, 3); // 3 bays now
    expect(useConfigurator.getState().openings).toHaveLength(0);
  });
});

describe("rooms / partitions", () => {
  it("addPartition splits the widest zone and keeps meta aligned", () => {
    useConfigurator.getState().addPartition();
    const s = useConfigurator.getState();
    expect(s.partitionsX).toEqual([3]); // 6m building → split at midpoint
    expect(s.roomMeta).toHaveLength(2);
    const rooms = deriveRooms(s);
    expect(rooms).toHaveLength(2);
    expect(rooms[0]!.areaM2).toBeCloseTo(9, 6);
  });

  it("movePartition clamps to a 0.6m minimum zone width", () => {
    useConfigurator.getState().addPartition();
    useConfigurator.getState().movePartition(0, 0.1);
    expect(useConfigurator.getState().partitionsX[0]).toBeCloseTo(0.6, 9);
  });
});

describe("buildSiteConfig — one state drives scene AND pricing", () => {
  it("maps openings to Blaise SKUs via the manifest", () => {
    expect(openingSku("door-920-single")).toBe("DOOR-920-SC");
    expect(openingSku("window-toilet-600x300")).toBe("WINDOW-TOILET-600X300");
  });

  it("aggregates opening quantities and includes room electrical with roomId", () => {
    const st = useConfigurator.getState();
    st.setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 0);
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("north", 0);

    const site = buildSiteConfig(useConfigurator.getState());
    const fitout = site.buildings[0]!.fitout;
    expect(fitout.find((f) => f.sku === "DOOR-920-SC")?.qty).toBe(2);
    const gpo = fitout.find((f) => f.sku === "GPO-DOUBLE");
    expect(gpo?.roomId).toBe("r1");
  });

  it("derives chassis from use and carries wet fitout + flags", () => {
    useConfigurator.getState().setSetup({ use: "Toilet & Amenities" });
    useConfigurator.getState().setDda(true);
    useConfigurator.getState().setWet({ mfSets: 1, accessibleSets: 1, kitchen: "2100" });

    const site = buildSiteConfig(useConfigurator.getState());
    const b = site.buildings[0]!;
    expect(b.chassis).toBe("toilet");
    expect(b.flags?.dda).toBe(true);
    const skus = b.fitout.map((f) => f.sku);
    expect(skus).toContain("BATH-ASSY-MF-STD");
    expect(skus).toContain("BATH-ASSY-ACCESSIBLE");
    expect(skus).toContain("KITCHEN-2100");
  });

  it("carries AC overrides through room derivation", () => {
    useConfigurator.getState().updateRoom(0, { acOverrideKw: 7.1 });
    const site = buildSiteConfig(useConfigurator.getState());
    expect(site.buildings[0]!.rooms[0]!.acOverrideKw).toBe(7.1);
  });
});
