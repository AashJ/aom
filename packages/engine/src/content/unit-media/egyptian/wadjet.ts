import { TYPE_WADJET } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/egyptian/wadjet/wadjetacknowledge1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/wadjet/wadjetacknowledge2.wav";
import attackUrl from "../../../assets/units/egyptian/wadjet/attack.glb?url";
import created1Url from "../../../assets/units/egyptian/wadjet/wadjetgrunt1.wav";
import created2Url from "../../../assets/units/egyptian/wadjet/wadjetgrunt2.wav";
import deathUrl from "../../../assets/units/egyptian/wadjet/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/wadjet/wadjetdeath.wav";
import iconUrl from "../../../assets/units/egyptian/wadjet/icon.png";
import idleUrl from "../../../assets/units/egyptian/wadjet/idle.glb?url";
import select1Url from "../../../assets/units/egyptian/wadjet/wadjetselect1.wav";
import select2Url from "../../../assets/units/egyptian/wadjet/wadjetselect2.wav";
import walkUrl from "../../../assets/units/egyptian/wadjet/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [acknowledge1Url, acknowledge2Url],
  volume: 1,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_WADJET,
  key: "egyptian-wadjet",
  presentation: {
    kind: "model",
    worldHeight: 2.6,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianWadjetIdle"]),
      walk: loop(["egyptianWadjetWalk"]),
      attack: actionCycle(["egyptianWadjetAttack"]),
      death: once(["egyptianWadjetDeath"]),
    },
  },
  models: [
    { key: "egyptianWadjetIdle", url: idleUrl, grounded: true },
    { key: "egyptianWadjetWalk", url: walkUrl, grounded: true },
    { key: "egyptianWadjetAttack", url: attackUrl, grounded: true },
    { key: "egyptianWadjetDeath", url: deathUrl, grounded: true },
  ],
  effects: [],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [created1Url, created2Url], volume: 0.8, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
