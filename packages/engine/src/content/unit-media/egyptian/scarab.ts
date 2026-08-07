import { TYPE_SCARAB } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/scarab/attack.glb?url";
import move1Url from "../../../assets/units/egyptian/scarab/scarabacknowledge1.wav";
import move2Url from "../../../assets/units/egyptian/scarab/scarabacknowledge2.wav";
import deathUrl from "../../../assets/units/egyptian/scarab/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/scarab/scarabdeath.wav";
import createdUrl from "../../../assets/units/egyptian/scarab/scarabgrunt1.wav";
import select1Url from "../../../assets/units/egyptian/scarab/scarabselect1.wav";
import select2Url from "../../../assets/units/egyptian/scarab/scarabselect2.wav";
import iconUrl from "../../../assets/units/egyptian/scarab/icon.png";
import idleUrl from "../../../assets/units/egyptian/scarab/idle.glb?url";
import walkUrl from "../../../assets/units/egyptian/scarab/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 0.85,
  maxVoices: 3,
} as const;

export const definition = {
  type: TYPE_SCARAB,
  key: "egyptian-scarab",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianScarabIdle"]),
      walk: loop(["egyptianScarabWalk"]),
      attack: actionCycle(["egyptianScarabAttack"]),
      death: once(["egyptianScarabDeath"]),
    },
  },
  models: [
    { key: "egyptianScarabIdle", url: idleUrl, grounded: true },
    { key: "egyptianScarabWalk", url: walkUrl, grounded: true },
    { key: "egyptianScarabAttack", url: attackUrl, grounded: true },
    { key: "egyptianScarabDeath", url: deathUrl, grounded: true },
  ],
  effects: [],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 3 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 3 },
  },
} as const satisfies UnitMediaDefinition;
