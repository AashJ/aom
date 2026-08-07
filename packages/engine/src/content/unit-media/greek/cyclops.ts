import { TYPE_CYCLOPS } from "@aom/sim";
import attack1Url from "../../../assets/units/greek/cyclops/attack1.wav";
import attack2Url from "../../../assets/units/greek/cyclops/attack2.wav";
import attack3Url from "../../../assets/units/greek/cyclops/attack3.wav";
import attack4Url from "../../../assets/units/greek/cyclops/attack4.wav";
import attackAUrl from "../../../assets/units/greek/cyclops/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/cyclops/attack-b.glb?url";
import createdUrl from "../../../assets/units/greek/cyclops/created.wav";
import deathUrl from "../../../assets/units/greek/cyclops/death.glb?url";
import death1Url from "../../../assets/units/greek/cyclops/death1.wav";
import death2Url from "../../../assets/units/greek/cyclops/death2.wav";
import iconUrl from "../../../assets/units/greek/cyclops/icon.png";
import idleUrl from "../../../assets/units/greek/cyclops/idle.glb?url";
import move1Url from "../../../assets/units/greek/cyclops/move1.wav";
import move2Url from "../../../assets/units/greek/cyclops/move2.wav";
import move3Url from "../../../assets/units/greek/cyclops/move3.wav";
import pickupUrl from "../../../assets/units/greek/cyclops/pickup.glb?url";
import select1Url from "../../../assets/units/greek/cyclops/select1.wav";
import select2Url from "../../../assets/units/greek/cyclops/select2.wav";
import select3Url from "../../../assets/units/greek/cyclops/select3.wav";
import special1Url from "../../../assets/units/greek/cyclops/special1.wav";
import special2Url from "../../../assets/units/greek/cyclops/special2.wav";
import swing1Url from "../../../assets/units/greek/cyclops/swing1.wav";
import swing2Url from "../../../assets/units/greek/cyclops/swing2.wav";
import swing3Url from "../../../assets/units/greek/cyclops/swing3.wav";
import walkUrl from "../../../assets/units/greek/cyclops/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 1,
  maxVoices: 1,
} as const;

const attackVoice = {
  files: [attack1Url, attack2Url, attack3Url, attack4Url],
  volume: 1,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_CYCLOPS,
  key: "greek-cyclops",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekCyclopsIdle"]),
      walk: loop(["greekCyclopsWalk"]),
      attack: actionCycle(["greekCyclopsAttackA", "greekCyclopsAttackB"]),
      specialAttack: actionCycle(["greekCyclopsPickup"]),
      death: once(["greekCyclopsDeath"]),
    },
  },
  models: [
    { key: "greekCyclopsIdle", url: idleUrl, grounded: true },
    { key: "greekCyclopsWalk", url: walkUrl, grounded: true },
    { key: "greekCyclopsAttackA", url: attackAUrl, grounded: true },
    { key: "greekCyclopsAttackB", url: attackBUrl, grounded: true },
    { key: "greekCyclopsPickup", url: pickupUrl, grounded: true },
    { key: "greekCyclopsDeath", url: deathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge,
    attackAcknowledge: attackVoice,
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [death1Url, death2Url], volume: 1, maxVoices: 1 },
    specialAttackLayers: [
      {
        files: [special1Url, special2Url],
        volume: 0.45,
        maxVoices: 1,
        delaySeconds: 1.15,
      },
      {
        files: [swing1Url, swing2Url, swing3Url],
        volume: 0.7,
        maxVoices: 3,
        delaySeconds: 3.45,
      },
    ],
  },
} as const satisfies UnitMediaDefinition;
