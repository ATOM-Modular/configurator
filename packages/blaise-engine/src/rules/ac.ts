import type { BuildingConfig, EstimateWarning, Room } from "@atom/contracts";

/**
 * AC is sized per room/zone, NEVER off whole floor area (SPEC engine rules).
 * Each split unit adds a condenser bracket.
 *
 * Sizing heuristic (PLACEHOLDER — calibrate with real Blaise rules):
 *   kW = max(2.5, areaM2 × 0.15), snapped up to the nearest available unit.
 */
const AC_SIZES_KW = [2.5, 3.5, 5.0, 7.1] as const;
const KW_PER_M2 = 0.15;

/** Toilet-chassis buildings get no AC by default. */
export function buildingGetsAc(b: BuildingConfig): boolean {
  return b.chassis !== "toilet";
}

export interface AcUnit {
  sku: string;
  roomId: string;
  kw: number;
  overridden: boolean;
}

export function sizeAcForRooms(b: BuildingConfig): {
  units: AcUnit[];
  warnings: EstimateWarning[];
} {
  if (!buildingGetsAc(b)) return { units: [], warnings: [] };

  const floorArea = b.lengthM * b.widthM;
  // No partitions drawn yet → treat the building as one zone.
  const rooms: Room[] =
    b.rooms.length > 0 ? b.rooms : [{ id: `${b.id}-zone-1`, areaM2: floorArea }];

  const units: AcUnit[] = [];
  const warnings: EstimateWarning[] = [];

  for (const room of rooms) {
    const areaM2 = room.areaM2 ?? floorArea / rooms.length;
    const autoKw = Math.max(2.5, areaM2 * KW_PER_M2);
    const targetKw = room.acOverrideKw ?? autoKw;
    const size =
      AC_SIZES_KW.find((s) => s >= targetKw) ?? AC_SIZES_KW[AC_SIZES_KW.length - 1]!;

    if (room.acOverrideKw !== undefined) {
      warnings.push({
        code: "AC_OVERRIDE",
        message: `Room "${room.name ?? room.id}" AC manually set to ${room.acOverrideKw}kW (auto-size: ${autoKw.toFixed(1)}kW)`,
        buildingId: b.id,
      });
    }

    units.push({
      sku: `AC-SPLIT-${size.toFixed(1)}`,
      roomId: room.id,
      kw: size,
      overridden: room.acOverrideKw !== undefined,
    });
  }

  return { units, warnings };
}
