import { TYPE_GREEK_CARAVAN } from "@aom/sim";
import createdUrl from "../../../assets/units/greek/caravan/created.wav";
import deathModelUrl from "../../../assets/units/greek/caravan/death.glb?url";
import deathUrl from "../../../assets/units/greek/caravan/death.wav";
import iconUrl from "../../../assets/units/greek/caravan/icon.png";
import idleUrl from "../../../assets/units/greek/caravan/idle.glb?url";
import loadedDeathUrl from "../../../assets/units/greek/caravan/loaded-death.glb?url";
import loadedIdleUrl from "../../../assets/units/greek/caravan/loaded-idle.glb?url";
import loadedWalkUrl from "../../../assets/units/greek/caravan/loaded-walk.glb?url";
import move1Url from "../../../assets/units/greek/caravan/move1.wav";
import move2Url from "../../../assets/units/greek/caravan/move2.wav";
import select1Url from "../../../assets/units/greek/caravan/select1.wav";
import select2Url from "../../../assets/units/greek/caravan/select2.wav";
import walkUrl from "../../../assets/units/greek/caravan/walk.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_CARAVAN,
  key: "greek-caravan",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekCaravanIdle", "greekCaravanLoadedIdle"], "inventory"),
      walk: loop(["greekCaravanWalk", "greekCaravanLoadedWalk"], "inventory"),
      death: once(["greekCaravanDeath", "greekCaravanLoadedDeath"], "inventory"),
    },
  },
  models: [
    { key: "greekCaravanIdle", url: idleUrl, grounded: true },
    { key: "greekCaravanLoadedIdle", url: loadedIdleUrl, grounded: true },
    { key: "greekCaravanWalk", url: walkUrl, grounded: true },
    { key: "greekCaravanLoadedWalk", url: loadedWalkUrl, grounded: true },
    { key: "greekCaravanDeath", url: deathModelUrl, grounded: true },
    { key: "greekCaravanLoadedDeath", url: loadedDeathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select2Url, select1Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url], volume: 0.85, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 0.8, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
