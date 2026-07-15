export class WebGPUUnsupportedError extends Error {
  constructor() {
    super(
      "WebGPU is not supported in this browser. Use Chrome/Edge, Safari 26+, or a recent Firefox release.",
    );
    this.name = "WebGPUUnsupportedError";
  }
}

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && navigator.gpu !== undefined;
}

export { initGPU, type DeviceLostCallback, type GpuContext } from "./gpu/device";
export { observeCanvasSize, type CanvasResizeCallback } from "./gpu/surface";
export {
  createGame,
  type GameHandle,
  type GameOptions,
  type SelectionSummary,
} from "./game";
export type { AgeAdvancementState, PlayerState, PlayerStateCallback } from "./player-state";
export { TYPE_ICONS, type IconConfig } from "./assets/icons";
export { connectToRelay } from "./net/relay";
export type { BeginInfo, NetEvent, NetSession } from "./net/relay";
// The web app consumes the engine's API surface only — it re-exports the wire
// types it needs so apps/web never depends on @aom/relay directly.
export type { PlayerInfo } from "@aom/relay";
// The web app reads outcome sentinels through the engine API surface.
export {
  AGE_NAMES,
  AGE_ARCHAIC,
  AGE_CLASSICAL,
  FAVOR,
  FOOD,
  getAgeAdvanceAvailability,
  getTypeAvailability,
  GOLD,
  GOD_ATHENA,
  GOD_HERMES,
  GOD_ZEUS,
  MATCH_DRAW,
  NO_AGE,
  TYPE_BARRACKS,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TOWN_CENTER,
  TYPE_TEMPLE,
  TYPE_VILLAGER,
  UNIT_TYPES,
  WOOD,
} from "@aom/sim";
export type { AgeAdvanceAvailability, AgeAdvanceRule, TypeAvailability } from "@aom/sim";
export type { GameStats, StatsCallback } from "./render/stats";
