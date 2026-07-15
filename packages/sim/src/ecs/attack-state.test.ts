import { describe, expect, test } from "bun:test";
import { advanceProjectileAim, clearAttackOrder } from "./attack-state";
import { NO_TARGET } from "./id";

describe("canonical attack-sequence state", () => {
  test("advances only consecutive shots against the same stable target", () => {
    const state = {
      attackTarget: new Uint32Array([44]),
      attackOrdered: new Uint8Array([1]),
      attackAimTarget: new Uint32Array([NO_TARGET]),
      attackAimShots: new Uint16Array(1),
      moving: new Uint8Array([1]),
      unitField: [{ goalCell: 4, dirX: new Float32Array(1), dirZ: new Float32Array(1) }],
    };

    expect(advanceProjectileAim(state, 0, 44)).toBe(0);
    expect(advanceProjectileAim(state, 0, 44)).toBe(1);
    expect(advanceProjectileAim(state, 0, 55)).toBe(0);
    expect(state.attackAimTarget[0]).toBe(55);
    expect(state.attackAimShots[0]).toBe(1);
  });

  test("clears combat order, pursuit, and projectile aim together", () => {
    const state = {
      attackTarget: new Uint32Array([44]),
      attackOrdered: new Uint8Array([1]),
      attackAimTarget: new Uint32Array([44]),
      attackAimShots: new Uint16Array([3]),
      moving: new Uint8Array([1]),
      unitField: [{ goalCell: 4, dirX: new Float32Array(1), dirZ: new Float32Array(1) }],
    };

    clearAttackOrder(state, 0);

    expect(state.attackTarget[0]).toBe(NO_TARGET);
    expect(state.attackOrdered[0]).toBe(0);
    expect(state.attackAimTarget[0]).toBe(NO_TARGET);
    expect(state.attackAimShots[0]).toBe(0);
    expect(state.moving[0]).toBe(0);
    expect(state.unitField[0]).toBeNull();
  });
});
