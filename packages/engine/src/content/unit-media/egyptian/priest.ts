import { TYPE_PRIEST } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/priest/attack.glb?url";
import convertUrl from "../../../assets/units/egyptian/priest/convert.glb?url";
import deathUrl from "../../../assets/units/egyptian/priest/death.glb?url";
import empowerUrl from "../../../assets/units/egyptian/priest/empower.glb?url";
import createdUrl from "../../../assets/units/egyptian/priest/herocreation.wav";
import iconUrl from "../../../assets/units/egyptian/priest/icon.png";
import idleUrl from "../../../assets/units/egyptian/priest/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/priest/priestmove1.wav";
import move2Url from "../../../assets/units/egyptian/priest/priestmove2.wav";
import move3Url from "../../../assets/units/egyptian/priest/priestmove3.wav";
import select1Url from "../../../assets/units/egyptian/priest/priestselect1.wav";
import select2Url from "../../../assets/units/egyptian/priest/priestselect2.wav";
import select3Url from "../../../assets/units/egyptian/priest/priestselect3.wav";
import walkUrl from "../../../assets/units/egyptian/priest/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url, move3Url], volume: 1, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_PRIEST,
  key: "egyptian-priest",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianPriestIdle"]),
      walk: loop(["egyptianPriestWalk"]),
      attack: actionCycle(["egyptianPriestAttack"]),
      heal: loop(["egyptianPriestEmpower"]),
      empower: loop(["egyptianPriestEmpower"]),
      convert: loop(["egyptianPriestConvert"]),
      death: once(["egyptianPriestDeath"]),
    },
  },
  models: [
    { key: "egyptianPriestIdle", url: idleUrl, grounded: true },
    { key: "egyptianPriestWalk", url: walkUrl, grounded: true },
    { key: "egyptianPriestAttack", url: attackUrl, grounded: true },
    { key: "egyptianPriestEmpower", url: empowerUrl, grounded: true },
    { key: "egyptianPriestConvert", url: convertUrl, grounded: true },
    { key: "egyptianPriestDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
