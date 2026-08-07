import { TYPE_KEBENIT } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/kebenit/attack.glb?url";
import createdUrl from "../../../assets/units/egyptian/kebenit/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/kebenit/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/kebenit/death.wav";
import iconUrl from "../../../assets/units/egyptian/kebenit/icon.png";
import idleUrl from "../../../assets/units/egyptian/kebenit/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/kebenit/move1.wav";
import move2Url from "../../../assets/units/egyptian/kebenit/move2.wav";
import move3Url from "../../../assets/units/egyptian/kebenit/move3.wav";
import select1Url from "../../../assets/units/egyptian/kebenit/select1.wav";
import select2Url from "../../../assets/units/egyptian/kebenit/select2.wav";
import select3Url from "../../../assets/units/egyptian/kebenit/select3.wav";
import walkUrl from "../../../assets/units/egyptian/kebenit/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_KEBENIT,
  key: "egyptian-kebenit",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianKebenitIdle"]),
      walk: loop(["egyptianKebenitWalk"]),
      attack: actionCycle(["egyptianKebenitAttack"]),
      death: once(["egyptianKebenitDeath"]),
    },
  },
  models: [
    { key: "egyptianKebenitIdle", url: idleUrl, grounded: true },
    { key: "egyptianKebenitWalk", url: walkUrl, grounded: true },
    { key: "egyptianKebenitAttack", url: attackUrl, grounded: true },
    { key: "egyptianKebenitDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
