import { TYPE_TOXOTES } from "@aom/sim";
import attackUrl from "../../../assets/units/greek/toxotes/attack.glb?url";
import acknowledge1Url from "../../../assets/units/greek/toxotes/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/toxotes/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/toxotes/gmm3.wav";
import attackVoice1Url from "../../../assets/units/greek/toxotes/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/toxotes/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/toxotes/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/toxotes/gma4.wav";
import bowUrl from "../../../assets/units/greek/toxotes/bow.glb?url";
import deathUrl from "../../../assets/units/greek/toxotes/death.glb?url";
import headUrl from "../../../assets/units/greek/toxotes/head.glb?url";
import iconUrl from "../../../assets/units/greek/toxotes/icon.png";
import idleUrl from "../../../assets/units/greek/toxotes/idle.glb?url";
import selection1Url from "../../../assets/units/greek/toxotes/gms1.wav";
import selection2Url from "../../../assets/units/greek/toxotes/gms2.wav";
import selection3Url from "../../../assets/units/greek/toxotes/gms3.wav";
import walkUrl from "../../../assets/units/greek/toxotes/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekToxotesHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekToxotesBow", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_TOXOTES,
  key: "greek-toxotes",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekToxotesIdle"]),
      walk: loop(["greekToxotesWalk"]),
      attack: actionCycle(["greekToxotesAttack"]),
      death: once(["greekToxotesDeath"]),
    },
  },
  models: [
    { key: "greekToxotesIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekToxotesWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekToxotesAttack", url: attackUrl, grounded: true, attachments: equipment },
    { key: "greekToxotesDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekToxotesHead", url: headUrl, grounded: false },
    { key: "greekToxotesBow", url: bowUrl, grounded: false },
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
