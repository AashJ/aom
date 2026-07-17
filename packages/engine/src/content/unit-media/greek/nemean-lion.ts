import { TYPE_NEMEAN_LION } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/nemean-lion/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/nemean-lion/attack-b.glb?url";
import createdUrl from "../../../assets/units/greek/nemean-lion/created.wav";
import deathUrl from "../../../assets/units/greek/nemean-lion/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/nemean-lion/death.wav";
import iconUrl from "../../../assets/units/greek/nemean-lion/icon.png";
import idleUrl from "../../../assets/units/greek/nemean-lion/idle.glb?url";
import move1Url from "../../../assets/units/greek/nemean-lion/move1.wav";
import move2Url from "../../../assets/units/greek/nemean-lion/move2.wav";
import move3Url from "../../../assets/units/greek/nemean-lion/move3.wav";
import roarUrl from "../../../assets/units/greek/nemean-lion/roar.glb?url";
import roarVoiceUrl from "../../../assets/units/greek/nemean-lion/roar.wav";
import select1Url from "../../../assets/units/greek/nemean-lion/select1.wav";
import select2Url from "../../../assets/units/greek/nemean-lion/select2.wav";
import soundWaveUrl from "../../../assets/units/greek/nemean-lion/sound-wave.png";
import walkUrl from "../../../assets/units/greek/nemean-lion/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 0.85,
  maxVoices: 3,
} as const;

export const definition = {
  type: TYPE_NEMEAN_LION,
  key: "greek-nemean-lion",
  presentation: {
    kind: "model",
    worldHeight: 2.23,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekNemeanLionIdle"]),
      walk: loop(["greekNemeanLionWalk"]),
      attack: actionCycle(["greekNemeanLionAttackA", "greekNemeanLionAttackB"]),
      specialAttack: actionCycle(["greekNemeanLionRoar"]),
      death: once(["greekNemeanLionDeath"]),
    },
  },
  models: [
    { key: "greekNemeanLionIdle", url: idleUrl, grounded: true },
    { key: "greekNemeanLionWalk", url: walkUrl, grounded: true },
    { key: "greekNemeanLionAttackA", url: attackAUrl, grounded: true },
    { key: "greekNemeanLionAttackB", url: attackBUrl, grounded: true },
    { key: "greekNemeanLionRoar", url: roarUrl, grounded: true },
    { key: "greekNemeanLionDeath", url: deathUrl, grounded: true },
  ],
  effects: [
    {
      key: "greekNemeanLionSoundWave",
      trigger: "special-attack",
      textureUrl: soundWaveUrl,
    },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 1, maxVoices: 3 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [createdUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 1, maxVoices: 3 },
    specialAttack: { files: [roarVoiceUrl], volume: 1, maxVoices: 3 },
  },
} as const satisfies UnitMediaDefinition;
