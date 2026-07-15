import { TYPE_HOPLITE } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/hoplite/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/hoplite/attack-b.glb?url";
import deathUrl from "../../../assets/units/greek/hoplite/death.glb?url";
import attackVoice1Url from "../../../assets/units/greek/hoplite/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/hoplite/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/hoplite/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/hoplite/gma4.wav";
import acknowledge1Url from "../../../assets/units/greek/hoplite/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/hoplite/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/hoplite/gmm3.wav";
import selection1Url from "../../../assets/units/greek/hoplite/gms1.wav";
import selection2Url from "../../../assets/units/greek/hoplite/gms2.wav";
import selection3Url from "../../../assets/units/greek/hoplite/gms3.wav";
import headUrl from "../../../assets/units/greek/hoplite/head.glb?url";
import iconUrl from "../../../assets/units/greek/hoplite/icon.png";
import idleUrl from "../../../assets/units/greek/hoplite/idle.glb?url";
import spearUrl from "../../../assets/units/greek/hoplite/spear.glb?url";
import walkUrl from "../../../assets/units/greek/hoplite/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekHopliteHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekHopliteSpear", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_HOPLITE,
  key: "greek-hoplite",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHopliteIdle"]),
      walk: loop(["greekHopliteWalk"]),
      attack: actionCycle(["greekHopliteAttackA", "greekHopliteAttackB"]),
      death: once(["greekHopliteDeath"]),
    },
  },
  models: [
    { key: "greekHopliteIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekHopliteWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekHopliteAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekHopliteAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekHopliteDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekHopliteHead", url: headUrl, grounded: false },
    { key: "greekHopliteSpear", url: spearUrl, grounded: false },
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
      files: [attackVoice1Url, attackVoice2Url, attackVoice3Url, attackVoice4Url],
      volume: 1,
      maxVoices: 1,
    },
    created: AUDIO_CUES.militaryCreate,
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
