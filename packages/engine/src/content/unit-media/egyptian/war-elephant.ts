import { TYPE_WAR_ELEPHANT } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/war-elephant/attack.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/war-elephant/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/war-elephant/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/war-elephant/ema3.wav";
import acknowledge1Url from "../../../assets/units/egyptian/war-elephant/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/war-elephant/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/war-elephant/emm3.wav";
import selection1Url from "../../../assets/units/egyptian/war-elephant/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/war-elephant/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/war-elephant/ems3.wav";
import deathUrl from "../../../assets/units/egyptian/war-elephant/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/war-elephant/death.wav";
import iconUrl from "../../../assets/units/egyptian/war-elephant/icon.png";
import idleUrl from "../../../assets/units/egyptian/war-elephant/idle.glb?url";
import tusksUrl from "../../../assets/units/egyptian/war-elephant/tusks.glb?url";
import walkUrl from "../../../assets/units/egyptian/war-elephant/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  {
    model: "egyptianWarElephantTusks",
    targetNode: "Dummy_chin",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_WAR_ELEPHANT,
  key: "egyptian-war-elephant",
  presentation: {
    kind: "model",
    worldHeight: 3.6,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianWarElephantIdle"]),
      walk: loop(["egyptianWarElephantWalk"]),
      attack: actionCycle(["egyptianWarElephantAttack"]),
      death: once(["egyptianWarElephantDeath"]),
    },
  },
  models: [
    { key: "egyptianWarElephantIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianWarElephantWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "egyptianWarElephantAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "egyptianWarElephantDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "egyptianWarElephantTusks", url: tusksUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selection1Url, selection2Url, selection3Url], volume: 1, maxVoices: 1 },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackVoice1Url, attackVoice2Url, attackVoice3Url],
      volume: 1,
      maxVoices: 1,
    },
    created: AUDIO_CUES.militaryCreate,
    death: { files: [deathVoiceUrl], volume: 0.7, maxVoices: 2 },
  },
} as const satisfies UnitMediaDefinition;
