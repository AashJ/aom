import { TYPE_MYRMIDON } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/myrmidon/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/myrmidon/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/myrmidon/gmm3.wav";
import attackAUrl from "../../../assets/units/greek/myrmidon/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/myrmidon/attack-b.glb?url";
import attackVoice1Url from "../../../assets/units/greek/myrmidon/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/myrmidon/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/myrmidon/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/myrmidon/gma4.wav";
import deathUrl from "../../../assets/units/greek/myrmidon/death.glb?url";
import headUrl from "../../../assets/units/greek/myrmidon/head.glb?url";
import iconUrl from "../../../assets/units/greek/myrmidon/icon.png";
import idleUrl from "../../../assets/units/greek/myrmidon/idle.glb?url";
import selection1Url from "../../../assets/units/greek/myrmidon/gms1.wav";
import selection2Url from "../../../assets/units/greek/myrmidon/gms2.wav";
import selection3Url from "../../../assets/units/greek/myrmidon/gms3.wav";
import swordUrl from "../../../assets/units/greek/myrmidon/sword.glb?url";
import walkUrl from "../../../assets/units/greek/myrmidon/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekMyrmidonHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekMyrmidonSword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_MYRMIDON,
  key: "greek-myrmidon",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekMyrmidonIdle"]),
      walk: loop(["greekMyrmidonWalk"]),
      attack: actionCycle(["greekMyrmidonAttackA", "greekMyrmidonAttackB"]),
      death: once(["greekMyrmidonDeath"]),
    },
  },
  models: [
    { key: "greekMyrmidonIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekMyrmidonWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekMyrmidonAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekMyrmidonAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekMyrmidonDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekMyrmidonHead", url: headUrl, grounded: false },
    { key: "greekMyrmidonSword", url: swordUrl, grounded: false },
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
