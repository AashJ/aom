import { TYPE_GREEK_FISHING_SHIP } from "@aom/sim";
import createdUrl from "../../../assets/units/greek/fishing-ship/created.wav";
import deathModelUrl from "../../../assets/units/greek/fishing-ship/death.glb?url";
import deathUrl from "../../../assets/units/greek/fishing-ship/death.wav";
import fishFlagUrl from "../../../assets/units/greek/fishing-ship/fish-flag.glb?url";
import fishUrl from "../../../assets/units/greek/fishing-ship/fish.glb?url";
import iconUrl from "../../../assets/units/greek/fishing-ship/icon.png";
import idleUrl from "../../../assets/units/greek/fishing-ship/idle.glb?url";
import move1Url from "../../../assets/units/greek/fishing-ship/move1.wav";
import move2Url from "../../../assets/units/greek/fishing-ship/move2.wav";
import move3Url from "../../../assets/units/greek/fishing-ship/move3.wav";
import select1Url from "../../../assets/units/greek/fishing-ship/select1.wav";
import select2Url from "../../../assets/units/greek/fishing-ship/select2.wav";
import select3Url from "../../../assets/units/greek/fishing-ship/select3.wav";
import select4Url from "../../../assets/units/greek/fishing-ship/select4.wav";
import walkUrl from "../../../assets/units/greek/fishing-ship/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_FISHING_SHIP,
  key: "greek-fishing-ship",
  presentation: {
    kind: "model",
    worldHeight: 2.1,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekFishingShipIdle"]),
      walk: loop(["greekFishingShipWalk"]),
      gatherFood: actionCycle(["greekFishingShipFish"]),
      carryWalk: loop(["greekFishingShipWalk"]),
      death: once(["greekFishingShipDeath"]),
    },
  },
  models: [
    { key: "greekFishingShipIdle", url: idleUrl, grounded: true },
    { key: "greekFishingShipWalk", url: walkUrl, grounded: true },
    {
      key: "greekFishingShipFish",
      url: fishUrl,
      grounded: true,
      attachments: [
        {
          model: "greekFishingShipFishFlag",
          targetNode: "Dummy_chin",
          hotspotNode: "Dummy_hotspot",
        },
      ],
    },
    { key: "greekFishingShipDeath", url: deathModelUrl, grounded: true },
    { key: "greekFishingShipFishFlag", url: fishFlagUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [select1Url, select2Url, select3Url, select4Url],
      volume: 1,
      maxVoices: 1,
    },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
