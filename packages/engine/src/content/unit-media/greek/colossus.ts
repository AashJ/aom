import { TYPE_COLOSSUS } from "@aom/sim";
import attack1Url from "../../../assets/units/greek/colossus/attack1.wav";
import attack2Url from "../../../assets/units/greek/colossus/attack2.wav";
import attack3Url from "../../../assets/units/greek/colossus/attack3.wav";
import attack4Url from "../../../assets/units/greek/colossus/attack4.wav";
import attackAUrl from "../../../assets/units/greek/colossus/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/colossus/attack-b.glb?url";
import createdUrl from "../../../assets/units/greek/colossus/created.wav";
import deathUrl from "../../../assets/units/greek/colossus/death.glb?url";
import death1Url from "../../../assets/units/greek/colossus/death1.wav";
import death2Url from "../../../assets/units/greek/colossus/death2.wav";
import eatUrl from "../../../assets/units/greek/colossus/eat.glb?url";
import eatSoundUrl from "../../../assets/units/greek/colossus/eat.wav";
import iconUrl from "../../../assets/units/greek/colossus/icon.png";
import idleUrl from "../../../assets/units/greek/colossus/idle.glb?url";
import move1Url from "../../../assets/units/greek/colossus/move1.wav";
import move2Url from "../../../assets/units/greek/colossus/move2.wav";
import move3Url from "../../../assets/units/greek/colossus/move3.wav";
import select1Url from "../../../assets/units/greek/colossus/select1.wav";
import select2Url from "../../../assets/units/greek/colossus/select2.wav";
import select3Url from "../../../assets/units/greek/colossus/select3.wav";
import walkUrl from "../../../assets/units/greek/colossus/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = { files: [move1Url, move2Url, move3Url], volume: 1, maxVoices: 1 } as const;
const attackVoice = {
  files: [attack1Url, attack2Url, attack3Url, attack4Url],
  volume: 1,
  maxVoices: 1,
} as const;
const eatCue = { files: [eatSoundUrl], volume: 1, maxVoices: 1 } as const;

export const definition = {
  type: TYPE_COLOSSUS,
  key: "greek-colossus",
  presentation: {
    kind: "model",
    worldHeight: 4.3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekColossusIdle"]),
      walk: loop(["greekColossusWalk"]),
      attack: actionCycle(["greekColossusAttackA", "greekColossusAttackB"]),
      gatherWood: loop(["greekColossusEat"]),
      gatherGold: loop(["greekColossusEat"]),
      death: once(["greekColossusDeath"]),
    },
  },
  models: [
    { key: "greekColossusIdle", url: idleUrl, grounded: true },
    { key: "greekColossusWalk", url: walkUrl, grounded: true },
    { key: "greekColossusAttackA", url: attackAUrl, grounded: true },
    { key: "greekColossusAttackB", url: attackBUrl, grounded: true },
    { key: "greekColossusEat", url: eatUrl, grounded: true },
    { key: "greekColossusDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: attackVoice,
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [death1Url, death2Url], volume: 1, maxVoices: 1 },
    gatherWood: eatCue,
    gatherGold: eatCue,
  },
} as const satisfies UnitMediaDefinition;
