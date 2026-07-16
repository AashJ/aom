import { TYPE_ODYSSEUS } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/odysseus/acknowledge1.wav";
import acknowledge2Url from "../../../assets/units/greek/odysseus/acknowledge2.wav";
import acknowledge3Url from "../../../assets/units/greek/odysseus/acknowledge3.wav";
import acknowledge4Url from "../../../assets/units/greek/odysseus/acknowledge4.wav";
import attackUrl from "../../../assets/units/greek/odysseus/attack.glb?url";
import attackAcknowledge1Url from "../../../assets/units/greek/odysseus/attack-acknowledge1.wav";
import attackAcknowledge2Url from "../../../assets/units/greek/odysseus/attack-acknowledge2.wav";
import bowUrl from "../../../assets/units/greek/odysseus/bow.glb?url";
import carryIdleUrl from "../../../assets/units/greek/odysseus/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/odysseus/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/odysseus/creation.wav";
import deathUrl from "../../../assets/units/greek/odysseus/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/odysseus/death.wav";
import iconUrl from "../../../assets/units/greek/odysseus/icon.png";
import idleUrl from "../../../assets/units/greek/odysseus/idle.glb?url";
import select1Url from "../../../assets/units/greek/odysseus/select1.wav";
import select2Url from "../../../assets/units/greek/odysseus/select2.wav";
import select3Url from "../../../assets/units/greek/odysseus/select3.wav";
import select4Url from "../../../assets/units/greek/odysseus/select4.wav";
import walkUrl from "../../../assets/units/greek/odysseus/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const bow = [
  { model: "greekOdysseusBow", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_ODYSSEUS,
  key: "greek-odysseus",
  presentation: {
    kind: "model",
    worldHeight: 2.45,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekOdysseusIdle"]),
      walk: loop(["greekOdysseusWalk"]),
      attack: actionCycle(["greekOdysseusAttack"]),
      death: once(["greekOdysseusDeath"]),
      carryIdle: loop(["greekOdysseusCarryIdle"]),
      carryWalk: loop(["greekOdysseusCarryWalk"]),
    },
  },
  models: [
    { key: "greekOdysseusIdle", url: idleUrl, grounded: true, attachments: bow },
    { key: "greekOdysseusWalk", url: walkUrl, grounded: true, attachments: bow },
    { key: "greekOdysseusAttack", url: attackUrl, grounded: true, attachments: bow },
    { key: "greekOdysseusDeath", url: deathUrl, grounded: true, attachments: bow },
    { key: "greekOdysseusCarryIdle", url: carryIdleUrl, grounded: true, attachments: bow },
    { key: "greekOdysseusCarryWalk", url: carryWalkUrl, grounded: true, attachments: bow },
    { key: "greekOdysseusBow", url: bowUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [select1Url, select2Url, select3Url, select4Url],
      volume: 1,
      maxVoices: 2,
    },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url, acknowledge4Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackAcknowledge1Url, attackAcknowledge2Url],
      volume: 1,
      maxVoices: 1,
    },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
