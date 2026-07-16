import { TYPE_THESEUS } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/theseus/ghm1.wav";
import acknowledge2Url from "../../../assets/units/greek/theseus/ghm2.wav";
import acknowledge3Url from "../../../assets/units/greek/theseus/ghm3.wav";
import acknowledge4Url from "../../../assets/units/greek/theseus/ghm4.wav";
import attackUrl from "../../../assets/units/greek/theseus/attack.glb?url";
import attackVoice1Url from "../../../assets/units/greek/theseus/gha1.wav";
import attackVoice2Url from "../../../assets/units/greek/theseus/gha2.wav";
import attackVoice3Url from "../../../assets/units/greek/theseus/gha3.wav";
import carryIdleUrl from "../../../assets/units/greek/theseus/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/theseus/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/theseus/creation.wav";
import deathUrl from "../../../assets/units/greek/theseus/death.glb?url";
import iconUrl from "../../../assets/units/greek/theseus/icon.png";
import idleUrl from "../../../assets/units/greek/theseus/idle.glb?url";
import selection1Url from "../../../assets/units/greek/theseus/ghs1.wav";
import selection2Url from "../../../assets/units/greek/theseus/ghs2.wav";
import selection3Url from "../../../assets/units/greek/theseus/ghs3.wav";
import selection4Url from "../../../assets/units/greek/theseus/ghs4.wav";
import walkUrl from "../../../assets/units/greek/theseus/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_THESEUS,
  key: "greek-theseus",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekTheseusIdle"]),
      walk: loop(["greekTheseusWalk"]),
      attack: actionCycle(["greekTheseusAttack"]),
      death: once(["greekTheseusDeath"]),
      carryIdle: loop(["greekTheseusCarryIdle"]),
      carryWalk: loop(["greekTheseusCarryWalk"]),
    },
  },
  models: [
    { key: "greekTheseusIdle", url: idleUrl, grounded: true },
    { key: "greekTheseusWalk", url: walkUrl, grounded: true },
    { key: "greekTheseusAttack", url: attackUrl, grounded: true },
    { key: "greekTheseusDeath", url: deathUrl, grounded: true },
    { key: "greekTheseusCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekTheseusCarryWalk", url: carryWalkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [selection1Url, selection2Url, selection3Url, selection4Url],
      volume: 1,
      maxVoices: 1,
    },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url, acknowledge4Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackVoice1Url, attackVoice2Url, attackVoice3Url],
      volume: 1,
      maxVoices: 1,
    },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
