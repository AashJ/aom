import { TYPE_GREEK_GATE } from "@aom/sim";
import iconUrl from "../../../assets/building-gate-icon.png";
import modelUrl from "../../../assets/models/greek-gate.glb?url";
import openModelUrl from "../../../assets/models/greek-gate-open.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_GATE,
  key: "greek-gate",
  presentation: {
    kind: "model",
    worldHeight: 3.5,
    bottomPadding: 0,
    actions: { idle: loop(["greek-gate", "greek-gate-open"], "gate-state") },
  },
  models: [
    { key: "greek-gate", url: modelUrl, grounded: true },
    { key: "greek-gate-open", url: openModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: { death: AUDIO_CUES.buildingDeath },
} as const satisfies UnitMediaDefinition;
