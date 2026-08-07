import { TYPE_WAR_BARGE } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/war-barge/attack.glb?url";
import attackSoundUrl from "../../../assets/units/egyptian/war-barge/attack.wav";
import createdUrl from "../../../assets/units/egyptian/war-barge/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/war-barge/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/war-barge/death.wav";
import iconUrl from "../../../assets/units/egyptian/war-barge/icon.png";
import idleUrl from "../../../assets/units/egyptian/war-barge/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/war-barge/move1.wav";
import move2Url from "../../../assets/units/egyptian/war-barge/move2.wav";
import move3Url from "../../../assets/units/egyptian/war-barge/move3.wav";
import select1Url from "../../../assets/units/egyptian/war-barge/select1.wav";
import select2Url from "../../../assets/units/egyptian/war-barge/select2.wav";
import select3Url from "../../../assets/units/egyptian/war-barge/select3.wav";
import walkUrl from "../../../assets/units/egyptian/war-barge/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_WAR_BARGE,
  key: "egyptian-war-barge",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianWarBargeIdle"]),
      walk: loop(["egyptianWarBargeWalk"]),
      attack: actionCycle(["egyptianWarBargeAttack"]),
      death: once(["egyptianWarBargeDeath"]),
    },
  },
  models: [
    { key: "egyptianWarBargeIdle", url: idleUrl, grounded: true },
    { key: "egyptianWarBargeWalk", url: walkUrl, grounded: true },
    { key: "egyptianWarBargeAttack", url: attackUrl, grounded: true },
    { key: "egyptianWarBargeDeath", url: deathModelUrl, grounded: true },
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
