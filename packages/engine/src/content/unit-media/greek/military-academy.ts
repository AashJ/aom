import { TYPE_GREEK_MILITARY_ACADEMY } from "@aom/sim";
import modelUrl from "../../../assets/models/greek-barracks-age1.glb?url";
import iconUrl from "../../../assets/barracks.png";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_MILITARY_ACADEMY,
  key: "greek-military-academy",
  presentation: {
    kind: "model",
    worldHeight: 4.2,
    bottomPadding: 0,
    actions: { idle: loop(["greekMilitaryAcademy"]) },
  },
  models: [{ key: "greekMilitaryAcademy", url: modelUrl, grounded: true }],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.barracks },
} as const satisfies UnitMediaDefinition;
