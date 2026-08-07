import { TYPE_ACHILLES } from "@aom/sim";
import attackAUrl from "../../../assets/units/greek/achilles/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/achilles/attack-b.glb?url";
import attackCUrl from "../../../assets/units/greek/achilles/attack-c.glb?url";
import carryIdleUrl from "../../../assets/units/greek/achilles/carry-idle.glb?url";
import carryWalkUrl from "../../../assets/units/greek/achilles/carry-walk.glb?url";
import creationUrl from "../../../assets/units/greek/achilles/creation.wav";
import deathUrl from "../../../assets/units/greek/achilles/death.glb?url";
import attackVoice1Url from "../../../assets/units/greek/achilles/gha1.wav";
import attackVoice2Url from "../../../assets/units/greek/achilles/gha2.wav";
import attackVoice3Url from "../../../assets/units/greek/achilles/gha3.wav";
import acknowledge1Url from "../../../assets/units/greek/achilles/ghm1.wav";
import acknowledge2Url from "../../../assets/units/greek/achilles/ghm2.wav";
import acknowledge3Url from "../../../assets/units/greek/achilles/ghm3.wav";
import acknowledge4Url from "../../../assets/units/greek/achilles/ghm4.wav";
import selection1Url from "../../../assets/units/greek/achilles/ghs1.wav";
import selection2Url from "../../../assets/units/greek/achilles/ghs2.wav";
import selection3Url from "../../../assets/units/greek/achilles/ghs3.wav";
import selection4Url from "../../../assets/units/greek/achilles/ghs4.wav";
import iconUrl from "../../../assets/units/greek/achilles/icon.png";
import idleUrl from "../../../assets/units/greek/achilles/idle.glb?url";
import shieldUrl from "../../../assets/units/greek/achilles/shield.glb?url";
import swordUrl from "../../../assets/units/greek/achilles/sword.glb?url";
import walkUrl from "../../../assets/units/greek/achilles/walk.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekAchillesSword", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
  {
    model: "greekAchillesShield",
    targetNode: "Dummy_leftforearm",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_ACHILLES,
  key: "greek-achilles",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekAchillesIdle"]),
      walk: loop(["greekAchillesWalk"]),
      attack: actionCycle(["greekAchillesAttackA", "greekAchillesAttackB", "greekAchillesAttackC"]),
      death: once(["greekAchillesDeath"]),
      carryIdle: loop(["greekAchillesCarryIdle"]),
      carryWalk: loop(["greekAchillesCarryWalk"]),
    },
  },
  models: [
    { key: "greekAchillesIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekAchillesWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekAchillesAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekAchillesAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekAchillesAttackC", url: attackCUrl, grounded: true, attachments: equipment },
    { key: "greekAchillesDeath", url: deathUrl, grounded: true, attachments: equipment },
    {
      key: "greekAchillesCarryIdle",
      url: carryIdleUrl,
      grounded: true,
      attachments: equipment,
    },
    {
      key: "greekAchillesCarryWalk",
      url: carryWalkUrl,
      grounded: true,
      attachments: equipment,
    },
    { key: "greekAchillesSword", url: swordUrl, grounded: false },
    { key: "greekAchillesShield", url: shieldUrl, grounded: false },
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
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
