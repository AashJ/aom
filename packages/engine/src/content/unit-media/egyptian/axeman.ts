import { TYPE_AXEMAN } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/egyptian/axeman/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/axeman/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/axeman/emm3.wav";
import attackUrl from "../../../assets/units/egyptian/axeman/attack.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/axeman/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/axeman/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/axeman/ema3.wav";
import axeUrl from "../../../assets/units/egyptian/axeman/axe.glb?url";
import deathUrl from "../../../assets/units/egyptian/axeman/death.glb?url";
import iconUrl from "../../../assets/units/egyptian/axeman/icon.png";
import idleUrl from "../../../assets/units/egyptian/axeman/idle.glb?url";
import selection1Url from "../../../assets/units/egyptian/axeman/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/axeman/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/axeman/ems3.wav";
import walkUrl from "../../../assets/units/egyptian/axeman/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "egyptianAxemanAxe", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_AXEMAN,
  key: "egyptian-axeman",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianAxemanIdle"]),
      walk: loop(["egyptianAxemanWalk"]),
      attack: actionCycle(["egyptianAxemanAttack"]),
      death: once(["egyptianAxemanDeath"]),
    },
  },
  models: [
    { key: "egyptianAxemanIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianAxemanWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "egyptianAxemanAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "egyptianAxemanDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "egyptianAxemanAxe", url: axeUrl, grounded: false },
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
