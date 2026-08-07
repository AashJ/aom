import { TYPE_EGYPTIAN_TITAN } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/avenger/attack-a.glb?url";
import deathUrl from "../../../assets/units/egyptian/avenger/death.glb?url";
import iconUrl from "../../../assets/units/egyptian/avenger/icon.png";
import idleUrl from "../../../assets/units/egyptian/avenger/idle.glb?url";
import walkUrl from "../../../assets/units/egyptian/avenger/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

// Development fallback only. The roster lane remains blocked until the licensed
// Titans expansion Horus archive replaces this Classic-native Egyptian proxy.
export const definition = {
  type: TYPE_EGYPTIAN_TITAN,
  key: "egyptian-titan",
  presentation: {
    kind: "model",
    worldHeight: 10,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianTitanIdle"]),
      walk: loop(["egyptianTitanWalk"]),
      attack: actionCycle(["egyptianTitanAttack"]),
      specialAttack: actionCycle(["egyptianTitanAttack"]),
      death: once(["egyptianTitanDeath"]),
    },
  },
  models: [
    { key: "egyptianTitanIdle", url: idleUrl, grounded: true },
    { key: "egyptianTitanWalk", url: walkUrl, grounded: true },
    { key: "egyptianTitanAttack", url: attackUrl, grounded: true },
    { key: "egyptianTitanDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {},
} as const satisfies UnitMediaDefinition;
