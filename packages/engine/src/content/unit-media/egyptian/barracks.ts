import { TYPE_EGYPTIAN_BARRACKS } from "@aom/sim";
import iconUrl from "../../../assets/barracks.png";
import spriteUrl from "../../../assets/barracks.png";
import { AUDIO_CUES } from "../../../audio/assets";
import { NO_MODELS, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_BARRACKS,
  key: "egyptian-barracks",
  presentation: {
    kind: "sprite",
    url: spriteUrl,
    frames: { kind: "fixed", columns: 1 },
    worldHeight: 4.2,
    bottomPadding: 0,
  },
  models: NO_MODELS,
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.barracks },
} as const satisfies UnitMediaDefinition;
