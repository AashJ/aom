import { TYPE_WAR_TURTLE } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/war-turtle/attack.glb?url";
import createdUrl from "../../../assets/units/egyptian/war-turtle/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/war-turtle/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/war-turtle/death.wav";
import iconUrl from "../../../assets/units/egyptian/war-turtle/icon.png";
import idleUrl from "../../../assets/units/egyptian/war-turtle/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/war-turtle/move1.wav";
import move2Url from "../../../assets/units/egyptian/war-turtle/move2.wav";
import select1Url from "../../../assets/units/egyptian/war-turtle/select1.wav";
import select2Url from "../../../assets/units/egyptian/war-turtle/select2.wav";
import snapUrl from "../../../assets/units/egyptian/war-turtle/snap.wav";
import specialUrl from "../../../assets/units/egyptian/war-turtle/special.glb?url";
import splashUrl from "../../../assets/units/egyptian/war-turtle/splash.wav";
import walkUrl from "../../../assets/units/egyptian/war-turtle/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url], volume: 1, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_WAR_TURTLE,
  key: "egyptian-war-turtle",
  presentation: {
    kind: "model",
    worldHeight: 3.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianWarTurtleIdle"]),
      walk: loop(["egyptianWarTurtleWalk"]),
      attack: actionCycle(["egyptianWarTurtleAttack"]),
      specialAttack: actionCycle(["egyptianWarTurtleSpecial"]),
      death: once(["egyptianWarTurtleDeath"]),
    },
  },
  models: [
    { key: "egyptianWarTurtleIdle", url: idleUrl, grounded: true },
    { key: "egyptianWarTurtleWalk", url: walkUrl, grounded: true },
    { key: "egyptianWarTurtleAttack", url: attackUrl, grounded: true },
    { key: "egyptianWarTurtleSpecial", url: specialUrl, grounded: true },
    { key: "egyptianWarTurtleDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
    attack: { files: [snapUrl], volume: 1, maxVoices: 3, delaySeconds: 0.55 * 1.65 },
    specialAttackLayers: [
      { files: [splashUrl], volume: 1, maxVoices: 3, delaySeconds: 0.41 * 1.5 },
      { files: [snapUrl], volume: 1, maxVoices: 3, delaySeconds: 0.75 * 1.5 },
    ],
  },
} as const satisfies UnitMediaDefinition;
