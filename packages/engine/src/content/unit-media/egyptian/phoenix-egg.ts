import { TYPE_PHOENIX_EGG } from "@aom/sim";
import deathModelUrl from "../../../assets/units/egyptian/phoenix-egg/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/phoenix-egg/death.wav";
import iconUrl from "../../../assets/units/egyptian/phoenix-egg/icon.png";
import idleUrl from "../../../assets/units/egyptian/phoenix-egg/idle.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_PHOENIX_EGG,
  key: "egyptian-phoenix-egg",
  presentation: {
    kind: "model",
    worldHeight: 1.5,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianPhoenixEggIdle"]),
      death: once(["egyptianPhoenixEggDeath"]),
    },
  },
  models: [
    { key: "egyptianPhoenixEggIdle", url: idleUrl, grounded: true },
    { key: "egyptianPhoenixEggDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    death: { files: [deathUrl], volume: 0.65, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
