import { GOD_ISIS, GOD_RA, GOD_SET, TYPE_EGYPTIAN_WONDER } from "@aom/sim";
import iconUrl from "../../../assets/building-wonder-icon.png";
import isisModelUrl from "../../../assets/models/egyptian-wonder-isis.glb?url";
import raModelUrl from "../../../assets/models/egyptian-wonder.glb?url";
import setModelUrl from "../../../assets/models/egyptian-wonder-set.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import type { UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_WONDER,
  key: "egyptian-wonder",
  presentation: {
    kind: "model",
    worldHeight: 9,
    bottomPadding: 0,
    actions: {
      idle: {
        models: ["egyptian-wonder-ra", "egyptian-wonder-isis", "egyptian-wonder-set"],
        animationClock: "loop",
        variant: "major-god",
        variantValues: [GOD_RA, GOD_ISIS, GOD_SET],
      },
    },
  },
  models: [
    { key: "egyptian-wonder-ra", url: raModelUrl, grounded: true },
    { key: "egyptian-wonder-isis", url: isisModelUrl, grounded: true },
    { key: "egyptian-wonder-set", url: setModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
