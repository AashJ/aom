import { TYPE_PRODROMOS } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/prodromos/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/prodromos/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/prodromos/gmm3.wav";
import attackAUrl from "../../../assets/units/greek/prodromos/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/prodromos/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/prodromos/attack-c.glb?url";
import attackVoice1Url from "../../../assets/units/greek/prodromos/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/prodromos/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/prodromos/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/prodromos/gma4.wav";
import deathUrl from "../../../assets/units/greek/prodromos/death.glb?url";
import headUrl from "../../../assets/units/greek/prodromos/head.glb?url";
import iconUrl from "../../../assets/units/greek/prodromos/icon.png";
import idleUrl from "../../../assets/units/greek/prodromos/idle.glb?url";
import selection1Url from "../../../assets/units/greek/prodromos/gms1.wav";
import selection2Url from "../../../assets/units/greek/prodromos/gms2.wav";
import selection3Url from "../../../assets/units/greek/prodromos/gms3.wav";
import spearUrl from "../../../assets/units/greek/prodromos/spear.glb?url";
import walkUrl from "../../../assets/units/greek/prodromos/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekProdromosHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekProdromosSpear", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_PRODROMOS,
  key: "greek-prodromos",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekProdromosIdle"]),
      walk: loop(["greekProdromosWalk"]),
      attack: actionCycle([
        "greekProdromosAttackA",
        "greekProdromosAttackB",
        "greekProdromosAttackC",
      ]),
      death: once(["greekProdromosDeath"]),
    },
  },
  models: [
    { key: "greekProdromosIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekProdromosWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekProdromosAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekProdromosAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekProdromosAttackC", url: attackCUrl, grounded: true, attachments: equipment },
    { key: "greekProdromosDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekProdromosHead", url: headUrl, grounded: false },
    { key: "greekProdromosSpear", url: spearUrl, grounded: false },
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
