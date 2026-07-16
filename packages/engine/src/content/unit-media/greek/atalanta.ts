import { TYPE_ATALANTA } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/atalanta/acknowledge1.wav";
import acknowledge2Url from "../../../assets/units/greek/atalanta/acknowledge2.wav";
import acknowledge3Url from "../../../assets/units/greek/atalanta/acknowledge3.wav";
import attackUrl from "../../../assets/units/greek/atalanta/attack.glb?url";
import attackVoice1Url from "../../../assets/units/greek/atalanta/attack-acknowledge1.wav";
import attackVoice2Url from "../../../assets/units/greek/atalanta/attack-acknowledge2.wav";
import carryIdleUrl from "../../../assets/units/greek/atalanta/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/atalanta/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/atalanta/creation.wav";
import deathUrl from "../../../assets/units/greek/atalanta/death.glb?url";
import deathVoice1Url from "../../../assets/units/greek/atalanta/female-death1.wav";
import deathVoice2Url from "../../../assets/units/greek/atalanta/female-death2.wav";
import deathVoice3Url from "../../../assets/units/greek/atalanta/female-death3.wav";
import deathVoice4Url from "../../../assets/units/greek/atalanta/female-death4.wav";
import iconUrl from "../../../assets/units/greek/atalanta/icon.png";
import idleUrl from "../../../assets/units/greek/atalanta/idle.glb?url";
import selection1Url from "../../../assets/units/greek/atalanta/selection1.wav";
import selection2Url from "../../../assets/units/greek/atalanta/selection2.wav";
import selection3Url from "../../../assets/units/greek/atalanta/selection3.wav";
import walkUrl from "../../../assets/units/greek/atalanta/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_ATALANTA,
  key: "greek-atalanta",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekAtalantaIdle"]),
      walk: loop(["greekAtalantaWalk"]),
      attack: actionCycle(["greekAtalantaAttack"]),
      death: once(["greekAtalantaDeath"]),
      carryIdle: loop(["greekAtalantaCarryIdle"]),
      carryWalk: loop(["greekAtalantaCarryWalk"]),
    },
  },
  models: [
    { key: "greekAtalantaIdle", url: idleUrl, grounded: true },
    { key: "greekAtalantaWalk", url: walkUrl, grounded: true },
    { key: "greekAtalantaAttack", url: attackUrl, grounded: true },
    { key: "greekAtalantaDeath", url: deathUrl, grounded: true },
    { key: "greekAtalantaCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekAtalantaCarryWalk", url: carryWalkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [selection1Url, selection2Url, selection3Url],
      volume: 1,
      maxVoices: 1,
    },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackVoice1Url, attackVoice2Url],
      volume: 1,
      maxVoices: 1,
    },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: {
      files: [deathVoice1Url, deathVoice2Url, deathVoice3Url, deathVoice4Url],
      volume: 1,
      maxVoices: 3,
    },
  },
} as const satisfies UnitMediaDefinition;
