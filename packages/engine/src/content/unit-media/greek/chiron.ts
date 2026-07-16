import { TYPE_CHIRON } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/chiron/acknowledge1.wav";
import acknowledge2Url from "../../../assets/units/greek/chiron/acknowledge2.wav";
import acknowledge3Url from "../../../assets/units/greek/chiron/acknowledge3.wav";
import acknowledge4Url from "../../../assets/units/greek/chiron/acknowledge4.wav";
import attackAUrl from "../../../assets/units/greek/chiron/attack-a.glb?url";
import attackAcknowledge1Url from "../../../assets/units/greek/chiron/attack-acknowledge1.wav";
import attackAcknowledge2Url from "../../../assets/units/greek/chiron/attack-acknowledge2.wav";
import attackBUrl from "../../../assets/units/greek/chiron/attack-b.glb?url";
import carryIdleUrl from "../../../assets/units/greek/chiron/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/chiron/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/chiron/creation.wav";
import deathUrl from "../../../assets/units/greek/chiron/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/chiron/death.wav";
import handArrowUrl from "../../../assets/units/greek/chiron/hand-arrow.glb?url";
import iconUrl from "../../../assets/units/greek/chiron/icon.png";
import idleUrl from "../../../assets/units/greek/chiron/idle.glb?url";
import select1Url from "../../../assets/units/greek/chiron/select1.wav";
import select2Url from "../../../assets/units/greek/chiron/select2.wav";
import select3Url from "../../../assets/units/greek/chiron/select3.wav";
import walkUrl from "../../../assets/units/greek/chiron/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const handArrow = [
  {
    model: "greekChironHandArrow",
    targetNode: "Dummy_righthand",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_CHIRON,
  key: "greek-chiron",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekChironIdle"]),
      walk: loop(["greekChironWalk"]),
      attack: actionCycle(["greekChironAttackA", "greekChironAttackB"]),
      death: once(["greekChironDeath"]),
      carryIdle: loop(["greekChironCarryIdle"]),
      carryWalk: loop(["greekChironCarryWalk"]),
    },
  },
  models: [
    { key: "greekChironIdle", url: idleUrl, grounded: true, attachments: handArrow },
    { key: "greekChironWalk", url: walkUrl, grounded: true, attachments: handArrow },
    { key: "greekChironAttackA", url: attackAUrl, grounded: true, attachments: handArrow },
    { key: "greekChironAttackB", url: attackBUrl, grounded: true, attachments: handArrow },
    { key: "greekChironDeath", url: deathUrl, grounded: true, attachments: handArrow },
    { key: "greekChironCarryIdle", url: carryIdleUrl, grounded: true, attachments: handArrow },
    { key: "greekChironCarryWalk", url: carryWalkUrl, grounded: true, attachments: handArrow },
    { key: "greekChironHandArrow", url: handArrowUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 2 },
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
