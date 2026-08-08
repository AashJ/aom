import { GOD_HADES, GOD_POSEIDON, GOD_ZEUS, TYPE_GREEK_WONDER } from "@aom/sim";
import iconUrl from "../../../assets/building-wonder-icon.png";
import hadesModelUrl from "../../../assets/models/greek-wonder-hades.glb?url";
import poseidonModelUrl from "../../../assets/models/greek-wonder-poseidon.glb?url";
import zeusModelUrl from "../../../assets/models/greek-wonder.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import type { UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_WONDER,
  key: "greek-wonder",
  presentation: {
    kind: "model",
    worldHeight: 9,
    bottomPadding: 0,
    actions: {
      idle: {
        models: ["greek-wonder-zeus", "greek-wonder-poseidon", "greek-wonder-hades"],
        animationClock: "loop",
        variant: "major-god",
        variantValues: [GOD_ZEUS, GOD_POSEIDON, GOD_HADES],
      },
    },
  },
  models: [
    { key: "greek-wonder-zeus", url: zeusModelUrl, grounded: true },
    { key: "greek-wonder-poseidon", url: poseidonModelUrl, grounded: true },
    { key: "greek-wonder-hades", url: hadesModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
