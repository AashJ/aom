import { TYPE_EGYPTIAN_DOCK } from "@aom/sim";
import age0DeathUrl from "../../../assets/units/egyptian/dock/age0-death.glb?url";
import age0Url from "../../../assets/units/egyptian/dock/age0.glb?url";
import age1DeathUrl from "../../../assets/units/egyptian/dock/age1-death.glb?url";
import age1Url from "../../../assets/units/egyptian/dock/age1.glb?url";
import age2DeathUrl from "../../../assets/units/egyptian/dock/age2-death.glb?url";
import age2Url from "../../../assets/units/egyptian/dock/age2.glb?url";
import age3DeathUrl from "../../../assets/units/egyptian/dock/age3-death.glb?url";
import age3Url from "../../../assets/units/egyptian/dock/age3.glb?url";
import deathUrl from "../../../assets/units/egyptian/dock/death.wav";
import dockUrl from "../../../assets/units/egyptian/dock/dock.wav";
import iconUrl from "../../../assets/units/egyptian/dock/icon.png";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_DOCK,
  key: "egyptian-dock",
  presentation: {
    kind: "model",
    worldHeight: 5.2,
    bottomPadding: 0,
    actions: {
      idle: loop(
        [
          "egyptianDockArchaic",
          "egyptianDockClassical",
          "egyptianDockHeroic",
          "egyptianDockMythic",
        ],
        "owner-age",
      ),
      death: once(
        [
          "egyptianDockArchaicDeath",
          "egyptianDockClassicalDeath",
          "egyptianDockHeroicDeath",
          "egyptianDockMythicDeath",
        ],
        "owner-age",
      ),
    },
  },
  models: [
    { key: "egyptianDockArchaic", url: age0Url, grounded: true },
    { key: "egyptianDockClassical", url: age1Url, grounded: true },
    { key: "egyptianDockHeroic", url: age2Url, grounded: true },
    { key: "egyptianDockMythic", url: age3Url, grounded: true },
    { key: "egyptianDockArchaicDeath", url: age0DeathUrl, grounded: true },
    { key: "egyptianDockClassicalDeath", url: age1DeathUrl, grounded: true },
    { key: "egyptianDockHeroicDeath", url: age2DeathUrl, grounded: true },
    { key: "egyptianDockMythicDeath", url: age3DeathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [dockUrl], volume: 1, maxVoices: 1 },
    completed: { files: [dockUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
