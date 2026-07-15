import { TYPE_SPEARMAN } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/spearman/attack.glb?url";
import deathUrl from "../../../assets/units/egyptian/spearman/death.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/spearman/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/spearman/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/spearman/ema3.wav";
import acknowledge1Url from "../../../assets/units/egyptian/spearman/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/spearman/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/spearman/emm3.wav";
import selection1Url from "../../../assets/units/egyptian/spearman/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/spearman/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/spearman/ems3.wav";
import headUrl from "../../../assets/units/egyptian/spearman/head.glb?url";
import iconUrl from "../../../assets/units/egyptian/spearman/icon.png";
import idleUrl from "../../../assets/units/egyptian/spearman/idle.glb?url";
import spearUrl from "../../../assets/units/egyptian/spearman/spear.glb?url";
import walkUrl from "../../../assets/units/egyptian/spearman/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "egyptianSpearmanHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "egyptianSpearmanSpear", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_SPEARMAN,
  key: "egyptian-spearman",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianSpearmanIdle"]),
      walk: loop(["egyptianSpearmanWalk"]),
      attack: actionCycle(["egyptianSpearmanAttack"]),
      death: once(["egyptianSpearmanDeath"]),
    },
  },
  models: [
    { key: "egyptianSpearmanIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianSpearmanWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "egyptianSpearmanAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "egyptianSpearmanDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "egyptianSpearmanHead", url: headUrl, grounded: false },
    { key: "egyptianSpearmanSpear", url: spearUrl, grounded: false },
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
