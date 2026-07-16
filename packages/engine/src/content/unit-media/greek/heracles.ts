import { TYPE_HERACLES } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/heracles/ghm1.wav";
import acknowledge2Url from "../../../assets/units/greek/heracles/ghm2.wav";
import acknowledge3Url from "../../../assets/units/greek/heracles/ghm3.wav";
import acknowledge4Url from "../../../assets/units/greek/heracles/ghm4.wav";
import attackUrl from "../../../assets/units/greek/heracles/attack.glb?url";
import attackVoice1Url from "../../../assets/units/greek/heracles/gha1.wav";
import attackVoice2Url from "../../../assets/units/greek/heracles/gha2.wav";
import attackVoice3Url from "../../../assets/units/greek/heracles/gha3.wav";
import carryIdleUrl from "../../../assets/units/greek/heracles/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/heracles/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/heracles/creation.wav";
import deathUrl from "../../../assets/units/greek/heracles/death.glb?url";
import iconUrl from "../../../assets/units/greek/heracles/icon.png";
import idleUrl from "../../../assets/units/greek/heracles/idle.glb?url";
import selection1Url from "../../../assets/units/greek/heracles/ghs1.wav";
import selection2Url from "../../../assets/units/greek/heracles/ghs2.wav";
import selection3Url from "../../../assets/units/greek/heracles/ghs3.wav";
import selection4Url from "../../../assets/units/greek/heracles/ghs4.wav";
import walkUrl from "../../../assets/units/greek/heracles/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_HERACLES,
  key: "greek-heracles",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHeraclesIdle"]),
      walk: loop(["greekHeraclesWalk"]),
      attack: actionCycle(["greekHeraclesAttack"]),
      death: once(["greekHeraclesDeath"]),
      carryIdle: loop(["greekHeraclesCarryIdle"]),
      carryWalk: loop(["greekHeraclesCarryWalk"]),
    },
  },
  models: [
    { key: "greekHeraclesIdle", url: idleUrl, grounded: true },
    { key: "greekHeraclesWalk", url: walkUrl, grounded: true },
    { key: "greekHeraclesAttack", url: attackUrl, grounded: true },
    { key: "greekHeraclesDeath", url: deathUrl, grounded: true },
    { key: "greekHeraclesCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekHeraclesCarryWalk", url: carryWalkUrl, grounded: true },
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
  },
} as const satisfies UnitMediaDefinition;
