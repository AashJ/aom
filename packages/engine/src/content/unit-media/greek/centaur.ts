import { TYPE_CENTAUR } from "@aom/sim";
import mythCreateUrl from "../../../assets/audio/units/mythcreate.wav";
import acknowledge1Url from "../../../assets/audio/units/gmm1.wav";
import acknowledge2Url from "../../../assets/audio/units/gmm2.wav";
import acknowledge3Url from "../../../assets/audio/units/gmm3.wav";
import selection1Url from "../../../assets/audio/units/gms1.wav";
import selection2Url from "../../../assets/audio/units/gms2.wav";
import selection3Url from "../../../assets/audio/units/gms3.wav";
import attackAUrl from "../../../assets/units/greek/centaur/attack-a.glb?url";
import attackBUrl from "../../../assets/units/greek/centaur/attack-b.glb?url";
import deathUrl from "../../../assets/units/greek/centaur/death.glb?url";
import handArrowUrl from "../../../assets/units/greek/centaur/hand-arrow.glb?url";
import headUrl from "../../../assets/units/greek/centaur/head.glb?url";
import heavyFall1Url from "../../../assets/units/greek/centaur/heavy-fall1.wav";
import heavyFall2Url from "../../../assets/units/greek/centaur/heavy-fall2.wav";
import heavyFall3Url from "../../../assets/units/greek/centaur/heavy-fall3.wav";
import iconUrl from "../../../assets/units/greek/centaur/icon.png";
import idleUrl from "../../../assets/units/greek/centaur/idle.glb?url";
import specialUrl from "../../../assets/units/greek/centaur/special.glb?url";
import walkUrl from "../../../assets/units/greek/centaur/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  { model: "greekCentaurHead", targetNode: "Dummy_topofhead", hotspotNode: "Dummy_hotspot" },
  {
    model: "greekCentaurHandArrow",
    targetNode: "Dummy_righthand",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

const acknowledge = {
  files: [acknowledge1Url, acknowledge2Url, acknowledge3Url],
  volume: 1,
  maxVoices: 1,
} as const;

export const definition = {
  type: TYPE_CENTAUR,
  key: "greek-centaur",
  presentation: {
    kind: "model",
    worldHeight: 2.8,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekCentaurIdle"]),
      walk: loop(["greekCentaurWalk"]),
      attack: actionCycle(["greekCentaurAttackA", "greekCentaurAttackB"]),
      specialAttack: actionCycle(["greekCentaurSpecial"]),
      death: once(["greekCentaurDeath"]),
    },
  },
  models: [
    { key: "greekCentaurIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "greekCentaurWalk", url: walkUrl, grounded: true, attachments: equipment },
    { key: "greekCentaurAttackA", url: attackAUrl, grounded: true, attachments: equipment },
    { key: "greekCentaurAttackB", url: attackBUrl, grounded: true, attachments: equipment },
    { key: "greekCentaurSpecial", url: specialUrl, grounded: true, attachments: equipment },
    { key: "greekCentaurDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "greekCentaurHead", url: headUrl, grounded: false },
    { key: "greekCentaurHandArrow", url: handArrowUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selection1Url, selection2Url, selection3Url], volume: 1, maxVoices: 1 },
    acknowledge,
    // Centaur has no enemy-specific acknowledge set in Classic, so attack
    // commands deliberately use the same Greek military acknowledge lines.
    attackAcknowledge: acknowledge,
    created: { files: [mythCreateUrl], volume: 0.6, maxVoices: 1 },
    // The unit sound definition has no death voice. Its death animation emits
    // the shared HeavyFall set at the authored event instead.
    death: {
      files: [heavyFall1Url, heavyFall2Url, heavyFall3Url],
      volume: 0.6,
      maxVoices: 3,
    },
  },
} as const satisfies UnitMediaDefinition;
