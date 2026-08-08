import { beforeEach, describe, expect, it } from "vitest";
import {
  activeBuilding,
  buildSiteConfig,
  deriveRooms,
  openingSku,
  useConfigurator,
} from "../src/state/store";
import { defaultWindRegion } from "../src/state/windRegion";
import { moduleCountFor, suggestedOccupancy } from "../src/state/presets";

const initial = useConfigurator.getState();
beforeEach(() => useConfigurator.setState(initial, true));

/** The active building, freshly read after each action. */
const active = () => activeBuilding(useConfigurator.getState());
const siteConfig = () => buildSiteConfig(useConfigurator.getState());

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
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 2);
    expect(active().openings).toHaveLength(1);
    expect(useConfigurator.getState().pendingOpeningPartId).toBeNull();
    expect(useConfigurator.getState().openingError).toBeNull();
  });

  it("rejects an overlapping placement with an error message", () => {
    useConfigurator.getState().setPendingOpening("door-1600-double");
    useConfigurator.getState().placePendingOpening("south", 1);
    useConfigurator.getState().setPendingOpening("window-sliding-1175");
    useConfigurator.getState().placePendingOpening("south", 2); // covered by the double door
    expect(active().openings).toHaveLength(1);
    expect(useConfigurator.getState().openingError).toMatch(/overlap/);
  });

  it("shrinking the wall drops openings that no longer fit", () => {
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 4); // 6m wall, bay 4 ok
    useConfigurator.getState().setDims(3.6, 3); // 3 bays now
    expect(active().openings).toHaveLength(0);
  });

  it("openings land on the ACTIVE building only", () => {
    const firstId = useConfigurator.getState().activeId;
    const secondId = useConfigurator.getState().addBuilding();
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 0);

    const s = useConfigurator.getState();
    expect(s.activeId).toBe(secondId);
    expect(s.buildings.find((b) => b.id === secondId)!.openings).toHaveLength(1);
    expect(s.buildings.find((b) => b.id === firstId)!.openings).toHaveLength(0);
  });
});

describe("rooms / partitions", () => {
  it("addPartition splits the widest zone and keeps meta aligned", () => {
    useConfigurator.getState().addPartition();
    const b = active();
    expect(b.partitionsX).toEqual([3]); // 6m building → split at midpoint
    expect(b.roomMeta).toHaveLength(2);
    const rooms = deriveRooms(b);
    expect(rooms).toHaveLength(2);
    expect(rooms[0]!.areaM2).toBeCloseTo(9, 6);
  });

  it("movePartition clamps to a 0.6m minimum zone width", () => {
    useConfigurator.getState().addPartition();
    useConfigurator.getState().movePartition(0, 0.1);
    expect(active().partitionsX[0]).toBeCloseTo(0.6, 9);
  });
});

describe("buildSiteConfig — one state drives scene AND pricing", () => {
  it("maps openings to Blaise SKUs via the manifest", () => {
    expect(openingSku("door-920-single")).toBe("DOOR-920-SC");
    expect(openingSku("window-toilet-600x300")).toBe("WINDOW-TOILET-600X300");
  });

  it("aggregates opening quantities and includes room electrical with roomId", () => {
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 0);
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("north", 0);

    const fitout = siteConfig().buildings[0]!.fitout;
    expect(fitout.find((f) => f.sku === "DOOR-920-SC")?.qty).toBe(2);
    expect(fitout.find((f) => f.sku === "GPO-DOUBLE")?.roomId).toBe("r1");
  });

  it("derives chassis from use and carries wet fitout + flags", () => {
    useConfigurator.getState().setSetup({ use: "Toilet & Amenities" });
    useConfigurator.getState().setDda(true);
    useConfigurator.getState().setWet({ mfSets: 1, accessibleSets: 1, kitchen: "2100" });

    const b = siteConfig().buildings[0]!;
    expect(b.chassis).toBe("toilet");
    expect(b.flags?.dda).toBe(true);
    const skus = b.fitout.map((f) => f.sku);
    expect(skus).toContain("BATH-ASSY-MF-STD");
    expect(skus).toContain("BATH-ASSY-ACCESSIBLE");
    expect(skus).toContain("KITCHEN-2100");
  });

  it("carries AC overrides through room derivation", () => {
    useConfigurator.getState().updateRoom(0, { acOverrideKw: 7.1 });
    expect(siteConfig().buildings[0]!.rooms[0]!.acOverrideKw).toBe(7.1);
  });

  it("carries site placement onto each priced building", () => {
    useConfigurator.getState().moveBuilding(useConfigurator.getState().activeId, 4.24, 2.17);
    const placement = siteConfig().buildings[0]!.placement!;
    // 0.1m snap grid
    expect(placement.xM).toBeCloseTo(4.2, 9);
    expect(placement.yM).toBeCloseTo(2.2, 9);
  });
});

describe("multi-building site state", () => {
  it("adds buildings clear of existing ones and selects the new one", () => {
    const firstId = useConfigurator.getState().activeId;
    const id = useConfigurator.getState().addBuilding();
    const s = useConfigurator.getState();
    expect(s.buildings).toHaveLength(2);
    expect(s.activeId).toBe(id);
    expect(s.buildings[1]!.placement.xM).toBeGreaterThan(s.buildings[0]!.lengthM);
    expect(firstId).not.toBe(id);
  });

  it("rotation cycles through 90° steps", () => {
    const id = useConfigurator.getState().activeId;
    useConfigurator.getState().rotateBuilding(id);
    expect(active().placement.rotationDeg).toBe(90);
    for (let i = 0; i < 3; i++) useConfigurator.getState().rotateBuilding(id);
    expect(active().placement.rotationDeg).toBe(0);
  });

  it("never removes the last building", () => {
    useConfigurator.getState().removeBuilding(useConfigurator.getState().activeId);
    expect(useConfigurator.getState().buildings).toHaveLength(1);
  });

  it("removing a building drops walkways referencing it", () => {
    const firstId = useConfigurator.getState().activeId;
    const secondId = useConfigurator.getState().addBuilding();
    useConfigurator.getState().startWalkway(firstId);
    useConfigurator.getState().completeWalkway(secondId);
    expect(useConfigurator.getState().walkways).toHaveLength(1);

    useConfigurator.getState().removeBuilding(secondId);
    expect(useConfigurator.getState().walkways).toHaveLength(0);
  });

  it("refuses a duplicate walkway between the same pair", () => {
    const firstId = useConfigurator.getState().activeId;
    const secondId = useConfigurator.getState().addBuilding();
    useConfigurator.getState().startWalkway(firstId);
    useConfigurator.getState().completeWalkway(secondId);
    useConfigurator.getState().startWalkway(secondId);
    useConfigurator.getState().completeWalkway(firstId);

    const s = useConfigurator.getState();
    expect(s.walkways).toHaveLength(1);
    expect(s.siteError).toMatch(/already linked/);
  });

  it("site kit placement snaps to the 0.1m grid", () => {
    useConfigurator.getState().addSiteKit({
      sku: "TANK-5000",
      partId: "tank-5000",
      label: "Water tank 5000L",
      xM: 0,
      zM: 0,
      rotationDeg: 0,
    });
    const id = useConfigurator.getState().siteKit[0]!.id;
    useConfigurator.getState().moveSiteKit(id, 3.17, 1.04);
    const k = useConfigurator.getState().siteKit[0]!;
    expect(k.xM).toBeCloseTo(3.2, 9);
    expect(k.zM).toBeCloseTo(1.0, 9);
  });
});
