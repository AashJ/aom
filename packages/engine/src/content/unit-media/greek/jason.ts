import { TYPE_JASON } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/jason/ghm1.wav";
import acknowledge2Url from "../../../assets/units/greek/jason/ghm2.wav";
import acknowledge3Url from "../../../assets/units/greek/jason/ghm3.wav";
import acknowledge4Url from "../../../assets/units/greek/jason/ghm4.wav";
import attackUrl from "../../../assets/units/greek/jason/attack.glb?url";
import attackVoice1Url from "../../../assets/units/greek/jason/gha1.wav";
import attackVoice2Url from "../../../assets/units/greek/jason/gha2.wav";
import attackVoice3Url from "../../../assets/units/greek/jason/gha3.wav";
import carryIdleUrl from "../../../assets/units/greek/jason/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/jason/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/jason/creation.wav";
import deathUrl from "../../../assets/units/greek/jason/death.glb?url";
import iconUrl from "../../../assets/units/greek/jason/icon.png";
import idleUrl from "../../../assets/units/greek/jason/idle.glb?url";
import selection1Url from "../../../assets/units/greek/jason/ghs1.wav";
import selection2Url from "../../../assets/units/greek/jason/ghs2.wav";
import selection3Url from "../../../assets/units/greek/jason/ghs3.wav";
import selection4Url from "../../../assets/units/greek/jason/ghs4.wav";
import walkUrl from "../../../assets/units/greek/jason/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_JASON,
  key: "greek-jason",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekJasonIdle"]),
      walk: loop(["greekJasonWalk"]),
      attack: actionCycle(["greekJasonAttack"]),
      death: once(["greekJasonDeath"]),
      carryIdle: loop(["greekJasonCarryIdle"]),
      carryWalk: loop(["greekJasonCarryWalk"]),
    },
  },
  models: [
    { key: "greekJasonIdle", url: idleUrl, grounded: true },
    { key: "greekJasonWalk", url: walkUrl, grounded: true },
    { key: "greekJasonAttack", url: attackUrl, grounded: true },
    { key: "greekJasonDeath", url: deathUrl, grounded: true },
    { key: "greekJasonCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekJasonCarryWalk", url: carryWalkUrl, grounded: true },
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
