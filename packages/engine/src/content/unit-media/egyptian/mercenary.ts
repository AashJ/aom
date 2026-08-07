import { TYPE_MERCENARY } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/mercenary/attack.glb?url";
import deathUrl from "../../../assets/units/egyptian/mercenary/death.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/mercenary/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/mercenary/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/mercenary/ema3.wav";
import acknowledge1Url from "../../../assets/units/egyptian/mercenary/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/mercenary/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/mercenary/emm3.wav";
import selection1Url from "../../../assets/units/egyptian/mercenary/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/mercenary/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/mercenary/ems3.wav";
import headUrl from "../../../assets/units/egyptian/mercenary/head.glb?url";
import iconUrl from "../../../assets/units/egyptian/mercenary/icon.png";
import idleUrl from "../../../assets/units/egyptian/mercenary/idle.glb?url";
import shieldUrl from "../../../assets/units/egyptian/mercenary/shield.glb?url";
import spearUrl from "../../../assets/units/egyptian/mercenary/spear.glb?url";
import walkUrl from "../../../assets/units/egyptian/mercenary/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "egyptianMercenaryHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  {
    model: "egyptianMercenaryShield",
    targetNode: "Dummy_leftforearm",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianMercenarySpear",
    targetNode: "Dummy_righthand",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_MERCENARY,
  key: "egyptian-mercenary",
  presentation: {
    kind: "model",
    worldHeight: 2.4,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianMercenaryIdle"]),
      walk: loop(["egyptianMercenaryWalk"]),
      attack: actionCycle(["egyptianMercenaryAttack"]),
      death: once(["egyptianMercenaryDeath"]),
    },
  },
  models: [
    { key: "egyptianMercenaryIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianMercenaryWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "egyptianMercenaryAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "egyptianMercenaryDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "egyptianMercenaryHead", url: headUrl, grounded: false },
    { key: "egyptianMercenaryShield", url: shieldUrl, grounded: false },
    { key: "egyptianMercenarySpear", url: spearUrl, grounded: false },
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
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
