import { TYPE_CARCINOS } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/carcinos/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/carcinos/attack-b.glb?url";
import created1Url from "../../../assets/units/greek/carcinos/created1.wav";
import created2Url from "../../../assets/units/greek/carcinos/created2.wav";
import deathModelUrl from "../../../assets/units/greek/carcinos/death.glb?url";
import deathUrl from "../../../assets/units/greek/carcinos/death.wav";
import iconUrl from "../../../assets/units/greek/carcinos/icon.png";
import idleUrl from "../../../assets/units/greek/carcinos/idle.glb?url";
import move1Url from "../../../assets/units/greek/carcinos/move1.wav";
import move2Url from "../../../assets/units/greek/carcinos/move2.wav";
import select1Url from "../../../assets/units/greek/carcinos/select1.wav";
import select2Url from "../../../assets/units/greek/carcinos/select2.wav";
import walkUrl from "../../../assets/units/greek/carcinos/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url], volume: 1, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_CARCINOS,
  key: "greek-carcinos",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekCarcinosIdle"]),
      walk: loop(["greekCarcinosWalk"]),
      attack: actionCycle(["greekCarcinosAttackA", "greekCarcinosAttackB"]),
      death: once(["greekCarcinosDeath"]),
    },
  },
  models: [
    { key: "greekCarcinosIdle", url: idleUrl, grounded: true },
    { key: "greekCarcinosWalk", url: walkUrl, grounded: true },
    { key: "greekCarcinosAttackA", url: attackAUrl, grounded: true },
    { key: "greekCarcinosAttackB", url: attackBUrl, grounded: true },
    { key: "greekCarcinosDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [created1Url, created2Url], volume: 0.9, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
