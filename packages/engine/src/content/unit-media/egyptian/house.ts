import { TYPE_EGYPTIAN_HOUSE } from "@aom/sim";
import modelUrl from "../../../assets/models/egyptian-house-age1.glb?url";
import iconUrl from "../../../assets/house.png";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_HOUSE,
  key: "egyptian-house",
  presentation: {
    kind: "model",
    worldHeight: 2.6,
    bottomPadding: 0,
    actions: { idle: loop(["egyptianHouse"]) },
  },
  models: [{ key: "egyptianHouse", url: modelUrl, grounded: true }],
  icon: { url: iconUrl, columns: 6 },
  audio: { completed: AUDIO_CUES.house },
} as const satisfies UnitMediaDefinition;
