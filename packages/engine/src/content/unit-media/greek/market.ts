import { TYPE_GREEK_MARKET } from "@aom/sim";
import deathUrl from "../../../assets/units/greek/market/death.wav";
import heroicDeathUrl from "../../../assets/units/greek/market/heroic-death.glb?url";
import heroicUrl from "../../../assets/units/greek/market/heroic.glb?url";
import iconUrl from "../../../assets/units/greek/market/icon.png";
import marketUrl from "../../../assets/units/greek/market/market.wav";
import mythicDeathUrl from "../../../assets/units/greek/market/mythic-death.glb?url";
import mythicUrl from "../../../assets/units/greek/market/mythic.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_GREEK_MARKET,
  key: "greek-market",
  presentation: {
    kind: "model",
    worldHeight: 4.3,
    bottomPadding: 0,
    actions: {
      idle: loop(["greekMarketHeroic", "greekMarketMythic"], "owner-age"),
      death: once(["greekMarketHeroicDeath", "greekMarketMythicDeath"], "owner-age"),
    },
  },
  models: [
    { key: "greekMarketHeroic", url: heroicUrl, grounded: true },
    { key: "greekMarketMythic", url: mythicUrl, grounded: true },
    { key: "greekMarketHeroicDeath", url: heroicDeathUrl, grounded: true },
    { key: "greekMarketMythicDeath", url: mythicDeathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [marketUrl], volume: 1, maxVoices: 1 },
    completed: { files: [marketUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
