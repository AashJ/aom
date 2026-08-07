import { TYPE_GREEK_DOCK } from "@aom/sim";
import age0DeathUrl from "../../../assets/units/greek/dock/age0-death.glb?url";
import age0Url from "../../../assets/units/greek/dock/age0.glb?url";
import age1DeathUrl from "../../../assets/units/greek/dock/age1-death.glb?url";
import age1Url from "../../../assets/units/greek/dock/age1.glb?url";
import age2DeathUrl from "../../../assets/units/greek/dock/age2-death.glb?url";
import age2Url from "../../../assets/units/greek/dock/age2.glb?url";
import age3DeathUrl from "../../../assets/units/greek/dock/age3-death.glb?url";
import age3Url from "../../../assets/units/greek/dock/age3.glb?url";
import deathUrl from "../../../assets/units/greek/dock/death.wav";
import dockUrl from "../../../assets/units/greek/dock/dock.wav";
import iconUrl from "../../../assets/units/greek/dock/icon.png";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_DOCK,
  key: "greek-dock",
  presentation: {
    kind: "model",
    worldHeight: 5.2,
    bottomPadding: 0,
    actions: {
      idle: loop(
        ["greekDockArchaic", "greekDockClassical", "greekDockHeroic", "greekDockMythic"],
        "owner-age",
      ),
      death: once(
        [
          "greekDockArchaicDeath",
          "greekDockClassicalDeath",
          "greekDockHeroicDeath",
          "greekDockMythicDeath",
        ],
        "owner-age",
      ),
    },
  },
  models: [
    { key: "greekDockArchaic", url: age0Url, grounded: true },
    { key: "greekDockClassical", url: age1Url, grounded: true },
    { key: "greekDockHeroic", url: age2Url, grounded: true },
    { key: "greekDockMythic", url: age3Url, grounded: true },
    { key: "greekDockArchaicDeath", url: age0DeathUrl, grounded: true },
    { key: "greekDockClassicalDeath", url: age1DeathUrl, grounded: true },
    { key: "greekDockHeroicDeath", url: age2DeathUrl, grounded: true },
    { key: "greekDockMythicDeath", url: age3DeathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [dockUrl], volume: 1, maxVoices: 1 },
    completed: { files: [dockUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
