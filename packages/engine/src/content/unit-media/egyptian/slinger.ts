import { TYPE_SLINGER } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/egyptian/slinger/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/slinger/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/slinger/emm3.wav";
import attackUrl from "../../../assets/units/egyptian/slinger/attack.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/slinger/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/slinger/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/slinger/ema3.wav";
import deathAUrl from "../../../assets/units/egyptian/slinger/death-a.glb?url";
import deathBUrl from "../../../assets/units/egyptian/slinger/death-b.glb?url";
import iconUrl from "../../../assets/units/egyptian/slinger/icon.png";
import idleUrl from "../../../assets/units/egyptian/slinger/idle.glb?url";
import selection1Url from "../../../assets/units/egyptian/slinger/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/slinger/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/slinger/ems3.wav";
import slingUrl from "../../../assets/units/egyptian/slinger/sling.glb?url";
import walkAUrl from "../../../assets/units/egyptian/slinger/walk-a.glb?url";
import walkBUrl from "../../../assets/units/egyptian/slinger/walk-b.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "egyptianSlingerSling", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_SLINGER,
  key: "egyptian-slinger",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianSlingerIdle"]),
      // The Classic definition weights WalkB twice among its three variants.
      walk: loop(["egyptianSlingerWalkA", "egyptianSlingerWalkB", "egyptianSlingerWalkB"]),
      attack: actionCycle(["egyptianSlingerAttack"]),
      death: once(["egyptianSlingerDeathA", "egyptianSlingerDeathB"]),
    },
  },
  models: [
    { key: "egyptianSlingerIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianSlingerWalkA", url: walkAUrl, grounded: true, attachments: equipment },
    { key: "egyptianSlingerWalkB", url: walkBUrl, grounded: true, attachments: equipment },
    { key: "egyptianSlingerAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "egyptianSlingerDeathA", url: deathAUrl, grounded: true, attachments: equipment },
    { key: "egyptianSlingerDeathB", url: deathBUrl, grounded: true, attachments: equipment },
    { key: "egyptianSlingerSling", url: slingUrl, grounded: false },
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
