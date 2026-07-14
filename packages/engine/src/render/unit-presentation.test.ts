import {
  GATHER_COOLDOWN_TICKS,
  MODE_BUILDING,
  MODE_GATHERING,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TREE,
  TYPE_VILLAGER,
  createSnapshot,
  packId,
} from "@aom/sim";
import { describe, expect, test } from "bun:test";
import {
  modelAnimationTime,
  resolveModelPresentation,
  resolveStaticSpritePresentation,
  UNIT_PRESENTATIONS,
} from "./unit-presentation";

describe("unit presentation", () => {
  test("resolves mobile model and action animation", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.unitType[0] = TYPE_VILLAGER;

    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerMaleIdle");
    expect(resolveModelPresentation(snapshot, 0, true)?.model).toBe("villagerMaleWalk");

    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_GOLD_MINE;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerMaleMine");

    snapshot.gatherTargetType[0] = TYPE_BERRY;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerMaleHarvest");

    snapshot.gatherTargetType[0] = TYPE_TREE;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerMaleChop");

    snapshot.mode[0] = MODE_BUILDING;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerMaleBuild");

    snapshot.unitType[0] = TYPE_MILITIA;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("militiaIdle");
    expect(resolveModelPresentation(snapshot, 0, true)?.model).toBe("militiaWalk");
  });

  test("distinguishes model units from actual static sprites", () => {
    expect(UNIT_PRESENTATIONS[TYPE_VILLAGER]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_MILITIA]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_TREE]?.kind).toBe("sprite");
    expect(UNIT_PRESENTATIONS[TYPE_HOUSE]).toMatchObject({
      kind: "sprite",
      frames: {
        kind: "construction",
        completedFrames: 3,
        stages: [{ threshold: 0 }, { threshold: 0.33 }, { threshold: 0.66 }],
      },
    });
  });

  test("keeps the female villager variation through movement and work actions", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(1, 7);
    snapshot.unitType[0] = TYPE_VILLAGER;

    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerFemaleIdle");
    expect(resolveModelPresentation(snapshot, 0, true)?.model).toBe("villagerFemaleWalk");

    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_GOLD_MINE;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerFemaleMine");

    snapshot.gatherTargetType[0] = TYPE_BERRY;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerFemaleHarvest");

    snapshot.gatherTargetType[0] = TYPE_TREE;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerFemaleChop");

    snapshot.mode[0] = MODE_BUILDING;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerFemaleBuild");
  });

  test("uses the Classic house construction stages before the completed variation", () => {
    const house = UNIT_PRESENTATIONS[TYPE_HOUSE];
    if (house?.kind !== "sprite") throw new Error("house must use a static sprite");

    expect(resolveStaticSpritePresentation(house, 4, 1, 0)).toEqual({ frame: 3, buildFrac: 1 });
    expect(resolveStaticSpritePresentation(house, 4, 1, 0.329).frame).toBe(3);
    expect(resolveStaticSpritePresentation(house, 4, 1, 0.33).frame).toBe(4);
    expect(resolveStaticSpritePresentation(house, 4, 1, 0.659).frame).toBe(4);
    expect(resolveStaticSpritePresentation(house, 4, 1, 0.66).frame).toBe(5);
    expect(resolveStaticSpritePresentation(house, 4, 1, 0.999).frame).toBe(5);
    expect(resolveStaticSpritePresentation(house, 4, 1, 1)).toEqual({ frame: 1, buildFrac: 1 });
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
