import { TYPE_POLYPHEMUS } from "@aom/sim";
import attack1Url from "../../../assets/units/greek/polyphemus/attack1.wav";
import attack2Url from "../../../assets/units/greek/polyphemus/attack2.wav";
import attack3Url from "../../../assets/units/greek/polyphemus/attack3.wav";
import attack4Url from "../../../assets/units/greek/polyphemus/attack4.wav";
import attackAUrl from "../../../assets/units/greek/polyphemus/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/polyphemus/attack-b.glb?url";
import carryIdleUrl from "../../../assets/units/greek/polyphemus/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/polyphemus/carry-walk.glb?url";
import deathUrl from "../../../assets/units/greek/polyphemus/death.glb?url";
import deathVoice1Url from "../../../assets/units/greek/polyphemus/death1.wav";
import deathVoice2Url from "../../../assets/units/greek/polyphemus/death2.wav";
import iconUrl from "../../../assets/units/greek/polyphemus/icon.png";
import idleUrl from "../../../assets/units/greek/polyphemus/idle.glb?url";
import move1Url from "../../../assets/units/greek/polyphemus/move1.wav";
import move2Url from "../../../assets/units/greek/polyphemus/move2.wav";
import move3Url from "../../../assets/units/greek/polyphemus/move3.wav";
import select1Url from "../../../assets/units/greek/polyphemus/select1.wav";
import select2Url from "../../../assets/units/greek/polyphemus/select2.wav";
import walkUrl from "../../../assets/units/greek/polyphemus/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 1,
  maxVoices: 1,
} as const;

const attackVoice = {
  files: [attack1Url, attack2Url, attack3Url, attack4Url],
  volume: 1,
  maxVoices: 2,
} as const;

export const definition = {
  type: TYPE_POLYPHEMUS,
  key: "greek-polyphemus",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekPolyphemusIdle"]),
      walk: loop(["greekPolyphemusWalk"]),
      attack: actionCycle(["greekPolyphemusAttackA", "greekPolyphemusAttackB"]),
      specialAttack: actionCycle(["greekPolyphemusAttackA"]),
      death: once(["greekPolyphemusDeath"]),
      carryIdle: loop(["greekPolyphemusCarryIdle"]),
      carryWalk: loop(["greekPolyphemusCarryWalk"]),
    },
  },
  models: [
    { key: "greekPolyphemusIdle", url: idleUrl, grounded: true },
    { key: "greekPolyphemusWalk", url: walkUrl, grounded: true },
    { key: "greekPolyphemusAttackA", url: attackAUrl, grounded: true },
    { key: "greekPolyphemusAttackB", url: attackBUrl, grounded: true },
    { key: "greekPolyphemusDeath", url: deathUrl, grounded: true },
    { key: "greekPolyphemusCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekPolyphemusCarryWalk", url: carryWalkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: attackVoice,
    created: { files: [select1Url, select2Url], volume: 1, maxVoices: 1 },
    death: { files: [deathVoice1Url, deathVoice2Url], volume: 1, maxVoices: 2 },
    specialAttack: attackVoice,
  },
} as const satisfies UnitMediaDefinition;
