import { TYPE_PETROBOLOS } from "@aom/sim";
import acknowledgeUrl from "../../../assets/units/greek/petrobolos/acknowledge.wav";
import attackUrl from "../../../assets/units/greek/petrobolos/attack.glb?url";
import deathModelUrl from "../../../assets/units/greek/petrobolos/death.glb?url";
import deathUrl from "../../../assets/units/greek/petrobolos/death.wav";
import iconUrl from "../../../assets/units/greek/petrobolos/icon.png";
import idleUrl from "../../../assets/units/greek/petrobolos/idle.glb?url";
import selectUrl from "../../../assets/units/greek/petrobolos/select.wav";
import walkUrl from "../../../assets/units/greek/petrobolos/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_PETROBOLOS,
  key: "greek-petrobolos",
  presentation: {
    kind: "model",
    worldHeight: 1.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekPetrobolosIdle"]),
      walk: loop(["greekPetrobolosWalk"]),
      attack: actionCycle(["greekPetrobolosAttack"]),
      death: once(["greekPetrobolosDeath"]),
    },
  },
  models: [
    { key: "greekPetrobolosIdle", url: idleUrl, grounded: true },
    { key: "greekPetrobolosWalk", url: walkUrl, grounded: true },
    { key: "greekPetrobolosAttack", url: attackUrl, grounded: true },
    { key: "greekPetrobolosDeath", url: deathModelUrl, grounded: true },
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
