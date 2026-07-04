const MULT = 6364136223846793005n;
const MASK64 = (1n << 64n) - 1n;

export interface Pcg32 {
  state: bigint;
  inc: bigint;
}

export function createPcg32(seed: number, seq = 1): Pcg32 {
  // JS numbers cannot hold the 64-bit multiply exactly; BigInt is exact and this runs at
  // init/tick rates, not per-pixel.
  const rng: Pcg32 = {
    state: 0n,
    inc: ((BigInt(seq) << 1n) | 1n) & MASK64,
  };

  nextU32(rng);
  rng.state = (rng.state + BigInt(seed)) & MASK64;
  nextU32(rng);
  return rng;
}

export function nextU32(rng: Pcg32): number {
  const oldState = rng.state;

  rng.state = (oldState * MULT + rng.inc) & MASK64;

  const xorshifted = Number((((oldState >> 18n) ^ oldState) >> 27n) & 0xffffffffn);
  const rot = Number(oldState >> 59n);

  return ((xorshifted >>> rot) | (xorshifted << (-rot & 31))) >>> 0;
}

export function nextFloat(rng: Pcg32): number {
  return nextU32(rng) / 4294967296;
}
