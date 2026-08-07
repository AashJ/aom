import { TYPE_AVENGER } from "@aom/sim";
import mythCreateUrl from "../../../assets/audio/units/mythcreate.wav";
import attackAUrl from "../../../assets/units/egyptian/avenger/attack-a.glb?url";
import attackBUrl from "../../../assets/units/egyptian/avenger/attack-b.glb?url";
import attack1Url from "../../../assets/units/egyptian/avenger/attack1.wav";
import attack2Url from "../../../assets/units/egyptian/avenger/attack2.wav";
import deathModelUrl from "../../../assets/units/egyptian/avenger/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/avenger/death.wav";
import iconUrl from "../../../assets/units/egyptian/avenger/icon.png";
import idleUrl from "../../../assets/units/egyptian/avenger/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/avenger/move1.wav";
import move2Url from "../../../assets/units/egyptian/avenger/move2.wav";
import select1Url from "../../../assets/units/egyptian/avenger/select1.wav";
import select2Url from "../../../assets/units/egyptian/avenger/select2.wav";
import swordSwooshUrl from "../../../assets/units/egyptian/avenger/sword-swoosh.png";
import walkUrl from "../../../assets/units/egyptian/avenger/walk.glb?url";
import whirlwindUrl from "../../../assets/units/egyptian/avenger/whirlwind.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 0.75,
  maxVoices: 2,
} as const;

export const definition = {
  type: TYPE_AVENGER,
  key: "egyptian-avenger",
  presentation: {
    kind: "model",
    worldHeight: 3.1,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianAvengerIdle"]),
      walk: loop(["egyptianAvengerWalk"]),
      attack: actionCycle(["egyptianAvengerAttackA", "egyptianAvengerAttackB"]),
      specialAttack: actionCycle(["egyptianAvengerWhirlwind"]),
      death: once(["egyptianAvengerDeath"]),
    },
  },
  models: [
    { key: "egyptianAvengerIdle", url: idleUrl, grounded: true },
    { key: "egyptianAvengerWalk", url: walkUrl, grounded: true },
    { key: "egyptianAvengerAttackA", url: attackAUrl, grounded: true },
    { key: "egyptianAvengerAttackB", url: attackBUrl, grounded: true },
    { key: "egyptianAvengerWhirlwind", url: whirlwindUrl, grounded: true },
    { key: "egyptianAvengerDeath", url: deathModelUrl, grounded: true },
  ],
  effects: [
    {
      key: "egyptianAvengerSwordSwoosh",
      trigger: "special-attack",
      textureUrl: swordSwooshUrl,
    },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.75, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [mythCreateUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 0.75, maxVoices: 1 },
    specialAttack: {
      files: [attack1Url, attack2Url],
      volume: 0.9,
      maxVoices: 1,
      delaySeconds: 0.9,
    },
  },
} as const satisfies UnitMediaDefinition;
