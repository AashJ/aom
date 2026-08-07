import { TYPE_PERSEUS } from "@aom/sim";
import attack1Url from "../../../assets/units/greek/perseus/attack1.wav";
import attack2Url from "../../../assets/units/greek/perseus/attack2.wav";
import attack3Url from "../../../assets/units/greek/perseus/attack3.wav";
import attackUrl from "../../../assets/units/greek/perseus/attack.glb?url";
import carryIdleUrl from "../../../assets/units/greek/perseus/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/perseus/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/perseus/creation.wav";
import deathUrl from "../../../assets/units/greek/perseus/death.glb?url";
import iconUrl from "../../../assets/units/greek/perseus/icon.png";
import idleUrl from "../../../assets/units/greek/perseus/idle.glb?url";
import medusaHeadUrl from "../../../assets/units/greek/perseus/medusa-head.glb?url";
import move1Url from "../../../assets/units/greek/perseus/move1.wav";
import move2Url from "../../../assets/units/greek/perseus/move2.wav";
import move3Url from "../../../assets/units/greek/perseus/move3.wav";
import move4Url from "../../../assets/units/greek/perseus/move4.wav";
import petrifyUrl from "../../../assets/units/greek/perseus/petrify.glb?url";
import petrifyVoiceUrl from "../../../assets/units/greek/perseus/petrify.wav";
import select1Url from "../../../assets/units/greek/perseus/select1.wav";
import select2Url from "../../../assets/units/greek/perseus/select2.wav";
import select3Url from "../../../assets/units/greek/perseus/select3.wav";
import select4Url from "../../../assets/units/greek/perseus/select4.wav";
import snakeAUrl from "../../../assets/units/greek/perseus/snake-a.glb?url";
import snakeBUrl from "../../../assets/units/greek/perseus/snake-b.glb?url";
import walkUrl from "../../../assets/units/greek/perseus/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const headAttachment = [
  { model: "greekPerseusMedusaHead", targetNode: "Dummy_lefthand", hotspotNode: "Dummy_hotspot" },
] as const;

export const definition = {
  type: TYPE_PERSEUS,
  key: "greek-perseus",
  presentation: {
    kind: "model",
    worldHeight: 2.5,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekPerseusIdle"]),
      walk: loop(["greekPerseusWalk"]),
      attack: actionCycle(["greekPerseusAttack"]),
      specialAttack: actionCycle(["greekPerseusPetrify"]),
      death: once(["greekPerseusDeath"]),
      carryIdle: loop(["greekPerseusCarryIdle"]),
      carryWalk: loop(["greekPerseusCarryWalk"]),
    },
  },
  models: [
    { key: "greekPerseusIdle", url: idleUrl, grounded: true, attachments: headAttachment },
    { key: "greekPerseusWalk", url: walkUrl, grounded: true, attachments: headAttachment },
    { key: "greekPerseusAttack", url: attackUrl, grounded: true, attachments: headAttachment },
    { key: "greekPerseusPetrify", url: petrifyUrl, grounded: true, attachments: headAttachment },
    { key: "greekPerseusDeath", url: deathUrl, grounded: true, attachments: headAttachment },
    {
      key: "greekPerseusCarryIdle",
      url: carryIdleUrl,
      grounded: true,
      attachments: headAttachment,
    },
    {
      key: "greekPerseusCarryWalk",
      url: carryWalkUrl,
      grounded: true,
      attachments: headAttachment,
    },
    {
      key: "greekPerseusMedusaHead",
      url: medusaHeadUrl,
      grounded: false,
      attachments: [
        {
          model: "greekPerseusSnakeA",
          targetNode: "Dummy_topofhead",
          hotspotNode: "Dummy_hotspot",
        },
        {
          model: "greekPerseusSnakeB",
          targetNode: "Dummy_attachpoint",
          hotspotNode: "Dummy_hotspot",
        },
      ],
    },
    { key: "greekPerseusSnakeA", url: snakeAUrl, grounded: false },
    { key: "greekPerseusSnakeB", url: snakeBUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [select1Url, select2Url, select3Url, select4Url],
      volume: 1,
      maxVoices: 1,
    },
    acknowledge: { files: [move1Url, move2Url, move3Url, move4Url], volume: 1, maxVoices: 1 },
    attackAcknowledge: { files: [attack1Url, attack2Url, attack3Url], volume: 1, maxVoices: 1 },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: AUDIO_CUES.maleDeath,
    specialAttack: { files: [petrifyVoiceUrl], volume: 1, maxVoices: 2 },
  },
} as const satisfies UnitMediaDefinition;
