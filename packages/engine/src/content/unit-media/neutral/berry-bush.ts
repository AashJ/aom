import { TYPE_BERRY } from "@aom/sim";
import spriteUrl from "../../../assets/berry-bush.png";
import { NO_AUDIO, NO_MODELS, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_BERRY,
  key: "berry-bush",
  presentation: {
    kind: "sprite",
    url: spriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 1.3,
    bottomPadding: 0,
  },
  models: NO_MODELS,
  icon: null,
  audio: NO_AUDIO,
} as const satisfies UnitMediaDefinition;
