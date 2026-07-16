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
  type GameCulture,
  type GameHandle,
  type GameOptions,
  type SelectionSummary,
} from "./game";
export {
  typeAvailabilityForPlayerState,
  type AgeAdvancementState,
  type PlayerState,
  type PlayerStateCallback,
} from "./player-state";
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
  BUILD_OPTIONS_BY_WORKER,
  cultureForMajorGod,
  FAVOR,
  FOOD,
  getAgeAdvanceAvailability,
  getAgeAdvanceProducerType,
  getTypeAvailability,
  GOLD,
  GOD_ATHENA,
  GOD_BAST,
  GOD_HERMES,
  GOD_PTAH,
  GOD_RA,
  GOD_ZEUS,
  MATCH_DRAW,
  NO_AGE,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_LABORER,
  TYPE_EGYPTIAN_TEMPLE,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GREEK_HOUSE,
  TYPE_GREEK_MILITARY_ACADEMY,
  TYPE_GREEK_TEMPLE,
  TYPE_GREEK_TOWN_CENTER,
  TYPE_GREEK_VILLAGER,
  TYPE_HOPLITE,
  TYPE_MILITIA,
  TYPE_SPEARMAN,
  TRAIN_OPTIONS_BY_PRODUCER,
  UNIT_TYPES,
  WOOD,
} from "@aom/sim";
export type {
  AgeAdvanceAvailability,
  AgeAdvanceRule,
  TypeCommandRelationship,
  TypeAvailability,
  TypeAvailabilityContext,
} from "@aom/sim";
export type { GameStats, StatsCallback } from "./render/stats";
