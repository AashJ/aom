import { MAX_TRAIN_QUEUE } from "./production";

export interface OwnedOrQueuedUnitState {
  readonly count: number;
  readonly owner: Uint8Array;
  readonly unitType: Uint16Array;
  readonly dying: Uint8Array;
  readonly hp: ArrayLike<number>;
  readonly trainQueueLength: Uint8Array;
  readonly trainQueueTypes: Uint16Array;
}

export function countLiveOrQueuedUnitType(
  state: OwnedOrQueuedUnitState,
  playerId: number,
  unitType: number,
): number {
  let count = 0;

  for (let index = 0; index < state.count; index += 1) {
    if (state.owner[index] !== playerId || state.dying[index] === 1 || state.hp[index]! <= 0) {
      continue;
    }

    if (state.unitType[index] === unitType) count += 1;

    const queueStart = index * MAX_TRAIN_QUEUE;
    for (let queueIndex = 0; queueIndex < state.trainQueueLength[index]!; queueIndex += 1) {
      if (state.trainQueueTypes[queueStart + queueIndex] === unitType) count += 1;
    }
  }

  return count;
}
