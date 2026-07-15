import { TYPE_GREEK_TOWN_CENTER } from "@aom/sim";
import modelUrl from "../../../assets/models/greek-town-center-age0.glb?url";
import iconUrl from "../../../assets/town-center.png";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_TOWN_CENTER,
  key: "greek-town-center",
  presentation: {
    kind: "model",
    worldHeight: 5.5,
    bottomPadding: 0,
    actions: { idle: loop(["greekTownCenter"]) },
  },
  models: [{ key: "greekTownCenter", url: modelUrl, grounded: true }],
  icon: { url: iconUrl, columns: 1 },
  audio: { completed: AUDIO_CUES.settlement },
} as const satisfies UnitMediaDefinition;
