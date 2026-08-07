import { TYPE_EGYPTIAN_TRANSPORT_SHIP } from "@aom/sim";
import createdUrl from "../../../assets/units/egyptian/transport-ship/created.wav";
import deathModelUrl from "../../../assets/units/egyptian/transport-ship/death.glb?url";
import deathUrl from "../../../assets/units/egyptian/transport-ship/death.wav";
import iconUrl from "../../../assets/units/egyptian/transport-ship/icon.png";
import idleUrl from "../../../assets/units/egyptian/transport-ship/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/transport-ship/move1.wav";
import move2Url from "../../../assets/units/egyptian/transport-ship/move2.wav";
import move3Url from "../../../assets/units/egyptian/transport-ship/move3.wav";
import select1Url from "../../../assets/units/egyptian/transport-ship/select1.wav";
import select2Url from "../../../assets/units/egyptian/transport-ship/select2.wav";
import select3Url from "../../../assets/units/egyptian/transport-ship/select3.wav";
import walkUrl from "../../../assets/units/egyptian/transport-ship/walk.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_TRANSPORT_SHIP,
  key: "egyptian-transport-ship",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianTransportShipIdle"]),
      walk: loop(["egyptianTransportShipWalk"]),
      attack: loop(["egyptianTransportShipIdle"]),
      death: once(["egyptianTransportShipDeath"]),
    },
  },
  models: [
    { key: "egyptianTransportShipIdle", url: idleUrl, grounded: true },
    { key: "egyptianTransportShipWalk", url: walkUrl, grounded: true },
    { key: "egyptianTransportShipDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
