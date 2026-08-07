// The only sim->engine channel. The engine reads snapshots, never World.
import { FAVOR, NO_UNIT_TYPE, RESOURCE_COUNT, UNIT_TYPES } from "./ecs/types";
import {
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_RELIC,
  type UnitTypeStats,
} from "./content/unit-type-schema";
import { getAgeAdvanceRuleByResearchId } from "./ecs/age-advancement";
import { isCompletedOwnedBuilding } from "./ecs/availability";
import {
  egyptianMonumentRateMilliPerMinute,
  favorCapForMajorGod,
  greekFavorRateMilliPerMinute,
  isGreekMajorGod,
} from "./ecs/favor";
import { findAgeAdvanceResearch } from "./ecs/research";
import { MAX_TRAIN_QUEUE } from "./ecs/production";
import { MAX_PROJECTILES, NO_PROJECTILE_TICK, projectileProgressAt } from "./ecs/projectiles";
import { NO_MELEE_ATTACK_VARIANT } from "./ecs/melee-attack-cycles";
import { jumpElevation } from "./ecs/special-attacks";
import { resolveId, unitIdAt, NO_TARGET, type World } from "./ecs/world";
import { AGE_ARCHAIC, AGE_COUNT, NO_AGE, NO_GOD } from "./ecs/progression";
import { PLAYER_RESEARCH_STRIDE } from "./ecs/technologies";
import {
  isEntityVisibleTo,
  isPositionVisibleTo,
  isTypeAtPositionVisibleTo,
  VISIBILITY_TILES,
} from "./visibility";

export interface RenderSnapshot {
  tick: number;
  count: number;
  ids: Uint32Array;
  posX: Float32Array;
  posZ: Float32Array;
  facingX: Float32Array;
  facingZ: Float32Array;
  moving: Uint8Array;
  gateOpen: Uint8Array;
  mode: Uint8Array;
  gatherTargetType: Uint16Array;
  actionCooldown: Uint16Array;
  secondaryAttack: Uint8Array;
  beamTargetId: Uint32Array;
  beamTargetVisible: Uint8Array;
  meleeActionVariant: Uint8Array;
  combatExperienceKills: Uint8Array;
  specialActionRemaining: Uint16Array;
  poisoned: Uint8Array;
  poisonElapsedTicks: Uint16Array;
  targetReactionKind: Uint8Array;
  elevation: Float32Array;
  visible: Uint8Array;
  fog: Uint8Array;
  selected: Uint8Array;
  owner: Uint8Array;
  unitType: Uint16Array;
  carriedRelicCount: Uint8Array;
  projectileCount: number;
  projectileIds: Uint32Array;
  projectileTypes: Uint8Array;
  projectilePosX: Float32Array;
  projectilePosZ: Float32Array;
  projectileFacingX: Float32Array;
  projectileFacingZ: Float32Array;
  projectileProgress: Float32Array;
  projectileOwners: Uint8Array;
  projectileVisible: Uint8Array;
  deathCount: number;
  deathIds: Uint32Array;
  deathTypes: Uint16Array;
  deathPosX: Float32Array;
  deathPosZ: Float32Array;
  deathFacingX: Float32Array;
  deathFacingZ: Float32Array;
  deathOwners: Uint8Array;
  deathCombatExperienceKills: Uint8Array;
  deathConditions: Uint8Array;
  deathCarried: Uint16Array;
  deathVisible: Uint8Array;
  hp: Float32Array;
  buildProgress: Uint16Array;
  lifespanRemaining: Uint16Array;
  trainRemaining: Uint16Array;
  trainQueueLength: Uint8Array;
  trainQueueTypes: Uint16Array;
  carried: Uint16Array;
  stockpiles: Uint32Array;
  age: number;
  majorGod: number;
  playerMajorGods: Uint8Array;
  playerAges: Uint8Array;
  minorGods: Uint8Array;
  ageAdvanceTarget: number;
  ageAdvanceGod: number;
  ageAdvanceRemaining: number;
  ageAdvanceTotal: number;
  ageAdvanceBuilding: number;
  favorRateMilliPerMinute: number;
  townBellActive: number;
  completedBuildings: Uint8Array;
  completedResearch: Uint8Array;
  winner: number;
}

export function createSnapshot(
  capacity: number,
  projectileCapacity = Math.min(MAX_PROJECTILES, Math.max(1, capacity * 4)),
): RenderSnapshot {
  return {
    tick: 0,
    count: 0,
    ids: new Uint32Array(capacity),
    posX: new Float32Array(capacity),
    posZ: new Float32Array(capacity),
    facingX: new Float32Array(capacity),
    facingZ: new Float32Array(capacity),
    moving: new Uint8Array(capacity),
    gateOpen: new Uint8Array(capacity),
    mode: new Uint8Array(capacity),
    gatherTargetType: new Uint16Array(capacity).fill(NO_UNIT_TYPE),
    actionCooldown: new Uint16Array(capacity),
    secondaryAttack: new Uint8Array(capacity),
    beamTargetId: new Uint32Array(capacity).fill(NO_TARGET),
    beamTargetVisible: new Uint8Array(capacity),
    meleeActionVariant: new Uint8Array(capacity).fill(NO_MELEE_ATTACK_VARIANT),
    combatExperienceKills: new Uint8Array(capacity),
    specialActionRemaining: new Uint16Array(capacity),
    poisoned: new Uint8Array(capacity),
    poisonElapsedTicks: new Uint16Array(capacity),
    targetReactionKind: new Uint8Array(capacity),
    elevation: new Float32Array(capacity),
    visible: new Uint8Array(capacity),
    fog: new Uint8Array(VISIBILITY_TILES),
    selected: new Uint8Array(capacity),
    owner: new Uint8Array(capacity),
    unitType: new Uint16Array(capacity),
    carriedRelicCount: new Uint8Array(capacity),
    projectileCount: 0,
    projectileIds: new Uint32Array(projectileCapacity),
    projectileTypes: new Uint8Array(projectileCapacity),
    projectilePosX: new Float32Array(projectileCapacity),
    projectilePosZ: new Float32Array(projectileCapacity),
    projectileFacingX: new Float32Array(projectileCapacity),
    projectileFacingZ: new Float32Array(projectileCapacity),
    projectileProgress: new Float32Array(projectileCapacity),
    projectileOwners: new Uint8Array(projectileCapacity),
    projectileVisible: new Uint8Array(projectileCapacity),
    deathCount: 0,
    deathIds: new Uint32Array(capacity),
    deathTypes: new Uint16Array(capacity),
    deathPosX: new Float32Array(capacity),
    deathPosZ: new Float32Array(capacity),
    deathFacingX: new Float32Array(capacity),
    deathFacingZ: new Float32Array(capacity),
    deathOwners: new Uint8Array(capacity),
    deathCombatExperienceKills: new Uint8Array(capacity),
    deathConditions: new Uint8Array(capacity),
    deathCarried: new Uint16Array(capacity),
    deathVisible: new Uint8Array(capacity),
    hp: new Float32Array(capacity),
    buildProgress: new Uint16Array(capacity),
    lifespanRemaining: new Uint16Array(capacity),
    trainRemaining: new Uint16Array(capacity),
    trainQueueLength: new Uint8Array(capacity),
    trainQueueTypes: new Uint16Array(capacity * MAX_TRAIN_QUEUE).fill(NO_UNIT_TYPE),
    carried: new Uint16Array(capacity),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    age: AGE_ARCHAIC,
    majorGod: NO_GOD,
    playerMajorGods: new Uint8Array(256).fill(NO_GOD),
    playerAges: new Uint8Array(256),
    minorGods: new Uint8Array(AGE_COUNT).fill(NO_GOD),
    ageAdvanceTarget: NO_AGE,
    ageAdvanceGod: NO_GOD,
    ageAdvanceRemaining: 0,
    ageAdvanceTotal: 0,
    ageAdvanceBuilding: NO_TARGET,
    favorRateMilliPerMinute: 0,
    townBellActive: 0,
    completedBuildings: new Uint8Array(UNIT_TYPES.length),
    completedResearch: new Uint8Array(PLAYER_RESEARCH_STRIDE),
    winner: -1,
  };
}

export function writeProjectileSnapshot(
  world: World,
  out: RenderSnapshot,
  viewerId: number,
  unitTypes: readonly (UnitTypeStats | undefined)[] = UNIT_TYPES,
): void {
  out.projectileCount = 0;

  for (let index = 0; index < world.projectiles.count; index += 1) {
    const impactTick = world.projectiles.impactTicks[index]!;
    if (impactTick === NO_PROJECTILE_TICK) continue;
    const output = out.projectileCount;
    if (output >= out.projectileIds.length) {
      throw new RangeError("Render snapshot projectile capacity exceeded.");
    }
    const progress = projectileProgressAt(world.projectiles, index, world.tick);
    const launchX = world.projectiles.launchX[index]!;
    const launchZ = world.projectiles.launchZ[index]!;
    const dx = world.projectiles.impactX[index]! - launchX;
    const dz = world.projectiles.impactZ[index]! - launchZ;
    const directionLength = Math.sqrt(dx * dx + dz * dz);
    const x = launchX + dx * progress;
    const z = launchZ + dz * progress;
    const sourceType = world.projectiles.sourceTypes[index]!;
    const stats = unitTypes[sourceType];
    const attack =
      world.projectiles.specialAttacks[index] === 1
        ? stats?.specialAttack?.kind === "charged-projectile"
          ? stats.specialAttack
          : null
        : stats?.attack?.kind === "projectile"
          ? stats.attack
          : null;
    if (attack === null || attack === undefined) continue;

    out.projectileIds[output] = world.projectiles.ids[index]!;
    out.projectileTypes[output] = attack.projectile.type;
    out.projectilePosX[output] = x;
    out.projectilePosZ[output] = z;
    out.projectileFacingX[output] = directionLength > 0 ? dx / directionLength : 0;
    out.projectileFacingZ[output] = directionLength > 0 ? dz / directionLength : 1;
    out.projectileProgress[output] = progress;
    out.projectileOwners[output] = world.projectiles.owners[index]!;
    out.projectileVisible[output] =
      world.projectiles.owners[index] === viewerId || isPositionVisibleTo(world, viewerId, x, z)
        ? 1
        : 0;
    out.projectileCount = output + 1;
  }
}

export function writeSnapshot(world: World, out: RenderSnapshot, viewerId = 0): void {
  out.tick = world.tick;
  out.count = world.count;
  out.deathCount = world.deathEventCount;
  // HP bars and the win banner are 4a/4b consumers.
  out.winner = world.winner;
  // Full copy each write: 4 KB at 20 Hz is negligible.
  out.stockpiles.set(world.stockpiles);
  out.playerMajorGods.set(world.playerMajorGod);
  out.playerAges.set(world.playerAge);
  out.completedBuildings.fill(0);
  out.completedResearch.fill(0);
  out.carriedRelicCount.fill(0);
  out.poisoned.fill(0);
  out.poisonElapsedTicks.fill(0);
  const viewerSlot = world.playerSlotById[viewerId]!;
  out.ageAdvanceTarget = NO_AGE;
  out.ageAdvanceGod = NO_GOD;
  out.ageAdvanceRemaining = 0;
  out.ageAdvanceTotal = 0;
  out.ageAdvanceBuilding = NO_TARGET;
  out.favorRateMilliPerMinute = 0;
  out.townBellActive = 0;

  if (viewerSlot >= 0) {
    out.age = world.playerAge[viewerId]!;
    out.majorGod = world.playerMajorGod[viewerId]!;
    out.townBellActive = world.townBellActive[viewerId]!;
    const prayingVillagers = world.prayingVillagers[viewerId]!;
    const favor = world.stockpiles[viewerId * RESOURCE_COUNT + FAVOR]!;
    out.favorRateMilliPerMinute =
      favor >= favorCapForMajorGod(out.majorGod)
        ? 0
        : isGreekMajorGod(out.majorGod)
          ? greekFavorRateMilliPerMinute(prayingVillagers, out.majorGod)
          : egyptianMonumentRateMilliPerMinute(world, viewerId);
    const minorGodStart = viewerId * AGE_COUNT;
    out.minorGods.set(world.playerMinorGods.subarray(minorGodStart, minorGodStart + AGE_COUNT));
    const researchStart = viewerId * PLAYER_RESEARCH_STRIDE;
    out.completedResearch.set(
      world.playerResearch.subarray(researchStart, researchStart + PLAYER_RESEARCH_STRIDE),
    );
    const researchBuilding = findAgeAdvanceResearch(world, viewerId);

    if (researchBuilding >= 0) {
      const rule = getAgeAdvanceRuleByResearchId(world.researchId[researchBuilding]!);

      if (rule) {
        out.ageAdvanceTarget = rule.targetAge;
        out.ageAdvanceGod = world.researchChoice[researchBuilding]!;
        out.ageAdvanceRemaining = world.researchRemaining[researchBuilding]!;
        out.ageAdvanceTotal = rule.durationTicks;
        out.ageAdvanceBuilding = unitIdAt(world, researchBuilding);
      }
    }

    const start = viewerSlot * VISIBILITY_TILES;
    out.fog.set(world.visibility.subarray(start, start + VISIBILITY_TILES));
  } else {
    out.age = AGE_ARCHAIC;
    out.majorGod = NO_GOD;
    out.minorGods.fill(NO_GOD);
    out.fog.fill(0);
  }

  for (let eventIndex = 0; eventIndex < world.deathEventCount; eventIndex += 1) {
    const owner = world.deathEventOwners[eventIndex]!;
    const unitType = world.deathEventTypes[eventIndex]!;
    const x = world.deathEventPosX[eventIndex]!;
    const z = world.deathEventPosZ[eventIndex]!;

    out.deathIds[eventIndex] = world.deathEventIds[eventIndex]!;
    out.deathTypes[eventIndex] = unitType;
    out.deathPosX[eventIndex] = x;
    out.deathPosZ[eventIndex] = z;
    out.deathFacingX[eventIndex] = world.deathEventFacingX[eventIndex]!;
    out.deathFacingZ[eventIndex] = world.deathEventFacingZ[eventIndex]!;
    out.deathOwners[eventIndex] = owner;
    out.deathCombatExperienceKills[eventIndex] = world.deathEventCombatExperienceKills[eventIndex]!;
    out.deathConditions[eventIndex] = world.deathEventConditions[eventIndex]!;
    out.deathCarried[eventIndex] = world.deathEventCarried[eventIndex]!;
    out.deathVisible[eventIndex] = isTypeAtPositionVisibleTo(world, viewerId, owner, unitType, x, z)
      ? 1
      : 0;
  }

  writeProjectileSnapshot(world, out, viewerId);

  for (let effectIndex = 0; effectIndex < world.poisonEffects.count; effectIndex += 1) {
    const target = resolveId(world, world.poisonEffects.targetIds[effectIndex]!);
    if (target < 0 || world.dying[target] === 1 || world.hp[target] === 0) continue;
    const elapsedTicks = Math.max(0, world.tick - world.poisonEffects.startTicks[effectIndex]! - 1);
    out.poisoned[target] = 1;
    out.poisonElapsedTicks[target] = Math.max(
      out.poisonElapsedTicks[target]!,
      Math.min(0xffff, elapsedTicks),
    );
  }

  for (let i = 0; i < world.count; i += 1) {
    // The renderer will use id equality to decide interpolate-vs-snap once swap-remove exists;
    // picking uses it to convert screen hits into command ids.
    out.ids[i] = unitIdAt(world, i);
    // f64 sim state narrows to f32 at this boundary: render precision is enough for pixels,
    // while sim keeps f64.
    out.posX[i] = world.posX[i]!;
    out.posZ[i] = world.posZ[i]!;
    out.facingX[i] = world.facingX[i]!;
    out.facingZ[i] = world.facingZ[i]!;
    out.moving[i] = world.moving[i]!;
    out.gateOpen[i] = world.gateOpen[i]!;
    out.mode[i] = world.mode[i]!;
    const gatherTarget = resolveId(world, world.taskTarget[i]!);
    out.gatherTargetType[i] = gatherTarget >= 0 ? world.unitType[gatherTarget]! : NO_UNIT_TYPE;
    out.actionCooldown[i] = world.attackCooldown[i]!;
    const actionTarget = resolveId(world, world.attackTarget[i]!);
    const stats = UNIT_TYPES[world.unitType[i]!]!;
    const secondaryCycles = stats.buildingAttack?.cycleVariants;
    out.secondaryAttack[i] =
      stats.buildingAttack !== undefined &&
      ((actionTarget >= 0 &&
        (UNIT_TYPES[world.unitType[actionTarget]!]!.classes & UNIT_CLASS_BUILDING) !== 0) ||
        (secondaryCycles !== undefined && world.meleeActionVariant[i]! < secondaryCycles.length))
        ? 1
        : 0;
    const attack = stats.attack;
    const beamTarget =
      attack?.kind === "beam" && world.beamActionActive[i] === 1
        ? resolveId(world, world.attackTarget[i]!)
        : -1;
    out.beamTargetId[i] = beamTarget >= 0 ? unitIdAt(world, beamTarget) : NO_TARGET;
    out.beamTargetVisible[i] =
      beamTarget >= 0 && isEntityVisibleTo(world, viewerId, beamTarget) ? 1 : 0;
    out.meleeActionVariant[i] = world.meleeActionVariant[i]!;
    out.combatExperienceKills[i] = world.combatExperienceKills[i]!;
    out.specialActionRemaining[i] = world.specialActionRemaining[i]!;
    out.targetReactionKind[i] = world.targetReactions.kind[i]!;
    const special = UNIT_TYPES[world.unitType[i]!]!.specialAttack;
    const actionElevation =
      special?.kind === "charged-jump" && world.specialActionRemaining[i]! > 0
        ? jumpElevation(special, world.specialActionRemaining[i]!)
        : 0;
    out.elevation[i] = world.targetReactions.elevation[i]! + actionElevation;
    out.visible[i] =
      world.containedBy[i] === NO_TARGET && isEntityVisibleTo(world, viewerId, i) ? 1 : 0;
    // Copies selected, not selectable; selectable only means the unit may be selected.
    out.selected[i] = world.selected[i]!;
    // Renderer tints by owner in the next chunk.
    out.owner[i] = world.owner[i]!;
    // The renderer picks sprites by type.
    out.unitType[i] = world.unitType[i]!;
    out.hp[i] = world.hp[i]!;
    out.buildProgress[i] = world.buildProgress[i]!;
    out.lifespanRemaining[i] = world.lifespanRemaining[i]!;
    if (viewerSlot >= 0 && isCompletedOwnedBuilding(world, i, viewerId)) {
      out.completedBuildings[world.unitType[i]!] = 1;
    }

    // Production progress for the build-bar UI.
    out.trainRemaining[i] = world.trainRemaining[i]!;
    out.trainQueueLength[i] = world.trainQueueLength[i]!;
    const queueStart = i * MAX_TRAIN_QUEUE;
    out.trainQueueTypes.set(
      world.trainQueueTypes.subarray(queueStart, queueStart + MAX_TRAIN_QUEUE),
      queueStart,
    );
    out.carried[i] = world.carried[i]!;

    if ((UNIT_TYPES[world.unitType[i]!]!.classes & UNIT_CLASS_RELIC) !== 0) {
      const container = resolveId(world, world.containedBy[i]!);
      if (container >= 0) {
        out.carriedRelicCount[container] = Math.min(0xff, out.carriedRelicCount[container]! + 1);
      }
    }
  }
}
