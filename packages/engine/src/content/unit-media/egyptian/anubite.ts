import { TYPE_ANUBITE } from "@aom/sim";
import mythCreateUrl from "../../../assets/audio/units/mythcreate.wav";
import attackAUrl from "../../../assets/units/egyptian/anubite/attack-a.glb?url";
import attackBUrl from "../../../assets/units/egyptian/anubite/attack-b.glb?url";
import deathModelUrl from "../../../assets/units/egyptian/anubite/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/anubite/death.wav";
import iconUrl from "../../../assets/units/egyptian/anubite/icon.png";
import idleUrl from "../../../assets/units/egyptian/anubite/idle.glb?url";
import jumpFlyUrl from "../../../assets/units/egyptian/anubite/jump-fly.glb?url";
import jumpLandUrl from "../../../assets/units/egyptian/anubite/jump-land.glb?url";
import jumpTakeoffUrl from "../../../assets/units/egyptian/anubite/jump-takeoff.glb?url";
import move1Url from "../../../assets/units/egyptian/anubite/move1.wav";
import move2Url from "../../../assets/units/egyptian/anubite/move2.wav";
import runUrl from "../../../assets/units/egyptian/anubite/run.glb?url";
import select1Url from "../../../assets/units/egyptian/anubite/select1.wav";
import select2Url from "../../../assets/units/egyptian/anubite/select2.wav";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 1,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_ANUBITE,
  key: "egyptian-anubite",
  presentation: {
    kind: "model",
    worldHeight: 2.75,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianAnubiteIdle"]),
      walk: loop(["egyptianAnubiteRun"]),
      attack: actionCycle(["egyptianAnubiteAttackA", "egyptianAnubiteAttackB"]),
      jumpTakeoff: actionCycle(["egyptianAnubiteJumpTakeoff"]),
      specialAttack: actionCycle(["egyptianAnubiteJumpFly"]),
      jumpLand: actionCycle(["egyptianAnubiteJumpLand"]),
      death: once(["egyptianAnubiteDeath"]),
    },
  },
  models: [
    { key: "egyptianAnubiteIdle", url: idleUrl, grounded: true },
    { key: "egyptianAnubiteRun", url: runUrl, grounded: true },
    { key: "egyptianAnubiteAttackA", url: attackAUrl, grounded: true },
    { key: "egyptianAnubiteAttackB", url: attackBUrl, grounded: true },
    { key: "egyptianAnubiteJumpTakeoff", url: jumpTakeoffUrl, grounded: true },
    { key: "egyptianAnubiteJumpFly", url: jumpFlyUrl, grounded: false },
    { key: "egyptianAnubiteJumpLand", url: jumpLandUrl, grounded: true },
    { key: "egyptianAnubiteDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [mythCreateUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
