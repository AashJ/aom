import { TYPE_AJAX } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/ajax/acknowledge1.wav";
import acknowledge2Url from "../../../assets/units/greek/ajax/acknowledge2.wav";
import acknowledge3Url from "../../../assets/units/greek/ajax/acknowledge3.wav";
import attackUrl from "../../../assets/units/greek/ajax/attack.glb?url";
import attackAcknowledge1Url from "../../../assets/units/greek/ajax/attack-acknowledge1.wav";
import attackAcknowledge2Url from "../../../assets/units/greek/ajax/attack-acknowledge2.wav";
import carryIdleUrl from "../../../assets/units/greek/ajax/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/ajax/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/ajax/creation.wav";
import deathUrl from "../../../assets/units/greek/ajax/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/ajax/death.wav";
import iconUrl from "../../../assets/units/greek/ajax/icon.png";
import idleUrl from "../../../assets/units/greek/ajax/idle.glb?url";
import select1Url from "../../../assets/units/greek/ajax/select1.wav";
import select2Url from "../../../assets/units/greek/ajax/select2.wav";
import walkUrl from "../../../assets/units/greek/ajax/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_AJAX,
  key: "greek-ajax",
  presentation: {
    kind: "model",
    worldHeight: 2.5,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekAjaxIdle"]),
      walk: loop(["greekAjaxWalk"]),
      attack: actionCycle(["greekAjaxAttack"]),
      death: once(["greekAjaxDeath"]),
      carryIdle: loop(["greekAjaxCarryIdle"]),
      carryWalk: loop(["greekAjaxCarryWalk"]),
    },
  },
  models: [
    { key: "greekAjaxIdle", url: idleUrl, grounded: true },
    { key: "greekAjaxWalk", url: walkUrl, grounded: true },
    { key: "greekAjaxAttack", url: attackUrl, grounded: true },
    { key: "greekAjaxDeath", url: deathUrl, grounded: true },
    { key: "greekAjaxCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekAjaxCarryWalk", url: carryWalkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 2 },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackAcknowledge1Url, attackAcknowledge2Url],
      volume: 1,
      maxVoices: 1,
    },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
