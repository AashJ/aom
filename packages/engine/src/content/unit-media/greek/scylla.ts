import { TYPE_SCYLLA } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/scylla/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/scylla/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/scylla/attack-c.glb?url";
import attackDUrl from "../../../assets/units/greek/scylla/attack-d.glb?url";
import attackEUrl from "../../../assets/units/greek/scylla/attack-e.glb?url";
import created1Url from "../../../assets/units/greek/scylla/created1.wav";
import created2Url from "../../../assets/units/greek/scylla/created2.wav";
import deathAUrl from "../../../assets/units/greek/scylla/death-a.glb?url";
import deathBUrl from "../../../assets/units/greek/scylla/death-b.glb?url";
import deathCUrl from "../../../assets/units/greek/scylla/death-c.glb?url";
import deathDUrl from "../../../assets/units/greek/scylla/death-d.glb?url";
import deathEUrl from "../../../assets/units/greek/scylla/death-e.glb?url";
import deathUrl from "../../../assets/units/greek/scylla/death.wav";
import iconUrl from "../../../assets/units/greek/scylla/icon.png";
import idleAUrl from "../../../assets/units/greek/scylla/idle-a.glb?url";
import idleBUrl from "../../../assets/units/greek/scylla/idle-b.glb?url";
import idleCUrl from "../../../assets/units/greek/scylla/idle-c.glb?url";
import idleDUrl from "../../../assets/units/greek/scylla/idle-d.glb?url";
import idleEUrl from "../../../assets/units/greek/scylla/idle-e.glb?url";
import move1Url from "../../../assets/units/greek/scylla/move1.wav";
import move2Url from "../../../assets/units/greek/scylla/move2.wav";
import select1Url from "../../../assets/units/greek/scylla/select1.wav";
import select2Url from "../../../assets/units/greek/scylla/select2.wav";
import walkAUrl from "../../../assets/units/greek/scylla/walk-a.glb?url";
import walkBUrl from "../../../assets/units/greek/scylla/walk-b.glb?url";
import walkCUrl from "../../../assets/units/greek/scylla/walk-c.glb?url";
import walkDUrl from "../../../assets/units/greek/scylla/walk-d.glb?url";
import walkEUrl from "../../../assets/units/greek/scylla/walk-e.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const experienceModels = (stem: string): readonly [string, ...string[]] => [
  `greekScylla${stem}A`,
  `greekScylla${stem}B`,
  `greekScylla${stem}C`,
  `greekScylla${stem}D`,
  `greekScylla${stem}E`,
];

const acknowledge = { files: [move1Url, move2Url], volume: 0.9, maxVoices: 2 } as const;

export const definition = {
  type: TYPE_SCYLLA,
  key: "greek-scylla",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(experienceModels("Idle"), "experience-tier"),
      walk: loop(experienceModels("Walk"), "experience-tier"),
      attack: actionCycle(experienceModels("Attack"), "experience-tier"),
      death: once(experienceModels("Death"), "experience-tier"),
    },
  },
  models: [
    { key: "greekScyllaIdleA", url: idleAUrl, grounded: true },
    { key: "greekScyllaIdleB", url: idleBUrl, grounded: true },
    { key: "greekScyllaIdleC", url: idleCUrl, grounded: true },
    { key: "greekScyllaIdleD", url: idleDUrl, grounded: true },
    { key: "greekScyllaIdleE", url: idleEUrl, grounded: true },
    { key: "greekScyllaWalkA", url: walkAUrl, grounded: true },
    { key: "greekScyllaWalkB", url: walkBUrl, grounded: true },
    { key: "greekScyllaWalkC", url: walkCUrl, grounded: true },
    { key: "greekScyllaWalkD", url: walkDUrl, grounded: true },
    { key: "greekScyllaWalkE", url: walkEUrl, grounded: true },
    { key: "greekScyllaAttackA", url: attackAUrl, grounded: true },
    { key: "greekScyllaAttackB", url: attackBUrl, grounded: true },
    { key: "greekScyllaAttackC", url: attackCUrl, grounded: true },
    { key: "greekScyllaAttackD", url: attackDUrl, grounded: true },
    { key: "greekScyllaAttackE", url: attackEUrl, grounded: true },
    { key: "greekScyllaDeathA", url: deathAUrl, grounded: true },
    { key: "greekScyllaDeathB", url: deathBUrl, grounded: true },
    { key: "greekScyllaDeathC", url: deathCUrl, grounded: true },
    { key: "greekScyllaDeathD", url: deathDUrl, grounded: true },
    { key: "greekScyllaDeathE", url: deathEUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [created1Url, created2Url], volume: 0.55, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
