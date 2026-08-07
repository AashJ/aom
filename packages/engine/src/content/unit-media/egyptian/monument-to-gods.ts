import { GOD_ISIS, GOD_RA, GOD_SET, TYPE_EGYPTIAN_MONUMENT_TO_GODS } from "@aom/sim";
import iconUrl from "../../../assets/building-monument-five-icon.png";
import isisModelUrl from "../../../assets/models/egyptian-monument-to-gods-isis.glb?url";
import raModelUrl from "../../../assets/models/egyptian-monument-to-gods-ra.glb?url";
import setModelUrl from "../../../assets/models/egyptian-monument-to-gods-set.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import type { UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_MONUMENT_TO_GODS,
  key: "egyptian-monument-to-gods",
  presentation: {
    kind: "model",
    worldHeight: 7,
    bottomPadding: 0,
    actions: {
      idle: {
        models: [
          "egyptian-monument-to-gods-ra",
          "egyptian-monument-to-gods-isis",
          "egyptian-monument-to-gods-set",
        ],
        animationClock: "loop",
        variant: "major-god",
        variantValues: [GOD_RA, GOD_ISIS, GOD_SET],
      },
    },
  },
  models: [
    { key: "egyptian-monument-to-gods-ra", url: raModelUrl, grounded: true },
    { key: "egyptian-monument-to-gods-isis", url: isisModelUrl, grounded: true },
    { key: "egyptian-monument-to-gods-set", url: setModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
