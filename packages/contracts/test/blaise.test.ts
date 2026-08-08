import { describe, expect, it } from "vitest";
import {
  BLAISE_COMPONENT_CATEGORIES,
  CHASSIS_SIZES,
  COLOURBOND_COLOURS,
  panelUpgradeMinimums,
} from "@atom/contracts";

describe("Blaise vocabulary", () => {
  it("carries the 22 Colourbond colours (GP margin stays server-side)", () => {
    expect(COLOURBOND_COLOURS).toHaveLength(22);
    expect(COLOURBOND_COLOURS).toContain("Surfmist");
    expect(COLOURBOND_COLOURS).toContain("Monument");
  });

  it("parses the 10 standard chassis sizes", () => {
    expect(CHASSIS_SIZES).toHaveLength(10);
    const six = CHASSIS_SIZES.find((c) => c.key === "6x3")!;
    expect(six).toMatchObject({ lengthM: 6, widthM: 3 });
    const wide = CHASSIS_SIZES.find((c) => c.key === "9.6x3.4")!;
    expect(wide).toMatchObject({ lengthM: 9.6, widthM: 3.4 });
  });

  it("has the 35 priced component categories", () => {
    expect(BLAISE_COMPONENT_CATEGORIES).toHaveLength(35);
    expect(BLAISE_COMPONENT_CATEGORIES).toContain("Gutter + Downpipe");
    expect(BLAISE_COMPONENT_CATEGORIES).toContain("Hot Water System");
  });

  it("region panel-upgrade minimums match Blaise (C→100, D→200/250)", () => {
    expect(panelUpgradeMinimums("AB")).toEqual({ externalMinMm: 50, ceilingMinMm: 50 });
    expect(panelUpgradeMinimums("C")).toEqual({ externalMinMm: 100, ceilingMinMm: 100 });
    expect(panelUpgradeMinimums("D")).toEqual({ externalMinMm: 200, ceilingMinMm: 250 });
  });
});
