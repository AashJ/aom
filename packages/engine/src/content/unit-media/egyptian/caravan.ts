import { TYPE_EGYPTIAN_CARAVAN } from "@aom/sim";
import createdUrl from "../../../assets/units/egyptian/caravan/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/caravan/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/caravan/death.wav";
import iconUrl from "../../../assets/units/egyptian/caravan/icon.png";
import idleUrl from "../../../assets/units/egyptian/caravan/idle.glb?url";
import loadedDeathUrl from "../../../assets/units/egyptian/caravan/loaded-death.glb?url";
import loadedIdleUrl from "../../../assets/units/egyptian/caravan/loaded-idle.glb?url";
import loadedWalkUrl from "../../../assets/units/egyptian/caravan/loaded-walk.glb?url";
import move1Url from "../../../assets/units/egyptian/caravan/move1.wav";
import move2Url from "../../../assets/units/egyptian/caravan/move2.wav";
import select1Url from "../../../assets/units/egyptian/caravan/select1.wav";
import select2Url from "../../../assets/units/egyptian/caravan/select2.wav";
import walkUrl from "../../../assets/units/egyptian/caravan/walk.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_CARAVAN,
  key: "egyptian-caravan",
  presentation: {
    kind: "model",
    worldHeight: 2.6,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianCaravanIdle", "egyptianCaravanLoadedIdle"], "inventory"),
      walk: loop(["egyptianCaravanWalk", "egyptianCaravanLoadedWalk"], "inventory"),
      death: once(["egyptianCaravanDeath", "egyptianCaravanLoadedDeath"], "inventory"),
    },
  },
  models: [
    { key: "egyptianCaravanIdle", url: idleUrl, grounded: true },
    { key: "egyptianCaravanLoadedIdle", url: loadedIdleUrl, grounded: true },
    { key: "egyptianCaravanWalk", url: walkUrl, grounded: true },
    { key: "egyptianCaravanLoadedWalk", url: loadedWalkUrl, grounded: true },
    { key: "egyptianCaravanDeath", url: deathModelUrl, grounded: true },
    { key: "egyptianCaravanLoadedDeath", url: loadedDeathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.85, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url], volume: 0.85, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 0.85, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
