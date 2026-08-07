import { TYPE_GREEK_TRANSPORT_SHIP } from "@aom/sim";
import createdUrl from "../../../assets/units/greek/transport-ship/created.wav";
import deathModelUrl from "../../../assets/units/greek/transport-ship/death.glb?url";
import deathUrl from "../../../assets/units/greek/transport-ship/death.wav";
import iconUrl from "../../../assets/units/greek/transport-ship/icon.png";
import idleUrl from "../../../assets/units/greek/transport-ship/idle.glb?url";
import move1Url from "../../../assets/units/greek/transport-ship/move1.wav";
import move2Url from "../../../assets/units/greek/transport-ship/move2.wav";
import move3Url from "../../../assets/units/greek/transport-ship/move3.wav";
import select1Url from "../../../assets/units/greek/transport-ship/select1.wav";
import select2Url from "../../../assets/units/greek/transport-ship/select2.wav";
import select3Url from "../../../assets/units/greek/transport-ship/select3.wav";
import walkUrl from "../../../assets/units/greek/transport-ship/walk.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_TRANSPORT_SHIP,
  key: "greek-transport-ship",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekTransportShipIdle"]),
      walk: loop(["greekTransportShipWalk"]),
      attack: loop(["greekTransportShipIdle"]),
      death: once(["greekTransportShipDeath"]),
    },
  },
  models: [
    { key: "greekTransportShipIdle", url: idleUrl, grounded: true },
    { key: "greekTransportShipWalk", url: walkUrl, grounded: true },
    { key: "greekTransportShipDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
