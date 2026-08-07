import { TYPE_EGYPTIAN_FISHING_SHIP } from "@aom/sim";
import createdUrl from "../../../assets/units/egyptian/fishing-ship/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/fishing-ship/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/fishing-ship/death.wav";
import fishFlagUrl from "../../../assets/units/egyptian/fishing-ship/fish-flag.glb?url";
import fishUrl from "../../../assets/units/egyptian/fishing-ship/fish.glb?url";
import iconUrl from "../../../assets/units/egyptian/fishing-ship/icon.png";
import idleUrl from "../../../assets/units/egyptian/fishing-ship/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/fishing-ship/move1.wav";
import move2Url from "../../../assets/units/egyptian/fishing-ship/move2.wav";
import move3Url from "../../../assets/units/egyptian/fishing-ship/move3.wav";
import walkUrl from "../../../assets/units/egyptian/fishing-ship/walk.glb?url";
import { EGYPTIAN_VILLAGER_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_FISHING_SHIP,
  key: "egyptian-fishing-ship",
  presentation: {
    kind: "model",
    worldHeight: 2.1,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianFishingShipIdle"]),
      walk: loop(["egyptianFishingShipWalk"]),
      gatherFood: actionCycle(["egyptianFishingShipFish"]),
      carryWalk: loop(["egyptianFishingShipWalk"]),
      death: once(["egyptianFishingShipDeath"]),
    },
  },
  models: [
    { key: "egyptianFishingShipIdle", url: idleUrl, grounded: true },
    { key: "egyptianFishingShipWalk", url: walkUrl, grounded: true },
    {
      key: "egyptianFishingShipFish",
      url: fishUrl,
      grounded: true,
      attachments: [
        {
          model: "egyptianFishingShipFishFlag",
          targetNode: "Dummy_chin",
          hotspotNode: "Dummy_hotspot",
        },
      ],
    },
    { key: "egyptianFishingShipDeath", url: deathModelUrl, grounded: true },
    { key: "egyptianFishingShipFishFlag", url: fishFlagUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: EGYPTIAN_VILLAGER_CUES.villagerSelect,
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
