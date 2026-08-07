import { TYPE_MILITIA } from "@aom/sim";
import attackUrl from "../../../assets/units/greek/militia/attack.glb?url";
import deathUrl from "../../../assets/units/greek/militia/death.glb?url";
import iconUrl from "../../../assets/units/greek/militia/icon.png";
import idleUrl from "../../../assets/units/greek/militia/idle.glb?url";
import walkUrl from "../../../assets/units/greek/militia/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_MILITIA,
  key: "militia",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["militiaIdle"]),
      walk: loop(["militiaWalk"]),
      attack: actionCycle(["militiaAttack"]),
      death: once(["militiaDeath"]),
    },
  },
  models: [
    { key: "militiaIdle", url: idleUrl, grounded: true },
    { key: "militiaWalk", url: walkUrl, grounded: true },
    { key: "militiaAttack", url: attackUrl, grounded: true },
    { key: "militiaDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: AUDIO_CUES.villagerSelect,
    acknowledge: AUDIO_CUES.villagerAcknowledge,
    attackAcknowledge: AUDIO_CUES.villagerAttack,
    created: AUDIO_CUES.militaryCreate,
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
