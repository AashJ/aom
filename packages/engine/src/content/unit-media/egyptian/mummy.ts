import { TYPE_MUMMY } from "@aom/sim";
import attackAUrl from "../../../assets/units/egyptian/mummy/attack-a.glb?url";
import attackBUrl from "../../../assets/units/egyptian/mummy/attack-b.glb?url";
import createdUrl from "../../../assets/units/egyptian/mummy/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/mummy/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/mummy/death.wav";
import iconUrl from "../../../assets/units/egyptian/mummy/icon.png";
import idleUrl from "../../../assets/units/egyptian/mummy/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/mummy/move1.wav";
import move2Url from "../../../assets/units/egyptian/mummy/move2.wav";
import select1Url from "../../../assets/units/egyptian/mummy/select1.wav";
import select2Url from "../../../assets/units/egyptian/mummy/select2.wav";
import specialUrl from "../../../assets/units/egyptian/mummy/special.glb?url";
import specialVoiceUrl from "../../../assets/units/egyptian/mummy/special.wav";
import walkUrl from "../../../assets/units/egyptian/mummy/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url], volume: 0.75, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_MUMMY,
  key: "egyptian-mummy",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianMummyIdle"]),
      walk: loop(["egyptianMummyWalk"]),
      attack: actionCycle(["egyptianMummyAttackA", "egyptianMummyAttackB"]),
      specialAttack: actionCycle(["egyptianMummySpecial"]),
      death: once(["egyptianMummyDeath"]),
    },
  },
  models: [
    { key: "egyptianMummyIdle", url: idleUrl, grounded: true },
    { key: "egyptianMummyWalk", url: walkUrl, grounded: true },
    { key: "egyptianMummyAttackA", url: attackAUrl, grounded: true },
    { key: "egyptianMummyAttackB", url: attackBUrl, grounded: true },
    { key: "egyptianMummySpecial", url: specialUrl, grounded: true },
    { key: "egyptianMummyDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.75, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathUrl], volume: 0.75, maxVoices: 1 },
    specialAttack: { files: [specialVoiceUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
