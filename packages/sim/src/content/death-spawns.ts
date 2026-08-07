import { GOD_POSEIDON } from "../ecs/progression";
import { TYPE_MILITIA } from "./unit-type-ids";
import type { DamageDeathSpawn } from "./unit-type-schema";

export function poseidonMilitiaDeathSpawn(count: number): DamageDeathSpawn {
  return {
    trigger: "destroyed-by-damage",
    requiredGod: GOD_POSEIDON,
    unitType: TYPE_MILITIA,
    count,
    liveLimit: 25,
  };
}
