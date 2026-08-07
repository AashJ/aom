import { TYPE_PENTEKONTER } from "@aom/sim";
import attackUrl from "../../../assets/units/greek/pentekonter/attack.glb?url";
import attackSoundUrl from "../../../assets/units/greek/pentekonter/attack.wav";
import createdUrl from "../../../assets/units/greek/pentekonter/created.wav";
import deathModelUrl from "../../../assets/units/greek/pentekonter/death.glb?url";
import deathUrl from "../../../assets/units/greek/pentekonter/death.wav";
import iconUrl from "../../../assets/units/greek/pentekonter/icon.png";
import idleUrl from "../../../assets/units/greek/pentekonter/idle.glb?url";
import move1Url from "../../../assets/units/greek/pentekonter/move1.wav";
import move2Url from "../../../assets/units/greek/pentekonter/move2.wav";
import move3Url from "../../../assets/units/greek/pentekonter/move3.wav";
import select1Url from "../../../assets/units/greek/pentekonter/select1.wav";
import select2Url from "../../../assets/units/greek/pentekonter/select2.wav";
import select3Url from "../../../assets/units/greek/pentekonter/select3.wav";
import walkUrl from "../../../assets/units/greek/pentekonter/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_PENTEKONTER,
  key: "greek-pentekonter",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekPentekonterIdle"]),
      walk: loop(["greekPentekonterWalk"]),
      attack: actionCycle(["greekPentekonterAttack"]),
      death: once(["greekPentekonterDeath"]),
    },
  },
  models: [
    { key: "greekPentekonterIdle", url: idleUrl, grounded: true },
    { key: "greekPentekonterWalk", url: walkUrl, grounded: true },
    { key: "greekPentekonterAttack", url: attackUrl, grounded: true },
    { key: "greekPentekonterDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    attack: { files: [attackSoundUrl], volume: 1, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
