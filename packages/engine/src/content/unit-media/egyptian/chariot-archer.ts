import { TYPE_CHARIOT_ARCHER } from "@aom/sim";
import acknowledge1Url from "../../../assets/units/egyptian/chariot-archer/emm1.wav";
import acknowledge2Url from "../../../assets/units/egyptian/chariot-archer/emm2.wav";
import acknowledge3Url from "../../../assets/units/egyptian/chariot-archer/emm3.wav";
import attackUrl from "../../../assets/units/egyptian/chariot-archer/attack.glb?url";
import attackVoice1Url from "../../../assets/units/egyptian/chariot-archer/ema1.wav";
import attackVoice2Url from "../../../assets/units/egyptian/chariot-archer/ema2.wav";
import attackVoice3Url from "../../../assets/units/egyptian/chariot-archer/ema3.wav";
import deathUrl from "../../../assets/units/egyptian/chariot-archer/death.glb?url";
import iconUrl from "../../../assets/units/egyptian/chariot-archer/icon.png";
import idleUrl from "../../../assets/units/egyptian/chariot-archer/idle.glb?url";
import selection1Url from "../../../assets/units/egyptian/chariot-archer/ems1.wav";
import selection2Url from "../../../assets/units/egyptian/chariot-archer/ems2.wav";
import selection3Url from "../../../assets/units/egyptian/chariot-archer/ems3.wav";
import walkUrl from "../../../assets/units/egyptian/chariot-archer/walk.glb?url";
import wheelUrl from "../../../assets/units/egyptian/chariot-archer/wheel.glb?url";
import { AUDIO_CUES } from "../../../audio/assets";
import { actionCycle, loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

const equipment = [
  {
    model: "egyptianChariotArcherWheel",
    targetNode: "Dummy_rightear",
    hotspotNode: "Dummy_hotspot",
  },
  {
    model: "egyptianChariotArcherWheel",
    targetNode: "Dummy_leftear",
    hotspotNode: "Dummy_hotspot",
  },
] as const;

export const definition = {
  type: TYPE_CHARIOT_ARCHER,
  key: "egyptian-chariot-archer",
  presentation: {
    kind: "model",
    worldHeight: 3.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianChariotArcherIdle"]),
      walk: loop(["egyptianChariotArcherWalk"]),
      attack: actionCycle(["egyptianChariotArcherAttack"]),
      death: once(["egyptianChariotArcherDeath"]),
    },
  },
  models: [
    { key: "egyptianChariotArcherIdle", url: idleUrl, grounded: true, attachments: equipment },
    { key: "egyptianChariotArcherWalk", url: walkUrl, grounded: true, attachments: equipment },
    {
      key: "egyptianChariotArcherAttack",
      url: attackUrl,
      grounded: true,
      attachments: equipment,
    },
    { key: "egyptianChariotArcherDeath", url: deathUrl, grounded: true, attachments: equipment },
    { key: "egyptianChariotArcherWheel", url: wheelUrl, grounded: false },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [selection1Url, selection2Url, selection3Url], volume: 1, maxVoices: 1 },
    acknowledge: {
      files: [acknowledge1Url, acknowledge2Url, acknowledge3Url],
      volume: 1,
      maxVoices: 1,
    },
    attackAcknowledge: {
      files: [attackVoice1Url, attackVoice2Url, attackVoice3Url],
      volume: 1,
      maxVoices: 1,
    },
    created: AUDIO_CUES.militaryCreate,
    death: AUDIO_CUES.maleDeath,
  },
} as const satisfies UnitMediaDefinition;
