import { TYPE_SON_OF_OSIRIS } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/son-of-osiris/attack.glb?url";
import carryIdleUrl from "../../../assets/units/egyptian/son-of-osiris/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/egyptian/son-of-osiris/carry-walk.glb?url";
import deathModelUrl from "../../../assets/units/egyptian/son-of-osiris/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/son-of-osiris/soopdeath.wav";
import empowerUrl from "../../../assets/units/egyptian/son-of-osiris/empower.glb?url";
import iconUrl from "../../../assets/units/egyptian/son-of-osiris/icon.png";
import idleUrl from "../../../assets/units/egyptian/son-of-osiris/idle.glb?url";
import lightningUrl from "../../../assets/units/egyptian/son-of-osiris/lightning.png";
import move1Url from "../../../assets/units/egyptian/son-of-osiris/soopmove1.wav";
import move2Url from "../../../assets/units/egyptian/son-of-osiris/soopmove2.wav";
import move3Url from "../../../assets/units/egyptian/son-of-osiris/soopmove3.wav";
import move4Url from "../../../assets/units/egyptian/son-of-osiris/soopmove4.wav";
import attackVoiceUrl from "../../../assets/units/egyptian/son-of-osiris/soopattack.wav";
import select1Url from "../../../assets/units/egyptian/son-of-osiris/soopselect1.wav";
import select2Url from "../../../assets/units/egyptian/son-of-osiris/soopselect2.wav";
import select3Url from "../../../assets/units/egyptian/son-of-osiris/soopselect3.wav";
import select4Url from "../../../assets/units/egyptian/son-of-osiris/soopselect4.wav";
import createdUrl from "../../../assets/units/egyptian/son-of-osiris/sonofosirisbirth.wav";
import boltUrl from "../../../assets/units/egyptian/son-of-osiris/sonofosirisbolt.wav";
import walkUrl from "../../../assets/units/egyptian/son-of-osiris/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url, move3Url, move4Url], volume: 1, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_SON_OF_OSIRIS,
  key: "egyptian-son-of-osiris",
  presentation: {
    kind: "model",
    worldHeight: 2.75,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianSonOfOsirisIdle"]),
      walk: loop(["egyptianSonOfOsirisWalk"]),
      attack: actionCycle(["egyptianSonOfOsirisAttack"]),
      heal: loop(["egyptianSonOfOsirisEmpower"]),
      empower: loop(["egyptianSonOfOsirisEmpower"]),
      carryIdle: loop(["egyptianSonOfOsirisCarryIdle"]),
      carryWalk: loop(["egyptianSonOfOsirisCarryWalk"]),
      death: once(["egyptianSonOfOsirisDeath"]),
    },
  },
  models: [
    { key: "egyptianSonOfOsirisIdle", url: idleUrl, grounded: true },
    { key: "egyptianSonOfOsirisWalk", url: walkUrl, grounded: true },
    { key: "egyptianSonOfOsirisAttack", url: attackUrl, grounded: true },
    { key: "egyptianSonOfOsirisEmpower", url: empowerUrl, grounded: true },
    { key: "egyptianSonOfOsirisCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "egyptianSonOfOsirisCarryWalk", url: carryWalkUrl, grounded: true },
    { key: "egyptianSonOfOsirisDeath", url: deathModelUrl, grounded: true },
  ],
  beam: {
    beamTextureUrl: lightningUrl,
    headTextureUrl: lightningUrl,
    blend: "additive",
    startTicks: 33,
    endTicks: 60,
    width: 0.3,
    headLength: 0.8,
    sourceHeight: 2.1,
    targetHeightFactor: 0.5,
  },
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url, select4Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: { files: [attackVoiceUrl], volume: 1, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 0.85, maxVoices: 1 },
    attack: { files: [boltUrl], volume: 1, maxVoices: 2 },
  },
} as const satisfies UnitMediaDefinition;
