import { TYPE_SPHINX } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/sphinx/attack.glb?url";
import attackVoiceUrl from "../../../assets/units/egyptian/sphinx/sphinxattack1.wav";
import createdUrl from "../../../assets/units/egyptian/sphinx/sphinxgrunt1.wav";
import deathUrl from "../../../assets/units/egyptian/sphinx/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/sphinx/sphinxdeath.wav";
import iconUrl from "../../../assets/units/egyptian/sphinx/icon.png";
import idleUrl from "../../../assets/units/egyptian/sphinx/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/sphinx/sphinxmove1.wav";
import move2Url from "../../../assets/units/egyptian/sphinx/sphinxmove2.wav";
import move3Url from "../../../assets/units/egyptian/sphinx/sphinxmove3.wav";
import select1Url from "../../../assets/units/egyptian/sphinx/sphinxselect1.wav";
import select2Url from "../../../assets/units/egyptian/sphinx/sphinxselect2.wav";
import select3Url from "../../../assets/units/egyptian/sphinx/sphinxselect3.wav";
import specialVoiceUrl from "../../../assets/units/egyptian/sphinx/sphinxspecialattack.wav";
import tornadoUrl from "../../../assets/units/egyptian/sphinx/tornado.png";
import walkUrl from "../../../assets/units/egyptian/sphinx/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 0.85,
  maxVoices: 3,
} as const;

export const definition = {
  type: TYPE_SPHINX,
  key: "egyptian-sphinx",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    // Classic's WhirlwindAttack selector is VisualNone: the sand-tornado
    // particle owns presentation for the full charged action.
    hideDuringSpecialAttack: true,
    actions: {
      idle: loop(["egyptianSphinxIdle"]),
      walk: loop(["egyptianSphinxWalk"]),
      attack: actionCycle(["egyptianSphinxAttack"]),
      specialAttack: actionCycle(["egyptianSphinxIdle"]),
      death: once(["egyptianSphinxDeath"]),
    },
  },
  models: [
    { key: "egyptianSphinxIdle", url: idleUrl, grounded: true },
    { key: "egyptianSphinxWalk", url: walkUrl, grounded: true },
    { key: "egyptianSphinxAttack", url: attackUrl, grounded: true },
    { key: "egyptianSphinxDeath", url: deathUrl, grounded: true },
  ],
  effects: [
    {
      key: "egyptianSphinxSandTornado",
      trigger: "special-attack",
      textureUrl: tornadoUrl,
    },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 3 },
    acknowledge,
    attackAcknowledge: { files: [attackVoiceUrl], volume: 1, maxVoices: 3 },
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 3 },
    specialAttack: { files: [specialVoiceUrl], volume: 1, maxVoices: 3 },
  },
} as const satisfies UnitMediaDefinition;
