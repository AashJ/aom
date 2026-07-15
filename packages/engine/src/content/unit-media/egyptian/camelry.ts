import { TYPE_CAMELRY } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/egyptian/camelry/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/camelry/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/camelry/emm3.wav";
import attackUrl from "../../../assets/units/egyptian/camelry/attack.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/camelry/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/camelry/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/camelry/ema3.wav";
import deathUrl from "../../../assets/units/egyptian/camelry/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/camelry/death.wav";
import iconUrl from "../../../assets/units/egyptian/camelry/icon.png";
import idleUrl from "../../../assets/units/egyptian/camelry/idle.glb?url";
import selection1Url from "../../../assets/units/egyptian/camelry/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/camelry/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/camelry/ems3.wav";
import swordUrl from "../../../assets/units/egyptian/camelry/sword.glb?url";
import walkUrl from "../../../assets/units/egyptian/camelry/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "egyptianCamelrySword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_CAMELRY,
  key: "egyptian-camelry",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianCamelryIdle"]),
      walk: loop(["egyptianCamelryWalk"]),
      attack: actionCycle(["egyptianCamelryAttack"]),
      death: once(["egyptianCamelryDeath"]),
    },
  },
  models: [
    { key: "egyptianCamelryIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianCamelryWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "egyptianCamelryAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "egyptianCamelryDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "egyptianCamelrySword", url: swordUrl, grounded: false },
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
