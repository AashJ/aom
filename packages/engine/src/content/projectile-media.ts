import { PROJECTILE_ARROW, PROJECTILE_SLING_STONE, PROJECTILE_SPEAR } from "@aom/sim";
import arrowUrl from "../assets/projectiles/arrow.glb?url";
import javelinUrl from "../assets/projectiles/javelin.glb?url";
import slingStoneUrl from "../assets/projectiles/sling-stone.glb?url";
import type { ProjectileMediaDefinition } from "./unit-media-schema";

// Stable projectile presentation identities are shared infrastructure. Unit
// packs select one of these types; they never add renderer-side unit switches.
export const PROJECTILE_MEDIA_DEFINITIONS = [
  {
    type: PROJECTILE_ARROW,
    key: "arrow",
    model: { key: "projectileArrow", url: arrowUrl, grounded: false },
    flightHeight: 1.15,
    arcHeight: 0.7,
    forwardAxis: "negative-z",
  },
  {
    type: PROJECTILE_SPEAR,
    key: "javelin",
    model: { key: "projectileJavelin", url: javelinUrl, grounded: false },
    flightHeight: 1.1,
    arcHeight: 0.55,
    forwardAxis: "positive-y",
  },
  {
    type: PROJECTILE_SLING_STONE,
    key: "sling-stone",
    model: { key: "projectileSlingStone", url: slingStoneUrl, grounded: false },
    flightHeight: 1,
    arcHeight: 0.8,
    forwardAxis: "positive-z",
  },
] as const satisfies readonly ProjectileMediaDefinition[];
