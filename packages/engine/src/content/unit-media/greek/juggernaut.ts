import { TYPE_JUGGERNAUT } from "@aom/sim";
import attackUrl from "../../../assets/units/greek/juggernaut/attack.glb?url";
import attackSoundUrl from "../../../assets/units/greek/juggernaut/attack.wav";
import createdUrl from "../../../assets/units/greek/juggernaut/created.wav";
import deathModelUrl from "../../../assets/units/greek/juggernaut/death.glb?url";
import deathUrl from "../../../assets/units/greek/juggernaut/death.wav";
import iconUrl from "../../../assets/units/greek/juggernaut/icon.png";
import idleUrl from "../../../assets/units/greek/juggernaut/idle.glb?url";
import move1Url from "../../../assets/units/greek/juggernaut/move1.wav";
import move2Url from "../../../assets/units/greek/juggernaut/move2.wav";
import move3Url from "../../../assets/units/greek/juggernaut/move3.wav";
import select1Url from "../../../assets/units/greek/juggernaut/select1.wav";
import select2Url from "../../../assets/units/greek/juggernaut/select2.wav";
import select3Url from "../../../assets/units/greek/juggernaut/select3.wav";
import walkUrl from "../../../assets/units/greek/juggernaut/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_JUGGERNAUT,
  key: "greek-juggernaut",
  presentation: {
    kind: "model",
    worldHeight: 3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekJuggernautIdle"]),
      walk: loop(["greekJuggernautWalk"]),
      attack: actionCycle(["greekJuggernautAttack"]),
      death: once(["greekJuggernautDeath"]),
    },
  },
  models: [
    { key: "greekJuggernautIdle", url: idleUrl, grounded: true },
    { key: "greekJuggernautWalk", url: walkUrl, grounded: true },
    { key: "greekJuggernautAttack", url: attackUrl, grounded: true },
    { key: "greekJuggernautDeath", url: deathModelUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url, select3Url], volume: 1, maxVoices: 1 },
    acknowledge: { files: [move1Url, move2Url, move3Url], volume: 0.6, maxVoices: 1 },
    attack: { files: [attackSoundUrl], volume: 1, maxVoices: 1 },
    created: { files: [createdUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
