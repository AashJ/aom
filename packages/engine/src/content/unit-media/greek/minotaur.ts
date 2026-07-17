import { TYPE_MINOTAUR } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/minotaur/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/minotaur/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/minotaur/attack-c.glb?url";
import axeUrl from "../../../assets/units/greek/minotaur/axe.glb?url";
import createdUrl from "../../../assets/units/greek/minotaur/created.wav";
import deathUrl from "../../../assets/units/greek/minotaur/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/minotaur/death.wav";
import goreUrl from "../../../assets/units/greek/minotaur/gore.glb?url";
import goreVoiceUrl from "../../../assets/units/greek/minotaur/gore.wav";
import iconUrl from "../../../assets/units/greek/minotaur/icon.png";
import idleUrl from "../../../assets/units/greek/minotaur/idle.glb?url";
import move1Url from "../../../assets/units/greek/minotaur/move1.wav";
import move2Url from "../../../assets/units/greek/minotaur/move2.wav";
import move3Url from "../../../assets/units/greek/minotaur/move3.wav";
import select1Url from "../../../assets/units/greek/minotaur/select1.wav";
import select2Url from "../../../assets/units/greek/minotaur/select2.wav";
import walkUrl from "../../../assets/units/greek/minotaur/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const axe = [
  {
    model: "greekMinotaurAxe",
    targetNode: "Dummy_righthand",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 0.85,
  maxVoices: 3,
} as const;

export const definition = {
  type: TYPE_MINOTAUR,
  key: "greek-minotaur",
  presentation: {
    kind: "model",
    worldHeight: 3.05,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekMinotaurIdle"]),
      walk: loop(["greekMinotaurWalk"]),
      attack: actionCycle(["greekMinotaurAttackA", "greekMinotaurAttackB", "greekMinotaurAttackC"]),
      specialAttack: actionCycle(["greekMinotaurGore"]),
      death: once(["greekMinotaurDeath"]),
    },
  },
  models: [
    { key: "greekMinotaurIdle", url: idleUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurWalk", url: walkUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurAttackA", url: attackAUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurAttackB", url: attackBUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurAttackC", url: attackCUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurGore", url: goreUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurDeath", url: deathUrl, grounded: true, attachments: axe },
    { key: "greekMinotaurAxe", url: axeUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.85, maxVoices: 3 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 0.85, maxVoices: 3 },
    specialAttack: { files: [goreVoiceUrl], volume: 0.85, maxVoices: 3 },
  },
} as const satisfies UnitMediaDefinition;
