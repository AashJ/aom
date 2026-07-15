import { TYPE_HIPPIKON } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/hippikon/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/hippikon/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/hippikon/gmm3.wav";
import attackAUrl from "../../../assets/units/greek/hippikon/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/hippikon/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/hippikon/attack-c.glb?url";
import attackVoice1Url from "../../../assets/units/greek/hippikon/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/hippikon/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/hippikon/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/hippikon/gma4.wav";
import deathUrl from "../../../assets/units/greek/hippikon/death.glb?url";
import headUrl from "../../../assets/units/greek/hippikon/head.glb?url";
import iconUrl from "../../../assets/units/greek/hippikon/icon.png";
import idleUrl from "../../../assets/units/greek/hippikon/idle.glb?url";
import selection1Url from "../../../assets/units/greek/hippikon/gms1.wav";
import selection2Url from "../../../assets/units/greek/hippikon/gms2.wav";
import selection3Url from "../../../assets/units/greek/hippikon/gms3.wav";
import swordUrl from "../../../assets/units/greek/hippikon/sword.glb?url";
import walkUrl from "../../../assets/units/greek/hippikon/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekHippikonHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekHippikonSword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_HIPPIKON,
  key: "greek-hippikon",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHippikonIdle"]),
      walk: loop(["greekHippikonWalk"]),
      attack: actionCycle(["greekHippikonAttackA", "greekHippikonAttackB", "greekHippikonAttackC"]),
      death: once(["greekHippikonDeath"]),
    },
  },
  models: [
    { key: "greekHippikonIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekHippikonWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekHippikonAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekHippikonAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekHippikonAttackC", url: attackCUrl, grounded: true, attachments: equipment },
    { key: "greekHippikonDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekHippikonHead", url: headUrl, grounded: false },
    { key: "greekHippikonSword", url: swordUrl, grounded: false },
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
