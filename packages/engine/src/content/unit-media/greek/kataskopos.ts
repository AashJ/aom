import { TYPE_KATASKOPOS } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/kataskopos/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/kataskopos/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/kataskopos/gmm3.wav";
import attackAUrl from "../../../assets/units/greek/kataskopos/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/kataskopos/attack-b.glb?url";
import attackVoice1Url from "../../../assets/units/greek/kataskopos/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/kataskopos/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/kataskopos/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/kataskopos/gma4.wav";
import deathUrl from "../../../assets/units/greek/kataskopos/death.glb?url";
import iconUrl from "../../../assets/units/greek/kataskopos/icon.png";
import idleUrl from "../../../assets/units/greek/kataskopos/idle.glb?url";
import selection1Url from "../../../assets/units/greek/kataskopos/gms1.wav";
import selection2Url from "../../../assets/units/greek/kataskopos/gms2.wav";
import selection3Url from "../../../assets/units/greek/kataskopos/gms3.wav";
import swordUrl from "../../../assets/units/greek/kataskopos/sword.glb?url";
import walkUrl from "../../../assets/units/greek/kataskopos/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekKataskoposSword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_KATASKOPOS,
  key: "greek-kataskopos",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekKataskoposIdle"]),
      walk: loop(["greekKataskoposWalk"]),
      attack: actionCycle(["greekKataskoposAttackA", "greekKataskoposAttackB"]),
      death: once(["greekKataskoposDeath"]),
    },
  },
  models: [
    { key: "greekKataskoposIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekKataskoposWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekKataskoposAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekKataskoposAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekKataskoposDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekKataskoposSword", url: swordUrl, grounded: false },
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
