import { TYPE_RELIC } from "@aom/sim";
import iconUrl from "../../../assets/units/neutral/relic/icon.png";
import idleUrl from "../../../assets/units/neutral/relic/idle.glb?url";
import selectUrl from "../../../assets/units/neutral/relic/select.wav";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_RELIC,
  key: "relic",
  presentation: {
    kind: "model",
    worldHeight: 1.5,
    bottomPadding: 0,
    actions: { idle: loop(["relicIdle"]) },
  },
  models: [{ key: "relicIdle", url: idleUrl, grounded: true }],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selectUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
