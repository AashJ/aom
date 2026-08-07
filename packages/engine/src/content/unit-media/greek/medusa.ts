import { TYPE_MEDUSA } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/medusa/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/medusa/attack-b.glb?url";
import deathUrl from "../../../assets/units/greek/medusa/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/medusa/medusadie.wav";
import grunt1Url from "../../../assets/units/greek/medusa/medusagrunt1.wav";
import grunt2Url from "../../../assets/units/greek/medusa/medusagrunt2.wav";
import headGlowUrl from "../../../assets/units/greek/medusa/head-glow.png";
import iconUrl from "../../../assets/units/greek/medusa/icon.png";
import idleUrl from "../../../assets/units/greek/medusa/idle.glb?url";
import move1Url from "../../../assets/units/greek/medusa/medusamove1.wav";
import move2Url from "../../../assets/units/greek/medusa/medusamove2.wav";
import petrifyUrl from "../../../assets/units/greek/medusa/petrify.glb?url";
import petrifyVoiceUrl from "../../../assets/units/greek/medusa/medusastone.wav";
import select1Url from "../../../assets/units/greek/medusa/medusaselect1.wav";
import select2Url from "../../../assets/units/greek/medusa/medusaselect2.wav";
import snakeAUrl from "../../../assets/units/greek/medusa/snake-a.glb?url";
import snakeBUrl from "../../../assets/units/greek/medusa/snake-b.glb?url";
import walkUrl from "../../../assets/units/greek/medusa/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const snakes = [
  { model: "greekMedusaSnakeA", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  { model: "greekMedusaSnakeB", targetNode: "Dummy_attachpoint", hotspotNode: "Dummy_hotspot" },
] as const;

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 1,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_MEDUSA,
  key: "greek-medusa",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekMedusaIdle"]),
      walk: loop(["greekMedusaWalk"]),
      attack: actionCycle(["greekMedusaAttackA", "greekMedusaAttackB"]),
      specialAttack: actionCycle(["greekMedusaPetrify"]),
      death: once(["greekMedusaDeath"]),
    },
  },
  models: [
    { key: "greekMedusaIdle", url: idleUrl, grounded: true, attachments: snakes },
    { key: "greekMedusaWalk", url: walkUrl, grounded: true, attachments: snakes },
    { key: "greekMedusaAttackA", url: attackAUrl, grounded: true, attachments: snakes },
    { key: "greekMedusaAttackB", url: attackBUrl, grounded: true, attachments: snakes },
    { key: "greekMedusaPetrify", url: petrifyUrl, grounded: true, attachments: snakes },
    { key: "greekMedusaDeath", url: deathUrl, grounded: true, attachments: snakes },
    { key: "greekMedusaSnakeA", url: snakeAUrl, grounded: false },
    { key: "greekMedusaSnakeB", url: snakeBUrl, grounded: false },
  ],
  effects: [
    {
      key: "greekMedusaHeadGlow",
      trigger: "special-attack",
      textureUrl: headGlowUrl,
    },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [grunt1Url, grunt2Url], volume: 0.8, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 1 },
    specialAttack: { files: [petrifyVoiceUrl], volume: 1, maxVoices: 2 },
  },
} as const satisfies UnitMediaDefinition;
