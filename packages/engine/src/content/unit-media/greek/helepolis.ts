import { TYPE_HELEPOLIS } from "@aom/sim";
import acknowledgeUrl from "../../../assets/units/greek/helepolis/acknowledge.wav";
import attackModelUrl from "../../../assets/units/greek/helepolis/attack.glb?url";
import attackUrl from "../../../assets/units/greek/helepolis/attack.wav";
import createdUrl from "../../../assets/units/greek/helepolis/created.wav";
import deathModelUrl from "../../../assets/units/greek/helepolis/death.glb?url";
import deathUrl from "../../../assets/units/greek/helepolis/death.wav";
import iconUrl from "../../../assets/units/greek/helepolis/icon.png";
import idleUrl from "../../../assets/units/greek/helepolis/idle.glb?url";
import selectUrl from "../../../assets/units/greek/helepolis/select.wav";
import walkUrl from "../../../assets/units/greek/helepolis/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_HELEPOLIS,
  key: "greek-helepolis",
  presentation: {
    kind: "model",
    worldHeight: 3.4,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHelepolisIdle"]),
      walk: loop(["greekHelepolisWalk"]),
      attack: actionCycle(["greekHelepolisAttack"]),
      death: once(["greekHelepolisDeath"]),
    },
  },
  models: [
    { key: "greekHelepolisIdle", url: idleUrl, grounded: true },
    { key: "greekHelepolisWalk", url: walkUrl, grounded: true },
    { key: "greekHelepolisAttack", url: attackModelUrl, grounded: true },
    { key: "greekHelepolisDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selectUrl], volume: 1, maxVoices: 1 },
    acknowledge: { files: [acknowledgeUrl], volume: 1, maxVoices: 1 },
    attackAcknowledge: { files: [acknowledgeUrl], volume: 1, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
    attack: { files: [attackUrl], volume: 1, maxVoices: 2, delaySeconds: 0.44 },
  },
} as const satisfies UnitMediaDefinition;
