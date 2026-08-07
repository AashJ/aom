import { TYPE_MINION } from "@aom/sim";
import attackAUrl from "../../../assets/units/egyptian/minion/attack-a.glb?url";
import attackBUrl from "../../../assets/units/egyptian/minion/attack-b.glb?url";
import birth1Url from "../../../assets/units/egyptian/minion/birth1.wav";
import birth2Url from "../../../assets/units/egyptian/minion/birth2.wav";
import birth3Url from "../../../assets/units/egyptian/minion/birth3.wav";
import birth4Url from "../../../assets/units/egyptian/minion/birth4.wav";
import deathAUrl from "../../../assets/units/egyptian/minion/death-a.glb?url";
import deathBUrl from "../../../assets/units/egyptian/minion/death-b.glb?url";
import deathCUrl from "../../../assets/units/egyptian/minion/death-c.glb?url";
import deathUrl from "../../../assets/units/egyptian/minion/death.wav";
import iconUrl from "../../../assets/units/egyptian/minion/icon.png";
import idleUrl from "../../../assets/units/egyptian/minion/idle.glb?url";
import move1Url from "../../../assets/units/egyptian/minion/move1.wav";
import move2Url from "../../../assets/units/egyptian/minion/move2.wav";
import move3Url from "../../../assets/units/egyptian/minion/move3.wav";
import scytheUrl from "../../../assets/units/egyptian/minion/scythe.glb?url";
import select1Url from "../../../assets/units/egyptian/minion/select1.wav";
import select2Url from "../../../assets/units/egyptian/minion/select2.wav";
import walkUrl from "../../../assets/units/egyptian/minion/walk.glb?url";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const scythe = [
  { model: "egyptianMinionScythe", targetNode: "Dummy_righthand", hotspotNode: "Dummy_hotspot" },
] as const;
const acknowledge = {
  files: [move1Url, move2Url, move3Url],
  volume: 0.65,
  maxVoices: 2,
} as const;

export const definition = {
  type: TYPE_MINION,
  key: "egyptian-minion",
  presentation: {
    kind: "model",
    worldHeight: 2.25,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianMinionIdle"]),
      walk: loop(["egyptianMinionWalk"]),
      attack: actionCycle(["egyptianMinionAttackA", "egyptianMinionAttackB"]),
      death: once(["egyptianMinionDeathA", "egyptianMinionDeathB", "egyptianMinionDeathC"]),
    },
  },
  models: [
    { key: "egyptianMinionIdle", url: idleUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionWalk", url: walkUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionAttackA", url: attackAUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionAttackB", url: attackBUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionDeathA", url: deathAUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionDeathB", url: deathBUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionDeathC", url: deathCUrl, grounded: true, attachments: scythe },
    { key: "egyptianMinionScythe", url: scytheUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [select1Url, select2Url], volume: 0.65, maxVoices: 2 },
    acknowledge,
    attackAcknowledge: acknowledge,
    created: {
      files: [birth1Url, birth2Url, birth3Url, birth4Url],
      volume: 0.3,
      maxVoices: 3,
    },
    death: { files: [deathUrl], volume: 0.65, maxVoices: 3 },
  },
} as const satisfies UnitMediaDefinition;
