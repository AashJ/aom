import { TYPE_ROC } from "@aom/sim";
import createdUrl from "../../../assets/units/egyptian/roc/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/roc/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/roc/death.wav";
import iconUrl from "../../../assets/units/egyptian/roc/icon.png";
import idleUrl from "../../../assets/units/egyptian/roc/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/roc/move1.wav";
import move2Url from "../../../assets/units/egyptian/roc/move2.wav";
import select1Url from "../../../assets/units/egyptian/roc/select1.wav";
import select2Url from "../../../assets/units/egyptian/roc/select2.wav";
import walkUrl from "../../../assets/units/egyptian/roc/walk.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url], volume: 0.6, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_ROC,
  key: "egyptian-roc",
  presentation: {
    kind: "model",
    worldHeight: 5.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianRocIdle"]),
      walk: loop(["egyptianRocWalk"]),
      death: once(["egyptianRocDeath"]),
    },
  },
  models: [
    { key: "egyptianRocIdle", url: idleUrl, grounded: false },
    { key: "egyptianRocWalk", url: walkUrl, grounded: false },
    { key: "egyptianRocDeath", url: deathModelUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.6, maxVoices: 2 },
    acknowledge,
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathUrl], volume: 0.7, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
