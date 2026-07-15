import type { World } from "./world";
import { TICK_HZ } from "../clock";
import { GOD_HADES, GOD_POSEIDON, GOD_ZEUS } from "./progression";
import { FAVOR, RESOURCE_COUNT } from "./types";

const FAVOR_MICROS = 1_000_000;
export const FAVOR_PROGRESS_PER_RESOURCE = FAVOR_MICROS * TICK_HZ;

// Classic's pre-Retold curve, quantized once to micro-Favor per second:
// N < 13: (1 - .015N - .005 * 60^(1 + .01N)) * N * .131; otherwise
// .3 * N * .131. Zeus applies the Classic 20% major-god bonus.
const GENERIC_GREEK_RATE_MICROS = [
  0, 88_093, 168_833, 242_006, 307_387, 364_735, 413_798, 454_310, 485_991, 508_543, 521_655,
  524_997, 518_222,
] as const;
const ZEUS_RATE_MICROS = [
  0, 105_711, 202_599, 290_408, 368_864, 437_681, 496_557, 545_172, 583_189, 610_252, 625_987,
  629_997, 621_866,
] as const;
const GENERIC_LINEAR_RATE_MICROS = 39_300;
const ZEUS_LINEAR_RATE_MICROS = 47_160;

export function isGreekMajorGod(majorGod: number): boolean {
  return majorGod === GOD_ZEUS || majorGod === GOD_POSEIDON || majorGod === GOD_HADES;
}

export function favorCapForMajorGod(majorGod: number): number {
  return majorGod === GOD_ZEUS ? 200 : 100;
}

export function greekFavorRateMicrosPerSecond(prayingVillagers: number, majorGod: number): number {
  if (prayingVillagers <= 0 || !isGreekMajorGod(majorGod)) {
    return 0;
  }

  const zeus = majorGod === GOD_ZEUS;

  if (prayingVillagers < GENERIC_GREEK_RATE_MICROS.length) {
    return (zeus ? ZEUS_RATE_MICROS : GENERIC_GREEK_RATE_MICROS)[prayingVillagers]!;
  }

  return prayingVillagers * (zeus ? ZEUS_LINEAR_RATE_MICROS : GENERIC_LINEAR_RATE_MICROS);
}

export function greekFavorRateMilliPerMinute(prayingVillagers: number, majorGod: number): number {
  return Math.round((greekFavorRateMicrosPerSecond(prayingVillagers, majorGod) * 60) / 1_000);
}

export function tickGreekFavor(world: World): void {
  for (let playerSlot = 0; playerSlot < world.playerCount; playerSlot += 1) {
    const playerId = world.playerIds[playerSlot]!;
    const favorIndex = playerId * RESOURCE_COUNT + FAVOR;
    const cap = favorCapForMajorGod(world.playerMajorGod[playerId]!);

    if (world.stockpiles[favorIndex]! >= cap) {
      // Classic discards fractional progress while capped; spending Favor starts
      // the next whole point from zero.
      world.playerFavorProgress[playerId] = 0;
      continue;
    }

    const rate = greekFavorRateMicrosPerSecond(
      world.prayingVillagers[playerId]!,
      world.playerMajorGod[playerId]!,
    );

    if (rate === 0) {
      continue;
    }

    let progress = world.playerFavorProgress[playerId]! + rate;
    const generated = Math.floor(progress / FAVOR_PROGRESS_PER_RESOURCE);

    if (generated > 0) {
      const available = cap - world.stockpiles[favorIndex]!;
      const credited = Math.min(generated, available);

      world.stockpiles[favorIndex] = world.stockpiles[favorIndex]! + credited;
      progress -= credited * FAVOR_PROGRESS_PER_RESOURCE;

      if (world.stockpiles[favorIndex] === cap) {
        progress = 0;
      }
    }

    world.playerFavorProgress[playerId] = progress;
  }
}
