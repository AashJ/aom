import { TYPE_TREE } from "@aom/sim";
import spriteUrl from "../../../assets/tree-wood.png";
import { NO_AUDIO, NO_MODELS, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_TREE,
  key: "tree",
  presentation: {
    kind: "sprite",
    url: spriteUrl,
    frames: { kind: "variation", columns: 3 },
    worldHeight: 3.8,
    bottomPadding: 0,
  },
  models: NO_MODELS,
  icon: null,
  audio: NO_AUDIO,
} as const satisfies UnitMediaDefinition;
