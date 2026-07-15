import { TYPE_GREEK_ARCHERY_RANGE } from "@aom/sim";
import iconUrl from "../../../assets/buildings/greek/archery-range/icon.png";
import modelUrl from "../../../assets/models/greek-barracks-age1.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_ARCHERY_RANGE,
  key: "greek-archery-range",
  presentation: {
    kind: "model",
    worldHeight: 4.2,
    bottomPadding: 0,
    actions: { idle: loop(["greekArcheryRangeTemporaryModel"]) },
  },
  // The Classic Trial has the authoritative Archery Range proto and sound but
  // omits its Greek visual archive. Keep the stand-in isolated to this media
  // entry so a legally sourced Classic model is a one-file asset replacement.
  models: [{ key: "greekArcheryRangeTemporaryModel", url: modelUrl, grounded: true }],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.archeryRange, death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
