import { TYPE_PELTAST } from "@aom/sim";
import attackUrl from "../../../assets/units/greek/peltast/attack.glb?url";
import acknowledge1Url from "../../../assets/units/greek/peltast/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/peltast/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/peltast/gmm3.wav";
import attackVoice1Url from "../../../assets/units/greek/peltast/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/peltast/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/peltast/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/peltast/gma4.wav";
import deathUrl from "../../../assets/units/greek/peltast/death.glb?url";
import iconUrl from "../../../assets/units/greek/peltast/icon.png";
import idleUrl from "../../../assets/units/greek/peltast/idle.glb?url";
import javelinUrl from "../../../assets/units/greek/peltast/javelin.glb?url";
import selection1Url from "../../../assets/units/greek/peltast/gms1.wav";
import selection2Url from "../../../assets/units/greek/peltast/gms2.wav";
import selection3Url from "../../../assets/units/greek/peltast/gms3.wav";
import walkUrl from "../../../assets/units/greek/peltast/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekPeltastJavelin", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_PELTAST,
  key: "greek-peltast",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekPeltastIdle"]),
      walk: loop(["greekPeltastWalk"]),
      attack: actionCycle(["greekPeltastAttack"]),
      death: once(["greekPeltastDeath"]),
    },
  },
  models: [
    { key: "greekPeltastIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekPeltastWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekPeltastAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "greekPeltastDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekPeltastJavelin", url: javelinUrl, grounded: false },
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
