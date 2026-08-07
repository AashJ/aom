import { TYPE_SCORPION_MAN } from "@aom/sim";
import mythCreateUrl from "../../../assets/audio/units/mythcreate.wav";
import attackAUrl from "../../../assets/units/egyptian/scorpion-man/attack-a.glb?url";
import attackBUrl from "../../../assets/units/egyptian/scorpion-man/attack-b.glb?url";
import attack1Url from "../../../assets/units/egyptian/scorpion-man/attack1.wav";
import attack2Url from "../../../assets/units/egyptian/scorpion-man/attack2.wav";
import attack3Url from "../../../assets/units/egyptian/scorpion-man/attack3.wav";
import attack4Url from "../../../assets/units/egyptian/scorpion-man/attack4.wav";
import deathModelUrl from "../../../assets/units/egyptian/scorpion-man/death.glb?url";
import deathVoiceUrl from "../../../assets/units/egyptian/scorpion-man/death.wav";
import iconUrl from "../../../assets/units/egyptian/scorpion-man/icon.png";
import idleUrl from "../../../assets/units/egyptian/scorpion-man/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/scorpion-man/move1.wav";
import move2Url from "../../../assets/units/egyptian/scorpion-man/move2.wav";
import move3Url from "../../../assets/units/egyptian/scorpion-man/move3.wav";
import poisonUrl from "../../../assets/units/egyptian/scorpion-man/poison.png";
import select1Url from "../../../assets/units/egyptian/scorpion-man/select1.wav";
import select2Url from "../../../assets/units/egyptian/scorpion-man/select2.wav";
import select3Url from "../../../assets/units/egyptian/scorpion-man/select3.wav";
import specialUrl from "../../../assets/units/egyptian/scorpion-man/special.glb?url";
import walkUrl from "../../../assets/units/egyptian/scorpion-man/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const attackVoices = [attack1Url, attack2Url, attack3Url, attack4Url] as const;

export const definition = {
  type: TYPE_SCORPION_MAN,
  key: "egyptian-scorpion-man",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianScorpionManIdle"]),
      walk: loop(["egyptianScorpionManWalk"]),
      attack: actionCycle(["egyptianScorpionManAttackA", "egyptianScorpionManAttackB"]),
      specialAttack: actionCycle(["egyptianScorpionManSpecial"]),
      death: once(["egyptianScorpionManDeath"]),
    },
  },
  models: [
    { key: "egyptianScorpionManIdle", url: idleUrl, grounded: true },
    { key: "egyptianScorpionManWalk", url: walkUrl, grounded: true },
    { key: "egyptianScorpionManAttackA", url: attackAUrl, grounded: true },
    { key: "egyptianScorpionManAttackB", url: attackBUrl, grounded: true },
    { key: "egyptianScorpionManSpecial", url: specialUrl, grounded: true },
    { key: "egyptianScorpionManDeath", url: deathModelUrl, grounded: true },
  ],
  effects: [
    {
      key: "egyptianScorpionPoison",
      trigger: "poisoned-status",
      textureUrl: poisonUrl,
    },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [select1Url, select2Url, select3Url],
      volume: 0.75,
      maxVoices: 2,
    },
    acknowledge: {
      files: [move1Url, move2Url, move3Url],
      volume: 0.85,
      maxVoices: 2,
    },
    attackAcknowledge: { files: attackVoices, volume: 1, maxVoices: 1 },
    created: { files: [mythCreateUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 0.9, maxVoices: 1 },
    specialAttack: {
      files: attackVoices,
      volume: 1,
      maxVoices: 1,
      delaySeconds: 0.66,
    },
  },
} as const satisfies UnitMediaDefinition;
