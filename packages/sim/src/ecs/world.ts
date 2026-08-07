// Determinism rules: allowed math is + - * /, Math.sqrt/fround/abs/min/max/floor/ceil/
// trunc/sign, integer ops, and comparisons. Banned: transcendental Math functions,
// Math.random, Date, wall-clock or DOM state, and unordered iteration.
import {
  CHEAT_ADD_FOOD,
  CHEAT_ADD_GOLD,
  CHEAT_ADD_WOOD,
  CHEAT_FULL_FAVOR,
  CHEAT_REVEAL_MAP,
  COMMAND_ADVANCE_AGE,
  COMMAND_ATTACK,
  COMMAND_BUILD,
  COMMAND_CANCEL_TRAIN,
  COMMAND_CHEAT,
  COMMAND_GATHER,
  COMMAND_HEAL,
  COMMAND_EMPOWER,
  COMMAND_CONVERT,
  COMMAND_MOVE,
  COMMAND_PLACE,
  COMMAND_PRAY,
  COMMAND_STOP,
  COMMAND_TRAIN,
  type Command,
} from "../commands";
import { TICK_HZ, TICK_S } from "../clock";
import {
  cultureForMajorGod,
  townCenterTypeForCulture,
  workerTypeForCulture,
} from "../content/culture-types";
import { buildFlowField, cellOf, sampleFlowDirection, type FlowField } from "../flow";
import { createPcg32, nextFloat, type Pcg32 } from "../math/prng";
import { MAP_TILES } from "../terrain";
import {
  DEFAULT_MAP_ID,
  generateMap,
  MAP_RIVER_NILE,
  startLocationsForMap,
  TERRAIN_DOMAIN_LAND,
  TERRAIN_DOMAIN_WATER,
  type MapId,
  type StartLocation,
} from "../maps";
import {
  isEntityVisibleTo,
  isFootprintVisibleTo,
  updateVisibility,
  VIS_EXPLORED,
  VISIBILITY_TILES,
} from "../visibility";
import { resolveStableId, stableIdAt } from "./id";
import {
  centerDistanceForEdgeRange,
  killScaledMeleeDamageMultiplier,
  resolveDamage,
  resolveMeleeCycleDamage,
  resolveMeleeDamage,
} from "./combat";
import { integrateGroundMotion } from "./ground-contact";
import { clearAttackOrder } from "./attack-state";
import { tickActiveBeamAttack } from "./beam-combat";
import {
  effectiveAttackDamageMultiplier,
  effectiveAttackRange,
  effectiveMaxHp,
} from "./unit-age";
import { hasCompletedBuilding, isTypeAvailable } from "./availability";
import { NO_RESEARCH } from "./age-advancement";
import { favorCapForMajorGod, tickGreekFavor } from "./favor";
import { countLiveOrQueuedUnitType } from "./hero-lifecycle";
import {
  applyGarrisonCommand,
  countGarrisonedUnits,
  isGarrisonCommand,
  releaseGarrisonedUnits,
  syncContainedUnits,
  tickGarrisonTask,
} from "./garrison";
import { applyTradeCommand, isTradeCommand, tickTradeTask } from "./trade";
import { applySupportCommand, empowermentAt, tickSupportTask } from "./support-actions";
import { registerPlayer } from "./players";
import {
  assignFieldGoal,
  isWalkableStep,
  movementDomainForType,
  navigableCellNear,
  navigationGridForDomain,
  setFacingToward,
} from "./navigation";
import { MAX_PROJECTILE_BODY_RADIUS, MAX_TARGET_BODY_RADIUS } from "./unit-catalog-bounds";
import { AGE_COUNT, GOD_OSIRIS, NO_GOD } from "./progression";
import {
  activeTrainType,
  cancelProduction,
  clearProductionQueue,
  copyProductionQueue,
  enqueueProduction,
  finishActiveProduction,
  MAX_TRAIN_QUEUE,
} from "./production";
import {
  beginProjectileAttack,
  beginSpecialProjectileAttack,
  cancelPendingProjectilesBySource,
  createProjectileStore,
  tickProjectileStore,
  type ProjectileStore,
} from "./projectiles";
import {
  createPoisonEffectStore,
  installAreaPoison,
  tickPoisonEffects,
  type PoisonEffectStore,
} from "./poison-effects";
import { applyRelicCommand, isRelicCommand, releaseContainedRelics, tickRelicTask } from "./relics";
import {
  GRID_CELL,
  GRID_CELLS,
  GRID_DIM,
  gridCoordinateForPosition,
  rebuildUnitSpatialGrid,
} from "./spatial-grid";
import {
  activeMeleeAttackCycle,
  beginAuthoredMeleeAttackCycle,
  beginMeleeAttackCycle,
  NO_MELEE_ATTACK_VARIANT,
} from "./melee-attack-cycles";
import { tickActiveMeleeAttack } from "./melee-combat";
import {
  advanceSpecialAttack,
  advancePickupThrowSpecialAttack,
  beginJumpSpecialAttack,
  beginPickupThrowSpecialAttack,
  beginSpecialAttack,
  clearSpecialAttack,
  isValidSpecialTarget,
  resolveChargedJump,
  resolveChargedAreaPulse,
  resolveChargedConeThrow,
  resolveAreaDamageAt,
  resolveMeleeImpactAreaAt,
  tickSpecialRecharge,
  updateJumpSpecialPosition,
} from "./special-attacks";
import {
  clearTargetReaction,
  copyTargetReaction,
  createTargetReactionStore,
  installTargetReaction,
  targetReactionCapabilitiesAt,
  tickTargetReactions,
  type TargetReactionStore,
} from "./target-reactions";
import {
  cancelBuildingResearch,
  isBuildingResearching,
  tickBuildingResearch,
  tryStartAgeAdvance,
} from "./research";
import {
  BUILD_PER_STRIKE,
  CARRY_CAPACITY,
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  FAVOR,
  FOOD,
  GATHER_COOLDOWN_TICKS,
  GATHER_PER_STRIKE,
  GOLD,
  LEASH_FACTOR,
  MOVEMENT_DOMAIN_LAND,
  NODE_RETARGET_RADIUS,
  NO_UNIT_TYPE,
  RESOURCE_COUNT,
  TYPE_BERRY,
  TYPE_FISH_PERCH,
  TYPE_GOLD_MINE,
  TYPE_KATASKOPOS,
  TYPE_PHARAOH,
  TYPE_PRIEST,
  TYPE_SON_OF_OSIRIS,
  TYPE_GREEK_VILLAGER,
  TYPE_TREE,
  TRAIN_OPTIONS_BY_PRODUCER,
  UNIT_CLASS_AIR,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_WORKER,
  UNIT_CONDITION_STONE,
  UNIT_TYPES,
  WOOD,
  type MeleeAttack,
  type MeleeAttackCycle,
  type ResourceType,
} from "./types";
import {
  assignGatherTask,
  assignWorkerTask,
  isValidPrayerTarget,
  tickPrayerTask,
} from "./worker-tasks";
import {
  clearUnitTask,
  MODE_BUILDING,
  MODE_EATING_RESOURCE,
  MODE_GATHERING,
  MODE_IDLE,
  MODE_PRAYING,
  MODE_RETURNING,
  NO_TARGET,
} from "./unit-tasks";

export { TICK_HZ, TICK_S } from "../clock";
export { setFacingToward } from "./navigation";
export {
  MODE_BUILDING,
  MODE_EATING_RESOURCE,
  MODE_HEALING,
  MODE_EMPOWERING,
  MODE_CONVERTING,
  MODE_GATHERING,
  MODE_IDLE,
  MODE_ENTERING_GARRISON,
  MODE_PRAYING,
  MODE_RETURNING,
  MODE_TRADING_TO_MARKET,
  MODE_TRADING_TO_TOWN_CENTER,
  NO_TARGET,
} from "./unit-tasks";
export const SIM_MAP_SIZE = MAP_TILES;
export const MAX_UNITS = 10_000;
// Players use real ids < 256, but stockpiles index by actual id; a 256-wide
// four-resource array is 4 KB, cheaper than an id-to-slot map.
export const NEUTRAL_OWNER = 255;
export const MAX_PLAYERS = 8;
// world.winner values: -1 = match ongoing, >= 0 = that player id won,
// MATCH_DRAW = everyone is dead (mutual annihilation).
export const MATCH_DRAW = -2;
const FINAL_APPROACH_DIST = 2;
const GOAL_REMAP_RADIUS = 8;
export const SEPARATION_RADIUS = 0.8;
// Caps crowd pressure independently of authored movement speed.
const SEPARATION_MAX_STEP = 0.12;
const GOLD_PLACEMENT_ATTEMPTS = 64;
const RIVER_NILE_BERRY_PATCH_RADIUS = 4;
const RIVER_NILE_BERRIES_PER_PATCH = 10;
const RIVER_NILE_BERRY_START_CLEARANCE = 60;
const RIVER_NILE_FISH_PER_SCHOOL = 3;
const RIVER_NILE_FISH_SCHOOL_RADIUS = 9;
const RIVER_NILE_FISH_SCHOOL_SPACING = 22;
const RIVER_NILE_FISH_LAND_CLEARANCE = 6;
const INV_SQRT2 = 1 / Math.sqrt(2);
const MELEE_SNARE_TICKS = 3 * TICK_HZ;
const MELEE_SNARE_STRENGTH = 0.35;
const sampledFlowDirection = new Float64Array(2);
const GOLD_OTHER_NODE_CLEARANCE = 2;
// This is content for the current map, not a universal economy rule. Future
// maps can choose different counts and ranges without changing mine behavior.
const AEGEAN_GOLD_PLACEMENTS = [
  { perPlayer: 1, minDistance: 22, maxDistance: 32, goldMineSpacing: 6 },
  { perPlayer: 1, minDistance: 50, maxDistance: 75, goldMineSpacing: 10 },
  { perPlayer: 1, minDistance: 90, maxDistance: 115, goldMineSpacing: 12 },
] as const;
const AEGEAN_BERRY_PATCH_PLACEMENT_ATTEMPTS = 64;
// Classic random-map scripts place berries as one object definition: the range
// applies to the patch center and every bush stays within a small cluster.
const AEGEAN_BERRY_PLACEMENTS = [
  { count: 5, minDistance: 20, maxDistance: 25 },
  { count: 10, minDistance: 50, maxDistance: 100 },
] as const;
const AEGEAN_BERRY_CLUSTER_OFFSETS = [
  [0, 0],
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
  [2.8, 2.8],
  [-2.8, 2.8],
  [2.8, -2.8],
  [-2.8, -2.8],
  [4, 0],
] as const;
// river nile.xs: one small mine at 34–40 m, one medium mine at 40–60 m,
// and three far mines within the player's team land from 60 m outward.
const RIVER_NILE_GOLD_PLACEMENTS = [
  { perPlayer: 1, minDistance: 34, maxDistance: 40, goldMineSpacing: 30 },
  { perPlayer: 1, minDistance: 40, maxDistance: 60, goldMineSpacing: 30 },
  { perPlayer: 3, minDistance: 60, maxDistance: 300, goldMineSpacing: 30 },
] as const;
const MAX_PLAYABLE_MAP_SEED_ATTEMPTS = 256;
const PHARAOH_RESPAWN_TICKS = 90 * TICK_HZ;

class RequiredMapObjectPlacementError extends RangeError {}

export class RequiredGoldMinePlacementError extends RequiredMapObjectPlacementError {
  constructor(readonly playerIndex: number) {
    super(`Unable to place required gold mine for player ${playerIndex}`);
  }
}

class RequiredBerryPatchPlacementError extends RequiredMapObjectPlacementError {
  constructor(readonly playerIndex: number) {
    super(`Unable to place required berry patch for player ${playerIndex}`);
  }
}

class RequiredFishSchoolPlacementError extends RequiredMapObjectPlacementError {
  constructor(readonly schoolIndex: number) {
    super(`Unable to place required fish school ${schoolIndex}`);
  }
}

export interface World {
  tick: number;
  count: number;
  rng: Pcg32;
  mapId: MapId;
  mapSeed: number;
  heights: Float32Array;
  terrainMaterials: Uint8Array;
  terrainDomains: Uint8Array;
  waterNavigable: Uint8Array;
  // Runtime water occupancy. The source water mask remains immutable for
  // rendering and terrain restoration, just as terrainDomains does.
  waterWalkable: Uint8Array;
  waterLevel: number;
  walkable: Uint8Array;
  posX: Float64Array;
  posZ: Float64Array;
  velX: Float64Array;
  velZ: Float64Array;
  moveTargetX: Float64Array;
  moveTargetZ: Float64Array;
  moving: Uint8Array;
  // Unit-length world-space heading. A vector avoids deterministic-sim trig and
  // lets the renderer rotate 3D models through the full circle.
  facingX: Float64Array;
  facingZ: Float64Array;
  // Actual player ids, which are NOT guaranteed contiguous - lobby churn skips numbers;
  // 255 owners is plenty.
  owner: Uint8Array;
  playerIds: Uint8Array;
  playerSlotById: Int16Array;
  playerCount: number;
  visibility: Uint8Array;
  stockpiles: Uint32Array;
  // Progression is indexed by actual player id, like stockpiles. Visibility is
  // the exception because its map-sized rows are packed by active-player slot.
  playerAge: Uint8Array;
  playerMajorGod: Uint8Array;
  playerMinorGods: Uint8Array;
  // Fractional Favor is authoritative because it determines the tick on which
  // the next whole resource becomes spendable.
  playerFavorProgress: Uint32Array;
  // Rebuilt from active prayer tasks every tick for Favor generation and HUD rate.
  prayingVillagers: Uint16Array;
  unitType: Uint16Array;
  // Stable id of the hero or Temple currently containing this entity. Gate C
  // uses it for relics; NO_TARGET means the entity exists on the map.
  containedBy: Uint32Array;
  // Armor can produce fractional damage, so authoritative hit points remain f64.
  hp: Float64Array;
  buildProgress: Float64Array;
  lifespanRemaining: Uint16Array;
  // Credited hostile kills used by Classic experience-driven unit mechanics.
  combatExperienceKills: Uint8Array;
  // Persistent target states used by source-authored immunity predicates.
  // Producers (freeze/petrification) own installation and expiry semantics;
  // consumers never infer state from unit type or presentation.
  unitConditions: Uint8Array;
  // Classic hand attacks reduce movement by 35%, recovering linearly over
  // three seconds. A fresh hit resets this authoritative countdown.
  meleeSnareRemaining: Uint8Array;
  // Queue slot 0 is the authoritative active item. trainRemaining belongs only to that slot.
  trainRemaining: Uint16Array;
  trainQueueLength: Uint8Array;
  trainQueueTypes: Uint16Array;
  // Research is owned by its building and shares that producer's countdown slot.
  researchId: Uint8Array;
  researchChoice: Uint8Array;
  researchRemaining: Uint16Array;
  attackCooldown: Uint16Array;
  attackTarget: Uint32Array;
  attackOrdered: Uint8Array;
  attackAimTarget: Uint32Array;
  attackAimShots: Uint16Array;
  meleeActionVariant: Uint8Array;
  meleeActionImpactPending: Uint8Array;
  beamActionImpactPending: Uint8Array;
  beamActionActive: Uint8Array;
  specialRecharge: Uint16Array;
  specialActionRemaining: Uint16Array;
  specialActionTarget: Uint32Array;
  specialActionImpactPending: Uint8Array;
  specialActionStartX: Float64Array;
  specialActionStartZ: Float64Array;
  supportActionRemaining: Uint16Array;
  // A zero-HP Cyclops pickup remains authoritative while the dedicated
  // BUnitThrowAction presents it through the Cyclops's combined animation.
  terminalThrowSource: Uint32Array;
  targetReactions: TargetReactionStore;
  projectiles: ProjectileStore;
  poisonEffects: PoisonEffectStore;
  mode: Uint8Array;
  carried: Uint16Array;
  carriedResource: Uint8Array;
  // Source gather rates are fractional. This authoritative accumulator keeps
  // sub-unit progress while `carried` remains the whole-resource UI value.
  resourceCargo: Float64Array;
  // Stable-id target shared by gathering, construction, and prayer tasks.
  taskTarget: Uint32Array;
  // Stable route endpoints and fractional cargo are authoritative. Fractions
  // survive deposits so Classic's alternating whole-gold payouts are retained.
  tradeMarket: Uint32Array;
  tradeTownCenter: Uint32Array;
  tradeCargo: Float64Array;
  empowerTrainProgress: Float64Array;
  empowerResearchProgress: Float64Array;
  pharaohRespawnRemaining: Uint16Array;
  // Last known position of the assigned node; returning villagers go back here to prospect
  // when the node died behind their back.
  gatherPosX: Float64Array;
  gatherPosZ: Float64Array;
  // Indexed by stable HANDLE, not dense slot. Per-dense-slot generations cannot
  // survive swap-remove: the moved unit's dense index changes, and its outstanding
  // ids must stay valid while it lives. Before any death, handle === dense index,
  // preserving M5 1a's generation-0 numeric equality.
  generation: Uint16Array;
  slotOf: Int32Array;
  handleOf: Uint32Array;
  nextHandle: number;
  freeHandles: Uint32Array;
  freeHandleCount: number;
  dying: Uint8Array;
  dyingFromDamage: Uint8Array;
  pendingDeaths: Uint32Array;
  pendingDeathCount: number;
  // Transient output for the last completed tick. Snapshots copy these before the
  // next tick clears them, so presentation never infers deaths from missing ids.
  deathEventCount: number;
  deathEventIds: Uint32Array;
  deathEventTypes: Uint16Array;
  deathEventPosX: Float64Array;
  deathEventPosZ: Float64Array;
  deathEventFacingX: Float64Array;
  deathEventFacingZ: Float64Array;
  deathEventOwners: Uint8Array;
  deathEventCombatExperienceKills: Uint8Array;
  deathEventConditions: Uint8Array;
  deathEventCarried: Uint16Array;
  selectable: Uint8Array;
  selected: Uint8Array;
  commands: Command[];
  winner: number;
  contested: boolean;
  // Per-tick derived scratch and command-time flow caches. Excluded from hashWorld:
  // grid/push arrays are rebuilt from positions each tick; unitField/fieldCache are
  // derived flow-field references for current move targets and walkability.
  cellCount: Uint32Array;
  cellStart: Uint32Array;
  cellUnits: Uint32Array;
  pushX: Float64Array;
  pushZ: Float64Array;
  unitField: (FlowField | null)[];
  // Tiny LRU keyed by goalCell; groups share one field, that's the whole point of flow fields.
  fieldCache: FlowField[];
}

export function createWorld(seed: number, mapId: MapId = DEFAULT_MAP_ID, playerCount = 2): World {
  const generatedMap = generateMap(mapId, seed, Math.max(1, playerCount));
  const slotOf = new Int32Array(MAX_UNITS);
  const playerSlotById = new Int16Array(256);
  const playerMajorGod = new Uint8Array(256);
  const playerMinorGods = new Uint8Array(256 * AGE_COUNT);
  const researchId = new Uint8Array(MAX_UNITS);
  const researchChoice = new Uint8Array(MAX_UNITS);

  slotOf.fill(-1);
  playerSlotById.fill(-1);
  playerMajorGod.fill(NO_GOD);
  playerMinorGods.fill(NO_GOD);
  researchId.fill(NO_RESEARCH);
  researchChoice.fill(NO_GOD);

  return {
    tick: 0,
    count: 0,
    rng: createPcg32(seed),
    mapId,
    mapSeed: seed,
    // One seed now derives the whole world: terrain and units can never disagree
    // about which map they're on.
    heights: generatedMap.heights,
    terrainMaterials: generatedMap.terrainMaterials,
    terrainDomains: generatedMap.terrainDomains,
    waterNavigable: generatedMap.waterNavigable,
    waterWalkable: generatedMap.waterNavigable.slice(),
    waterLevel: generatedMap.waterLevel,
    walkable: generatedMap.landWalkable,
    // SoA typed arrays: cache-friendly linear iteration, zero per-tick allocation, and
    // trivially hashable for future desync detection.
    posX: new Float64Array(MAX_UNITS),
    posZ: new Float64Array(MAX_UNITS),
    velX: new Float64Array(MAX_UNITS),
    velZ: new Float64Array(MAX_UNITS),
    moveTargetX: new Float64Array(MAX_UNITS),
    moveTargetZ: new Float64Array(MAX_UNITS),
    moving: new Uint8Array(MAX_UNITS),
    facingX: new Float64Array(MAX_UNITS),
    facingZ: new Float64Array(MAX_UNITS),
    owner: new Uint8Array(MAX_UNITS),
    playerIds: new Uint8Array(MAX_PLAYERS),
    playerSlotById,
    playerCount: 0,
    visibility: new Uint8Array(MAX_PLAYERS * VISIBILITY_TILES),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    playerAge: new Uint8Array(256),
    playerMajorGod,
    playerMinorGods,
    playerFavorProgress: new Uint32Array(256),
    prayingVillagers: new Uint16Array(256),
    unitType: new Uint16Array(MAX_UNITS),
    containedBy: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    hp: new Float64Array(MAX_UNITS),
    buildProgress: new Float64Array(MAX_UNITS),
    lifespanRemaining: new Uint16Array(MAX_UNITS),
    combatExperienceKills: new Uint8Array(MAX_UNITS),
    unitConditions: new Uint8Array(MAX_UNITS),
    meleeSnareRemaining: new Uint8Array(MAX_UNITS),
    trainRemaining: new Uint16Array(MAX_UNITS),
    trainQueueLength: new Uint8Array(MAX_UNITS),
    trainQueueTypes: new Uint16Array(MAX_UNITS * MAX_TRAIN_QUEUE).fill(NO_UNIT_TYPE),
    researchId,
    researchChoice,
    researchRemaining: new Uint16Array(MAX_UNITS),
    attackCooldown: new Uint16Array(MAX_UNITS),
    attackTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    attackOrdered: new Uint8Array(MAX_UNITS),
    attackAimTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    attackAimShots: new Uint16Array(MAX_UNITS),
    meleeActionVariant: new Uint8Array(MAX_UNITS).fill(NO_MELEE_ATTACK_VARIANT),
    meleeActionImpactPending: new Uint8Array(MAX_UNITS),
    beamActionImpactPending: new Uint8Array(MAX_UNITS),
    beamActionActive: new Uint8Array(MAX_UNITS),
    specialRecharge: new Uint16Array(MAX_UNITS),
    specialActionRemaining: new Uint16Array(MAX_UNITS),
    specialActionTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    specialActionImpactPending: new Uint8Array(MAX_UNITS),
    specialActionStartX: new Float64Array(MAX_UNITS),
    specialActionStartZ: new Float64Array(MAX_UNITS),
    supportActionRemaining: new Uint16Array(MAX_UNITS),
    terminalThrowSource: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    targetReactions: createTargetReactionStore(MAX_UNITS),
    projectiles: createProjectileStore(),
    poisonEffects: createPoisonEffectStore(),
    mode: new Uint8Array(MAX_UNITS),
    carried: new Uint16Array(MAX_UNITS),
    carriedResource: new Uint8Array(MAX_UNITS),
    resourceCargo: new Float64Array(MAX_UNITS),
    taskTarget: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    tradeMarket: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    tradeTownCenter: new Uint32Array(MAX_UNITS).fill(NO_TARGET),
    tradeCargo: new Float64Array(MAX_UNITS),
    empowerTrainProgress: new Float64Array(MAX_UNITS),
    empowerResearchProgress: new Float64Array(MAX_UNITS),
    pharaohRespawnRemaining: new Uint16Array(256),
    gatherPosX: new Float64Array(MAX_UNITS),
    gatherPosZ: new Float64Array(MAX_UNITS),
    generation: new Uint16Array(MAX_UNITS),
    slotOf,
    handleOf: new Uint32Array(MAX_UNITS),
    nextHandle: 0,
    freeHandles: new Uint32Array(MAX_UNITS),
    freeHandleCount: 0,
    dying: new Uint8Array(MAX_UNITS),
    dyingFromDamage: new Uint8Array(MAX_UNITS),
    pendingDeaths: new Uint32Array(MAX_UNITS),
    pendingDeathCount: 0,
    deathEventCount: 0,
    deathEventIds: new Uint32Array(MAX_UNITS),
    deathEventTypes: new Uint16Array(MAX_UNITS),
    deathEventPosX: new Float64Array(MAX_UNITS),
    deathEventPosZ: new Float64Array(MAX_UNITS),
    deathEventFacingX: new Float64Array(MAX_UNITS),
    deathEventFacingZ: new Float64Array(MAX_UNITS),
    deathEventOwners: new Uint8Array(MAX_UNITS),
    deathEventCombatExperienceKills: new Uint8Array(MAX_UNITS),
    deathEventConditions: new Uint8Array(MAX_UNITS),
    deathEventCarried: new Uint16Array(MAX_UNITS),
    selectable: new Uint8Array(MAX_UNITS),
    // Per-client UI state in multiplayer eventually, but a plain component in M1.
    selected: new Uint8Array(MAX_UNITS),
    commands: [],
    winner: -1,
    contested: false,
    cellCount: new Uint32Array(GRID_CELLS),
    cellStart: new Uint32Array(GRID_CELLS + 1),
    cellUnits: new Uint32Array(MAX_UNITS),
    pushX: new Float64Array(MAX_UNITS),
    pushZ: new Float64Array(MAX_UNITS),
    // oxlint-disable-next-line unicorn/no-new-array
    unitField: new Array(MAX_UNITS).fill(null),
    fieldCache: [],
  };
}

function isTypeAvailableToPlayer(
  world: World,
  playerId: number,
  unitType: number,
  producerType = NO_UNIT_TYPE,
): boolean {
  if (
    playerId < 0 ||
    playerId >= world.playerSlotById.length ||
    world.playerSlotById[playerId] === -1
  ) {
    return false;
  }

  const majorGod = world.playerMajorGod[playerId]!;
  const minorGodStart = playerId * AGE_COUNT;

  return isTypeAvailable(unitType, {
    playerAge: world.playerAge[playerId]!,
    playerCulture: cultureForMajorGod(majorGod),
    producerType,
    hasCompletedBuilding: (buildingType) => hasCompletedBuilding(world, playerId, buildingType),
    ownedOrQueuedUnitCount: (type) => countLiveOrQueuedUnitType(world, playerId, type),
    hasGod: (god) => {
      if (god === majorGod) return true;
      for (let age = 0; age < AGE_COUNT; age += 1) {
        if (world.playerMinorGods[minorGodStart + age] === god) return true;
      }
      return false;
    },
  });
}

function hasWalkableDirectPath(
  world: World,
  unitType: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  distance: number,
): boolean {
  // Final approach is at most two world units. Quarter-tile segments cannot
  // skip an intervening cell, and isWalkableStep preserves the same diagonal
  // corner rule used by normal movement.
  const segmentCount = Math.ceil(distance * 4);
  let x = fromX;
  let z = fromZ;

  for (let segment = 1; segment <= segmentCount; segment += 1) {
    const nextX = fromX + ((toX - fromX) * segment) / segmentCount;
    const nextZ = fromZ + ((toZ - fromZ) * segment) / segmentCount;

    if (!isWalkableStep(world, x, z, nextX, nextZ, movementDomainForType(unitType))) {
      return false;
    }

    x = nextX;
    z = nextZ;
  }

  return true;
}

function remapGoalForNavigationGrid(
  navigationGrid: Uint8Array,
  targetX: number,
  targetZ: number,
): readonly [number, number] | null {
  const goalCell = cellOf(targetX, targetZ);

  if (navigationGrid[goalCell] === 1) {
    return [targetX, targetZ];
  }

  const goalTileX = goalCell % MAP_TILES;
  const goalTileZ = Math.floor(goalCell / MAP_TILES);

  // Fixed scan order is determinism; first hit is not the Euclidean-nearest
  // but is stable and matches Classic's closest-reachable command behavior.
  for (let radius = 1; radius <= GOAL_REMAP_RADIUS; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const tileX = goalTileX + dx;
        const tileZ = goalTileZ + dz;

        if (tileX < 0 || tileX >= MAP_TILES || tileZ < 0 || tileZ >= MAP_TILES) continue;
        if (navigationGrid[tileZ * MAP_TILES + tileX] === 1) {
          return [tileX + 0.5, tileZ + 0.5];
        }
      }
    }
  }

  return null;
}

export function spawnUnit(
  world: World,
  x: number,
  z: number,
  vx: number,
  vz: number,
  owner = 0,
  type = TYPE_GREEK_VILLAGER,
): number {
  if (world.count >= MAX_UNITS) {
    throw new RangeError("World unit capacity exceeded.");
  }

  if (owner !== NEUTRAL_OWNER && world.playerSlotById[owner] === -1) {
    throw new RangeError(`Player ${owner} must be registered before spawning owned entities.`);
  }

  const index = world.count;
  const handle =
    world.freeHandleCount > 0 ? world.freeHandles[--world.freeHandleCount]! : world.nextHandle++;

  world.slotOf[handle] = index;
  world.handleOf[index] = handle;
  world.posX[index] = x;
  world.posZ[index] = z;
  world.velX[index] = vx;
  world.velZ[index] = vz;
  world.moveTargetX[index] = 0;
  world.moveTargetZ[index] = 0;
  world.moving[index] = 0;
  // The fixed camera looks from -X/-Z, so new idle units begin front-facing.
  world.facingX[index] = -INV_SQRT2;
  world.facingZ[index] = -INV_SQRT2;
  setFacingToward(world, index, x + vx, z + vz);
  world.owner[index] = owner;
  world.unitType[index] = type;
  world.containedBy[index] = NO_TARGET;
  world.hp[index] = effectiveMaxHp(UNIT_TYPES[type]!, world.playerAge[owner]!);
  world.buildProgress[index] = 0;
  world.lifespanRemaining[index] = UNIT_TYPES[type]!.lifespanTicks ?? 0;
  world.combatExperienceKills[index] = 0;
  world.unitConditions[index] = 0;
  world.meleeSnareRemaining[index] = 0;
  clearProductionQueue(world, index);
  world.researchId[index] = NO_RESEARCH;
  world.researchChoice[index] = NO_GOD;
  world.researchRemaining[index] = 0;
  world.attackCooldown[index] = 0;
  world.beamActionImpactPending[index] = 0;
  world.beamActionActive[index] = 0;
  world.specialRecharge[index] = 0;
  clearSpecialAttack(world, index);
  world.supportActionRemaining[index] = 0;
  world.terminalThrowSource[index] = NO_TARGET;
  clearTargetReaction(world.targetReactions, index);
  world.carried[index] = 0;
  world.carriedResource[index] = 0;
  world.resourceCargo[index] = 0;
  world.tradeMarket[index] = NO_TARGET;
  world.tradeTownCenter[index] = NO_TARGET;
  world.tradeCargo[index] = 0;
  world.empowerTrainProgress[index] = 0;
  world.empowerResearchProgress[index] = 0;
  clearUnitTask(world, index);
  world.selectable[index] = 1;
  world.selected[index] = 0;
  world.count += 1;
  // Numerically identical while generations are 0; callers holding "indices" from spawnUnit
  // are already holding valid packed ids.
  return stableIdAt(world, index);
}

export function flushFlowFields(world: World): void {
  // Fields are derived from walkability; any walkability edit invalidates every cached path.
  // Units mid-move fall back to direct seek until their next field fetch: graceful, deterministic.
  world.fieldCache.length = 0;
  world.unitField.fill(null);
}

export function canPlaceBuilding(
  world: World,
  tileX: number,
  tileZ: number,
  type: number,
): boolean {
  const stats = UNIT_TYPES[type]!;
  const footprint = stats.footprint;

  if (stats.placementTerrain === "shoreline") {
    let landTiles = 0;
    let waterTiles = 0;

    for (let z = tileZ; z < tileZ + footprint; z += 1) {
      for (let x = tileX; x < tileX + footprint; x += 1) {
        if (x < 0 || x >= MAP_TILES || z < 0 || z >= MAP_TILES) return false;
        const cell = z * MAP_TILES + x;

        if (world.walkable[cell] === 1) {
          landTiles += 1;
        } else if (world.waterWalkable[cell] === 1) {
          waterTiles += 1;
        } else {
          return false;
        }
      }
    }

    return landTiles > 0 && waterTiles > 0;
  }

  // walkable doubles as the occupancy grid: mountains, other buildings, and map edges all reject
  // placement through one check.
  for (let z = tileZ; z < tileZ + footprint; z += 1) {
    for (let x = tileX; x < tileX + footprint; x += 1) {
      if (x < 0 || x >= MAP_TILES || z < 0 || z >= MAP_TILES) {
        return false;
      }

      if (world.walkable[z * MAP_TILES + x] !== 1) {
        return false;
      }
    }
  }

  return true;
}

export function spawnBuilding(
  world: World,
  tileX: number,
  tileZ: number,
  owner: number,
  type: number,
  complete = true,
): number {
  const footprint = UNIT_TYPES[type]!.footprint;
  const id = spawnUnit(world, tileX + footprint / 2, tileZ + footprint / 2, 0, 0, owner, type);
  const index = world.count - 1;

  // An incomplete building is a blueprint — present, footprint stamped, attackable,
  // but functionally inert until construction finishes in M6-5.
  world.buildProgress[index] = complete ? UNIT_TYPES[type]!.buildTicks : 0;
  // Units standing inside a just-stamped footprint are accepted as-is for M6 — the existing
  // same-tile movement allowance means they can always walk out.
  for (let z = tileZ; z < tileZ + footprint; z += 1) {
    for (let x = tileX; x < tileX + footprint; x += 1) {
      const cell = z * MAP_TILES + x;
      world.walkable[cell] = 0;
      world.waterWalkable[cell] = 0;
    }
  }

  flushFlowFields(world);

  return id;
}

export function resolveId(world: World, id: number): number {
  // -1 = stale or invalid — a unit that died during the input-delay window; callers treat it
  // as a silent, deterministic no-op. Ordering a corpse around must never be an error and NEVER
  // a desync. Dead handles keep slotOf = -1, so they resolve to -1 naturally.
  return resolveStableId(world, id);
}

export function unitIdAt(world: World, index: number): number {
  // How the engine converts a live index — e.g. from selection — into the id a command must carry.
  return stableIdAt(world, index);
}

function markUnitForDeath(
  world: World,
  index: number,
  fromDamage: boolean,
  destroyContainedSubtree: boolean,
): void {
  if (index < 0 || index >= world.count || world.dying[index] === 1) {
    return;
  }

  // Marks only; removal happens at tick end so mid-tick iteration order is never
  // disturbed. Callers today: tests; tomorrow: combat.
  world.dying[index] = 1;
  world.dyingFromDamage[index] = fromDamage ? 1 : 0;
  world.pendingDeaths[world.pendingDeathCount] = index;
  world.pendingDeathCount += 1;

  // A victim already committed by Cyclops Pickup is terminal even if its
  // carrier dies before the dedicated BUnitThrowAction completes.
  const dyingId = unitIdAt(world, index);
  for (let victim = 0; victim < world.count; victim += 1) {
    if (
      world.terminalThrowSource[victim] === dyingId &&
      world.containedBy[victim] === dyingId
    ) {
      markUnitForDeath(world, victim, true, true);
    }
  }

  // Mobile transports take their cargo down with them. Containers that author
  // ejection on death release later, before their stable handle is invalidated.
  if (
    destroyContainedSubtree ||
    UNIT_TYPES[world.unitType[index]!]!.garrison?.ejectOnDeath === false
  ) {
    const containerId = dyingId;
    for (let occupant = 0; occupant < world.count; occupant += 1) {
      if (world.containedBy[occupant] === containerId) {
        markUnitForDeath(world, occupant, fromDamage, true);
      }
    }
  }
}

export function killUnit(world: World, index: number, fromDamage = false): void {
  markUnitForDeath(world, index, fromDamage, false);
}

export function transformPharaohToSonOfOsiris(world: World, id: number): boolean {
  const index = resolveId(world, id);
  if (index < 0 || world.unitType[index] !== TYPE_PHARAOH || world.dying[index] === 1) return false;
  const owner = world.owner[index]!;
  let hasOsiris = world.playerMajorGod[owner] === GOD_OSIRIS;
  const minorGodStart = owner * AGE_COUNT;
  for (let age = 0; age < AGE_COUNT && !hasOsiris; age += 1) {
    hasOsiris = world.playerMinorGods[minorGodStart + age] === GOD_OSIRIS;
  }
  if (!hasOsiris) return false;

  const hpFraction = world.hp[index]! / effectiveMaxHp(UNIT_TYPES[TYPE_PHARAOH]!, world.playerAge[owner]!);
  clearAttackOrder(world, index);
  clearUnitTask(world, index);
  clearSpecialAttack(world, index);
  world.unitType[index] = TYPE_SON_OF_OSIRIS;
  world.hp[index] = effectiveMaxHp(UNIT_TYPES[TYPE_SON_OF_OSIRIS]!, world.playerAge[owner]!) * hpFraction;
  world.pharaohRespawnRemaining[owner] = 0;
  return true;
}

export function clearSelection(world: World): void {
  world.selected.fill(0, 0, world.count);
}

export function setSelected(world: World, id: number, on: boolean): void {
  if (id < 0 || id >= world.count) {
    return;
  }

  world.selected[id] = on ? 1 : 0;
}

export interface StartingUnitTypesByCulture {
  readonly [culture: number]: readonly number[] | undefined;
}

// Standard Classic random-map starts give every Greek player exactly one
// Kataskopos. Scenario-owned additions are appended by createPlayableWorld.
export const CLASSIC_STARTING_UNIT_TYPES_BY_CULTURE: StartingUnitTypesByCulture = {
  [CULTURE_GREEK]: [TYPE_KATASKOPOS],
  [CULTURE_EGYPTIAN]: [TYPE_PHARAOH, TYPE_PRIEST],
};

export interface MatchPlayerSetup {
  readonly id: number;
  readonly majorGod: number;
}

function spawnMobileUnitNearStart(
  world: World,
  centerX: number,
  centerZ: number,
  owner: number,
  type: number,
  startField: FlowField,
): void {
  let x = 0;
  let z = 0;
  let placed = false;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rawX = centerX - 28 + nextFloat(world.rng) * 56;
    const rawZ = centerZ - 28 + nextFloat(world.rng) * 56;

    x = rawX < 8 ? 8 : rawX > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawX;
    z = rawZ < 8 ? 8 : rawZ > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawZ;

    if (world.walkable[cellOf(x, z)] === 1 && reachableIn(startField, x, z)) {
      placed = true;
      break;
    }
  }

  if (!placed) {
    x = (startField.goalCell & (MAP_TILES - 1)) + 0.5;
    z = (startField.goalCell >>> 8) + 0.5;
  }

  // Spawn retry consumes a seed-derived, deterministic number of rng draws.
  spawnUnit(world, x, z, 0, 0, owner, type);
}

export function spawnUnits(
  world: World,
  count: number,
  ownerIds: number[] = [0],
  startingUnitTypesByCulture?: StartingUnitTypesByCulture,
): void {
  const ownerCount = ownerIds.length;

  // A solo world must never declare a winner.
  world.contested = ownerCount > 1;

  if (ownerCount === 0) {
    return;
  }

  const startLocations = startLocationsForMap(world.mapId, world.mapSeed, ownerCount);

  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    registerPlayer(world, ownerIds[ownerIndex]!);
  }

  // Placement affordability lands in M6-4; 100/100 is a balance-pass placeholder.
  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    const owner = ownerIds[ownerIndex]!;
    let alreadyCredited = false;

    for (let previousIndex = 0; previousIndex < ownerIndex; previousIndex += 1) {
      if (ownerIds[previousIndex] === owner) {
        alreadyCredited = true;
        break;
      }
    }

    if (alreadyCredited) {
      continue;
    }

    world.stockpiles[owner * RESOURCE_COUNT + FOOD] = 100;
    world.stockpiles[owner * RESOURCE_COUNT + WOOD] = 100;
    world.stockpiles[owner * RESOURCE_COUNT + GOLD] = 0;
    world.stockpiles[owner * RESOURCE_COUNT + FAVOR] = 0;
  }

  const baseCount = Math.floor(count / ownerCount);
  const extraCount = count % ownerCount;

  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    const owner = ownerIds[ownerIndex]!;
    const [centerX, centerZ] = startLocations[ownerIndex]!;
    const unitsForOwner = baseCount + (ownerIndex < extraCount ? 1 : 0);
    const culture = cultureForMajorGod(world.playerMajorGod[owner]!);
    const townCenterType = townCenterTypeForCulture(culture);
    const workerType = workerTypeForCulture(culture);

    // Placed before units so the walkable-resample naturally keeps the army off the footprint;
    // deterministic order is preserved.
    spawnBuilding(world, centerX - 2, centerZ - 2, owner, townCenterType);
    const inwardX = centerX + (centerX < SIM_MAP_SIZE * 0.5 ? 6 : -6);
    const inwardZ = centerZ + (centerZ < SIM_MAP_SIZE * 0.5 ? 6 : -6);
    const startField = buildFlowField(world.walkable, walkableCellNear(world, inwardX, inwardZ));

    for (let i = 0; i < unitsForOwner; i += 1) {
      // Drift was M1 scaffolding to exercise interpolation; M3 units stand still until commanded.
      spawnMobileUnitNearStart(world, centerX, centerZ, owner, workerType, startField);
    }

    const additionalTypes = startingUnitTypesByCulture?.[culture] ?? [];
    for (let i = 0; i < additionalTypes.length; i += 1) {
      spawnMobileUnitNearStart(world, centerX, centerZ, owner, additionalTypes[i]!, startField);
    }
  }
}

// A resource node needs standing room: its own tile AND all eight neighbors
// walkable. A node on (or ringed by) rock is permanently ungatherable — workers
// grind against the boundary forever. Placement skips such spots.
function isNodeSpotOpen(world: World, x: number, z: number): boolean {
  const tx = Math.floor(x);
  const tz = Math.floor(z);

  if (tx < 1 || tx >= MAP_TILES - 1 || tz < 1 || tz >= MAP_TILES - 1) {
    return false;
  }

  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (world.walkable[(tz + dz) * MAP_TILES + (tx + dx)] !== 1) {
        return false;
      }
    }
  }

  return true;
}

// Local standing room (isNodeSpotOpen) is not enough: value-noise mountains form
// walkable POCKETS sealed off from the spawns, and a node inside one is passable
// 3x3 but globally unreachable — workers commute to it forever. Reachability is
// checked against a flow field built from each spawn corner at placement time.
function reachableIn(field: FlowField, x: number, z: number): boolean {
  const cell = cellOf(x, z);

  return cell === field.goalCell || field.dirX[cell] !== 0 || field.dirZ[cell] !== 0;
}

function canTypeGatherResource(workerType: number, resourceType: number): boolean {
  const resourceStats = UNIT_TYPES[resourceType]!;

  return (
    resourceStats.resource >= 0 &&
    (resourceStats.resourceGathererDomain === undefined ||
      movementDomainForType(workerType) === resourceStats.resourceGathererDomain)
  );
}

function gatherCargo(world: World, index: number): number {
  return UNIT_TYPES[world.unitType[index]!]!.gather === undefined
    ? world.carried[index]!
    : world.resourceCargo[index]!;
}

function gatherCapacity(world: World, index: number): number {
  return UNIT_TYPES[world.unitType[index]!]!.gather?.capacity ?? CARRY_CAPACITY;
}

function canUseResourceDropsite(
  workerType: number,
  dropsiteType: number,
  resource: number,
): boolean {
  const dropsite = UNIT_TYPES[dropsiteType]!;
  return (
    dropsite.isDropsite &&
    (dropsite.resourceDropsiteResources === undefined ||
      dropsite.resourceDropsiteResources.includes(resource as ResourceType)) &&
    movementDomainForType(workerType) === (dropsite.resourceDropsiteDomain ?? MOVEMENT_DOMAIN_LAND)
  );
}

// Deterministic spiral for a walkable cell near a corner (the corner itself sits
// under the pre-placed Town Center footprint).
function walkableCellNear(world: World, x: number, z: number): number {
  return navigableCellNear(world, x, z, MOVEMENT_DOMAIN_LAND);
}

function hasNodeClearance(world: World, x: number, z: number, goldMineSpacing: number): boolean {
  for (let i = 0; i < world.count; i += 1) {
    const type = world.unitType[i]!;

    if (UNIT_TYPES[type]!.resource < 0) continue;

    const dx = world.posX[i]! - x;
    const dz = world.posZ[i]! - z;
    const clearance = type === TYPE_GOLD_MINE ? goldMineSpacing : GOLD_OTHER_NODE_CLEARANCE;

    if (dx * dx + dz * dz < clearance * clearance) {
      return false;
    }
  }

  return true;
}

function findConstrainedGoldSpot(
  world: World,
  startX: number,
  startZ: number,
  field: FlowField,
  minDistance: number,
  maxDistance: number,
  goldMineSpacing: number,
): readonly [number, number] | null {
  const minDistanceSq = minDistance * minDistance;
  const maxDistanceSq = maxDistance * maxDistance;

  // Square rejection sampling produces a random direction without sin/cos,
  // which are banned by the deterministic simulation contract.
  for (let attempt = 0; attempt < GOLD_PLACEMENT_ATTEMPTS; attempt += 1) {
    const x = startX + (nextFloat(world.rng) * 2 - 1) * maxDistance;
    const z = startZ + (nextFloat(world.rng) * 2 - 1) * maxDistance;
    const dx = x - startX;
    const dz = z - startZ;
    const distanceSq = dx * dx + dz * dz;

    if (
      distanceSq >= minDistanceSq &&
      distanceSq <= maxDistanceSq &&
      isNodeSpotOpen(world, x, z) &&
      reachableIn(field, x, z) &&
      hasNodeClearance(world, x, z, goldMineSpacing)
    ) {
      return [x, z];
    }
  }

  // Required map objects do not silently disappear after unlucky sampling.
  // The stable row-major fallback finds any legal tile in the same band.
  for (let tileZ = 1; tileZ < MAP_TILES - 1; tileZ += 1) {
    for (let tileX = 1; tileX < MAP_TILES - 1; tileX += 1) {
      const x = tileX + 0.5;
      const z = tileZ + 0.5;
      const dx = x - startX;
      const dz = z - startZ;
      const distanceSq = dx * dx + dz * dz;

      if (
        distanceSq >= minDistanceSq &&
        distanceSq <= maxDistanceSq &&
        isNodeSpotOpen(world, x, z) &&
        reachableIn(field, x, z) &&
        hasNodeClearance(world, x, z, goldMineSpacing)
      ) {
        return [x, z];
      }
    }
  }

  return null;
}

function spawnGoldMines(
  world: World,
  startLocations: readonly StartLocation[],
  startFields: readonly FlowField[],
): void {
  const placements =
    world.mapId === MAP_RIVER_NILE ? RIVER_NILE_GOLD_PLACEMENTS : AEGEAN_GOLD_PLACEMENTS;

  for (const placement of placements) {
    for (let copy = 0; copy < placement.perPlayer; copy += 1) {
      for (let playerIndex = 0; playerIndex < world.playerCount; playerIndex += 1) {
        const [startX, startZ] = startLocations[playerIndex]!;
        const spot = findConstrainedGoldSpot(
          world,
          startX,
          startZ,
          startFields[playerIndex]!,
          placement.minDistance,
          placement.maxDistance,
          placement.goldMineSpacing,
        );

        if (spot === null) {
          throw new RequiredGoldMinePlacementError(playerIndex);
        }

        spawnUnit(world, spot[0], spot[1], 0, 0, NEUTRAL_OWNER, TYPE_GOLD_MINE);
      }
    }
  }
}

function isAegeanBerryPatchOpen(
  world: World,
  centerX: number,
  centerZ: number,
  field: FlowField,
  count: number,
): boolean {
  for (let bush = 0; bush < count; bush += 1) {
    const [offsetX, offsetZ] = AEGEAN_BERRY_CLUSTER_OFFSETS[bush]!;
    const x = centerX + offsetX;
    const z = centerZ + offsetZ;

    if (
      !isNodeSpotOpen(world, x, z) ||
      !reachableIn(field, x, z) ||
      !hasNodeClearance(world, x, z, GOLD_OTHER_NODE_CLEARANCE)
    ) {
      return false;
    }
  }

  return true;
}

function findConstrainedAegeanBerryPatch(
  world: World,
  startX: number,
  startZ: number,
  field: FlowField,
  count: number,
  minDistance: number,
  maxDistance: number,
): readonly [number, number] | null {
  const minDistanceSq = minDistance * minDistance;
  const maxDistanceSq = maxDistance * maxDistance;

  for (let attempt = 0; attempt < AEGEAN_BERRY_PATCH_PLACEMENT_ATTEMPTS; attempt += 1) {
    const centerX = startX + (nextFloat(world.rng) * 2 - 1) * maxDistance;
    const centerZ = startZ + (nextFloat(world.rng) * 2 - 1) * maxDistance;
    const dx = centerX - startX;
    const dz = centerZ - startZ;
    const distanceSq = dx * dx + dz * dz;

    if (
      distanceSq >= minDistanceSq &&
      distanceSq <= maxDistanceSq &&
      isAegeanBerryPatchOpen(world, centerX, centerZ, field, count)
    ) {
      return [centerX, centerZ];
    }
  }

  // Required food never disappears because rejection sampling was unlucky.
  for (let tileZ = 5; tileZ < MAP_TILES - 5; tileZ += 1) {
    for (let tileX = 5; tileX < MAP_TILES - 5; tileX += 1) {
      const centerX = tileX + 0.5;
      const centerZ = tileZ + 0.5;
      const dx = centerX - startX;
      const dz = centerZ - startZ;
      const distanceSq = dx * dx + dz * dz;

      if (
        distanceSq >= minDistanceSq &&
        distanceSq <= maxDistanceSq &&
        isAegeanBerryPatchOpen(world, centerX, centerZ, field, count)
      ) {
        return [centerX, centerZ];
      }
    }
  }

  return null;
}

function spawnAegeanBerryPatches(
  world: World,
  startLocations: readonly StartLocation[],
  startFields: readonly FlowField[],
): void {
  for (const placement of AEGEAN_BERRY_PLACEMENTS) {
    for (let playerIndex = 0; playerIndex < world.playerCount; playerIndex += 1) {
      const [startX, startZ] = startLocations[playerIndex]!;
      const center = findConstrainedAegeanBerryPatch(
        world,
        startX,
        startZ,
        startFields[playerIndex]!,
        placement.count,
        placement.minDistance,
        placement.maxDistance,
      );

      if (center === null) {
        throw new RequiredBerryPatchPlacementError(playerIndex);
      }

      for (let bush = 0; bush < placement.count; bush += 1) {
        const [offsetX, offsetZ] = AEGEAN_BERRY_CLUSTER_OFFSETS[bush]!;
        spawnUnit(world, center[0] + offsetX, center[1] + offsetZ, 0, 0, NEUTRAL_OWNER, TYPE_BERRY);
      }
    }
  }
}

function isFarFromActiveStarts(
  world: World,
  x: number,
  z: number,
  startLocations: readonly StartLocation[],
): boolean {
  const clearanceSq = RIVER_NILE_BERRY_START_CLEARANCE * RIVER_NILE_BERRY_START_CLEARANCE;

  for (let playerIndex = 0; playerIndex < world.playerCount; playerIndex += 1) {
    const [startX, startZ] = startLocations[playerIndex]!;
    const dx = x - startX;
    const dz = z - startZ;
    if (dx * dx + dz * dz < clearanceSq) return false;
  }

  return true;
}

function reachableFromAnActiveStart(
  world: World,
  x: number,
  z: number,
  startFields: readonly FlowField[],
): boolean {
  for (let playerIndex = 0; playerIndex < world.playerCount; playerIndex += 1) {
    if (reachableIn(startFields[playerIndex]!, x, z)) return true;
  }

  return false;
}

function sampleClusterPoint(
  world: World,
  centerX: number,
  centerZ: number,
  radius: number,
): readonly [number, number] {
  const radiusSq = radius * radius;

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const dx = (nextFloat(world.rng) * 2 - 1) * radius;
    const dz = (nextFloat(world.rng) * 2 - 1) * radius;
    if (dx * dx + dz * dz <= radiusSq) return [centerX + dx, centerZ + dz];
  }

  return [centerX, centerZ];
}

function spawnRiverNileBerryPatches(
  world: World,
  startLocations: readonly StartLocation[],
  startFields: readonly FlowField[],
): void {
  // river nile.xs uses cNumberPlayers / 2 copies; cNumberPlayers includes Gaia.
  const patchCount = Math.floor((world.playerCount + 1) / 2);

  for (let patchIndex = 0; patchIndex < patchCount; patchIndex += 1) {
    let patch: readonly (readonly [number, number])[] | null = null;

    for (let attempt = 0; attempt < 1_024 && patch === null; attempt += 1) {
      const centerX = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);
      const centerZ = 8 + nextFloat(world.rng) * (SIM_MAP_SIZE - 16);
      const candidates: (readonly [number, number])[] = [];
      let valid = true;

      for (let bush = 0; bush < RIVER_NILE_BERRIES_PER_PATCH; bush += 1) {
        const [x, z] = sampleClusterPoint(world, centerX, centerZ, RIVER_NILE_BERRY_PATCH_RADIUS);

        if (
          !isNodeSpotOpen(world, x, z) ||
          !isFarFromActiveStarts(world, x, z, startLocations) ||
          !reachableFromAnActiveStart(world, x, z, startFields) ||
          !hasNodeClearance(world, x, z, GOLD_OTHER_NODE_CLEARANCE)
        ) {
          valid = false;
        }
        candidates.push([x, z]);
      }

      if (valid) patch = candidates;
    }

    if (patch === null) {
      throw new RequiredBerryPatchPlacementError(patchIndex);
    }

    for (const [x, z] of patch) {
      spawnUnit(world, x, z, 0, 0, NEUTRAL_OWNER, TYPE_BERRY);
    }
  }
}

function isDeepWaterSpot(world: World, x: number, z: number): boolean {
  const tileX = Math.floor(x);
  const tileZ = Math.floor(z);
  const clearance = RIVER_NILE_FISH_LAND_CLEARANCE;
  const clearanceSq = clearance * clearance;

  if (
    tileX < clearance ||
    tileX >= MAP_TILES - clearance ||
    tileZ < clearance ||
    tileZ >= MAP_TILES - clearance ||
    world.waterNavigable[tileZ * MAP_TILES + tileX] !== 1
  ) {
    return false;
  }

  for (let dz = -clearance; dz <= clearance; dz += 1) {
    for (let dx = -clearance; dx <= clearance; dx += 1) {
      if (
        dx * dx + dz * dz <= clearanceSq &&
        world.waterNavigable[(tileZ + dz) * MAP_TILES + tileX + dx] !== 1
      ) {
        return false;
      }
    }
  }

  return true;
}

function spawnRiverNileFishSchools(world: World): void {
  const schoolCount = 3 * world.playerCount;
  const schoolCenters: (readonly [number, number])[] = [];
  const schoolSpacingSq = RIVER_NILE_FISH_SCHOOL_SPACING * RIVER_NILE_FISH_SCHOOL_SPACING;

  for (let schoolIndex = 0; schoolIndex < schoolCount; schoolIndex += 1) {
    let school: readonly (readonly [number, number])[] | null = null;
    let acceptedCenter: readonly [number, number] | null = null;

    for (let attempt = 0; attempt < 4_096 && school === null; attempt += 1) {
      const centerX =
        RIVER_NILE_FISH_SCHOOL_RADIUS +
        nextFloat(world.rng) * (SIM_MAP_SIZE - RIVER_NILE_FISH_SCHOOL_RADIUS * 2);
      const centerZ =
        RIVER_NILE_FISH_SCHOOL_RADIUS +
        nextFloat(world.rng) * (SIM_MAP_SIZE - RIVER_NILE_FISH_SCHOOL_RADIUS * 2);
      let clearOfSchools = true;

      for (const [otherX, otherZ] of schoolCenters) {
        const dx = centerX - otherX;
        const dz = centerZ - otherZ;
        if (dx * dx + dz * dz < schoolSpacingSq) {
          clearOfSchools = false;
          break;
        }
      }
      if (!clearOfSchools) continue;

      const candidates: (readonly [number, number])[] = [];
      let valid = true;
      for (let fish = 0; fish < RIVER_NILE_FISH_PER_SCHOOL; fish += 1) {
        const point = sampleClusterPoint(world, centerX, centerZ, RIVER_NILE_FISH_SCHOOL_RADIUS);
        if (!isDeepWaterSpot(world, point[0], point[1])) valid = false;
        candidates.push(point);
      }

      if (valid) {
        school = candidates;
        acceptedCenter = [centerX, centerZ];
      }
    }

    if (school === null || acceptedCenter === null) {
      throw new RequiredFishSchoolPlacementError(schoolIndex);
    }

    schoolCenters.push(acceptedCenter);
    for (const [x, z] of school) {
      spawnUnit(world, x, z, 0, 0, NEUTRAL_OWNER, TYPE_FISH_PERCH);
    }
  }
}

export function spawnResourceNodes(world: World): void {
  // Fixed order: the rng stream and handle assignment depend on call order; do not reorder.
  // Keep the two legacy forest fields in solo play. Multiplayer adds one field
  // per active start; food and gold profiles use active starts only.
  const startFieldCount = Math.max(2, world.playerCount);
  const startLocations = startLocationsForMap(world.mapId, world.mapSeed, startFieldCount);
  const startFields: FlowField[] = [];

  for (let playerIndex = 0; playerIndex < startFieldCount; playerIndex += 1) {
    const [startX, startZ] = startLocations[playerIndex]!;
    const inwardX = startX + (startX < SIM_MAP_SIZE * 0.5 ? 6 : -6);
    const inwardZ = startZ + (startZ < SIM_MAP_SIZE * 0.5 ? 6 : -6);
    startFields.push(buildFlowField(world.walkable, walkableCellNear(world, inwardX, inwardZ)));
  }

  const fieldA = startFields[0]!;
  const fieldB = startFields[1]!;
  for (let cluster = 0; cluster < 6; cluster += 1) {
    let centerX = 0;
    let centerZ = 0;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      centerX = 30 + nextFloat(world.rng) * 196;
      centerZ = 30 + nextFloat(world.rng) * 196;
      const mirrorCenterX = SIM_MAP_SIZE - centerX;
      const mirrorCenterZ = SIM_MAP_SIZE - centerZ;
      let clearOfStarts = true;

      for (const [startX, startZ] of startLocations) {
        const dx = centerX - startX;
        const dz = centerZ - startZ;
        const mirrorDx = mirrorCenterX - startX;
        const mirrorDz = mirrorCenterZ - startZ;

        if (dx * dx + dz * dz < 45 * 45 || mirrorDx * mirrorDx + mirrorDz * mirrorDz < 45 * 45) {
          clearOfStarts = false;
          break;
        }
      }

      if (clearOfStarts) {
        break;
      }
    }

    const treeCount = 8 + Math.floor(nextFloat(world.rng) * 8);

    for (let tree = 0; tree < treeCount; tree += 1) {
      let placed = false;

      for (let attempt = 0; attempt < 20 && !placed; attempt += 1) {
        const rawX = centerX - 10 + nextFloat(world.rng) * 20;
        const rawZ = centerZ - 10 + nextFloat(world.rng) * 20;
        const x = rawX < 8 ? 8 : rawX > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawX;
        const z = rawZ < 8 ? 8 : rawZ > SIM_MAP_SIZE - 8 ? SIM_MAP_SIZE - 8 : rawZ;
        const mirrorX = SIM_MAP_SIZE - x;
        const mirrorZ = SIM_MAP_SIZE - z;
        let reachableForAdditionalPlayers = true;

        for (let playerIndex = 2; playerIndex < startFields.length; playerIndex += 1) {
          const field = startFields[playerIndex]!;

          if (!reachableIn(field, x, z) && !reachableIn(field, mirrorX, mirrorZ)) {
            reachableForAdditionalPlayers = false;
            break;
          }
        }

        // Terrain is NOT symmetric: a fine spot can have an on-rock mirror.
        // Place the pair only when BOTH ends are gatherable; skipping the pair
        // (not just one end) is what keeps the halves fair. Every additional
        // player must be able to reach at least one end of the pair.
        if (
          isNodeSpotOpen(world, x, z) &&
          isNodeSpotOpen(world, mirrorX, mirrorZ) &&
          reachableIn(fieldA, x, z) &&
          reachableIn(fieldB, mirrorX, mirrorZ) &&
          reachableForAdditionalPlayers
        ) {
          spawnUnit(world, x, z, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
          spawnUnit(world, mirrorX, mirrorZ, 0, 0, NEUTRAL_OWNER, TYPE_TREE);
          placed = true;
        }
      }
    }
  }

  if (world.mapId === MAP_RIVER_NILE) {
    spawnRiverNileBerryPatches(world, startLocations, startFields);
  } else {
    spawnAegeanBerryPatches(world, startLocations, startFields);
  }

  // Gold is placed after existing resources so its clearance constraints cannot
  // perturb the established forest and berry layouts for the same seed.
  spawnGoldMines(world, startLocations, startFields);

  if (world.mapId === MAP_RIVER_NILE) {
    spawnRiverNileFishSchools(world);
  }
}

// Random terrain can occasionally seal a start into a component too small for
// its required starting/medium/far mine bands. Match setup deterministically
// advances the shared seed and rebuilds the whole initial world, so every peer
// chooses the same playable map without moving a mine outside its profile or
// making an unreachable mine gatherable by fiat.
export function createPlayableWorld(
  seed: number,
  unitCount: number,
  players: readonly MatchPlayerSetup[],
  startingUnitTypesByCulture?: StartingUnitTypesByCulture,
  mapId: MapId = DEFAULT_MAP_ID,
): World {
  const ownerIds = players.map((player) => player.id);

  for (let attempt = 0; attempt < MAX_PLAYABLE_MAP_SEED_ATTEMPTS; attempt += 1) {
    const worldSeed = (seed + attempt) >>> 0;
    const world = createWorld(worldSeed, mapId, Math.max(2, players.length));

    for (const player of players) {
      registerPlayer(world, player.id, player.majorGod);
    }

    const combinedStartingTypes = {
      ...startingUnitTypesByCulture,
      [CULTURE_GREEK]: [
        ...(CLASSIC_STARTING_UNIT_TYPES_BY_CULTURE[CULTURE_GREEK] ?? []),
        ...(startingUnitTypesByCulture?.[CULTURE_GREEK] ?? []),
      ],
      [CULTURE_EGYPTIAN]: [
        ...(CLASSIC_STARTING_UNIT_TYPES_BY_CULTURE[CULTURE_EGYPTIAN] ?? []),
        ...(startingUnitTypesByCulture?.[CULTURE_EGYPTIAN] ?? []),
      ],
    } satisfies StartingUnitTypesByCulture;

    spawnUnits(world, unitCount, ownerIds, combinedStartingTypes);

    try {
      spawnResourceNodes(world);
      return world;
    } catch (error) {
      if (!(error instanceof RequiredMapObjectPlacementError)) {
        throw error;
      }
    }
  }

  throw new RangeError(
    `Unable to generate a playable map after ${MAX_PLAYABLE_MAP_SEED_ATTEMPTS} seeds.`,
  );
}

export function tickWorld(world: World): void {
  world.deathEventCount = 0;
  const terminalReplacementSpawns: Array<{
    readonly x: number;
    readonly z: number;
    readonly owner: number;
    readonly type: number;
  }> = [];

  // 1. Visibility reads positions from the last completed movement step. Command
  // validation and combat below therefore consult the same authoritative mask.
  updateVisibility(world);

  // 2. Apply commands at the start of the tick.
  applyPendingCommands(world);

  // 3. Existing target reactions advance before the spatial grid is rebuilt.
  // A reaction created by this tick's combat impact begins moving next tick,
  // matching the action-controller handoff in Classic.
  let hasActiveTargetReactions = tickTargetReactions(world);

  // 4. Build a spatial grid from current authoritative positions.
  rebuildUnitSpatialGrid(world);

  // 5. Existing projectile entities launch, fly, and impact before units decide
  // whether to begin a new attack cycle. A newly queued projectile cannot advance
  // until the next tick, preserving its animation-timed release boundary.
  tickProjectileStore(world, world.projectiles, UNIT_TYPES, MAX_PROJECTILE_BODY_RADIUS, dealDamage);
  tickPoisonEffects(world, world.poisonEffects, UNIT_TYPES, dealDamage);

  // Persistent Regenerate actions are source-authored rates, not an interruptible
  // order. Apply them after existing projectile impacts so lethal damage cannot
  // be reversed, and before this tick's units choose their next action.
  for (let i = 0; i < world.count; i += 1) {
    if (world.dying[i] === 1 || world.hp[i]! <= 0) continue;
    const stats = UNIT_TYPES[world.unitType[i]!]!;
    const rate = stats.regenerationPerSecond;
    const maxHp = effectiveMaxHp(stats, world.playerAge[world.owner[i]!]!);
    if (rate !== undefined && world.hp[i]! < maxHp) {
      world.hp[i] = Math.min(maxHp, world.hp[i]! + rate * TICK_S);
    }
  }

  // 6. Combat needs the fresh spatial grid for acquisition and writes moveTarget/moving
  // that the movement compute then consumes.
  for (let i = 0; i < world.count; i += 1) {
    const stats = UNIT_TYPES[world.unitType[i]!]!;
    const currentTarget = resolveId(world, world.attackTarget[i]!);
    const currentTargetStats =
      currentTarget >= 0 ? UNIT_TYPES[world.unitType[currentTarget]!]! : null;
    const attack =
      stats.buildingAttack !== undefined &&
      currentTargetStats !== null &&
      (currentTargetStats.classes & UNIT_CLASS_BUILDING) !== 0
        ? stats.buildingAttack
        : stats.attack;
    const special = stats.specialAttack;

    if (world.containedBy[i] !== NO_TARGET || stats.isStatic) {
      // Contained and static rows never auto-acquire or strike.
      continue;
    }
    if (attack === null) {
      // Economic gatherers reuse the action cooldown for source-rate cadence
      // without gaining a combat attack.
      if (stats.gather !== undefined && world.attackCooldown[i]! > 0) {
        world.attackCooldown[i] = world.attackCooldown[i]! - 1;
      }
      continue;
    }

    const activeMeleeCycle =
      attack.kind === "melee" ? activeMeleeAttackCycle(world, i, attack) : null;
    const activeBeamCycle =
      attack.kind === "beam" &&
      world.specialActionRemaining[i] === 0 &&
      world.beamActionActive[i] === 1 &&
      world.attackCooldown[i]! > 0;
    if (activeMeleeCycle === null && !activeBeamCycle && world.attackCooldown[i]! > 0) {
      world.attackCooldown[i] = world.attackCooldown[i]! - 1;
    }
    if (special !== undefined) tickSpecialRecharge(world, i);

    // Forced reactions overlay pending intent. The reaction policy decides
    // whether the unit may execute attacks and ordinary orders this tick.
    if (
      hasActiveTargetReactions &&
      targetReactionCapabilitiesAt(world.targetReactions, i).blocksOrderExecution
    ) {
      continue;
    }

    if (activeMeleeCycle !== null && attack.kind === "melee") {
      if (
        tickActiveMeleeAttack(
          world,
          i,
          attack,
          activeMeleeCycle,
          NEUTRAL_OWNER,
          resolvePrimaryMeleeImpact,
        )
      ) {
        continue;
      }
    }

    if (
      activeBeamCycle &&
      attack.kind === "beam" &&
      tickActiveBeamAttack(world, i, attack, NEUTRAL_OWNER, dealDamage)
    ) {
      continue;
    }

    if (world.specialActionRemaining[i]! > 0) {
      // A charged action owns the unit's position until it completes or is
      // interrupted. Movement, tasks, and the later separation pass must not
      // make the attacker slide through its authored animation.
      world.moving[i] = 0;
      world.unitField[i] = null;

      if (special === undefined) {
        clearSpecialAttack(world, i);
      } else if (special.kind === "charged-pickup-throw") {
        const target = resolveId(world, world.specialActionTarget[i]!);
        const targetStats = target >= 0 ? UNIT_TYPES[world.unitType[target]!]! : null;
        const elapsed = special.actionTicks - world.specialActionRemaining[i]!;
        const committed = world.specialActionImpactPending[i]! >= 2;

        if (!committed) {
          const targetVisible =
            target >= 0 && isEntityVisibleTo(world, world.owner[i]!, target);
          const dx = target >= 0 ? world.posX[target]! - world.posX[i]! : 0;
          const dz = target >= 0 ? world.posZ[target]! - world.posZ[i]! : 0;
          const reach =
            targetStats === null ? 0 : centerDistanceForEdgeRange(special.range, stats, targetStats);
          if (
            targetStats === null ||
            world.dying[target] === 1 ||
            world.hp[target] === 0 ||
            !targetVisible ||
            !isValidSpecialTarget(special, targetStats, world.unitConditions[target]!) ||
            dx * dx + dz * dz > reach * reach
          ) {
            clearSpecialAttack(world, i);
            world.attackCooldown[i] = 0;
            continue;
          }
          setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);
        }

        const phase = advancePickupThrowSpecialAttack(world, i, special);
        if (phase === "pickup") {
          // KillsTargetAfterPickupAction commits terminal ownership here. The
          // combined Cyclops mesh presents both units for the rest of the action.
          clearUnitTask(world, target);
          cancelPendingProjectilesBySource(world.projectiles, unitIdAt(world, target));
          world.hp[target] = 0;
          world.containedBy[target] = unitIdAt(world, i);
          world.terminalThrowSource[target] = unitIdAt(world, i);
          world.moving[target] = 0;
          world.selected[target] = 0;
        } else if (phase === "throw") {
          if (target < 0 || world.terminalThrowSource[target] !== unitIdAt(world, i)) {
            throw new RangeError("Committed pickup target disappeared before the Throw tag.");
          }

          resolveAreaDamageAt(
            world,
            world.owner[i]!,
            world.posX[i]!,
            world.posZ[i]!,
            special,
            UNIT_TYPES,
            NEUTRAL_OWNER,
            (state, hitTarget, damage) => dealDamage(state, hitTarget, damage, i),
            i,
          );
        } else if (elapsed > special.throwDelayTicks && phase === "held") {
          throw new RangeError("Pickup/throw action remained held past its authored Throw tag.");
        } else if (phase === "complete") {
          if (target < 0 || world.terminalThrowSource[target] !== unitIdAt(world, i)) {
            throw new RangeError("Committed pickup target disappeared before action completion.");
          }
          world.terminalThrowSource[target] = NO_TARGET;
          world.containedBy[target] = NO_TARGET;
          world.posX[target] = world.posX[i]!;
          world.posZ[target] = world.posZ[i]!;
          killUnit(world, target, true);
        }
        continue;
      } else if (world.specialActionImpactPending[i] === 1) {
        const target = resolveId(world, world.specialActionTarget[i]!);
        const targetStats = target >= 0 ? UNIT_TYPES[world.unitType[target]!]! : null;
        const targetVisible = target >= 0 && isEntityVisibleTo(world, world.owner[i]!, target);
        const dx = target >= 0 ? world.posX[target]! - world.posX[i]! : 0;
        const dz = target >= 0 ? world.posZ[target]! - world.posZ[i]! : 0;
        const reach =
          targetStats === null ? 0 : centerDistanceForEdgeRange(special.range, stats, targetStats);
        const jumpCommitted =
          special.kind === "charged-jump" &&
          special.actionTicks - world.specialActionRemaining[i]! >= special.takeoffTicks;

        if (
          !jumpCommitted &&
          (targetStats === null ||
            world.dying[target] === 1 ||
            world.hp[target] === 0 ||
            !targetVisible ||
            !isValidSpecialTarget(special, targetStats, world.unitConditions[target]!) ||
            dx * dx + dz * dz > reach * reach)
        ) {
          // Classic cancels a charged melee wind-up when its target escapes.
          // The charge is consumed only on the authored impact tag, so the unit
          // may immediately pursue and retry instead of losing the recharge.
          clearSpecialAttack(world, i);
          world.attackCooldown[i] = 0;
        } else {
          if (!jumpCommitted && target >= 0) {
            setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);
          }
          const phase = advanceSpecialAttack(world, i, special);
          if (special.kind === "charged-jump") {
            updateJumpSpecialPosition(world, i, special);
          }
          if (phase === "impact") {
            switch (special.kind) {
              case "charged-melee": {
                dealDamage(world, target, resolveDamage(special, targetStats!), i);
                if (
                  special.targetReaction !== undefined &&
                  world.dying[target] === 0 &&
                  world.hp[target]! > 0
                ) {
                  hasActiveTargetReactions =
                    installTargetReaction(
                      world,
                      target,
                      world.posX[i]!,
                      world.posZ[i]!,
                      special.targetReaction,
                    ) || hasActiveTargetReactions;
                }
                break;
              }
              case "charged-area-pulse": {
                resolveChargedAreaPulse(world, i, special, UNIT_TYPES, NEUTRAL_OWNER, dealDamage);
                break;
              }
              case "charged-area-poison": {
                installAreaPoison(
                  world,
                  world.poisonEffects,
                  i,
                  special,
                  UNIT_TYPES,
                  NEUTRAL_OWNER,
                );
                break;
              }
              case "charged-cone-throw": {
                resolveChargedConeThrow(
                  world,
                  i,
                  special,
                  UNIT_TYPES,
                  NEUTRAL_OWNER,
                  (state, hitTarget, damage) => dealDamage(state, hitTarget, damage, i),
                  (hitTarget) => {
                    hasActiveTargetReactions =
                      installTargetReaction(
                        world,
                        hitTarget,
                        world.posX[i]!,
                        world.posZ[i]!,
                        special.targetReaction,
                        movementDomainForType(world.unitType[hitTarget]!),
                      ) || hasActiveTargetReactions;
                  },
                );
                break;
              }
              case "charged-terminal": {
                switch (special.effect) {
                  case "petrify-kill": {
                    world.unitConditions[target] =
                      world.unitConditions[target]! | UNIT_CONDITION_STONE;
                    dealDamage(world, target, world.hp[target]!, i);
                    break;
                  }
                }
                break;
              }
              case "charged-convert": {
                const replacementX = world.posX[target]!;
                const replacementZ = world.posZ[target]!;
                dealDamage(world, target, world.hp[target]!, i);
                terminalReplacementSpawns.push({
                  x: replacementX,
                  z: replacementZ,
                  owner: world.owner[i]!,
                  type: special.spawnUnitType,
                });
                break;
              }
              case "charged-projectile": {
                beginSpecialProjectileAttack(world, i, target, special);
                break;
              }
              case "charged-jump": {
                if (special.delivery === "area") {
                  resolveChargedJump(world, i, special, UNIT_TYPES, NEUTRAL_OWNER, dealDamage);
                } else if (
                  target >= 0 &&
                  targetStats !== null &&
                  world.dying[target] === 0 &&
                  world.hp[target]! > 0
                ) {
                  dealDamage(world, target, resolveDamage(special, targetStats), i);
                }
                break;
              }
            }
          }
          continue;
        }
      } else {
        // Recovery no longer depends on the target remaining alive or visible.
        advanceSpecialAttack(world, i, special);
        if (special.kind === "charged-jump") {
          updateJumpSpecialPosition(world, i, special);
        }
        continue;
      }
    }

    if (world.attackTarget[i] !== NO_TARGET) {
      const target = resolveId(world, world.attackTarget[i]!);
      const targetVisible =
        target >= 0 &&
        world.dying[target] === 0 &&
        world.hp[target]! > 0 &&
        world.containedBy[target] === NO_TARGET &&
        (attack.kind !== "melee" ||
          attack.canTargetAir === true ||
          (UNIT_TYPES[world.unitType[target]!]!.classes & UNIT_CLASS_AIR) === 0) &&
        isEntityVisibleTo(world, world.owner[i]!, target);

      if (!targetVisible) {
        const lastDx = world.moveTargetX[i]! - world.posX[i]!;
        const lastDz = world.moveTargetZ[i]! - world.posZ[i]!;
        const arrivedAtLastSeen =
          lastDx * lastDx + lastDz * lastDz <= FINAL_APPROACH_DIST * FINAL_APPROACH_DIST;

        if (world.attackOrdered[i] === 1 && !arrivedAtLastSeen) {
          // Explicit AoM-style pursuit investigates the last visible position without
          // reading the target's live hidden coordinates. Existing moveTargetX/Z are
          // the memory; no separate pursuit component is needed.
          world.moving[i] = 1;
        } else {
          clearAttackOrder(world, i);
        }
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const dx = targetX - world.posX[i]!;
        const dz = targetZ - world.posZ[i]!;
        const distSq = dx * dx + dz * dz;
        const targetStats = UNIT_TYPES[world.unitType[target]!]!;
        const authoredAttackRange = effectiveAttackRange(
          stats,
          attack,
          world.playerAge[world.owner[i]!]!,
        );
        const surfaceAttackRange =
          attack.kind === "melee"
            ? centerDistanceForEdgeRange(authoredAttackRange, stats, targetStats)
            : authoredAttackRange + targetStats.bodyRadius;
        const attackRangeSq = surfaceAttackRange * surfaceAttackRange;
        const projectileMinimumRange =
          attack.kind === "projectile" ? (attack.minimumRange ?? 0) + targetStats.bodyRadius : 0;
        const insideProjectileMinimumRange =
          projectileMinimumRange > 0 && distSq < projectileMinimumRange * projectileMinimumRange;
        const canBeginSpecial =
          special !== undefined &&
          world.attackCooldown[i] === 0 &&
          world.specialRecharge[i] === 0 &&
          isValidSpecialTarget(special, targetStats, world.unitConditions[target]!);
        const specialAttackRange =
          special === undefined ? 0 : centerDistanceForEdgeRange(special.range, stats, targetStats);
        const specialMinimumRange =
          special?.kind === "charged-jump"
            ? centerDistanceForEdgeRange(special.minimumRange, stats, targetStats)
            : 0;
        const inSpecialRange =
          canBeginSpecial &&
          distSq <= specialAttackRange * specialAttackRange &&
          distSq >= specialMinimumRange * specialMinimumRange;

        // Always refresh the memory while visible, including while already in strike range.
        world.moveTargetX[i] = targetX;
        world.moveTargetZ[i] = targetZ;

        // Melee range is edge-to-edge across both obstruction bodies. Large footprints are
        // unwalkable, so center-range melee would stop outside valid strike distance and orbit.
        if (distSq <= attackRangeSq || inSpecialRange) {
          if (insideProjectileMinimumRange && !inSpecialRange) {
            // Ranged siege backs out of its source-authored dead zone. The
            // retreat point is target-relative, so a moving pursuer refreshes
            // the goal every visible tick without introducing path state.
            let retreatX = world.posX[i]! - targetX;
            let retreatZ = world.posZ[i]! - targetZ;
            let retreatLength = Math.sqrt(retreatX * retreatX + retreatZ * retreatZ);
            if (retreatLength < 1e-9) {
              retreatX = -world.facingX[i]!;
              retreatZ = -world.facingZ[i]!;
              retreatLength = Math.sqrt(retreatX * retreatX + retreatZ * retreatZ);
            }
            const retreatDistance = projectileMinimumRange + 1e-6;
            world.moveTargetX[i] = targetX + (retreatX / retreatLength) * retreatDistance;
            world.moveTargetZ[i] = targetZ + (retreatZ / retreatLength) * retreatDistance;
            world.moving[i] = 1;
            world.unitField[i] = null;
            continue;
          }

          world.moving[i] = 0;
          world.unitField[i] = null;
          setFacingToward(world, i, targetX, targetZ);

          if (world.attackCooldown[i] === 0) {
            if (special !== undefined && inSpecialRange) {
              if (special.kind === "charged-jump") {
                beginJumpSpecialAttack(
                  world,
                  i,
                  unitIdAt(world, target),
                  special,
                  world.posX[i]!,
                  world.posZ[i]!,
                );
              } else if (special.kind === "charged-pickup-throw") {
                beginPickupThrowSpecialAttack(
                  world,
                  i,
                  unitIdAt(world, target),
                  special,
                  targetX,
                  targetZ,
                );
              } else {
                beginSpecialAttack(world, i, unitIdAt(world, target), special);
              }
              world.attackCooldown[i] = special.actionTicks;
            } else if (distSq <= attackRangeSq && attack.kind === "melee") {
              if (attack.cycleVariants === undefined) {
                resolvePrimaryMeleeImpact(world, i, target, attack);
                world.attackCooldown[i] = attack.cooldownTicks;
              } else if (attack.killScaling !== undefined) {
                const variant = Math.min(
                  attack.cycleVariants.length - 1,
                  Math.floor(world.combatExperienceKills[i]! / attack.killScaling.killsPerVariant),
                );
                beginAuthoredMeleeAttackCycle(world, i, attack, variant);
              } else {
                beginMeleeAttackCycle(world, i, attack, nextFloat(world.rng));
              }
            } else if (distSq <= attackRangeSq && attack.kind === "beam") {
              world.attackCooldown[i] = attack.cooldownTicks;
              world.beamActionActive[i] = 1;
              world.beamActionImpactPending[i] = 1;
            } else if (distSq <= attackRangeSq) {
              beginProjectileAttack(world, i, target, UNIT_TYPES);
            }
          }
        } else {
          const leashRange = attack.aggroRange * LEASH_FACTOR;
          const leashRangeSq = leashRange * leashRange;

          if (world.attackOrdered[i] === 1 || distSq <= leashRangeSq) {
            // STATIC targets - nodes and buildings - have goal cells that never move, so every
            // worker/attacker heading there shares one cached field. UNIT targets keep direct
            // seek: they move every tick, straight-line pursuit self-corrects, and per-tick
            // field builds would churn the tiny LRU.
            if (targetStats.isStatic) {
              const targetGoalCell = cellOf(targetX, targetZ);

              // Avoid re-running the cache lookup every tick for an unchanged static goal.
              if (world.unitField[i]?.goalCell !== targetGoalCell) {
                assignFieldGoal(world, i, targetX, targetZ, targetStats.footprint);
              }
            } else {
              world.moveTargetX[i] = targetX;
              world.moveTargetZ[i] = targetZ;
              world.moving[i] = 1;
              world.unitField[i] = null;
            }
          } else {
            clearAttackOrder(world, i);
          }
        }
      }
    }

    if (
      world.attackTarget[i] === NO_TARGET &&
      world.moving[i] === 0 &&
      world.mode[i] === MODE_IDLE &&
      attack.autoAcquire !== false
    ) {
      // Villagers in economy modes keep working under fire; defense is the player's job in M6.
      // Classic RTS trick: 4x cheaper scans for a worst-case 200 ms reaction,
      // imperceptible and deterministic.
      if ((i + world.tick) % 4 !== 0) {
        continue;
      }

      const x = world.posX[i]!;
      const z = world.posZ[i]!;
      const aggroSearchRange = attack.aggroRange + MAX_TARGET_BODY_RADIUS;
      const searchRadius = Math.ceil(aggroSearchRange / GRID_CELL);
      const cellX = gridCoordinateForPosition(x);
      const cellZ = gridCoordinateForPosition(z);
      const minCellX = cellX > searchRadius ? cellX - searchRadius : 0;
      const maxCellX = cellX < GRID_DIM - 1 - searchRadius ? cellX + searchRadius : GRID_DIM - 1;
      const minCellZ = cellZ > searchRadius ? cellZ - searchRadius : 0;
      const maxCellZ = cellZ < GRID_DIM - 1 - searchRadius ? cellZ + searchRadius : GRID_DIM - 1;
      let bestIndex = -1;
      let bestDistSq = aggroSearchRange * aggroSearchRange;
      let bestBuildingIndex = -1;
      let bestBuildingDistSq = bestDistSq;

      for (let neighborCellZ = minCellZ; neighborCellZ <= maxCellZ; neighborCellZ += 1) {
        for (let neighborCellX = minCellX; neighborCellX <= maxCellX; neighborCellX += 1) {
          const cell = neighborCellX + GRID_DIM * neighborCellZ;
          const start = world.cellStart[cell]!;
          const end = world.cellStart[cell + 1]!;

          for (let unitOffset = start; unitOffset < end; unitOffset += 1) {
            const j = world.cellUnits[unitOffset]!;

            // Nobody auto-fights a tree.
            if (j === i || world.owner[j] === world.owner[i] || world.owner[j] === NEUTRAL_OWNER) {
              continue;
            }

            if (!isEntityVisibleTo(world, world.owner[i]!, j)) {
              continue;
            }

            const dx = world.posX[j]! - x;
            const dz = world.posZ[j]! - z;
            const distSq = dx * dx + dz * dz;
            const surfaceAggroRange =
              attack.aggroRange + UNIT_TYPES[world.unitType[j]!]!.bodyRadius;

            // A large building's edge can be inside aggro range while its center is not.
            if (distSq > surfaceAggroRange * surfaceAggroRange) {
              continue;
            }

            const candidateStats = UNIT_TYPES[world.unitType[j]!]!;
            if (
              attack.kind === "melee" &&
              attack.canTargetAir !== true &&
              (candidateStats.classes & UNIT_CLASS_AIR) !== 0
            ) {
              continue;
            }
            if (
              attack.autoAcquireBuildings === true &&
              (candidateStats.classes & UNIT_CLASS_BUILDING) !== 0 &&
              (bestBuildingIndex === -1 ||
                distSq < bestBuildingDistSq ||
                (distSq === bestBuildingDistSq && j < bestBuildingIndex))
            ) {
              bestBuildingIndex = j;
              bestBuildingDistSq = distSq;
            }

            // Grid buckets are in ascending unit order, so first-found-at-min-distance
            // is deterministic; equality keeps the lower dense index tiebreak across cells.
            if (
              bestIndex === -1 ||
              distSq < bestDistSq ||
              (distSq === bestDistSq && j < bestIndex)
            ) {
              bestIndex = j;
              bestDistSq = distSq;
            }
          }
        }
      }

      const acquiredIndex = bestBuildingIndex >= 0 ? bestBuildingIndex : bestIndex;
      if (acquiredIndex >= 0) {
        world.attackTarget[i] = unitIdAt(world, acquiredIndex);
      }
    }
  }

  // 7. Unit tasks read the same fresh grid as combat and write moveTarget/moving
  // for movement to consume. Every task mode is dispatched in this one dense pass.
  const retargetRangeSq = NODE_RETARGET_RADIUS * NODE_RETARGET_RADIUS;

  world.prayingVillagers.fill(0);

  for (let i = 0; i < world.count; i += 1) {
    if (world.containedBy[i] !== NO_TARGET) continue;
    if (
      hasActiveTargetReactions &&
      targetReactionCapabilitiesAt(world.targetReactions, i).blocksOrderExecution
    ) {
      continue;
    }

    if (world.mode[i] === MODE_IDLE) {
      continue;
    }

    if (tickRelicTask(world, i)) {
      continue;
    }

    if (tickGarrisonTask(world, i)) {
      continue;
    }

    if (tickTradeTask(world, i)) {
      continue;
    }

    if (tickSupportTask(world, i)) {
      continue;
    }

    const workerStats = UNIT_TYPES[world.unitType[i]!]!;

    if (world.mode[i] === MODE_EATING_RESOURCE) {
      const eat = workerStats.resourceEat;
      const target = resolveId(world, world.taskTarget[i]!);
      const targetStats = target >= 0 ? UNIT_TYPES[world.unitType[target]!]! : null;
      if (
        eat === undefined ||
        targetStats === null ||
        world.dying[target] === 1 ||
        world.hp[target] === 0 ||
        !eat.resourceTypes.includes(targetStats.resource) ||
        world.hp[i]! >= effectiveMaxHp(workerStats, world.playerAge[world.owner[i]!]!)
      ) {
        clearUnitTask(world, i);
        continue;
      }

      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const reach = eat.range + targetStats.bodyRadius;
      if (dx * dx + dz * dz <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;
        setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);
        const workerMaxHp = effectiveMaxHp(workerStats, world.playerAge[world.owner[i]!]!);
        const maxForMissingHealth =
          ((workerMaxHp - world.hp[i]!) * eat.consumePerSecond) / eat.healPerSecond;
        const consumed = Math.min(
          eat.consumePerSecond * TICK_S,
          world.hp[target]!,
          maxForMissingHealth,
        );
        world.hp[target] = world.hp[target]! - consumed;
        world.hp[i] = Math.min(
          workerMaxHp,
          world.hp[i]! + consumed * (eat.healPerSecond / eat.consumePerSecond),
        );
        if (world.hp[target] === 0) killUnit(world, target);
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const targetGoalCell = cellOf(targetX, targetZ);
        if (world.unitField[i]?.goalCell !== targetGoalCell) {
          assignFieldGoal(world, i, targetX, targetZ);
        }
      }
      continue;
    }

    if (
      world.dying[i] === 1 ||
      world.hp[i] === 0 ||
      ((workerStats.classes & UNIT_CLASS_WORKER) === 0 && workerStats.gather === undefined)
    ) {
      continue;
    }
    const workerReach = workerStats.workRange ?? 0;

    if (world.mode[i] === MODE_GATHERING) {
      if (gatherCargo(world, i) >= gatherCapacity(world, i)) {
        let bestDropsite = -1;
        let bestDropsiteDistSq = Number.POSITIVE_INFINITY;

        for (let j = 0; j < world.count; j += 1) {
          if (
            !canUseResourceDropsite(
              world.unitType[i]!,
              world.unitType[j]!,
              world.carriedResource[i]!,
            ) ||
            world.owner[j] !== world.owner[i] ||
            world.dying[j] === 1 ||
            world.hp[j] === 0 ||
            !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
          ) {
            continue;
          }

          const dx = world.posX[j]! - world.posX[i]!;
          const dz = world.posZ[j]! - world.posZ[i]!;
          const distSq = dx * dx + dz * dz;

          if (
            bestDropsite === -1 ||
            distSq < bestDropsiteDistSq ||
            (distSq === bestDropsiteDistSq && j < bestDropsite)
          ) {
            bestDropsite = j;
            bestDropsiteDistSq = distSq;
          }
        }

        if (bestDropsite >= 0) {
          const dropsiteX = world.posX[bestDropsite]!;
          const dropsiteZ = world.posZ[bestDropsite]!;
          const dropsiteGoalCell = cellOf(dropsiteX, dropsiteZ);

          if (world.unitField[i]?.goalCell !== dropsiteGoalCell) {
            assignFieldGoal(
              world,
              i,
              dropsiteX,
              dropsiteZ,
              UNIT_TYPES[world.unitType[bestDropsite]!]!.footprint,
            );
          }

          world.mode[i] = MODE_RETURNING;
        } else {
          clearUnitTask(world, i);
        }

        continue;
      }

      let target = resolveId(world, world.taskTarget[i]!);

      if (
        target < 0 ||
        world.dying[target] === 1 ||
        world.hp[target] === 0 ||
        !canTypeGatherResource(world.unitType[i]!, world.unitType[target]!)
      ) {
        const searchX = world.posX[i]!;
        const searchZ = world.posZ[i]!;
        const requiredResource = gatherCargo(world, i) > 0 ? world.carriedResource[i]! : -1;
        const searchRadius = Math.ceil(NODE_RETARGET_RADIUS / GRID_CELL);
        const cellX = gridCoordinateForPosition(searchX);
        const cellZ = gridCoordinateForPosition(searchZ);
        const minCellX = cellX > searchRadius ? cellX - searchRadius : 0;
        const maxCellX = cellX < GRID_DIM - 1 - searchRadius ? cellX + searchRadius : GRID_DIM - 1;
        const minCellZ = cellZ > searchRadius ? cellZ - searchRadius : 0;
        const maxCellZ = cellZ < GRID_DIM - 1 - searchRadius ? cellZ + searchRadius : GRID_DIM - 1;
        let bestNode = -1;
        let bestNodeDistSq = retargetRangeSq;

        // The depleted node's resource row may be gone; loaded workers keep their
        // carried resource, while empty workers accept any nearby resource node.
        for (let neighborCellZ = minCellZ; neighborCellZ <= maxCellZ; neighborCellZ += 1) {
          for (let neighborCellX = minCellX; neighborCellX <= maxCellX; neighborCellX += 1) {
            const cell = neighborCellX + GRID_DIM * neighborCellZ;
            const start = world.cellStart[cell]!;
            const end = world.cellStart[cell + 1]!;

            for (let unitOffset = start; unitOffset < end; unitOffset += 1) {
              const j = world.cellUnits[unitOffset]!;
              const candidateStats = UNIT_TYPES[world.unitType[j]!]!;

              if (
                !canTypeGatherResource(world.unitType[i]!, world.unitType[j]!) ||
                world.dying[j] === 1 ||
                world.hp[j] === 0 ||
                (requiredResource >= 0 && candidateStats.resource !== requiredResource)
              ) {
                continue;
              }

              const dx = world.posX[j]! - searchX;
              const dz = world.posZ[j]! - searchZ;
              const distSq = dx * dx + dz * dz;

              if (distSq > retargetRangeSq) {
                continue;
              }

              // Grid buckets are fixed order; equality keeps the lower dense-index tiebreak.
              if (
                bestNode === -1 ||
                distSq < bestNodeDistSq ||
                (distSq === bestNodeDistSq && j < bestNode)
              ) {
                bestNode = j;
                bestNodeDistSq = distSq;
              }
            }
          }
        }

        if (bestNode >= 0) {
          world.taskTarget[i] = unitIdAt(world, bestNode);
          world.gatherPosX[i] = world.posX[bestNode]!;
          world.gatherPosZ[i] = world.posZ[bestNode]!;
          target = bestNode;
        } else {
          if (gatherCargo(world, i) > 0) {
            let bestDropsite = -1;
            let bestDropsiteDistSq = Number.POSITIVE_INFINITY;

            for (let j = 0; j < world.count; j += 1) {
              if (
                !canUseResourceDropsite(
                  world.unitType[i]!,
                  world.unitType[j]!,
                  world.carriedResource[i]!,
                ) ||
                world.owner[j] !== world.owner[i] ||
                world.dying[j] === 1 ||
                world.hp[j] === 0 ||
                !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
              ) {
                continue;
              }

              const dx = world.posX[j]! - world.posX[i]!;
              const dz = world.posZ[j]! - world.posZ[i]!;
              const distSq = dx * dx + dz * dz;

              if (
                bestDropsite === -1 ||
                distSq < bestDropsiteDistSq ||
                (distSq === bestDropsiteDistSq && j < bestDropsite)
              ) {
                bestDropsite = j;
                bestDropsiteDistSq = distSq;
              }
            }

            if (bestDropsite >= 0) {
              const dropsiteX = world.posX[bestDropsite]!;
              const dropsiteZ = world.posZ[bestDropsite]!;
              const dropsiteGoalCell = cellOf(dropsiteX, dropsiteZ);

              if (world.unitField[i]?.goalCell !== dropsiteGoalCell) {
                assignFieldGoal(
                  world,
                  i,
                  dropsiteX,
                  dropsiteZ,
                  UNIT_TYPES[world.unitType[bestDropsite]!]!.footprint,
                );
              }

              world.mode[i] = MODE_RETURNING;
            } else {
              clearUnitTask(world, i);
            }
          } else {
            const prospectDx = world.gatherPosX[i]! - world.posX[i]!;
            const prospectDz = world.gatherPosZ[i]! - world.posZ[i]!;
            const prospectThreshold = NODE_RETARGET_RADIUS * 0.5;

            if (
              prospectDx * prospectDx + prospectDz * prospectDz >
              prospectThreshold * prospectThreshold
            ) {
              const prospectGoalCell = cellOf(world.gatherPosX[i]!, world.gatherPosZ[i]!);

              world.taskTarget[i] = NO_TARGET;
              // En route to prospect: this scan re-runs each tick as they travel and adopts
              // the first node that comes into radius.
              if (world.unitField[i]?.goalCell !== prospectGoalCell) {
                assignFieldGoal(world, i, world.gatherPosX[i]!, world.gatherPosZ[i]!);
              }
            } else {
              clearUnitTask(world, i);
            }
          }

          continue;
        }
      }

      const nodeStats = UNIT_TYPES[world.unitType[target]!]!;
      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const distSq = dx * dx + dz * dz;
      const reach = workerReach + nodeStats.bodyRadius;

      if (distSq <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;
        setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);

        if (world.attackCooldown[i] === 0) {
          const cargo = gatherCargo(world, i);
          const capacity = gatherCapacity(world, i);
          const gatherPerStrike =
            workerStats.gather === undefined
              ? GATHER_PER_STRIKE
              : workerStats.gather.ratePerSecond * GATHER_COOLDOWN_TICKS * TICK_S;
          const take = Math.min(gatherPerStrike, world.hp[target]!, capacity - cargo);

          world.hp[target] = world.hp[target]! - take;
          if (world.hp[target] === 0) {
            killUnit(world, target);
          }

          if (workerStats.gather === undefined) {
            world.carried[i] = world.carried[i]! + take;
          } else {
            world.resourceCargo[i] = cargo + take;
            world.carried[i] = Math.floor(world.resourceCargo[i]!);
          }
          world.carriedResource[i] = nodeStats.resource;
          world.gatherPosX[i] = world.posX[target]!;
          world.gatherPosZ[i] = world.posZ[target]!;
          // The shared cooldown is correct: a villager cannot chop and fight in the same breath.
          world.attackCooldown[i] = GATHER_COOLDOWN_TICKS;
        }
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const targetGoalCell = cellOf(targetX, targetZ);

        // Resource nodes are STATIC targets: their goal cells do not move, so workers can
        // share cached fields instead of direct-seeking through terrain.
        if (world.unitField[i]?.goalCell !== targetGoalCell) {
          assignFieldGoal(world, i, targetX, targetZ);
        }
      }
    } else if (world.mode[i] === MODE_RETURNING) {
      let depositDropsite = -1;

      // Dropsites are buildings and few; scanning them every returning tick keeps arrival
      // deterministic without adding a per-tick-per-unit broadphase.
      for (let j = 0; j < world.count; j += 1) {
        const dropsiteStats = UNIT_TYPES[world.unitType[j]!]!;

        if (
          !canUseResourceDropsite(
            world.unitType[i]!,
            world.unitType[j]!,
            world.carriedResource[i]!,
          ) ||
          world.owner[j] !== world.owner[i] ||
          world.dying[j] === 1 ||
          world.hp[j] === 0 ||
          !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
        ) {
          continue;
        }

        const dx = world.posX[j]! - world.posX[i]!;
        const dz = world.posZ[j]! - world.posZ[i]!;
        const distSq = dx * dx + dz * dz;
        const reach = workerReach + dropsiteStats.bodyRadius;

        if (distSq <= reach * reach) {
          depositDropsite = j;
          break;
        }
      }

      if (depositDropsite >= 0) {
        const owner = world.owner[i]!;
        const resource = world.carriedResource[i]!;
        const deposited = world.carried[i]!;
        const empoweredYield =
          empowermentAt(world, depositDropsite)?.gatherYieldMultiplier ?? 1;
        const credited = Math.floor(deposited * empoweredYield);

        world.stockpiles[owner * RESOURCE_COUNT + resource] =
          world.stockpiles[owner * RESOURCE_COUNT + resource]! + credited;
        if (workerStats.gather === undefined) {
          world.carried[i] = 0;
        } else {
          world.resourceCargo[i] = world.resourceCargo[i]! - deposited;
          world.carried[i] = Math.floor(world.resourceCargo[i]!);
        }

        const target = resolveId(world, world.taskTarget[i]!);

        if (
          target >= 0 &&
          world.dying[target] === 0 &&
          world.hp[target]! > 0 &&
          canTypeGatherResource(world.unitType[i]!, world.unitType[target]!)
        ) {
          const targetX = world.posX[target]!;
          const targetZ = world.posZ[target]!;
          const targetGoalCell = cellOf(targetX, targetZ);

          world.mode[i] = MODE_GATHERING;
          world.gatherPosX[i] = targetX;
          world.gatherPosZ[i] = targetZ;

          if (world.unitField[i]?.goalCell !== targetGoalCell) {
            assignFieldGoal(world, i, targetX, targetZ);
          }
        } else {
          // Deposit-then-return-to-patch: keep prospect memory so the dead-node handling
          // walks back from the dropsite instead of clocking out at the town center.
          world.mode[i] = MODE_GATHERING;
          world.taskTarget[i] = NO_TARGET;
          world.moving[i] = 0;
          world.unitField[i] = null;
        }

        continue;
      }

      if (world.moving[i] === 0) {
        let bestDropsite = -1;
        let bestDropsiteDistSq = Number.POSITIVE_INFINITY;

        for (let j = 0; j < world.count; j += 1) {
          if (
            !canUseResourceDropsite(
              world.unitType[i]!,
              world.unitType[j]!,
              world.carriedResource[i]!,
            ) ||
            world.owner[j] !== world.owner[i] ||
            world.dying[j] === 1 ||
            world.hp[j] === 0 ||
            !(world.buildProgress[j]! >= UNIT_TYPES[world.unitType[j]!]!.buildTicks)
          ) {
            continue;
          }

          const dx = world.posX[j]! - world.posX[i]!;
          const dz = world.posZ[j]! - world.posZ[i]!;
          const distSq = dx * dx + dz * dz;

          if (
            bestDropsite === -1 ||
            distSq < bestDropsiteDistSq ||
            (distSq === bestDropsiteDistSq && j < bestDropsite)
          ) {
            bestDropsite = j;
            bestDropsiteDistSq = distSq;
          }
        }

        if (bestDropsite >= 0) {
          const dropsiteX = world.posX[bestDropsite]!;
          const dropsiteZ = world.posZ[bestDropsite]!;
          const dropsiteGoalCell = cellOf(dropsiteX, dropsiteZ);

          if (world.unitField[i]?.goalCell !== dropsiteGoalCell) {
            assignFieldGoal(
              world,
              i,
              dropsiteX,
              dropsiteZ,
              UNIT_TYPES[world.unitType[bestDropsite]!]!.footprint,
            );
          }
        } else {
          // A player with no dropsites has bigger problems; the villager stands carrying.
          clearUnitTask(world, i);
        }
      }
    } else if (world.mode[i] === MODE_BUILDING) {
      const target = resolveId(world, world.taskTarget[i]!);

      if (target < 0 || world.dying[target] === 1 || world.hp[target] === 0) {
        clearUnitTask(world, i);
        continue;
      }

      const siteStats = UNIT_TYPES[world.unitType[target]!]!;

      if (world.buildProgress[target]! >= siteStats.buildTicks) {
        clearUnitTask(world, i);
        continue;
      }

      const dx = world.posX[target]! - world.posX[i]!;
      const dz = world.posZ[target]! - world.posZ[i]!;
      const distSq = dx * dx + dz * dz;
      const reach = (workerStats.construction?.range ?? workerReach) + siteStats.bodyRadius;

      if (distSq <= reach * reach) {
        world.moving[i] = 0;
        world.unitField[i] = null;
        setFacingToward(world, i, world.posX[target]!, world.posZ[target]!);

        if (world.attackCooldown[i] === 0) {
          const empoweredBuildWork = empowermentAt(world, target)?.buildWorkMultiplier ?? 1;
          const progress =
            world.buildProgress[target]! +
            BUILD_PER_STRIKE *
              (workerStats.construction === undefined
                ? 1
                : workerStats.construction.ratePerSecond /
                  workerStats.construction.baselineRatePerSecond) *
              empoweredBuildWork;

          world.buildProgress[target] =
            progress > siteStats.buildTicks ? siteStats.buildTicks : progress;
          // The shared cooldown means a villager cannot hammer and chop/fight in the same breath; N builders in reach stack N strikes per cooldown window.
          world.attackCooldown[i] = GATHER_COOLDOWN_TICKS;
        }
      } else {
        const targetX = world.posX[target]!;
        const targetZ = world.posZ[target]!;
        const targetGoalCell = cellOf(targetX, targetZ);

        // Building sites are static targets sharing cached fields.
        if (world.unitField[i]?.goalCell !== targetGoalCell) {
          assignFieldGoal(world, i, targetX, targetZ, siteStats.footprint);
        }
      }
    } else if (world.mode[i] === MODE_PRAYING) {
      const target = resolveId(world, world.taskTarget[i]!);
      tickPrayerTask(world, i, target, workerReach);
    }
  }

  tickGreekFavor(world);

  // 8. Production countdown - research occupies its building; queued units resume
  // on the completion tick. Completed spawns append after producedThrough.
  const producedThrough = world.count;

  for (let i = 0; i < producedThrough; i += 1) {
    if (tickBuildingResearch(world, i)) {
      continue;
    }

    // A building destroyed mid-train loses its entire queue with no refund.
    if (world.trainRemaining[i] === 0 || world.dying[i] === 1 || world.hp[i] === 0) {
      world.empowerTrainProgress[i] = 0;
      continue;
    }
    const trainWork = empowermentAt(world, i)?.trainWorkMultiplier ?? 1;
    world.empowerTrainProgress[i] = world.empowerTrainProgress[i]! + trainWork;
    const completedTrainWork = Math.floor(world.empowerTrainProgress[i]!);
    world.empowerTrainProgress[i] = world.empowerTrainProgress[i]! - completedTrainWork;
    world.trainRemaining[i] = Math.max(0, world.trainRemaining[i]! - completedTrainWork);
    if (world.trainRemaining[i] !== 0) continue;
    // Classic buildings have a front-door exit on their -Z side. Their visible meshes overhang
    // the smaller logical footprints, so each producer owns an explicit model-clear offset.
    const producerStats = UNIT_TYPES[world.unitType[i]!]!;
    const completedType = activeTrainType(world, i);
    if (completedType === NO_UNIT_TYPE) {
      world.trainRemaining[i] = 0;
      continue;
    }

    const cell = navigableCellNear(
      world,
      world.posX[i]!,
      world.posZ[i]! - producerStats.trainExitOffset,
      movementDomainForType(completedType),
    );

    spawnUnit(
      world,
      (cell % MAP_TILES) + 0.5,
      Math.floor(cell / MAP_TILES) + 0.5,
      0,
      0,
      world.owner[i]!,
      completedType,
    );
    finishActiveProduction(world, i, (unitType) => UNIT_TYPES[unitType]!.buildTicks);
    if (producerStats.trainingSite?.consumeOnCompletion === true) {
      killUnit(world, i, false);
    }
  }

  // 9. Compute pushes from start-of-tick positions only; forces never read partially-updated state.
  for (let i = 0; i < world.count; i += 1) {
    const x = world.posX[i]!;
    const z = world.posZ[i]!;
    const stats = UNIT_TYPES[world.unitType[i]!]!;
    const snareRemaining = world.meleeSnareRemaining[i]!;
    const snareMultiplier =
      snareRemaining === 0 ? 1 : 1 - MELEE_SNARE_STRENGTH * (snareRemaining / MELEE_SNARE_TICKS);
    const garrisonSpeedMultiplier =
      stats.garrison === undefined
        ? 1
        : 1 +
          countGarrisonedUnits(world, i) * (stats.garrison.speedMultiplierPerOccupant ?? 0);
    const step = stats.movementSpeed * garrisonSpeedMultiplier * snareMultiplier * TICK_S;
    const wasMoving = world.moving[i] === 1;
    let pushX = 0;
    let pushZ = 0;

    if (
      world.containedBy[i] !== NO_TARGET ||
      (hasActiveTargetReactions &&
        targetReactionCapabilitiesAt(world.targetReactions, i).drivesPosition)
    ) {
      // The target-reaction system already authored this unit's position for
      // the tick. Ground movement and separation cannot add a second motion.
      world.pushX[i] = 0;
      world.pushZ[i] = 0;
      continue;
    }

    if (stats.isStatic) {
      // Static nodes stay in the grid as separation sources, but never accumulate pushes.
      world.pushX[i] = 0;
      world.pushZ[i] = 0;
      continue;
    }

    if (world.moving[i] === 0) {
      pushX = 0;
      pushZ = 0;
    } else {
      const dx = world.moveTargetX[i]! - x;
      const dz = world.moveTargetZ[i]! - z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const field = world.unitField[i] ?? null;
      const canApproachDirectly =
        dist <= FINAL_APPROACH_DIST &&
        (field === null ||
          hasWalkableDirectPath(
            world,
            world.unitType[i]!,
            x,
            z,
            world.moveTargetX[i]!,
            world.moveTargetZ[i]!,
            dist,
          ));

      // Fields quantize to tiles; a clear last stretch uses the exact line so arrival stays
      // bit-exact. If terrain blocks that segment, keep following the field around it.
      if (canApproachDirectly) {
        if (dist <= step) {
          pushX = dx;
          pushZ = dz;
          world.moving[i] = 0;
        } else {
          pushX = (dx / dist) * step;
          pushZ = (dz / dist) * step;
        }
      } else {
        // Most moving units follow their cached goal field.
        if (field !== null) {
          sampleFlowDirection(field, x, z, sampledFlowDirection);
          const fdx = sampledFlowDirection[0]!;
          const fdz = sampledFlowDirection[1]!;

          if (fdx !== 0 || fdz !== 0) {
            pushX = fdx * step;
            pushZ = fdz * step;
          } else {
            // Unreachable pockets or unwalkable starts degrade to M3-step-1 behavior instead of freezing.
            pushX = (dx / dist) * step;
            pushZ = (dz / dist) * step;
          }
        } else {
          // Belt-and-suspenders: moving units should have a field, but direct seek remains valid.
          pushX = (dx / dist) * step;
          pushZ = (dz / dist) * step;
        }
      }
    }

    if (wasMoving && (pushX !== 0 || pushZ !== 0)) {
      setFacingToward(world, i, x + pushX, z + pushZ);
    }

    // Idle units are separated too, so arriving crowds spread out instead of stacking.
    let separationX = 0;
    let separationZ = 0;
    const cellX = gridCoordinateForPosition(x);
    const cellZ = gridCoordinateForPosition(z);
    const minCellX = cellX > 0 ? cellX - 1 : 0;
    const maxCellX = cellX < GRID_DIM - 1 ? cellX + 1 : GRID_DIM - 1;
    const minCellZ = cellZ > 0 ? cellZ - 1 : 0;
    const maxCellZ = cellZ < GRID_DIM - 1 ? cellZ + 1 : GRID_DIM - 1;
    const actionPositionLocked =
      world.meleeActionVariant[i] !== NO_MELEE_ATTACK_VARIANT ||
      world.specialActionRemaining[i]! > 0;

    // Radius 0.8 is smaller than the 2-unit cell size, so the 3x3 neighborhood always suffices.
    for (let neighborCellZ = minCellZ; neighborCellZ <= maxCellZ; neighborCellZ += 1) {
      for (let neighborCellX = minCellX; neighborCellX <= maxCellX; neighborCellX += 1) {
        const cell = neighborCellX + GRID_DIM * neighborCellZ;
        const start = world.cellStart[cell]!;
        const end = world.cellStart[cell + 1]!;

        for (let unitOffset = start; unitOffset < end; unitOffset += 1) {
          const j = world.cellUnits[unitOffset]!;

          if (j === i) {
            continue;
          }

          const statsJ = UNIT_TYPES[world.unitType[j]!]!;
          if (
            stats.collidesWithUnits === false ||
            statsJ.collidesWithUnits === false ||
            ((stats.classes & UNIT_CLASS_AIR) !== 0) !== ((statsJ.classes & UNIT_CLASS_AIR) !== 0)
          ) {
            continue;
          }

          // Reaction policy owns whether this neighbor participates on the ground.
          if (
            hasActiveTargetReactions &&
            !targetReactionCapabilitiesAt(world.targetReactions, j).participatesInGroundSeparation
          ) {
            continue;
          }

          // Authored actions own their attacker's position. Suppress separation
          // whenever either participant is active; otherwise a lower-index
          // neighbor can still slide the attacker during its wind-up.
          if (
            actionPositionLocked ||
            world.meleeActionVariant[j] !== NO_MELEE_ATTACK_VARIANT ||
            world.specialActionRemaining[j]! > 0
          ) {
            continue;
          }

          let dx = x - world.posX[j]!;
          let dz = z - world.posZ[j]!;
          let distSq = dx * dx + dz * dz;

          if (distSq >= SEPARATION_RADIUS * SEPARATION_RADIUS) {
            continue;
          }

          if (distSq < 1e-12) {
            // Any fixed function of (i, j) works here; it must not be random or order-dependent.
            const pairSign = i > j ? 1e-3 : -1e-3;

            dx = pairSign;
            dz = (i + j) % 2 === 0 ? pairSign : -pairSign;
            distSq = dx * dx + dz * dz;
          }

          const dist = Math.sqrt(distSq);
          const strength = 1 - dist / SEPARATION_RADIUS;

          separationX += (dx / dist) * strength * SEPARATION_MAX_STEP;
          separationZ += (dz / dist) * strength * SEPARATION_MAX_STEP;
        }
      }
    }

    const separationDistSq = separationX * separationX + separationZ * separationZ;

    if (separationDistSq > SEPARATION_MAX_STEP * SEPARATION_MAX_STEP) {
      // A crowd of N neighbors must not multiply the push.
      const scale = SEPARATION_MAX_STEP / Math.sqrt(separationDistSq);

      separationX *= scale;
      separationZ *= scale;
    }

    world.pushX[i] = pushX + separationX;
    world.pushZ[i] = pushZ + separationZ;
  }

  // 10. Resolve terrain and the complete direct-combat contact graph against
  // one candidate snapshot, then commit every mobile position together.
  integrateGroundMotion(world, hasActiveTargetReactions);

  // Recovery is measured in completed simulation ticks. A hit in the combat
  // pass affects this tick's movement at the full 35% penalty, then eases by
  // one fixed step after positions commit.
  for (let i = 0; i < world.count; i += 1) {
    if (world.meleeSnareRemaining[i]! > 0) {
      world.meleeSnareRemaining[i] = world.meleeSnareRemaining[i]! - 1;
    }
  }

  // Every contained unit follows its outermost carrier only after movement has
  // committed, keeping nested transport coordinates deterministic.
  syncContainedUnits(world);

  // Temporary units receive their full authored number of active ticks. Units
  // produced during this tick are appended after producedThrough and begin
  // aging on the next tick.
  for (let i = 0; i < producedThrough; i += 1) {
    const remaining = world.lifespanRemaining[i]!;
    if (remaining === 0 || world.dying[i] === 1) continue;
    world.lifespanRemaining[i] = remaining - 1;
    if (remaining === 1) killUnit(world, i);
  }

  // Terminal replacements exist before the victim's deferred death effects,
  // matching Classic cases where the newborn can be struck by that death.
  for (const replacement of terminalReplacementSpawns) {
    if (world.count >= MAX_UNITS) break;
    spawnUnit(world, replacement.x, replacement.z, 0, 0, replacement.owner, replacement.type);
  }

  applyDeaths(world);
  tickPharaohLifecycle(world);

  // Annihilation, in-sim, hashed: the UI reads it, never computes it.
  if (world.contested && world.winner === -1) {
    // Neutral forests must not prevent victory or count as armies in a draw.
    let liveArmies = 0;
    let liveOwner = -1;
    let singleOwner = true;

    for (let i = 0; i < world.count; i += 1) {
      const owner = world.owner[i]!;

      if (owner === NEUTRAL_OWNER) {
        continue;
      }

      liveArmies += 1;

      if (liveOwner === -1) {
        liveOwner = owner;
      } else if (owner !== liveOwner) {
        singleOwner = false;
      }
    }

    if (liveArmies === 0) {
      // Mutual annihilation is a real outcome: symmetric duels genuinely
      // double-KO on synchronized cooldowns. A draw, not an eternal stalemate.
      world.winner = MATCH_DRAW;
    } else if (singleOwner) {
      world.winner = liveOwner;
    }
  }

  world.tick += 1;
}

function dealDamage(world: World, index: number, damage: number, sourceIndex = -1): void {
  // THE strike seam: "decided to hit" is upstream, "damage lands" is here.
  // Deterministic projectile flight will insert between the two when ranged units arrive.
  world.hp[index] = Math.max(0, world.hp[index]! - damage);

  if (world.hp[index] === 0) {
    if (sourceIndex >= 0 && sourceIndex < world.count) {
      const attack = UNIT_TYPES[world.unitType[sourceIndex]!]!.attack;
      const scaling = attack?.kind === "melee" ? attack.killScaling : undefined;
      if (scaling !== undefined) {
        world.combatExperienceKills[sourceIndex] = Math.min(
          scaling.maxKills,
          world.combatExperienceKills[sourceIndex]! + 1,
        );
      }
    }
    killUnit(world, index, true);
  }
}

function applyMeleeSnare(world: World, index: number): void {
  if (world.dying[index] === 0 && world.hp[index]! > 0) {
    world.meleeSnareRemaining[index] = MELEE_SNARE_TICKS;
  }
}

function resolvePrimaryMeleeImpact(
  world: World,
  attacker: number,
  target: number,
  attack: MeleeAttack,
  cycle?: MeleeAttackCycle,
): void {
  const experienceMultiplier = killScaledMeleeDamageMultiplier(
    attack,
    world.combatExperienceKills[attacker]!,
  );
  const ageMultiplier = effectiveAttackDamageMultiplier(
    UNIT_TYPES[world.unitType[attacker]!]!,
    world.playerAge[world.owner[attacker]!]!,
  );

  if (attack.impactArea !== undefined) {
    const cycleMultiplier = cycle === undefined ? 1 : cycle.actionTicks / attack.cooldownTicks;
    resolveMeleeImpactAreaAt(
      world,
      world.owner[attacker]!,
      world.posX[target]!,
      world.posZ[target]!,
      attack,
      experienceMultiplier * ageMultiplier * cycleMultiplier,
      UNIT_TYPES,
      NEUTRAL_OWNER,
      (state, hitTarget, damage) => {
        applyMeleeSnare(state, hitTarget);
        dealDamage(state, hitTarget, damage, attacker);
      },
      attacker,
    );
    return;
  }

  applyMeleeSnare(world, target);
  const damage =
    cycle === undefined
      ? resolveMeleeDamage(attack, UNIT_TYPES[world.unitType[target]!]!)
      : resolveMeleeCycleDamage(attack, cycle, UNIT_TYPES[world.unitType[target]!]!);
  dealDamage(world, target, damage * experienceMultiplier * ageMultiplier, attacker);
}

function applyDeaths(world: World): void {
  if (world.pendingDeathCount === 0) {
    return;
  }

  // Death-area attacks may kill more death-area units. Walk the lethal-event
  // queue until it is exhausted so every unit bursts exactly once and chained
  // deaths retain deterministic lethal-event order.
  for (let deathOffset = 0; deathOffset < world.pendingDeathCount; deathOffset += 1) {
    const index = world.pendingDeaths[deathOffset]!;
    const attack = UNIT_TYPES[world.unitType[index]!]!.deathAreaAttack;
    if (attack !== undefined) {
      resolveAreaDamageAt(
        world,
        world.owner[index]!,
        world.posX[index]!,
        world.posZ[index]!,
        attack,
        UNIT_TYPES,
        NEUTRAL_OWNER,
        dealDamage,
        index,
      );
    }
  }

  const deathCount = world.pendingDeathCount;

  let restoredFootprint = false;
  const deathSpawns: Array<{
    readonly owner: number;
    readonly x: number;
    readonly z: number;
    readonly unitType: number;
    readonly count: number;
    readonly liveLimit: number;
  }> = [];
  const deathReplacements: Array<{
    readonly owner: number;
    readonly x: number;
    readonly z: number;
    readonly unitType: number;
  }> = [];

  // Preserve lethal-event order independently from the descending dense-index
  // removal order used below.
  for (let deathOffset = 0; deathOffset < deathCount; deathOffset += 1) {
    const index = world.pendingDeaths[deathOffset]!;
    const owner = world.owner[index]!;
    const stats = UNIT_TYPES[world.unitType[index]!]!;
    if (
      owner !== NEUTRAL_OWNER &&
      (world.unitType[index] === TYPE_PHARAOH || world.unitType[index] === TYPE_SON_OF_OSIRIS)
    ) {
      world.pharaohRespawnRemaining[owner] = PHARAOH_RESPAWN_TICKS;
    }
    const rule = stats.deathSpawn;
    if (
      world.dyingFromDamage[index] === 1 &&
      rule !== undefined &&
      owner !== NEUTRAL_OWNER &&
      world.playerMajorGod[owner] === rule.requiredGod
    ) {
      deathSpawns.push({
        owner,
        x: world.posX[index]!,
        z: world.posZ[index]!,
        unitType: rule.unitType,
        count: rule.count,
        liveLimit: rule.liveLimit,
      });
    }

    const replacement = stats.deathReplacement;
    if (replacement !== undefined && replacement.trigger === "death") {
      const x = world.posX[index]!;
      const z = world.posZ[index]!;
      const placementAllowed =
        !replacement.requireNavigableOrigin ||
        navigationGridForDomain(world, replacement.placementDomain)[cellOf(x, z)] === 1;
      if (placementAllowed) {
        deathReplacements.push({ owner, x, z, unitType: replacement.unitType });
      }
    }
  }

  // Fixed order for determinism. Removing high indices first means a swap can
  // never move a unit that is itself pending removal.
  world.pendingDeaths.subarray(0, deathCount).sort();

  for (let deathOffset = deathCount - 1; deathOffset >= 0; deathOffset -= 1) {
    const i = world.pendingDeaths[deathOffset]!;
    const last = world.count - 1;
    const handle = world.handleOf[i]!;
    const footprint = UNIT_TYPES[world.unitType[i]!]!.footprint;
    const eventIndex = world.deathEventCount;

    // Heroes drop carried relics and destroyed Temples release deposited relics
    // before the container handle is invalidated or a dense slot is swapped.
    releaseContainedRelics(world, i);
    if (UNIT_TYPES[world.unitType[i]!]!.garrison?.ejectOnDeath === true) {
      releaseGarrisonedUnits(world, i);
    }

    world.deathEventIds[eventIndex] = unitIdAt(world, i);
    world.deathEventTypes[eventIndex] = world.unitType[i]!;
    world.deathEventPosX[eventIndex] = world.posX[i]!;
    world.deathEventPosZ[eventIndex] = world.posZ[i]!;
    world.deathEventFacingX[eventIndex] = world.facingX[i]!;
    world.deathEventFacingZ[eventIndex] = world.facingZ[i]!;
    world.deathEventOwners[eventIndex] = world.owner[i]!;
    world.deathEventCombatExperienceKills[eventIndex] = world.combatExperienceKills[i]!;
    world.deathEventConditions[eventIndex] = world.unitConditions[i]!;
    world.deathEventCarried[eventIndex] = world.carried[i]!;
    world.deathEventCount = eventIndex + 1;

    // Building-owned research is canceled before the producer's components disappear.
    cancelBuildingResearch(world, i);

    if (footprint > 0) {
      // Exact because building centers are constructed from integer origin tiles.
      const tileX = Math.round(world.posX[i]! - footprint / 2);
      const tileZ = Math.round(world.posZ[i]! - footprint / 2);

      // Rubble does not obstruct: destroyed buildings unblock immediately.
      for (let z = tileZ; z < tileZ + footprint; z += 1) {
        for (let x = tileX; x < tileX + footprint; x += 1) {
          const cell = z * MAP_TILES + x;
          world.walkable[cell] = (world.terrainDomains[cell]! & TERRAIN_DOMAIN_LAND) !== 0 ? 1 : 0;
          world.waterWalkable[cell] =
            (world.terrainDomains[cell]! & TERRAIN_DOMAIN_WATER) !== 0 ? 1 : 0;
        }
      }

      restoredFootprint = true;
    }

    world.slotOf[handle] = -1;
    world.generation[handle] = (world.generation[handle]! + 1) & 0xffff;
    world.freeHandles[world.freeHandleCount] = handle;
    world.freeHandleCount += 1;

    if (i !== last) {
      // LOUD component-copy checklist: EVERY future per-unit component (owner, hp,
      // cooldown...) must be added here. Missing one array is a delayed desync, the worst kind.
      world.posX[i] = world.posX[last]!;
      world.posZ[i] = world.posZ[last]!;
      world.velX[i] = world.velX[last]!;
      world.velZ[i] = world.velZ[last]!;
      world.moveTargetX[i] = world.moveTargetX[last]!;
      world.moveTargetZ[i] = world.moveTargetZ[last]!;
      world.moving[i] = world.moving[last]!;
      world.facingX[i] = world.facingX[last]!;
      world.facingZ[i] = world.facingZ[last]!;
      world.owner[i] = world.owner[last]!;
      world.unitType[i] = world.unitType[last]!;
      world.containedBy[i] = world.containedBy[last]!;
      world.hp[i] = world.hp[last]!;
      world.buildProgress[i] = world.buildProgress[last]!;
      world.lifespanRemaining[i] = world.lifespanRemaining[last]!;
      world.combatExperienceKills[i] = world.combatExperienceKills[last]!;
      world.unitConditions[i] = world.unitConditions[last]!;
      world.meleeSnareRemaining[i] = world.meleeSnareRemaining[last]!;
      copyProductionQueue(world, i, last);
      world.researchId[i] = world.researchId[last]!;
      world.researchChoice[i] = world.researchChoice[last]!;
      world.researchRemaining[i] = world.researchRemaining[last]!;
      world.attackCooldown[i] = world.attackCooldown[last]!;
      world.attackTarget[i] = world.attackTarget[last]!;
      world.attackOrdered[i] = world.attackOrdered[last]!;
      world.attackAimTarget[i] = world.attackAimTarget[last]!;
      world.attackAimShots[i] = world.attackAimShots[last]!;
      world.meleeActionVariant[i] = world.meleeActionVariant[last]!;
      world.meleeActionImpactPending[i] = world.meleeActionImpactPending[last]!;
      world.beamActionImpactPending[i] = world.beamActionImpactPending[last]!;
      world.beamActionActive[i] = world.beamActionActive[last]!;
      world.specialRecharge[i] = world.specialRecharge[last]!;
      world.specialActionRemaining[i] = world.specialActionRemaining[last]!;
      world.specialActionTarget[i] = world.specialActionTarget[last]!;
      world.specialActionImpactPending[i] = world.specialActionImpactPending[last]!;
      world.specialActionStartX[i] = world.specialActionStartX[last]!;
      world.specialActionStartZ[i] = world.specialActionStartZ[last]!;
      world.supportActionRemaining[i] = world.supportActionRemaining[last]!;
      world.terminalThrowSource[i] = world.terminalThrowSource[last]!;
      copyTargetReaction(world.targetReactions, i, last);
      world.mode[i] = world.mode[last]!;
      world.carried[i] = world.carried[last]!;
      world.carriedResource[i] = world.carriedResource[last]!;
      world.resourceCargo[i] = world.resourceCargo[last]!;
      world.taskTarget[i] = world.taskTarget[last]!;
      world.tradeMarket[i] = world.tradeMarket[last]!;
      world.tradeTownCenter[i] = world.tradeTownCenter[last]!;
      world.tradeCargo[i] = world.tradeCargo[last]!;
      world.empowerTrainProgress[i] = world.empowerTrainProgress[last]!;
      world.empowerResearchProgress[i] = world.empowerResearchProgress[last]!;
      world.gatherPosX[i] = world.gatherPosX[last]!;
      world.gatherPosZ[i] = world.gatherPosZ[last]!;
      world.selectable[i] = world.selectable[last]!;
      world.selected[i] = world.selected[last]!;
      world.dyingFromDamage[i] = world.dyingFromDamage[last]!;
      world.unitField[i] = world.unitField[last] ?? null;

      const movedHandle = world.handleOf[last]!;

      world.handleOf[i] = movedHandle;
      world.slotOf[movedHandle] = i;
    }

    world.unitField[last] = null;
    world.lifespanRemaining[last] = 0;
    world.combatExperienceKills[last] = 0;
    world.unitConditions[last] = 0;
    world.meleeSnareRemaining[last] = 0;
    world.terminalThrowSource[last] = NO_TARGET;
    world.tradeMarket[last] = NO_TARGET;
    world.tradeTownCenter[last] = NO_TARGET;
    world.tradeCargo[last] = 0;
    world.supportActionRemaining[last] = 0;
    world.empowerTrainProgress[last] = 0;
    world.empowerResearchProgress[last] = 0;
    world.resourceCargo[last] = 0;
    clearTargetReaction(world.targetReactions, last);
    clearProductionQueue(world, last);
    world.count -= 1;
    world.dying[i] = 0;
    world.dying[last] = 0;
    world.dyingFromDamage[i] = 0;
    world.dyingFromDamage[last] = 0;
  }

  world.pendingDeathCount = 0;

  if (restoredFootprint) {
    // One invalidation per death batch, not per building.
    flushFlowFields(world);
  }

  for (const replacement of deathReplacements) {
    if (world.count >= MAX_UNITS) break;
    spawnUnit(world, replacement.x, replacement.z, 0, 0, replacement.owner, replacement.unitType);
  }

  for (const event of deathSpawns) {
    let live = 0;
    for (let index = 0; index < world.count; index += 1) {
      if (world.owner[index] === event.owner && world.unitType[index] === event.unitType) live += 1;
    }
    const spawnCount = Math.max(
      0,
      Math.min(event.count, event.liveLimit - live, MAX_UNITS - world.count),
    );
    for (let spawned = 0; spawned < spawnCount; spawned += 1) {
      spawnUnit(world, event.x, event.z, 0, 0, event.owner, event.unitType);
    }
  }
}

function tickPharaohLifecycle(world: World): void {
  for (let playerSlot = 0; playerSlot < world.playerCount; playerSlot += 1) {
    const playerId = world.playerIds[playerSlot]!;
    if (cultureForMajorGod(world.playerMajorGod[playerId]!) !== CULTURE_EGYPTIAN) continue;
    let hasPharaoh = false;
    let hasSon = false;
    for (let unit = 0; unit < world.count; unit += 1) {
      if (world.owner[unit] !== playerId || world.dying[unit] === 1 || world.hp[unit]! <= 0) continue;
      hasPharaoh ||= world.unitType[unit] === TYPE_PHARAOH;
      hasSon ||= world.unitType[unit] === TYPE_SON_OF_OSIRIS;
    }
    if (hasSon || hasPharaoh) {
      world.pharaohRespawnRemaining[playerId] = 0;
      continue;
    }
    if (world.pharaohRespawnRemaining[playerId]! > 0) {
      world.pharaohRespawnRemaining[playerId] = world.pharaohRespawnRemaining[playerId]! - 1;
      continue;
    }
    const townCenterType = townCenterTypeForCulture(CULTURE_EGYPTIAN);
    let townCenter = -1;
    for (let unit = 0; unit < world.count; unit += 1) {
      if (
        world.owner[unit] === playerId &&
        world.unitType[unit] === townCenterType &&
        world.dying[unit] === 0 &&
        world.hp[unit]! > 0 &&
        world.buildProgress[unit]! >= UNIT_TYPES[townCenterType]!.buildTicks
      ) {
        townCenter = unit;
        break;
      }
    }
    if (townCenter < 0 || world.count >= MAX_UNITS) continue;
    const cell = navigableCellNear(
      world,
      world.posX[townCenter]!,
      world.posZ[townCenter]! - UNIT_TYPES[townCenterType]!.trainExitOffset,
      MOVEMENT_DOMAIN_LAND,
    );
    spawnUnit(
      world,
      (cell % MAP_TILES) + 0.5,
      Math.floor(cell / MAP_TILES) + 0.5,
      0,
      0,
      playerId,
      TYPE_PHARAOH,
    );
  }
}

function applyPendingCommands(world: World): void {
  for (let i = 0; i < world.commands.length; ) {
    const command = world.commands[i]!;

    if (command.tick > world.tick) {
      i += 1;
      continue;
    }

    // Late commands apply ASAP instead of dropping; deterministic because queue order is fixed.
    if (command.type === COMMAND_MOVE) {
      for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
        const id = command.unitIds[unitIndex]!;
        const index = resolveId(world, id);

        if (index < 0) continue;
        // THE ownership validation - one place, every client, deterministic. The relay stays
        // dumb; forged or mis-addressed commands die here identically everywhere.
        if (world.owner[index] !== command.issuer) continue;
        const movementDomain = movementDomainForType(world.unitType[index]!);
        const navigationGrid = navigationGridForDomain(world, movementDomain);
        const target = remapGoalForNavigationGrid(navigationGrid, command.targetX, command.targetZ);

        if (target === null) continue;
        // Carried resources persist across interrupts: a hauler keeps the load.
        clearUnitTask(world, index);
        assignFieldGoal(world, index, target[0], target[1]);
      }
    } else if (command.type === COMMAND_STOP) {
      for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
        const id = command.unitIds[unitIndex]!;
        const index = resolveId(world, id);

        if (index < 0) continue;
        // THE ownership validation - one place, every client, deterministic. The relay stays
        // dumb; forged or mis-addressed commands die here identically everywhere.
        if (world.owner[index] !== command.issuer) continue;
        // Carried resources persist across interrupts: a hauler keeps the load.
        clearUnitTask(world, index);
      }
    } else if (command.type === COMMAND_ATTACK) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.owner[target] !== NEUTRAL_OWNER &&
        world.owner[target] !== command.issuer &&
        isEntityVisibleTo(world, command.issuer, target)
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          const sourceStats = UNIT_TYPES[world.unitType[index]!]!;
          if (
            sourceStats.attack === null ||
            (sourceStats.attack.kind === "melee" &&
              sourceStats.attack.canTargetAir !== true &&
              (UNIT_TYPES[world.unitType[target]!]!.classes & UNIT_CLASS_AIR) !== 0)
          ) {
            continue;
          }
          // Carried resources persist across interrupts: a hauler keeps the load.
          clearUnitTask(world, index);
          world.attackTarget[index] = command.targetId;
          world.attackOrdered[index] = 1;
          world.moveTargetX[index] = world.posX[target]!;
          world.moveTargetZ[index] = world.posZ[target]!;
        }
      }
    } else if (
      command.type === COMMAND_HEAL ||
      command.type === COMMAND_EMPOWER ||
      command.type === COMMAND_CONVERT
    ) {
      applySupportCommand(world, command);
    } else if (command.type === COMMAND_GATHER) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.dying[target] === 0 &&
        world.hp[target]! > 0 &&
        UNIT_TYPES[world.unitType[target]!]!.resource >= 0
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Resource-eating repair shares the world-resource gesture while
          // remaining distinct from worker cargo and dropsite behavior.
          const gathererStats = UNIT_TYPES[world.unitType[index]!]!;
          const targetStats = UNIT_TYPES[world.unitType[target]!]!;
          const eat = gathererStats.resourceEat;
          if (
            eat !== undefined &&
            eat.resourceTypes.includes(targetStats.resource) &&
            world.hp[index]! <
              effectiveMaxHp(gathererStats, world.playerAge[world.owner[index]!]!)
          ) {
            clearUnitTask(world, index);
            world.mode[index] = MODE_EATING_RESOURCE;
            world.taskTarget[index] = command.targetId;
            world.gatherPosX[index] = world.posX[target]!;
            world.gatherPosZ[index] = world.posZ[target]!;
            assignFieldGoal(world, index, world.posX[target]!, world.posZ[target]!);
            continue;
          }
          // Non-gatherers in a mixed selection are silently skipped, not treated as an error.
          if (
            (gathererStats.classes & UNIT_CLASS_WORKER) === 0 &&
            gathererStats.gather === undefined
          ) {
            continue;
          }
          if (!canTypeGatherResource(world.unitType[index]!, world.unitType[target]!)) continue;
          assignGatherTask(
            world,
            index,
            command.targetId,
            world.posX[target]!,
            world.posZ[target]!,
          );
        }
      }
    } else if (command.type === COMMAND_BUILD) {
      const target = resolveId(world, command.targetId);

      if (
        target >= 0 &&
        world.dying[target] === 0 &&
        world.hp[target]! > 0 &&
        world.owner[target] === command.issuer &&
        UNIT_TYPES[world.unitType[target]!]!.footprint > 0 &&
        world.buildProgress[target]! < UNIT_TYPES[world.unitType[target]!]!.buildTicks
      ) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          // THE ownership validation - one place, every client, deterministic. The relay stays
          // dumb; forged or mis-addressed commands die here identically everywhere.
          if (world.owner[index] !== command.issuer) continue;
          // Mixed selections silently skip entities the target does not list as builders.
          if (
            !UNIT_TYPES[world.unitType[target]!]!.builtBy.some(
              (relationship) => relationship.type === world.unitType[index],
            )
          ) {
            continue;
          }
          assignWorkerTask(world, index, MODE_BUILDING, command.targetId);
        }
      }
    } else if (command.type === COMMAND_PRAY) {
      const target = resolveId(world, command.targetId);

      if (isValidPrayerTarget(world, target, command.issuer)) {
        for (let unitIndex = 0; unitIndex < command.unitIds.length; unitIndex += 1) {
          const id = command.unitIds[unitIndex]!;
          const index = resolveId(world, id);

          if (index < 0) continue;
          if (world.owner[index] !== command.issuer) continue;
          const workerStats = UNIT_TYPES[world.unitType[index]!]!;
          if (
            (workerStats.classes & UNIT_CLASS_WORKER) === 0 ||
            workerStats.culture !== CULTURE_GREEK
          ) {
            continue;
          }
          assignWorkerTask(world, index, MODE_PRAYING, command.targetId);
        }
      }
    } else if (isRelicCommand(command)) {
      applyRelicCommand(world, command);
    } else if (isGarrisonCommand(command)) {
      applyGarrisonCommand(world, command);
    } else if (isTradeCommand(command)) {
      applyTradeCommand(world, command);
    } else if (command.type === COMMAND_TRAIN) {
      const building = resolveId(world, command.buildingId);

      if (
        building >= 0 &&
        world.dying[building] === 0 &&
        world.hp[building]! > 0 &&
        world.owner[building] === command.issuer
      ) {
        const producerStats = UNIT_TYPES[world.unitType[building]!]!;
        const trainOptions = TRAIN_OPTIONS_BY_PRODUCER[producerStats.id];

        if (
          trainOptions !== undefined &&
          trainOptions.some((option) => option.type === command.unitType) &&
          world.buildProgress[building]! >= producerStats.buildTicks &&
          world.trainQueueLength[building]! < MAX_TRAIN_QUEUE &&
          (producerStats.trainingSite?.consumeOnCompletion !== true ||
            world.trainQueueLength[building] === 0) &&
          !isBuildingResearching(world, building) &&
          isTypeAvailableToPlayer(
            world,
            command.issuer,
            command.unitType,
            world.unitType[building]!,
          )
        ) {
          const unitStats = UNIT_TYPES[command.unitType]!;
          const foodIndex = command.issuer * RESOURCE_COUNT + FOOD;
          const woodIndex = command.issuer * RESOURCE_COUNT + WOOD;
          const goldIndex = command.issuer * RESOURCE_COUNT + GOLD;
          const favorIndex = command.issuer * RESOURCE_COUNT + FAVOR;

          if (
            world.stockpiles[foodIndex]! >= unitStats.costFood &&
            world.stockpiles[woodIndex]! >= unitStats.costWood &&
            world.stockpiles[goldIndex]! >= unitStats.costGold &&
            world.stockpiles[favorIndex]! >= unitStats.costFavor
          ) {
            let pop = 0;
            let popCap = 0;

            // Command-rate scan is cheap, and counting promises here keeps cap validation local.
            for (let j = 0; j < world.count; j += 1) {
              if (world.owner[j] !== command.issuer || world.dying[j] === 1 || world.hp[j] === 0) {
                continue;
              }

              const js = UNIT_TYPES[world.unitType[j]!]!;

              pop += js.populationCost;
              // Every queued order is a promised unit; sum its own cost so mixed queues cannot
              // overshoot the cap in the same turn.
              const queueStart = j * MAX_TRAIN_QUEUE;
              for (let queueIndex = 0; queueIndex < world.trainQueueLength[j]!; queueIndex += 1) {
                pop += UNIT_TYPES[world.trainQueueTypes[queueStart + queueIndex]!]!.populationCost;
              }
              if (js.footprint > 0 && world.buildProgress[j]! >= js.buildTicks) {
                popCap += js.popBonus;
              }
            }

            if (pop + unitStats.populationCost <= popCap) {
              world.stockpiles[foodIndex] = world.stockpiles[foodIndex]! - unitStats.costFood;
              world.stockpiles[woodIndex] = world.stockpiles[woodIndex]! - unitStats.costWood;
              world.stockpiles[goldIndex] = world.stockpiles[goldIndex]! - unitStats.costGold;
              world.stockpiles[favorIndex] = world.stockpiles[favorIndex]! - unitStats.costFavor;

              enqueueProduction(world, building, command.unitType, unitStats.buildTicks);
            }
          }
        }
      }
    } else if (command.type === COMMAND_CANCEL_TRAIN) {
      const building = resolveId(world, command.buildingId);

      if (
        building >= 0 &&
        world.dying[building] === 0 &&
        world.hp[building]! > 0 &&
        world.owner[building] === command.issuer
      ) {
        const cancelledType = cancelProduction(
          world,
          building,
          command.queueIndex,
          (unitType) => UNIT_TYPES[unitType]!.buildTicks,
        );

        if (cancelledType !== NO_UNIT_TYPE) {
          const stats = UNIT_TYPES[cancelledType]!;
          const resourceStart = command.issuer * RESOURCE_COUNT;

          world.stockpiles[resourceStart + FOOD] =
            world.stockpiles[resourceStart + FOOD]! + stats.costFood;
          world.stockpiles[resourceStart + WOOD] =
            world.stockpiles[resourceStart + WOOD]! + stats.costWood;
          world.stockpiles[resourceStart + GOLD] =
            world.stockpiles[resourceStart + GOLD]! + stats.costGold;
          world.stockpiles[resourceStart + FAVOR] =
            world.stockpiles[resourceStart + FAVOR]! + stats.costFavor;
        }
      }
    } else if (command.type === COMMAND_ADVANCE_AGE) {
      const building = resolveId(world, command.buildingId);

      tryStartAgeAdvance(world, command.issuer, building, command.minorGod);
    } else if (command.type === COMMAND_CHEAT) {
      const playerId = command.issuer;
      const playerSlot = world.playerSlotById[playerId] ?? -1;

      if (playerSlot !== -1) {
        if (command.cheat === CHEAT_ADD_FOOD) {
          addCheatResource(world, playerId, FOOD);
        } else if (command.cheat === CHEAT_ADD_WOOD) {
          addCheatResource(world, playerId, WOOD);
        } else if (command.cheat === CHEAT_ADD_GOLD) {
          addCheatResource(world, playerId, GOLD);
        } else if (command.cheat === CHEAT_FULL_FAVOR) {
          world.stockpiles[playerId * RESOURCE_COUNT + FAVOR] = favorCapForMajorGod(
            world.playerMajorGod[playerId]!,
          );
        } else if (command.cheat === CHEAT_REVEAL_MAP) {
          const start = playerSlot * VISIBILITY_TILES;
          world.visibility.fill(VIS_EXPLORED, start, start + VISIBILITY_TILES);
        }
      }
    } else if (command.type === COMMAND_PLACE) {
      const buildingType = command.buildingType;
      const buildingStats = UNIT_TYPES[buildingType];
      const foodIndex = command.issuer * RESOURCE_COUNT + FOOD;
      const woodIndex = command.issuer * RESOURCE_COUNT + WOOD;
      const goldIndex = command.issuer * RESOURCE_COUNT + GOLD;
      const favorIndex = command.issuer * RESOURCE_COUNT + FAVOR;

      // The engine's ghost preview pre-validates, so failures here are stale-by-input-delay races —
      // e.g. two players placing on the same tiles in one turn: the first (playerId order) wins,
      // the second's command finds tiles occupied and dies silently. This is the desired lockstep semantics.
      if (
        buildingStats !== undefined &&
        buildingStats.footprint > 0 &&
        isTypeAvailableToPlayer(
          world,
          command.issuer,
          buildingType,
          workerTypeForCulture(cultureForMajorGod(world.playerMajorGod[command.issuer]!)),
        ) &&
        isFootprintVisibleTo(
          world,
          command.issuer,
          command.tileX,
          command.tileZ,
          buildingStats.footprint,
        ) &&
        canPlaceBuilding(world, command.tileX, command.tileZ, buildingType) &&
        world.stockpiles[foodIndex]! >= buildingStats.costFood &&
        world.stockpiles[woodIndex]! >= buildingStats.costWood &&
        world.stockpiles[goldIndex]! >= buildingStats.costGold &&
        world.stockpiles[favorIndex]! >= buildingStats.costFavor
      ) {
        world.stockpiles[foodIndex] = world.stockpiles[foodIndex]! - buildingStats.costFood;
        world.stockpiles[woodIndex] = world.stockpiles[woodIndex]! - buildingStats.costWood;
        world.stockpiles[goldIndex] = world.stockpiles[goldIndex]! - buildingStats.costGold;
        world.stockpiles[favorIndex] = world.stockpiles[favorIndex]! - buildingStats.costFavor;
        spawnBuilding(world, command.tileX, command.tileZ, command.issuer, buildingType, false);
      }
    }

    // Rare path, allocation acceptable: command queue handling runs at click rate.
    world.commands.splice(i, 1);
  }
}

function addCheatResource(world: World, playerId: number, resource: number): void {
  const index = playerId * RESOURCE_COUNT + resource;
  world.stockpiles[index] = Math.min(0xffffffff, world.stockpiles[index]! + 1_000);
}
