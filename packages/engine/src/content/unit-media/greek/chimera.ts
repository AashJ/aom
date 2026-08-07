import { TYPE_CHIMERA } from "@aom/sim";
import mythCreateUrl from "../../../assets/audio/units/mythcreate.wav";
import attackUrl from "../../../assets/units/greek/chimera/attack.glb?url";
import deathModelUrl from "../../../assets/units/greek/chimera/death.glb?url";
import deathVoiceUrl from "../../../assets/units/greek/chimera/death.wav";
import fire1Url from "../../../assets/units/greek/chimera/fire-1.png";
import fire2Url from "../../../assets/units/greek/chimera/fire-2.png";
import fire3Url from "../../../assets/units/greek/chimera/fire-3.png";
import flameUrl from "../../../assets/units/greek/chimera/flame.wav";
import iconUrl from "../../../assets/units/greek/chimera/icon.png";
import idleUrl from "../../../assets/units/greek/chimera/idle.glb?url";
import move1Url from "../../../assets/units/greek/chimera/move1.wav";
import move2Url from "../../../assets/units/greek/chimera/move2.wav";
import select1Url from "../../../assets/units/greek/chimera/select1.wav";
import select2Url from "../../../assets/units/greek/chimera/select2.wav";
import specialUrl from "../../../assets/units/greek/chimera/special.glb?url";
import walkUrl from "../../../assets/units/greek/chimera/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url],
  volume: 0.9,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_CHIMERA,
  key: "greek-chimera",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekChimeraIdle"]),
      walk: loop(["greekChimeraWalk"]),
      attack: actionCycle(["greekChimeraAttack"]),
      specialAttack: actionCycle(["greekChimeraSpecial"]),
      death: once(["greekChimeraDeath"]),
    },
  },
  models: [
    { key: "greekChimeraIdle", url: idleUrl, grounded: true },
    { key: "greekChimeraWalk", url: walkUrl, grounded: true },
    { key: "greekChimeraAttack", url: attackUrl, grounded: true },
    { key: "greekChimeraSpecial", url: specialUrl, grounded: true },
    { key: "greekChimeraDeath", url: deathModelUrl, grounded: true },
  ],
  effects: [
    {
      key: "greekChimeraFireBreath",
      trigger: "special-attack",
      textureUrl: fire1Url,
      additionalTextureUrls: [fire2Url, fire3Url],
    },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.9, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: { files: [mythCreateUrl], volume: 0.6, maxVoices: 1 },
    death: { files: [deathVoiceUrl], volume: 0.75, maxVoices: 1 },
    specialAttack: { files: [flameUrl], volume: 1, maxVoices: 1, delaySeconds: 0.74 },
  },
} as const satisfies UnitMediaDefinition;
