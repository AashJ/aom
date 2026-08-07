import { TYPE_MERCENARY_CAVALRY } from "@aom/sim";
import attackAUrl from "../../../assets/units/egyptian/mercenary-cavalry/attack-a.glb?url";
import attackBUrl from "../../../assets/units/egyptian/mercenary-cavalry/attack-b.glb?url";
import attackCUrl from "../../../assets/units/egyptian/mercenary-cavalry/attack-c.glb?url";
import deathUrl from "../../../assets/units/egyptian/mercenary-cavalry/death.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/mercenary-cavalry/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/mercenary-cavalry/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/mercenary-cavalry/ema3.wav";
import acknowledge1Url from "../../../assets/units/egyptian/mercenary-cavalry/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/mercenary-cavalry/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/mercenary-cavalry/emm3.wav";
import selection1Url from "../../../assets/units/egyptian/mercenary-cavalry/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/mercenary-cavalry/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/mercenary-cavalry/ems3.wav";
import iconUrl from "../../../assets/units/egyptian/mercenary-cavalry/icon.png";
import idleUrl from "../../../assets/units/egyptian/mercenary-cavalry/idle.glb?url";
import shieldUrl from "../../../assets/units/egyptian/mercenary-cavalry/shield.glb?url";
import walkUrl from "../../../assets/units/egyptian/mercenary-cavalry/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  {
    model: "egyptianMercenaryCavalryShield",
    targetNode: "Dummy_leftforearm",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_MERCENARY_CAVALRY,
  key: "egyptian-mercenary-cavalry",
  presentation: {
    kind: "model",
    worldHeight: 2.9,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianMercenaryCavalryIdle"]),
      walk: loop(["egyptianMercenaryCavalryWalk"]),
      attack: actionCycle([
        "egyptianMercenaryCavalryAttackA",
        "egyptianMercenaryCavalryAttackB",
        "egyptianMercenaryCavalryAttackC",
      ]),
      death: once(["egyptianMercenaryCavalryDeath"]),
    },
  },
  models: [
    {
      key: "egyptianMercenaryCavalryIdle",
      url: idleUrl,
      grounded: true,
      attachments: equipment,
    },
    {
      key: "egyptianMercenaryCavalryWalk",
      url: walkUrl,
      grounded: true,
      attachments: equipment,
    },
    {
      key: "egyptianMercenaryCavalryAttackA",
      url: attackAUrl,
      grounded: true,
      attachments: equipment,
    },
    {
      key: "egyptianMercenaryCavalryAttackB",
      url: attackBUrl,
      grounded: true,
      attachments: equipment,
    },
    {
      key: "egyptianMercenaryCavalryAttackC",
      url: attackCUrl,
      grounded: true,
      attachments: equipment,
    },
    {
      key: "egyptianMercenaryCavalryDeath",
      url: deathUrl,
      grounded: true,
      attachments: equipment,
    },
    { key: "egyptianMercenaryCavalryShield", url: shieldUrl, grounded: false },
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
