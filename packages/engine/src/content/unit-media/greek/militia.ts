import { TYPE_MILITIA } from "@aom/sim";
import idleUrl from "../../../assets/models/infantry-g-militia-idle.glb?url";
import walkUrl from "../../../assets/models/infantry-g-militia-walk.glb?url";
import iconUrl from "../../../assets/militia-walk.png";
import { AUDIO_CUES } from "../../../audio/assets";
import { loop, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_MILITIA,
  key: "militia",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["militiaIdle"]),
      walk: loop(["militiaWalk"]),
    },
  },
  models: [
    { key: "militiaIdle", url: idleUrl, grounded: true },
    { key: "militiaWalk", url: walkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 7 },
  audio: {
    selection: AUDIO_CUES.villagerSelect,
    acknowledge: AUDIO_CUES.villagerAcknowledge,
    attackAcknowledge: AUDIO_CUES.villagerAttack,
    created: AUDIO_CUES.militaryCreate,
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
