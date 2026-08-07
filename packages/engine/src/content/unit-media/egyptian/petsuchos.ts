import { TYPE_PETSUCHOS } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/egyptian/petsuchos/acknowledge1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/petsuchos/acknowledge2.wav";
import attackModelUrl from "../../../assets/units/egyptian/petsuchos/attack.glb?url";
import attackVoiceUrl from "../../../assets/units/egyptian/petsuchos/attack.wav";
import ballGlowUrl from "../../../assets/units/egyptian/petsuchos/ball-glow.png";
import beamUrl from "../../../assets/units/egyptian/petsuchos/beam.png";
import created1Url from "../../../assets/units/egyptian/petsuchos/created1.wav";
import created2Url from "../../../assets/units/egyptian/petsuchos/created2.wav";
import deathModelUrl from "../../../assets/units/egyptian/petsuchos/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/petsuchos/death.wav";
import iconUrl from "../../../assets/units/egyptian/petsuchos/icon.png";
import headUrl from "../../../assets/units/egyptian/petsuchos/arrow.png";
import idleUrl from "../../../assets/units/egyptian/petsuchos/idle.glb?url";
import select1Url from "../../../assets/units/egyptian/petsuchos/select1.wav";
import select2Url from "../../../assets/units/egyptian/petsuchos/select2.wav";
import walkUrl from "../../../assets/units/egyptian/petsuchos/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [acknowledge1Url, acknowledge2Url],
  volume: 0.85,
  maxVoices: 3,
} as const;

export const definition = {
  type: TYPE_PETSUCHOS,
  key: "egyptian-petsuchos",
  presentation: {
    kind: "model",
    worldHeight: 2.5,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianPetsuchosIdle"]),
      walk: loop(["egyptianPetsuchosWalk"]),
      attack: actionCycle(["egyptianPetsuchosCharging"]),
      death: once(["egyptianPetsuchosDeath"]),
    },
  },
  models: [
    { key: "egyptianPetsuchosIdle", url: idleUrl, grounded: true },
    { key: "egyptianPetsuchosWalk", url: walkUrl, grounded: true },
    { key: "egyptianPetsuchosCharging", url: attackModelUrl, grounded: true },
    { key: "egyptianPetsuchosDeath", url: deathModelUrl, grounded: true },
  ],
  effects: [
    {
      key: "egyptianPetsuchosBallGlow",
      trigger: "beam-attack",
      textureUrl: ballGlowUrl,
    },
  ],
  beam: {
    beamTextureUrl: beamUrl,
    headTextureUrl: headUrl,
    blend: "additive",
    startTicks: 27,
    endTicks: 60,
    width: 0.38,
    headLength: 1.2,
    sourceHeight: 1.3,
    targetHeightFactor: 0.5,
  },
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [select1Url, select2Url],
      volume: 0.85,
      maxVoices: 3,
    },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: {
      files: [created1Url, created2Url],
      volume: 0.75,
      maxVoices: 3,
    },
    death: { files: [deathVoiceUrl], volume: 0.85, maxVoices: 3 },
    attack: {
      files: [attackVoiceUrl],
      volume: 0.6,
      maxVoices: 3,
      delaySeconds: 1.41,
    },
  },
} as const satisfies UnitMediaDefinition;
