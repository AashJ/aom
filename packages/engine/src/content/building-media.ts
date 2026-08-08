import { AUDIO_CUES } from "../audio/assets";
import { loop, type UnitMediaDefinition } from "./unit-media-schema";

export interface SingleModelBuildingMediaOptions {
  readonly type: number;
  readonly key: string;
  readonly modelUrl: string;
  readonly iconUrl: string;
  readonly worldHeight: number;
}

export function singleModelBuildingMedia(
  options: SingleModelBuildingMediaOptions,
): UnitMediaDefinition {
  return {
    type: options.type,
    key: options.key,
    presentation: {
      kind: "model",
      worldHeight: options.worldHeight,
      bottomPadding: 0,
      actions: { idle: loop([options.key]) },
    },
    models: [{ key: options.key, url: options.modelUrl, grounded: true }],
    icon: { url: options.iconUrl, columns: 1 },
    audio: { death: AUDIO_CUES.buildingDeath },
  };
}
