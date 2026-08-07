import { TYPE_PHARAOH } from "@aom/sim";
import attackUrl from "../../../assets/units/egyptian/pharaoh/attack.glb?url";
import carryIdleUrl from "../../../assets/units/egyptian/pharaoh/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/egyptian/pharaoh/carry-walk.glb?url";
import deathUrl from "../../../assets/units/egyptian/pharaoh/death.glb?url";
import empowerUrl from "../../../assets/units/egyptian/pharaoh/empower.glb?url";
import createdUrl from "../../../assets/units/egyptian/pharaoh/herocreation.wav";
import healUrl from "../../../assets/units/egyptian/pharaoh/heal.glb?url";
import iconUrl from "../../../assets/units/egyptian/pharaoh/icon.png";
import idleUrl from "../../../assets/units/egyptian/pharaoh/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/pharaoh/phm1.wav";
import move2Url from "../../../assets/units/egyptian/pharaoh/phm2.wav";
import move3Url from "../../../assets/units/egyptian/pharaoh/phm3.wav";
import move4Url from "../../../assets/units/egyptian/pharaoh/phm4.wav";
import attack1Url from "../../../assets/units/egyptian/pharaoh/pha1.wav";
import attack2Url from "../../../assets/units/egyptian/pharaoh/pha2.wav";
import select1Url from "../../../assets/units/egyptian/pharaoh/phs1.wav";
import select2Url from "../../../assets/units/egyptian/pharaoh/phs2.wav";
import select3Url from "../../../assets/units/egyptian/pharaoh/phs3.wav";
import select4Url from "../../../assets/units/egyptian/pharaoh/phs4.wav";
import walkUrl from "../../../assets/units/egyptian/pharaoh/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url, move3Url, move4Url], volume: 1, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_PHARAOH,
  key: "egyptian-pharaoh",
  presentation: {
    kind: "model",
    worldHeight: 2.35,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianPharaohIdle"]),
      walk: loop(["egyptianPharaohWalk"]),
      attack: actionCycle(["egyptianPharaohAttack"]),
      heal: loop(["egyptianPharaohHeal"]),
      empower: loop(["egyptianPharaohEmpower"]),
      carryIdle: loop(["egyptianPharaohCarryIdle"]),
      carryWalk: loop(["egyptianPharaohCarryWalk"]),
      death: once(["egyptianPharaohDeath"]),
    },
  },
  models: [
    { key: "egyptianPharaohIdle", url: idleUrl, grounded: true },
    { key: "egyptianPharaohWalk", url: walkUrl, grounded: true },
    { key: "egyptianPharaohAttack", url: attackUrl, grounded: true },
    { key: "egyptianPharaohHeal", url: healUrl, grounded: true },
    { key: "egyptianPharaohEmpower", url: empowerUrl, grounded: true },
    { key: "egyptianPharaohCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "egyptianPharaohCarryWalk", url: carryWalkUrl, grounded: true },
    { key: "egyptianPharaohDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url, select4Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: { files: [attack1Url, attack2Url], volume: 1, maxVoices: 2 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
