import { TYPE_EGYPTIAN_SIEGE_WORKS } from "@aom/sim";
import deathUrl from "../../../assets/units/egyptian/siege-works/death.glb?url";
import iconUrl from "../../../assets/units/egyptian/siege-works/icon.png";
import idleUrl from "../../../assets/units/egyptian/siege-works/idle.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_SIEGE_WORKS,
  key: "egyptian-siege-works",
  presentation: {
    kind: "model",
    worldHeight: 7,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianSiegeWorksIdle"]),
      death: once(["egyptianSiegeWorksDeath"]),
    },
  },
  models: [
    { key: "egyptianSiegeWorksIdle", url: idleUrl, grounded: true },
    { key: "egyptianSiegeWorksDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.fortress, death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
