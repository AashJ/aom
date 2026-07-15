import type { UnitTypeStats } from "../content/unit-type-schema";
import { UNIT_TYPES } from "./types";

function maximumBodyRadius(
  unitTypes: readonly (UnitTypeStats | undefined)[],
  projectileBodiesOnly: boolean,
): number {
  let maximum = 0;
  for (let type = 0; type < unitTypes.length; type += 1) {
    const stats = unitTypes[type];
    if (stats && (!projectileBodiesOnly || stats.collidesWithProjectiles)) {
      maximum = Math.max(maximum, stats.bodyRadius);
    }
  }
  return maximum;
}

export function maximumUnitBodyRadius(unitTypes: readonly (UnitTypeStats | undefined)[]): number {
  return maximumBodyRadius(unitTypes, false);
}

export function maximumProjectileBodyRadius(
  unitTypes: readonly (UnitTypeStats | undefined)[],
): number {
  return maximumBodyRadius(unitTypes, true);
}

// Static catalog metadata: compute once, never in a per-tick system.
export const MAX_TARGET_BODY_RADIUS = maximumUnitBodyRadius(UNIT_TYPES);
export const MAX_PROJECTILE_BODY_RADIUS = maximumProjectileBodyRadius(UNIT_TYPES);
