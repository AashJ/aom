import { NO_UNIT_TYPE } from "./types";

export const MAX_TRAIN_QUEUE = 15;

export interface ProductionQueueState {
  trainRemaining: Uint16Array;
  trainQueueLength: Uint8Array;
  trainQueueTypes: Uint16Array;
}

function queueStart(producer: number): number {
  return producer * MAX_TRAIN_QUEUE;
}

export function activeTrainType(state: ProductionQueueState, producer: number): number {
  if (state.trainQueueLength[producer] === 0) return NO_UNIT_TYPE;
  return state.trainQueueTypes[queueStart(producer)]!;
}

export function clearProductionQueue(state: ProductionQueueState, producer: number): void {
  const start = queueStart(producer);

  state.trainRemaining[producer] = 0;
  state.trainQueueLength[producer] = 0;
  state.trainQueueTypes.fill(NO_UNIT_TYPE, start, start + MAX_TRAIN_QUEUE);
}

export function enqueueProduction(
  state: ProductionQueueState,
  producer: number,
  unitType: number,
  buildTicks: number,
): boolean {
  const length = state.trainQueueLength[producer]!;
  if (length >= MAX_TRAIN_QUEUE) return false;

  state.trainQueueTypes[queueStart(producer) + length] = unitType;
  state.trainQueueLength[producer] = length + 1;

  if (length === 0) {
    state.trainRemaining[producer] = buildTicks;
  }

  return true;
}

export function finishActiveProduction(
  state: ProductionQueueState,
  producer: number,
  buildTicksFor: (unitType: number) => number,
): number {
  const completedType = activeTrainType(state, producer);
  if (completedType === NO_UNIT_TYPE) return NO_UNIT_TYPE;

  removeQueueEntry(state, producer, 0);
  const nextType = activeTrainType(state, producer);
  state.trainRemaining[producer] = nextType === NO_UNIT_TYPE ? 0 : buildTicksFor(nextType);

  return completedType;
}

export function cancelProduction(
  state: ProductionQueueState,
  producer: number,
  queueIndex: number,
  buildTicksFor: (unitType: number) => number,
): number {
  const length = state.trainQueueLength[producer]!;
  if (!Number.isInteger(queueIndex) || queueIndex < 0 || queueIndex >= length) {
    return NO_UNIT_TYPE;
  }

  const cancelledType = state.trainQueueTypes[queueStart(producer) + queueIndex]!;
  removeQueueEntry(state, producer, queueIndex);

  if (queueIndex === 0) {
    const nextType = activeTrainType(state, producer);
    state.trainRemaining[producer] = nextType === NO_UNIT_TYPE ? 0 : buildTicksFor(nextType);
  }

  return cancelledType;
}

export function copyProductionQueue(
  state: ProductionQueueState,
  destination: number,
  source: number,
): void {
  const destinationStart = queueStart(destination);
  const sourceStart = queueStart(source);

  state.trainRemaining[destination] = state.trainRemaining[source]!;
  state.trainQueueLength[destination] = state.trainQueueLength[source]!;
  state.trainQueueTypes.copyWithin(destinationStart, sourceStart, sourceStart + MAX_TRAIN_QUEUE);
}

function removeQueueEntry(state: ProductionQueueState, producer: number, queueIndex: number): void {
  const start = queueStart(producer);
  const nextLength = state.trainQueueLength[producer]! - 1;

  for (let index = queueIndex; index < nextLength; index += 1) {
    state.trainQueueTypes[start + index] = state.trainQueueTypes[start + index + 1]!;
  }

  state.trainQueueTypes[start + nextLength] = NO_UNIT_TYPE;
  state.trainQueueLength[producer] = nextLength;
}
