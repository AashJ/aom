import { TYPE_CATAPULT } from "@aom/sim";
import acknowledgeUrl from "../../../assets/units/egyptian/catapult/acknowledge.wav";
import attackUrl from "../../../assets/units/egyptian/catapult/attack.glb?url";
import deathModelUrl from "../../../assets/units/egyptian/catapult/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/catapult/death.wav";
import iconUrl from "../../../assets/units/egyptian/catapult/icon.png";
import idleUrl from "../../../assets/units/egyptian/catapult/idle.glb?url";
import selectUrl from "../../../assets/units/egyptian/catapult/select.wav";
import walkUrl from "../../../assets/units/egyptian/catapult/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_CATAPULT,
  key: "egyptian-catapult",
  presentation: {
    kind: "model",
    worldHeight: 1.9,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianCatapultIdle"]),
      walk: loop(["egyptianCatapultWalk"]),
      attack: actionCycle(["egyptianCatapultAttack"]),
      death: once(["egyptianCatapultDeath"]),
    },
  },
  models: [
    { key: "egyptianCatapultIdle", url: idleUrl, grounded: true },
    { key: "egyptianCatapultWalk", url: walkUrl, grounded: true },
    { key: "egyptianCatapultAttack", url: attackUrl, grounded: true },
    { key: "egyptianCatapultDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selectUrl], volume: 1, maxVoices: 1 },
    acknowledge: { files: [acknowledgeUrl], volume: 1, maxVoices: 1 },
    attackAcknowledge: { files: [acknowledgeUrl], volume: 1, maxVoices: 1 },
    created: AUDIO_CUES.militaryCreate,
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
