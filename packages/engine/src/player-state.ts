import {
  AGE_ARCHAIC,
  FAVOR,
  FOOD,
  getTypeAvailability,
  GOLD,
  NO_AGE,
  NO_GOD,
  RESOURCE_COUNT,
  UNIT_TYPES,
  WOOD,
  type RenderSnapshot,
  type TypeAvailability,
} from "@aom/sim";

export interface PlayerState {
  age: number;
  majorGod: number;
  food: number;
  wood: number;
  gold: number;
  favor: number;
  pop: number;
  popCap: number;
  completedBuildings: Uint8Array;
  ageAdvancement: AgeAdvancementState | null;
}

export interface AgeAdvancementState {
  targetAge: number;
  minorGod: number;
  remainingTicks: number;
  totalTicks: number;
  buildingId: number;
  progress: number;
}

export type PlayerStateCallback = (state: PlayerState) => void;

export interface PlayerStateStore {
  update(snapshot: RenderSnapshot): void;
  availability(unitType: number): TypeAvailability;
  subscribe(callback: PlayerStateCallback): () => void;
  clear(): void;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

export function createPlayerStateStore(playerId: number): PlayerStateStore {
  let state: PlayerState = {
    age: AGE_ARCHAIC,
    majorGod: NO_GOD,
    food: 0,
    wood: 0,
    gold: 0,
    favor: 0,
    pop: 0,
    popCap: 0,
    completedBuildings: new Uint8Array(UNIT_TYPES.length),
    ageAdvancement: null,
  };
  const callbacks = new Set<PlayerStateCallback>();

  function update(snapshot: RenderSnapshot): void {
    const stockpileBase = playerId * RESOURCE_COUNT;
    const age = snapshot.age;
    const majorGod = snapshot.majorGod;
    const food = snapshot.stockpiles[stockpileBase + FOOD] ?? 0;
    const wood = snapshot.stockpiles[stockpileBase + WOOD] ?? 0;
    const gold = snapshot.stockpiles[stockpileBase + GOLD] ?? 0;
    const favor = snapshot.stockpiles[stockpileBase + FAVOR] ?? 0;
    let pop = 0;
    let popCap = 0;
    const ageAdvancement =
      snapshot.ageAdvanceTarget === NO_AGE
        ? null
        : {
            targetAge: snapshot.ageAdvanceTarget,
            minorGod: snapshot.ageAdvanceGod,
            remainingTicks: snapshot.ageAdvanceRemaining,
            totalTicks: snapshot.ageAdvanceTotal,
            buildingId: snapshot.ageAdvanceBuilding,
            progress: 1 - snapshot.ageAdvanceRemaining / Math.max(1, snapshot.ageAdvanceTotal),
          };

    for (let index = 0; index < snapshot.count; index += 1) {
      if (snapshot.owner[index] !== playerId) {
        continue;
      }

      const stats = UNIT_TYPES[snapshot.unitType[index]!]!;

      if (stats.footprint === 0) {
        pop += 1;
      }

      pop += snapshot.trainQueueLength[index]!;

      if (stats.footprint > 0 && snapshot.buildProgress[index]! >= stats.buildTicks) {
        popCap += stats.popBonus;
      }
    }

    if (
      age === state.age &&
      majorGod === state.majorGod &&
      food === state.food &&
      wood === state.wood &&
      gold === state.gold &&
      favor === state.favor &&
      pop === state.pop &&
      popCap === state.popCap &&
      ageAdvancement?.targetAge === state.ageAdvancement?.targetAge &&
      ageAdvancement?.minorGod === state.ageAdvancement?.minorGod &&
      ageAdvancement?.remainingTicks === state.ageAdvancement?.remainingTicks &&
      ageAdvancement?.totalTicks === state.ageAdvancement?.totalTicks &&
      ageAdvancement?.buildingId === state.ageAdvancement?.buildingId &&
      arraysEqual(state.completedBuildings, snapshot.completedBuildings)
    ) {
      return;
    }

    state = {
      age,
      majorGod,
      food,
      wood,
      gold,
      favor,
      pop,
      popCap,
      completedBuildings: snapshot.completedBuildings.slice(),
      ageAdvancement,
    };

    for (const callback of callbacks) {
      callback(state);
    }
  }

  function availability(unitType: number): TypeAvailability {
    return getTypeAvailability(
      unitType,
      state.age,
      (buildingType) => state.completedBuildings[buildingType] === 1,
    );
  }

  function subscribe(callback: PlayerStateCallback): () => void {
    callbacks.add(callback);
    callback(state);

    return () => callbacks.delete(callback);
  }

  return { update, availability, subscribe, clear: () => callbacks.clear() };
}
