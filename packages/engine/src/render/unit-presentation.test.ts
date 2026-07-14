import {
  GATHER_COOLDOWN_TICKS,
  MODE_GATHERING,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_MILITIA,
  TYPE_TREE,
  TYPE_VILLAGER,
  createSnapshot,
} from "@aom/sim";
import { describe, expect, test } from "bun:test";
import {
  MODEL_MILITIA_IDLE,
  MODEL_MILITIA_WALK,
  MODEL_VILLAGER_HARVEST,
  MODEL_VILLAGER_IDLE,
  MODEL_VILLAGER_MINE,
  MODEL_VILLAGER_WALK,
} from "./model-assets";
import {
  modelAnimationTime,
  resolveModelPresentation,
  UNIT_PRESENTATIONS,
} from "./unit-presentation";

describe("unit presentation", () => {
  test("resolves mobile model and action animation", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.unitType[0] = TYPE_VILLAGER;

    expect(resolveModelPresentation(snapshot, 0, false)?.modelIndex).toBe(MODEL_VILLAGER_IDLE);
    expect(resolveModelPresentation(snapshot, 0, true)?.modelIndex).toBe(MODEL_VILLAGER_WALK);

    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_GOLD_MINE;
    expect(resolveModelPresentation(snapshot, 0, false)?.modelIndex).toBe(MODEL_VILLAGER_MINE);

    snapshot.gatherTargetType[0] = TYPE_BERRY;
    expect(resolveModelPresentation(snapshot, 0, false)?.modelIndex).toBe(MODEL_VILLAGER_HARVEST);

    snapshot.unitType[0] = TYPE_MILITIA;
    expect(resolveModelPresentation(snapshot, 0, false)?.modelIndex).toBe(MODEL_MILITIA_IDLE);
    expect(resolveModelPresentation(snapshot, 0, true)?.modelIndex).toBe(MODEL_MILITIA_WALK);
  });

  test("distinguishes model units from actual static sprites", () => {
    expect(UNIT_PRESENTATIONS[TYPE_VILLAGER]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_MILITIA]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_TREE]?.kind).toBe("sprite");
  });

  test("drives gather animations from the action cooldown", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.unitType[0] = TYPE_VILLAGER;
    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_GOLD_MINE;
    snapshot.actionCooldown[0] = Math.floor(GATHER_COOLDOWN_TICKS / 2);
    const presentation = resolveModelPresentation(snapshot, 0, false)!;

    expect(modelAnimationTime(presentation, snapshot, 0, 0, 2)).toBeCloseTo(1);
  });
});
