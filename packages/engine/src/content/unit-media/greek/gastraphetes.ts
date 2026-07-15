import { TYPE_GASTRAPHETES } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/gastraphetes/gmm1.wav";
import acknowledge2Url from "../../../assets/units/greek/gastraphetes/gmm2.wav";
import acknowledge3Url from "../../../assets/units/greek/gastraphetes/gmm3.wav";
import attackAUrl from "../../../assets/units/greek/gastraphetes/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/gastraphetes/attack-b.glb?url";
import attackVoice1Url from "../../../assets/units/greek/gastraphetes/gma1.wav";
import attackVoice2Url from "../../../assets/units/greek/gastraphetes/gma2.wav";
import attackVoice3Url from "../../../assets/units/greek/gastraphetes/gma3.wav";
import attackVoice4Url from "../../../assets/units/greek/gastraphetes/gma4.wav";
import deathUrl from "../../../assets/units/greek/gastraphetes/death.glb?url";
import iconUrl from "../../../assets/units/greek/gastraphetes/icon.png";
import idleUrl from "../../../assets/units/greek/gastraphetes/idle.glb?url";
import selection1Url from "../../../assets/units/greek/gastraphetes/gms1.wav";
import selection2Url from "../../../assets/units/greek/gastraphetes/gms2.wav";
import selection3Url from "../../../assets/units/greek/gastraphetes/gms3.wav";
import walkUrl from "../../../assets/units/greek/gastraphetes/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GASTRAPHETES,
  key: "greek-gastraphetes",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekGastraphetesIdle"]),
      walk: loop(["greekGastraphetesWalk"]),
      attack: actionCycle(["greekGastraphetesAttackA", "greekGastraphetesAttackB"]),
      death: once(["greekGastraphetesDeath"]),
    },
  },
  models: [
    { key: "greekGastraphetesIdle", url: idleUrl, grounded: true },
    { key: "greekGastraphetesWalk", url: walkUrl, grounded: true },
    { key: "greekGastraphetesAttackA", url: attackAUrl, grounded: true },
    { key: "greekGastraphetesAttackB", url: attackBUrl, grounded: true },
    { key: "greekGastraphetesDeath", url: deathUrl, grounded: true },
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
