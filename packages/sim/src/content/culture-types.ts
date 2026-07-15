import { GOD_HADES, GOD_ISIS, GOD_POSEIDON, GOD_RA, GOD_SET, GOD_ZEUS } from "../ecs/progression";
import {
  TYPE_EGYPTIAN_LABORER,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_VILLAGER,
} from "./unit-type-ids";
import { CULTURE_EGYPTIAN, CULTURE_GREEK, CULTURE_SHARED } from "./unit-type-schema";

export function cultureForMajorGod(majorGod: number): number {
  if (majorGod === GOD_ZEUS || majorGod === GOD_POSEIDON || majorGod === GOD_HADES) {
    return CULTURE_GREEK;
  }
  if (majorGod === GOD_RA || majorGod === GOD_ISIS || majorGod === GOD_SET) {
    return CULTURE_EGYPTIAN;
  }
  return CULTURE_SHARED;
}

export function workerTypeForCulture(culture: number): number {
  if (culture === CULTURE_GREEK) return TYPE_GREEK_VILLAGER;
  if (culture === CULTURE_EGYPTIAN) return TYPE_EGYPTIAN_LABORER;
  throw new RangeError(`Culture ${culture} has no worker type.`);
}

export function townCenterTypeForCulture(culture: number): number {
  if (culture === CULTURE_GREEK) return TYPE_GREEK_TOWN_CENTER;
  if (culture === CULTURE_EGYPTIAN) return TYPE_EGYPTIAN_TOWN_CENTER;
  throw new RangeError(`Culture ${culture} has no Town Center type.`);
}

export function templeTypeForCulture(culture: number): number {
  if (culture === CULTURE_GREEK) return TYPE_GREEK_TEMPLE;
  if (culture === CULTURE_EGYPTIAN) return TYPE_EGYPTIAN_TEMPLE;
  throw new RangeError(`Culture ${culture} has no Temple type.`);
}
