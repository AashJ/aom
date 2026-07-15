import { TYPE_HYPASPIST } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/hypaspist/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/hypaspist/attack-b.glb?url";
import deathUrl from "../../../assets/units/greek/hypaspist/death.glb?url";
import attackVoice1Url from "../../../assets/units/greek/hypaspist/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/hypaspist/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/hypaspist/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/hypaspist/gma4.wav";
import acknowledge1Url from "../../../assets/units/greek/hypaspist/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/hypaspist/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/hypaspist/gmm3.wav";
import selection1Url from "../../../assets/units/greek/hypaspist/gms1.wav";
import selection2Url from "../../../assets/units/greek/hypaspist/gms2.wav";
import selection3Url from "../../../assets/units/greek/hypaspist/gms3.wav";
import headUrl from "../../../assets/units/greek/hypaspist/head.glb?url";
import iconUrl from "../../../assets/units/greek/hypaspist/icon.png";
import idleUrl from "../../../assets/units/greek/hypaspist/idle.glb?url";
import swordUrl from "../../../assets/units/greek/hypaspist/sword.glb?url";
import walkUrl from "../../../assets/units/greek/hypaspist/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekHypaspistHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekHypaspistSword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_HYPASPIST,
  key: "greek-hypaspist",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHypaspistIdle"]),
      walk: loop(["greekHypaspistWalk"]),
      attack: actionCycle(["greekHypaspistAttackA", "greekHypaspistAttackB"]),
      death: once(["greekHypaspistDeath"]),
    },
  },
  models: [
    { key: "greekHypaspistIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekHypaspistWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekHypaspistAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekHypaspistAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekHypaspistDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekHypaspistHead", url: headUrl, grounded: false },
    { key: "greekHypaspistSword", url: swordUrl, grounded: false },
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
