import { beforeEach, describe, expect, it } from "vitest";
import {
  activeBuilding,
  buildSiteConfig,
  deriveRooms,
  makeBuilding,
  openingSku,
  useConfigurator,
} from "../src/state/store";
import { defaultWindRegion } from "../src/state/windRegion";
import { moduleCountFor, suggestedOccupancy } from "../src/state/presets";
import { loadGroups } from "@atom/assets";
import { price, PricingValidationError } from "@atom/blaise-engine";
import { loadCatalog } from "@atom/catalog";

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

  it("addChassis creates a blank building and drives scope to building", () => {
    const n0 = useConfigurator.getState().buildings.length;
    const id = useConfigurator.getState().addChassis({ lengthM: 4.8, widthM: 3, chassisType: "toilet" });
    const s = useConfigurator.getState();
    expect(s.buildings).toHaveLength(n0 + 1);
    expect(s.activeId).toBe(id);
    expect(s.scope).toBe("building");
    const b = s.buildings.find((x) => x.id === id)!;
    expect(b.lengthM).toBe(4.8);
    // blank fit-out: no default lights/gpo
    expect(b.roomMeta[0]!.lightQty).toBe(0);
    expect(b.roomMeta[0]!.gpoQty).toBe(0);
  });

  it("placed fit-out objects count per SKU into the priced fitout", () => {
    // studio buildings are blank (addChassis) — placed items are the only fit-out
    useConfigurator.getState().addChassis({ lengthM: 6, widthM: 3, chassisType: "office" });
    useConfigurator.getState().placeInstance("fixture-led-panel", 1, 1);
    useConfigurator.getState().placeInstance("fixture-led-panel", 2, 1);
    const gpoId = useConfigurator.getState().placeInstance("fixture-gpo-double", 3, 1);
    expect(active().placedInstances).toHaveLength(3);

    const b = siteConfig().buildings.find((x) => x.id === useConfigurator.getState().activeId)!;
    expect(b.fitout.find((f) => f.sku === "LIGHT-LED-PANEL")?.qty).toBe(2);
    expect(b.fitout.find((f) => f.sku === "GPO-DOUBLE")?.qty).toBe(1);

    // objects move, rotate and delete
    useConfigurator.getState().moveItem(gpoId, 4.24, 1.17);
    const moved = active().placedInstances.find((p) => p.instanceId === gpoId)!;
    expect(moved.xM).toBeCloseTo(4.2, 9); // 0.1m snap
    useConfigurator.getState().setItemRotation(gpoId, 450); // wraps into [0,360)
    expect(active().placedInstances.find((p) => p.instanceId === gpoId)!.rotationDeg).toBe(90);
    useConfigurator.getState().removeItem(gpoId);
    expect(active().placedInstances.some((p) => p.instanceId === gpoId)).toBe(false);
  });

  it("ACCEPTANCE: 6 pans + 6 basins, one per cubicle → 6× each, room-assigned, move-in-room is free", () => {
    // 12×3 toilet block split into 6 × 2m cubicles (rooms r1..r6)
    const block = makeBuilding({
      name: "Ablutions",
      use: "Toilet & Amenities",
      lengthM: 12,
      widthM: 3,
      partitionsX: [2, 4, 6, 8, 10],
    });
    useConfigurator.setState({ buildings: [block], activeId: block.id, mode: "single", scope: "building" });

    const s = () => useConfigurator.getState();
    const rooms = deriveRooms(active());
    expect(rooms).toHaveLength(6);

    // drop one pan + one basin into the centre of each cubicle
    const panIds: string[] = [];
    for (const r of rooms) {
      const cx = (r.x0M + r.x1M) / 2;
      panIds.push(s().placeInstance("fixture-bath-pan", cx, 1.5));
      s().placeInstance("fixture-bath-basin", cx, 2.2);
    }

    // priced lines: 6× each (summed across room-scoped lines)
    const fit = () => siteConfig().buildings[0]!.fitout;
    const qty = (f: { sku: string; qty: number }[], sku: string) =>
      f.filter((l) => l.sku === sku).reduce((n, l) => n + l.qty, 0);
    expect(qty(fit(), "BATH-PAN")).toBe(6);
    expect(qty(fit(), "BATH-BASIN")).toBe(6);

    // each pan is assigned to its own cubicle
    const panRooms = active().placedInstances.filter((p) => p.sku === "BATH-PAN").map((p) => p.roomId);
    expect(panRooms.every(Boolean)).toBe(true);
    expect(new Set(panRooms).size).toBe(6);

    // moving a pan to a new spot in the SAME cubicle must not change the fitout
    const before = fit();
    s().moveItem(panIds[0]!, 1.4, 0.6); // still inside r1 [0,2)
    expect(active().placedInstances.find((p) => p.instanceId === panIds[0])!.roomId).toBe("r1");
    expect(fit()).toEqual(before); // position is never priced
  });

  it("slides an opening along its wall to a new bay (rejects invalid)", () => {
    useConfigurator.getState().addChassis({ lengthM: 6, widthM: 3, chassisType: "office" });
    useConfigurator.getState().setPendingOpening("door-920-single");
    useConfigurator.getState().placePendingOpening("south", 1);
    const openId = active().openings[0]!.id;
    useConfigurator.getState().moveOpeningBay(openId, 3);
    expect(active().openings[0]!.startBay).toBe(3);
    // bay 9 doesn't exist on a 5-bay wall → move rejected, stays at 3
    useConfigurator.getState().moveOpeningBay(openId, 9);
    expect(active().openings[0]!.startBay).toBe(3);
  });

  it("drawn partitions price by l.m. (Blaise Internal Walls Lm)", () => {
    useConfigurator.getState().drawPartition(0, 1.5, 3, 1.5); // 3.0m
    useConfigurator.getState().drawPartition(1.5, 0, 1.5, 2); // 2.0m
    const line = siteConfig().buildings[0]!.fitout.find((f) => f.sku === "INTERNAL-WALL-LM")!;
    expect(line.qty).toBeCloseTo(5.0, 6);
  });

  it("partitions snap to 0/90 on draw and when dragging an endpoint", () => {
    // a diagonal draw becomes horizontal (X delta dominates) → y2 = y1
    const id = useConfigurator.getState().drawPartition(0, 1, 3, 1.4);
    const w = active().placedInstances.find((p) => p.instanceId === id)!;
    expect(w.y2M).toBe(w.yM);
    expect(w.x2M).toBeCloseTo(3, 9);
    // dragging node 2 off-axis snaps back to axis-aligned from node 1
    useConfigurator.getState().moveInstanceNode(id, 2, 1.2, 3.3);
    const w2 = active().placedInstances.find((p) => p.instanceId === id)!;
    expect(w2.x2M).toBe(w2.xM); // Y delta now dominates → vertical
    expect(w2.y2M).toBeCloseTo(3.3, 9);
  });

  it("wind region C/D enforces Blaise panel-thickness minimums", () => {
    useConfigurator.getState().setWindRegion("D");
    expect(active().panelMm).toBeGreaterThanOrEqual(200);
    expect(active().ceilingMm).toBeGreaterThanOrEqual(250);
    // building it out carries the separate ceiling thickness + roof flag
    const b = siteConfig().buildings[0]!;
    expect(b.panels.wallMm).toBeGreaterThanOrEqual(200);
    expect(b.panels.ceilingMm).toBeGreaterThanOrEqual(250);
    expect(b.flags?.colourbondRoof).toBe(true);
  });

  it("wall and ceiling thickness are independent (Blaise separates them)", () => {
    useConfigurator.getState().setPanel({ panelMm: 75, ceilingMm: 125 });
    const b = siteConfig().buildings[0]!;
    expect(b.panels.wallMm).toBe(75);
    expect(b.panels.ceilingMm).toBe(125);
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

describe("assembly groups + partitions — Marsden Park toilet block", () => {
  const catalog = loadCatalog();
  const block = (dda: boolean) => {
    const b = makeBuilding({
      name: "Amenities",
      use: "Toilet & Amenities",
      lengthM: 12,
      widthM: 3,
      partitionsX: [2, 4, 6, 8, 10], // six 2m cubicles
      dda,
    });
    useConfigurator.setState({ buildings: [b], activeId: b.id, mode: "single", scope: "building" });
    return b;
  };

  it("groups offered are DDA-gated (accessible set only with the flag on)", () => {
    const offered = (dda: boolean) =>
      loadGroups().groups.filter((g) => (g.dda ? dda : true)).map((g) => g.id);
    expect(offered(false)).not.toContain("accessible-wc-set");
    expect(offered(true)).toContain("accessible-wc-set");
  });

  it("ACCEPTANCE: 5 cubicles + 1 accessible set + drawn dividers → counts, l.m., price per drop", () => {
    block(true);
    const s = () => useConfigurator.getState();
    const rooms = deriveRooms(active());
    const qty = (sku: string) =>
      siteConfig().buildings[0]!.fitout.filter((f) => f.sku === sku).reduce((n, f) => n + f.qty, 0);
    const total = () => price({ mode: "public", site: siteConfig() }, catalog).total_exGst;

    // one toilet-cubicle group in each of the first five cubicles; price must
    // rise with every drop (position isn't priced, but the new parts are)
    let prev = total();
    rooms.slice(0, 5).forEach((r) => {
      s().dropGroup("toilet-cubicle", r.x0M + 0.2, 0.3);
      const now = total();
      expect(now).toBeGreaterThan(prev);
      prev = now;
    });
    // accessible set into the sixth cubicle
    s().dropGroup("accessible-wc-set", rooms[5]!.x0M + 0.2, 0.3);
    // draw the five dividing partitions (full 3m width each = 15 l.m.)
    for (const x of [2, 4, 6, 8, 10]) s().drawPartition(x, 0, x, 3);

    // fixture counts match the schedule
    expect(qty("BATH-PAN")).toBe(5); // one per toilet cubicle
    expect(qty("BATH-BASIN")).toBe(6); // 5 cubicles + 1 accessible
    expect(qty("BATH-ASSY-ACCESSIBLE")).toBe(1);
    // partition lineal metres: 5×3m drawn + 2.2m from the accessible group
    expect(qty("INTERNAL-WALL-LM")).toBeCloseTo(17.2, 6);

    // DDA on → the accessible fixture prices without error
    expect(() => price({ mode: "public", site: siteConfig() }, catalog)).not.toThrow();
  });

  it("accessible fixtures are rejected by the engine when DDA is off", () => {
    block(false);
    useConfigurator.getState().dropGroup("accessible-wc-set", 1, 1);
    expect(() => price({ mode: "public", site: siteConfig() }, catalog)).toThrow(PricingValidationError);
  });
});
