import { TYPE_MANTICORE } from "@aom/sim";
import mythCreateUrl from "../../../assets/audio/units/mythcreate.wav";
import attackUrl from "../../../assets/units/greek/manticore/attack.glb?url";
import deathModelUrl from "../../../assets/units/greek/manticore/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/manticore/death.wav";
import iconUrl from "../../../assets/units/greek/manticore/icon.png";
import idleUrl from "../../../assets/units/greek/manticore/idle.glb?url";
import move1Url from "../../../assets/units/greek/manticore/move1.wav";
import move2Url from "../../../assets/units/greek/manticore/move2.wav";
import select1Url from "../../../assets/units/greek/manticore/select1.wav";
import select2Url from "../../../assets/units/greek/manticore/select2.wav";
import walkUrl from "../../../assets/units/greek/manticore/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 0.8,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_MANTICORE,
  key: "greek-manticore",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekManticoreIdle"]),
      walk: loop(["greekManticoreWalk"]),
      attack: actionCycle(["greekManticoreAttack"]),
      specialAttack: actionCycle(["greekManticoreAttack"]),
      death: once(["greekManticoreDeath"]),
    },
  },
  models: [
    { key: "greekManticoreIdle", url: idleUrl, grounded: true },
    { key: "greekManticoreWalk", url: walkUrl, grounded: true },
    { key: "greekManticoreAttack", url: attackUrl, grounded: true },
    { key: "greekManticoreDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.8, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [mythCreateUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 0.75, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
