import { TYPE_LEVIATHAN } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/leviathan/attack.glb?url";
import created1Url from "../../../assets/units/egyptian/leviathan/created1.wav";
import created2Url from "../../../assets/units/egyptian/leviathan/created2.wav";
import deathModelUrl from "../../../assets/units/egyptian/leviathan/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/leviathan/death.wav";
import iconUrl from "../../../assets/units/egyptian/leviathan/icon.png";
import idleUrl from "../../../assets/units/egyptian/leviathan/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/leviathan/move1.wav";
import move2Url from "../../../assets/units/egyptian/leviathan/move2.wav";
import move3Url from "../../../assets/units/egyptian/leviathan/move3.wav";
import select1Url from "../../../assets/units/egyptian/leviathan/select1.wav";
import select2Url from "../../../assets/units/egyptian/leviathan/select2.wav";
import select3Url from "../../../assets/units/egyptian/leviathan/select3.wav";
import walkUrl from "../../../assets/units/egyptian/leviathan/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 1,
  maxVoices: 2,
} as const;

export const definition = {
  type: TYPE_LEVIATHAN,
  key: "egyptian-leviathan",
  presentation: {
    kind: "model",
    worldHeight: 4.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianLeviathanIdle"]),
      walk: loop(["egyptianLeviathanWalk"]),
      attack: actionCycle(["egyptianLeviathanAttack"]),
      death: once(["egyptianLeviathanDeath"]),
    },
  },
  models: [
    { key: "egyptianLeviathanIdle", url: idleUrl, grounded: true },
    { key: "egyptianLeviathanWalk", url: walkUrl, grounded: true },
    { key: "egyptianLeviathanAttack", url: attackUrl, grounded: true },
    { key: "egyptianLeviathanDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [created1Url, created2Url], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
