import { TYPE_GREEK_TEMPLE } from "@aom/sim";
import modelUrl from "../../../assets/models/greek-temple-age0.glb?url";
import iconUrl from "../../../assets/barracks.png";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_TEMPLE,
  key: "greek-temple",
  presentation: {
    kind: "model",
    worldHeight: 4.8,
    bottomPadding: 0,
    actions: { idle: loop(["greekTemple"]) },
  },
  models: [{ key: "greekTemple", url: modelUrl, grounded: true }],
  icon: { url: iconUrl, columns: 1 },
  audio: {},
} as const satisfies UnitMediaDefinition;
