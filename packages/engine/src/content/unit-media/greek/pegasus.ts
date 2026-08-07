import { TYPE_PEGASUS } from "@aom/sim";
import createdUrl from "../../../assets/units/greek/pegasus/created.wav";
import deathModelUrl from "../../../assets/units/greek/pegasus/death.glb?url";
import deathUrl from "../../../assets/units/greek/pegasus/death.wav";
import iconUrl from "../../../assets/units/greek/pegasus/icon.png";
import idleUrl from "../../../assets/units/greek/pegasus/idle.glb?url";
import move1Url from "../../../assets/units/greek/pegasus/move1.wav";
import move2Url from "../../../assets/units/greek/pegasus/move2.wav";
import select1Url from "../../../assets/units/greek/pegasus/select1.wav";
import select2Url from "../../../assets/units/greek/pegasus/select2.wav";
import walkUrl from "../../../assets/units/greek/pegasus/walk.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url], volume: 1, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_PEGASUS,
  key: "greek-pegasus",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekPegasusIdle"]),
      walk: loop(["greekPegasusFly"]),
      death: once(["greekPegasusDeath"]),
    },
  },
  models: [
    { key: "greekPegasusIdle", url: idleUrl, grounded: false },
    { key: "greekPegasusFly", url: walkUrl, grounded: false },
    { key: "greekPegasusDeath", url: deathModelUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 2 },
    acknowledge,
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
