import { TYPE_GREEK_TITAN } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/colossus/attack-a.glb?url";
import deathUrl from "../../../assets/units/greek/colossus/death.glb?url";
import iconUrl from "../../../assets/units/greek/colossus/icon.png";
import idleUrl from "../../../assets/units/greek/colossus/idle.glb?url";
import walkUrl from "../../../assets/units/greek/colossus/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

// Development fallback only. The roster lane remains blocked until the licensed
// Titans expansion Cerberus archive replaces this Classic-native giant proxy.
export const definition = {
  type: TYPE_GREEK_TITAN,
  key: "greek-titan",
  presentation: {
    kind: "model",
    worldHeight: 10,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekTitanIdle"]),
      walk: loop(["greekTitanWalk"]),
      attack: actionCycle(["greekTitanAttack"]),
      specialAttack: actionCycle(["greekTitanAttack"]),
      death: once(["greekTitanDeath"]),
    },
  },
  models: [
    { key: "greekTitanIdle", url: idleUrl, grounded: true },
    { key: "greekTitanWalk", url: walkUrl, grounded: true },
    { key: "greekTitanAttack", url: attackAUrl, grounded: true },
    { key: "greekTitanDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {},
} as const satisfies UnitMediaDefinition;
