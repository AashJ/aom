import { TYPE_EGYPTIAN_GATE } from "@aom/sim";
import iconUrl from "../../../assets/building-gate-icon.png";
import modelUrl from "../../../assets/models/egyptian-gate.glb?url";
import openModelUrl from "../../../assets/models/egyptian-gate-open.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_GATE,
  key: "egyptian-gate",
  presentation: {
    kind: "model",
    worldHeight: 3.5,
    bottomPadding: 0,
    actions: { idle: loop(["egyptian-gate", "egyptian-gate-open"], "gate-state") },
  },
  models: [
    { key: "egyptian-gate", url: modelUrl, grounded: true },
    { key: "egyptian-gate-open", url: openModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
