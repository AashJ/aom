import { TYPE_GREEK_HOUSE } from "@aom/sim";
import modelAUrl from "../../../assets/models/greek-house-a-age0.glb?url";
import modelBUrl from "../../../assets/models/greek-house-b-age0.glb?url";
import modelCUrl from "../../../assets/models/greek-house-c-age0.glb?url";
import constructionAUrl from "../../../assets/models/greek-house-construction-a.glb?url";
import constructionBUrl from "../../../assets/models/greek-house-construction-b.glb?url";
import constructionCUrl from "../../../assets/models/greek-house-construction-c.glb?url";
import iconUrl from "../../../assets/house.png";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_HOUSE,
  key: "greek-house",
  presentation: {
    kind: "model",
    worldHeight: 2.6,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHouseA", "greekHouseB", "greekHouseC"]),
      construction: loop(
        ["greekHouseConstructionA", "greekHouseConstructionB", "greekHouseConstructionC"],
        "construction-stage",
      ),
    },
  },
  models: [
    { key: "greekHouseA", url: modelAUrl, grounded: true },
    { key: "greekHouseB", url: modelBUrl, grounded: true },
    { key: "greekHouseC", url: modelCUrl, grounded: true },
    { key: "greekHouseConstructionA", url: constructionAUrl, grounded: true },
    { key: "greekHouseConstructionB", url: constructionBUrl, grounded: true },
    { key: "greekHouseConstructionC", url: constructionCUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 6 },
  audio: { completed: AUDIO_CUES.house },
} as const satisfies UnitMediaDefinition;
