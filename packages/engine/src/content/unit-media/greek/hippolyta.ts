import { TYPE_HIPPOLYTA } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/greek/hippolyta/hippolytamove1.wav";
import acknowledge2Url from "../../../assets/units/greek/hippolyta/hippolytamove2.wav";
import acknowledge3Url from "../../../assets/units/greek/hippolyta/hippolytamove3.wav";
import acknowledge4Url from "../../../assets/units/greek/hippolyta/hippolytamove4.wav";
import attackUrl from "../../../assets/units/greek/hippolyta/attack.glb?url";
import attackVoice1Url from "../../../assets/units/greek/hippolyta/hippolytaattack1.wav";
import attackVoice2Url from "../../../assets/units/greek/hippolyta/hippolytaattack2.wav";
import attackVoice3Url from "../../../assets/units/greek/hippolyta/hippolytaattack3.wav";
import carryIdleUrl from "../../../assets/units/greek/hippolyta/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/hippolyta/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/hippolyta/herocreation.wav";
import death1Url from "../../../assets/units/greek/hippolyta/femaledeath1.wav";
import death2Url from "../../../assets/units/greek/hippolyta/femaledeath2.wav";
import death3Url from "../../../assets/units/greek/hippolyta/femaledeath3.wav";
import death4Url from "../../../assets/units/greek/hippolyta/femaledeath4.wav";
import deathUrl from "../../../assets/units/greek/hippolyta/death.glb?url";
import iconUrl from "../../../assets/units/greek/hippolyta/icon.png";
import idleUrl from "../../../assets/units/greek/hippolyta/idle.glb?url";
import selection1Url from "../../../assets/units/greek/hippolyta/hippolytaselect1.wav";
import selection2Url from "../../../assets/units/greek/hippolyta/hippolytaselect2.wav";
import selection3Url from "../../../assets/units/greek/hippolyta/hippolytaselect3.wav";
import selection4Url from "../../../assets/units/greek/hippolyta/hippolytaselect4.wav";
import walkUrl from "../../../assets/units/greek/hippolyta/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_HIPPOLYTA,
  key: "greek-hippolyta",
  presentation: {
    kind: "model",
    worldHeight: 2.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekHippolytaIdle"]),
      walk: loop(["greekHippolytaWalk"]),
      attack: actionCycle(["greekHippolytaAttack"]),
      death: once(["greekHippolytaDeath"]),
      carryIdle: loop(["greekHippolytaCarryIdle"]),
      carryWalk: loop(["greekHippolytaCarryWalk"]),
    },
  },
  models: [
    { key: "greekHippolytaIdle", url: idleUrl, grounded: true },
    { key: "greekHippolytaWalk", url: walkUrl, grounded: true },
    { key: "greekHippolytaAttack", url: attackUrl, grounded: true },
    { key: "greekHippolytaDeath", url: deathUrl, grounded: true },
    { key: "greekHippolytaCarryIdle", url: carryIdleUrl, grounded: true },
    { key: "greekHippolytaCarryWalk", url: carryWalkUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: {
      files: [selection1Url, selection2Url, selection3Url, selection4Url],
      volume: 1,
      maxVoices: 1,
    },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url, acknowledge4Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackVoice1Url, attackVoice2Url, attackVoice3Url],
      volume: 1,
      maxVoices: 1,
    },
    created: { files: [creationUrl], volume: 1, maxVoices: 1 },
    death: { files: [death1Url, death2Url, death3Url, death4Url], volume: 1, maxVoices: 2 },
  },
} as const satisfies UnitMediaDefinition;
