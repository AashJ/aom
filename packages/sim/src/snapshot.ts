// The only sim->engine channel. The engine reads snapshots, never World.
import { FAVOR, NO_UNIT_TYPE, RESOURCE_COUNT, UNIT_TYPES } from "./ecs/types";
import { getAgeAdvanceRuleByResearchId } from "./ecs/age-advancement";
import { isCompletedOwnedBuilding } from "./ecs/availability";
import { favorCapForMajorGod, greekFavorRateMilliPerMinute } from "./ecs/favor";
import { findAgeAdvanceResearch } from "./ecs/research";
import { MAX_TRAIN_QUEUE } from "./ecs/production";
import { resolveId, unitIdAt, NO_TARGET, type World } from "./ecs/world";
import { AGE_ARCHAIC, AGE_COUNT, NO_AGE, NO_GOD } from "./ecs/progression";
import { isEntityVisibleTo, isTypeAtPositionVisibleTo, VISIBILITY_TILES } from "./visibility";

export interface RenderSnapshot {
  tick: number;
  count: number;
  ids: Uint32Array;
  posX: Float32Array;
  posZ: Float32Array;
  facingX: Float32Array;
  facingZ: Float32Array;
  moving: Uint8Array;
  mode: Uint8Array;
  gatherTargetType: Uint16Array;
  actionCooldown: Uint16Array;
  visible: Uint8Array;
  fog: Uint8Array;
  selected: Uint8Array;
  owner: Uint8Array;
  unitType: Uint16Array;
  deathCount: number;
  deathIds: Uint32Array;
  deathTypes: Uint16Array;
  deathPosX: Float32Array;
  deathPosZ: Float32Array;
  deathFacingX: Float32Array;
  deathFacingZ: Float32Array;
  deathOwners: Uint8Array;
  deathVisible: Uint8Array;
  hp: Float32Array;
  buildProgress: Uint16Array;
  trainRemaining: Uint16Array;
  trainQueueLength: Uint8Array;
  trainQueueTypes: Uint16Array;
  carried: Uint16Array;
  stockpiles: Uint32Array;
  age: number;
  majorGod: number;
  playerMajorGods: Uint8Array;
  minorGods: Uint8Array;
  ageAdvanceTarget: number;
  ageAdvanceGod: number;
  ageAdvanceRemaining: number;
  ageAdvanceTotal: number;
  ageAdvanceBuilding: number;
  favorRateMilliPerMinute: number;
  completedBuildings: Uint8Array;
  winner: number;
}

export function createSnapshot(capacity: number): RenderSnapshot {
  return {
    tick: 0,
    count: 0,
    ids: new Uint32Array(capacity),
    posX: new Float32Array(capacity),
    posZ: new Float32Array(capacity),
    facingX: new Float32Array(capacity),
    facingZ: new Float32Array(capacity),
    moving: new Uint8Array(capacity),
    mode: new Uint8Array(capacity),
    gatherTargetType: new Uint16Array(capacity).fill(NO_UNIT_TYPE),
    actionCooldown: new Uint16Array(capacity),
    visible: new Uint8Array(capacity),
    fog: new Uint8Array(VISIBILITY_TILES),
    selected: new Uint8Array(capacity),
    owner: new Uint8Array(capacity),
    unitType: new Uint16Array(capacity),
    deathCount: 0,
    deathIds: new Uint32Array(capacity),
    deathTypes: new Uint16Array(capacity),
    deathPosX: new Float32Array(capacity),
    deathPosZ: new Float32Array(capacity),
    deathFacingX: new Float32Array(capacity),
    deathFacingZ: new Float32Array(capacity),
    deathOwners: new Uint8Array(capacity),
    deathVisible: new Uint8Array(capacity),
    hp: new Float32Array(capacity),
    buildProgress: new Uint16Array(capacity),
    trainRemaining: new Uint16Array(capacity),
    trainQueueLength: new Uint8Array(capacity),
    trainQueueTypes: new Uint16Array(capacity * MAX_TRAIN_QUEUE).fill(NO_UNIT_TYPE),
    carried: new Uint16Array(capacity),
    stockpiles: new Uint32Array(256 * RESOURCE_COUNT),
    age: AGE_ARCHAIC,
    majorGod: NO_GOD,
    playerMajorGods: new Uint8Array(256).fill(NO_GOD),
    minorGods: new Uint8Array(AGE_COUNT).fill(NO_GOD),
    ageAdvanceTarget: NO_AGE,
    ageAdvanceGod: NO_GOD,
    ageAdvanceRemaining: 0,
    ageAdvanceTotal: 0,
    ageAdvanceBuilding: NO_TARGET,
    favorRateMilliPerMinute: 0,
    completedBuildings: new Uint8Array(UNIT_TYPES.length),
    winner: -1,
  };
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
  out.completedBuildings.fill(0);
  const viewerSlot = world.playerSlotById[viewerId]!;
  out.ageAdvanceTarget = NO_AGE;
  out.ageAdvanceGod = NO_GOD;
  out.ageAdvanceRemaining = 0;
  out.ageAdvanceTotal = 0;
  out.ageAdvanceBuilding = NO_TARGET;
  out.favorRateMilliPerMinute = 0;

  if (viewerSlot >= 0) {
    out.age = world.playerAge[viewerId]!;
    out.majorGod = world.playerMajorGod[viewerId]!;
    const prayingVillagers = world.prayingVillagers[viewerId]!;
    const favor = world.stockpiles[viewerId * RESOURCE_COUNT + FAVOR]!;
    out.favorRateMilliPerMinute =
      favor >= favorCapForMajorGod(out.majorGod)
        ? 0
        : greekFavorRateMilliPerMinute(prayingVillagers, out.majorGod);
    const minorGodStart = viewerId * AGE_COUNT;
    out.minorGods.set(world.playerMinorGods.subarray(minorGodStart, minorGodStart + AGE_COUNT));
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
    out.deathVisible[eventIndex] = isTypeAtPositionVisibleTo(world, viewerId, owner, unitType, x, z)
      ? 1
      : 0;
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
    out.mode[i] = world.mode[i]!;
    const gatherTarget = resolveId(world, world.taskTarget[i]!);
    out.gatherTargetType[i] = gatherTarget >= 0 ? world.unitType[gatherTarget]! : NO_UNIT_TYPE;
    out.actionCooldown[i] = world.attackCooldown[i]!;
    out.visible[i] = isEntityVisibleTo(world, viewerId, i) ? 1 : 0;
    // Copies selected, not selectable; selectable only means the unit may be selected.
    out.selected[i] = world.selected[i]!;
    // Renderer tints by owner in the next chunk.
    out.owner[i] = world.owner[i]!;
    // The renderer picks sprites by type.
    out.unitType[i] = world.unitType[i]!;
    out.hp[i] = world.hp[i]!;
    out.buildProgress[i] = world.buildProgress[i]!;
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
  }
}
