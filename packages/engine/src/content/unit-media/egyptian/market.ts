import { TYPE_EGYPTIAN_MARKET } from "@aom/sim";
import deathUrl from "../../../assets/units/egyptian/market/death.wav";
import heroicDeathUrl from "../../../assets/units/egyptian/market/heroic-death.glb?url";
import heroicUrl from "../../../assets/units/egyptian/market/heroic.glb?url";
import iconUrl from "../../../assets/units/egyptian/market/icon.png";
import marketUrl from "../../../assets/units/egyptian/market/market.wav";
import mythicDeathUrl from "../../../assets/units/egyptian/market/mythic-death.glb?url";
import mythicUrl from "../../../assets/units/egyptian/market/mythic.glb?url";
import { loop, once, type UnitMediaDefinition } from "../../unit-media-schema";

export const definition = {
  type: TYPE_EGYPTIAN_MARKET,
  key: "egyptian-market",
  presentation: {
    kind: "model",
    worldHeight: 5.2,
    bottomPadding: 0,
    actions: {
      idle: loop(["egyptianMarketHeroic", "egyptianMarketMythic"], "owner-age"),
      death: once(["egyptianMarketHeroicDeath", "egyptianMarketMythicDeath"], "owner-age"),
    },
  },
  models: [
    { key: "egyptianMarketHeroic", url: heroicUrl, grounded: true },
    { key: "egyptianMarketMythic", url: mythicUrl, grounded: true },
    { key: "egyptianMarketHeroicDeath", url: heroicDeathUrl, grounded: true },
    { key: "egyptianMarketMythicDeath", url: mythicDeathUrl, grounded: true },
  ],
  icon: { url: iconUrl, columns: 1 },
  audio: {
    selection: { files: [marketUrl], volume: 1, maxVoices: 1 },
    completed: { files: [marketUrl], volume: 1, maxVoices: 1 },
    death: { files: [deathUrl], volume: 1, maxVoices: 1 },
  },
} as const satisfies UnitMediaDefinition;
