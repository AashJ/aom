import { TYPE_BELLEROPHON } from "@aom/sim";
import attack1Url from "../../../assets/units/greek/bellerophon/attack1.wav";
import attack2Url from "../../../assets/units/greek/bellerophon/attack2.wav";
import attack3Url from "../../../assets/units/greek/bellerophon/attack3.wav";
import attackUrl from "../../../assets/units/greek/bellerophon/attack.glb?url";
import carryIdleUrl from "../../../assets/units/greek/bellerophon/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/bellerophon/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/bellerophon/creation.wav";
import deathUrl from "../../../assets/units/greek/bellerophon/death.glb?url";
import iconUrl from "../../../assets/units/greek/bellerophon/icon.png";
import idleUrl from "../../../assets/units/greek/bellerophon/idle.glb?url";
import jumpUrl from "../../../assets/units/greek/bellerophon/jump.glb?url";
import move1Url from "../../../assets/units/greek/bellerophon/move1.wav";
import move2Url from "../../../assets/units/greek/bellerophon/move2.wav";
import move3Url from "../../../assets/units/greek/bellerophon/move3.wav";
import move4Url from "../../../assets/units/greek/bellerophon/move4.wav";
import select1Url from "../../../assets/units/greek/bellerophon/select1.wav";
import select2Url from "../../../assets/units/greek/bellerophon/select2.wav";
import select3Url from "../../../assets/units/greek/bellerophon/select3.wav";
import select4Url from "../../../assets/units/greek/bellerophon/select4.wav";
import walkUrl from "../../../assets/units/greek/bellerophon/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_BELLEROPHON,
  key: "greek-bellerophon",
  presentation: {
    kind: "model",
    worldHeight: 4.5,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekBellerophonIdle"]),
      walk: loop(["greekBellerophonWalk"]),
      attack: actionCycle(["greekBellerophonAttack"]),
      specialAttack: actionCycle(["greekBellerophonJump"]),
      death: once(["greekBellerophonDeath"]),
      carryIdle: loop(["greekBellerophonCarryIdle"]),
      carryWalk: loop(["greekBellerophonCarryWalk"]),
    },
  },
  models: [
    { key: "greekBellerophonIdle", url: idleUrl, grounded: true },
    { key: "greekBellerophonWalk", url: walkUrl, grounded: true },
    { key: "greekBellerophonAttack", url: attackUrl, grounded: true },
    { key: "greekBellerophonJump", url: jumpUrl, grounded: false },
    { key: "greekBellerophonDeath", url: deathUrl, grounded: true },
    { key: "greekBellerophonCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekBellerophonCarryWalk", url: carryWalkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [select1Url, select2Url, select3Url, select4Url],
      volume: 1,
      maxVoices: 1,
    },
    acknowledge: { files: [move1Url, move2Url, move3Url, move4Url], volume: 1, maxVoices: 1 },
    attackAcknowledge: {
      files: [attack1Url, attack2Url, attack3Url],
      volume: 1,
      maxVoices: 1,
    },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
