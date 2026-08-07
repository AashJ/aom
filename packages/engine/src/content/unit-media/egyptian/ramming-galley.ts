import { TYPE_RAMMING_GALLEY } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/ramming-galley/attack.glb?url";
import attackSoundUrl from "../../../assets/units/egyptian/ramming-galley/attack.wav";
import createdUrl from "../../../assets/units/egyptian/ramming-galley/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/ramming-galley/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/ramming-galley/death.wav";
import iconUrl from "../../../assets/units/egyptian/ramming-galley/icon.png";
import idleUrl from "../../../assets/units/egyptian/ramming-galley/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/ramming-galley/move1.wav";
import move2Url from "../../../assets/units/egyptian/ramming-galley/move2.wav";
import move3Url from "../../../assets/units/egyptian/ramming-galley/move3.wav";
import select1Url from "../../../assets/units/egyptian/ramming-galley/select1.wav";
import select2Url from "../../../assets/units/egyptian/ramming-galley/select2.wav";
import select3Url from "../../../assets/units/egyptian/ramming-galley/select3.wav";
import walkUrl from "../../../assets/units/egyptian/ramming-galley/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_RAMMING_GALLEY,
  key: "egyptian-ramming-galley",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianRammingGalleyIdle"]),
      walk: loop(["egyptianRammingGalleyWalk"]),
      attack: actionCycle(["egyptianRammingGalleyAttack"]),
      death: once(["egyptianRammingGalleyDeath"]),
    },
  },
  models: [
    { key: "egyptianRammingGalleyIdle", url: idleUrl, grounded: true },
    { key: "egyptianRammingGalleyWalk", url: walkUrl, grounded: true },
    { key: "egyptianRammingGalleyAttack", url: attackUrl, grounded: true },
    { key: "egyptianRammingGalleyDeath", url: deathModelUrl, grounded: true },
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
