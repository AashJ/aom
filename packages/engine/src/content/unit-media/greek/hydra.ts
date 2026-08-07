import { TYPE_HYDRA } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/hydra/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/hydra/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/hydra/attack-c.glb?url";
import attackDUrl from "../../../assets/units/greek/hydra/attack-d.glb?url";
import attackEUrl from "../../../assets/units/greek/hydra/attack-e.glb?url";
import deathAUrl from "../../../assets/units/greek/hydra/death-a.glb?url";
import deathBUrl from "../../../assets/units/greek/hydra/death-b.glb?url";
import deathCUrl from "../../../assets/units/greek/hydra/death-c.glb?url";
import deathDUrl from "../../../assets/units/greek/hydra/death-d.glb?url";
import deathEUrl from "../../../assets/units/greek/hydra/death-e.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/hydra/hydradeath.wav";
import createdUrl from "../../../assets/units/greek/hydra/hydragrunt1.wav";
import move1Url from "../../../assets/units/greek/hydra/hydramove1.wav";
import move2Url from "../../../assets/units/greek/hydra/hydramove2.wav";
import select1Url from "../../../assets/units/greek/hydra/hydraselect1.wav";
import select2Url from "../../../assets/units/greek/hydra/hydraselect2.wav";
import iconUrl from "../../../assets/units/greek/hydra/icon.png";
import idleAUrl from "../../../assets/units/greek/hydra/idle-a.glb?url";
import idleBUrl from "../../../assets/units/greek/hydra/idle-b.glb?url";
import idleCUrl from "../../../assets/units/greek/hydra/idle-c.glb?url";
import idleDUrl from "../../../assets/units/greek/hydra/idle-d.glb?url";
import idleEUrl from "../../../assets/units/greek/hydra/idle-e.glb?url";
import walkAUrl from "../../../assets/units/greek/hydra/walk-a.glb?url";
import walkBUrl from "../../../assets/units/greek/hydra/walk-b.glb?url";
import walkCUrl from "../../../assets/units/greek/hydra/walk-c.glb?url";
import walkDUrl from "../../../assets/units/greek/hydra/walk-d.glb?url";
import walkEUrl from "../../../assets/units/greek/hydra/walk-e.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 0.85,
  maxVoices: 3,
} as const;

export const definition = {
  type: TYPE_HYDRA,
  key: "greek-hydra",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(
        [
          "greekHydraIdleA",
          "greekHydraIdleB",
          "greekHydraIdleC",
          "greekHydraIdleD",
          "greekHydraIdleE",
        ],
        "experience-tier",
      ),
      walk: loop(
        [
          "greekHydraWalkA",
          "greekHydraWalkB",
          "greekHydraWalkC",
          "greekHydraWalkD",
          "greekHydraWalkE",
        ],
        "experience-tier",
      ),
      attack: actionCycle(
        [
          "greekHydraAttackA",
          "greekHydraAttackB",
          "greekHydraAttackC",
          "greekHydraAttackD",
          "greekHydraAttackE",
        ],
        "experience-tier",
      ),
      death: once(
        [
          "greekHydraDeathA",
          "greekHydraDeathB",
          "greekHydraDeathC",
          "greekHydraDeathD",
          "greekHydraDeathE",
        ],
        "experience-tier",
      ),
    },
  },
  models: [
    { key: "greekHydraIdleA", url: idleAUrl, grounded: true },
    { key: "greekHydraIdleB", url: idleBUrl, grounded: true },
    { key: "greekHydraIdleC", url: idleCUrl, grounded: true },
    { key: "greekHydraIdleD", url: idleDUrl, grounded: true },
    { key: "greekHydraIdleE", url: idleEUrl, grounded: true },
    { key: "greekHydraWalkA", url: walkAUrl, grounded: true },
    { key: "greekHydraWalkB", url: walkBUrl, grounded: true },
    { key: "greekHydraWalkC", url: walkCUrl, grounded: true },
    { key: "greekHydraWalkD", url: walkDUrl, grounded: true },
    { key: "greekHydraWalkE", url: walkEUrl, grounded: true },
    { key: "greekHydraAttackA", url: attackAUrl, grounded: true },
    { key: "greekHydraAttackB", url: attackBUrl, grounded: true },
    { key: "greekHydraAttackC", url: attackCUrl, grounded: true },
    { key: "greekHydraAttackD", url: attackDUrl, grounded: true },
    { key: "greekHydraAttackE", url: attackEUrl, grounded: true },
    { key: "greekHydraDeathA", url: deathAUrl, grounded: true },
    { key: "greekHydraDeathB", url: deathBUrl, grounded: true },
    { key: "greekHydraDeathC", url: deathCUrl, grounded: true },
    { key: "greekHydraDeathD", url: deathDUrl, grounded: true },
    { key: "greekHydraDeathE", url: deathEUrl, grounded: true },
  ],
  effects: [],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 3 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 3 },
  },
} as const satisfies UnitMediaDefinition;
