import { TYPE_GOLD_MINE } from "@aom/sim";
import spriteUrl from "../../../assets/gold-mine.png";
import { NO_AUDIO, NO_MODELS, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GOLD_MINE,
  key: "gold-mine",
  presentation: {
    kind: "sprite",
    url: spriteUrl,
    frames: { kind: "depletion", columns: 4 },
    worldHeight: 2.8,
    bottomPadding: 0,
  },
  models: NO_MODELS,
  icon: null,
  audio: NO_AUDIO,
} as const satisfies UnitMediaDefinition;
