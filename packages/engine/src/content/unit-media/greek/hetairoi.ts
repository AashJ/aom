import { TYPE_HETAIROI } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/hetairoi/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/hetairoi/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/hetairoi/gmm3.wav";
import attackAUrl from "../../../assets/units/greek/hetairoi/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/hetairoi/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/hetairoi/attack-c.glb?url";
import attackVoice1Url from "../../../assets/units/greek/hetairoi/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/hetairoi/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/hetairoi/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/hetairoi/gma4.wav";
import deathUrl from "../../../assets/units/greek/hetairoi/death.glb?url";
import iconUrl from "../../../assets/units/greek/hetairoi/icon.png";
import idleUrl from "../../../assets/units/greek/hetairoi/idle.glb?url";
import selection1Url from "../../../assets/units/greek/hetairoi/gms1.wav";
import selection2Url from "../../../assets/units/greek/hetairoi/gms2.wav";
import selection3Url from "../../../assets/units/greek/hetairoi/gms3.wav";
import swordUrl from "../../../assets/units/greek/hetairoi/sword.glb?url";
import walkUrl from "../../../assets/units/greek/hetairoi/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekHetairoiSword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_HETAIROI,
  key: "greek-hetairoi",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHetairoiIdle"]),
      walk: loop(["greekHetairoiWalk"]),
      attack: actionCycle(["greekHetairoiAttackA", "greekHetairoiAttackB", "greekHetairoiAttackC"]),
      death: once(["greekHetairoiDeath"]),
    },
  },
  models: [
    { key: "greekHetairoiIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekHetairoiWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekHetairoiAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekHetairoiAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekHetairoiAttackC", url: attackCUrl, grounded: true, attachments: equipment },
    { key: "greekHetairoiDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekHetairoiSword", url: swordUrl, grounded: false },
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
