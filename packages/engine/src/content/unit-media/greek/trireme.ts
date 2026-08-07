import { TYPE_TRIREME } from "@aom/sim";
import attackUrl from "../../../assets/units/greek/trireme/attack.glb?url";
import createdUrl from "../../../assets/units/greek/trireme/created.wav";
import deathModelUrl from "../../../assets/units/greek/trireme/death.glb?url";
import deathUrl from "../../../assets/units/greek/trireme/death.wav";
import iconUrl from "../../../assets/units/greek/trireme/icon.png";
import idleUrl from "../../../assets/units/greek/trireme/idle.glb?url";
import move1Url from "../../../assets/units/greek/trireme/move1.wav";
import move2Url from "../../../assets/units/greek/trireme/move2.wav";
import move3Url from "../../../assets/units/greek/trireme/move3.wav";
import select1Url from "../../../assets/units/greek/trireme/select1.wav";
import select2Url from "../../../assets/units/greek/trireme/select2.wav";
import select3Url from "../../../assets/units/greek/trireme/select3.wav";
import walkUrl from "../../../assets/units/greek/trireme/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_TRIREME,
  key: "greek-trireme",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekTriremeIdle"]),
      walk: loop(["greekTriremeWalk"]),
      attack: actionCycle(["greekTriremeAttack"]),
      death: once(["greekTriremeDeath"]),
    },
  },
  models: [
    { key: "greekTriremeIdle", url: idleUrl, grounded: true },
    { key: "greekTriremeWalk", url: walkUrl, grounded: true },
    { key: "greekTriremeAttack", url: attackUrl, grounded: true },
    { key: "greekTriremeDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
