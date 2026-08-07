import { TYPE_SIEGE_TOWER } from "@aom/sim";
import acknowledgeUrl from "../../../assets/units/egyptian/siege-tower/acknowledge.wav";
import deathModelUrl from "../../../assets/units/egyptian/siege-tower/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/siege-tower/death.wav";
import iconUrl from "../../../assets/units/egyptian/siege-tower/icon.png";
import idleUrl from "../../../assets/units/egyptian/siege-tower/idle.glb?url";
import ramUrl from "../../../assets/units/egyptian/siege-tower/ram.glb?url";
import selectUrl from "../../../assets/units/egyptian/siege-tower/select.wav";
import walkUrl from "../../../assets/units/egyptian/siege-tower/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_SIEGE_TOWER,
  key: "egyptian-siege-tower",
  presentation: {
    kind: "model",
    worldHeight: 4.5,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianSiegeTowerIdle"]),
      walk: loop(["egyptianSiegeTowerWalk"]),
      attack: actionCycle(["egyptianSiegeTowerIdle"]),
      secondaryAttack: actionCycle(["egyptianSiegeTowerRam"]),
      death: once(["egyptianSiegeTowerDeath"]),
    },
  },
  models: [
    { key: "egyptianSiegeTowerIdle", url: idleUrl, grounded: true },
    { key: "egyptianSiegeTowerWalk", url: walkUrl, grounded: true },
    { key: "egyptianSiegeTowerRam", url: ramUrl, grounded: true },
    { key: "egyptianSiegeTowerDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selectUrl], volume: 1, maxVoices: 3 },
    acknowledge: { files: [acknowledgeUrl], volume: 0.7, maxVoices: 3 },
    attackAcknowledge: { files: [acknowledgeUrl], volume: 0.7, maxVoices: 3 },
    created: AUDIO_CUES.militaryCreate,
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
