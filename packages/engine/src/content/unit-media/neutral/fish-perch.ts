import { TYPE_FISH_PERCH } from "@aom/sim";
import modelUrl from "../../../assets/units/neutral/fish-perch/idle.glb?url";
import { loop, NO_AUDIO, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_FISH_PERCH,
  key: "fish-perch",
  presentation: {
    kind: "model",
    worldHeight: 0.9,
    bottomPadding: 0,
    actions: {
      idle: loop(["fishPerch"]),
    },
  },
  models: [{ key: "fishPerch", url: modelUrl, grounded: false }],
  icon: null,
  audio: NO_AUDIO,
} as const satisfies UnitMediaDefinition;
