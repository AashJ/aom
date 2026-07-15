import { TYPE_EGYPTIAN_TEMPLE } from "@aom/sim";
import iconUrl from "../../../assets/barracks.png";
import spriteUrl from "../../../assets/barracks.png";
import { NO_MODELS, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_TEMPLE,
  key: "egyptian-temple",
  presentation: {
    kind: "sprite",
    url: spriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 4.8,
    bottomPadding: 0,
  },
  models: NO_MODELS,
  icon: { url: iconUrl, columns: 1 },
  audio: {},
} as const satisfies UnitMediaDefinition;
