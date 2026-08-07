import { TYPE_PHOENIX } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/phoenix/attack.glb?url";
import attackOrder1Url from "../../../assets/units/egyptian/phoenix/attack-order1.wav";
import attackOrder2Url from "../../../assets/units/egyptian/phoenix/attack-order2.wav";
import createdUrl from "../../../assets/units/egyptian/phoenix/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/phoenix/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/phoenix/death.wav";
import flame1Url from "../../../assets/units/egyptian/phoenix/flame1.wav";
import flame2Url from "../../../assets/units/egyptian/phoenix/flame2.wav";
import iconUrl from "../../../assets/units/egyptian/phoenix/icon.png";
import idleUrl from "../../../assets/units/egyptian/phoenix/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/phoenix/move1.wav";
import move2Url from "../../../assets/units/egyptian/phoenix/move2.wav";
import select1Url from "../../../assets/units/egyptian/phoenix/select1.wav";
import select2Url from "../../../assets/units/egyptian/phoenix/select2.wav";
import walkUrl from "../../../assets/units/egyptian/phoenix/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_PHOENIX,
  key: "egyptian-phoenix",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianPhoenixIdle"]),
      walk: loop(["egyptianPhoenixWalk"]),
      attack: actionCycle(["egyptianPhoenixAttack"]),
      death: once(["egyptianPhoenixDeath"]),
    },
  },
  models: [
    { key: "egyptianPhoenixIdle", url: idleUrl, grounded: false },
    { key: "egyptianPhoenixWalk", url: walkUrl, grounded: false },
    { key: "egyptianPhoenixAttack", url: attackUrl, grounded: false },
    { key: "egyptianPhoenixDeath", url: deathModelUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 2 },
    acknowledge: { files: [move1Url, move2Url], volume: 1, maxVoices: 2 },
    attackAcknowledge: {
      files: [attackOrder1Url, attackOrder2Url],
      volume: 1,
      maxVoices: 2,
    },
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
    attack: {
      files: [flame1Url, flame2Url],
      volume: 1,
      maxVoices: 3,
      delaySeconds: 0.59 * 2.7,
    },
  },
} as const satisfies UnitMediaDefinition;
