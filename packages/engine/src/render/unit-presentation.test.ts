import {
  GATHER_COOLDOWN_TICKS,
  GOD_RA,
  GOD_ZEUS,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_PRAYING,
  TYPE_BARRACKS,
  TYPE_BERRY,
  TYPE_GOLD_MINE,
  TYPE_HOUSE,
  TYPE_MILITIA,
  TYPE_TEMPLE,
  TYPE_TOWN_CENTER,
  TYPE_TREE,
  TYPE_VILLAGER,
  UNIT_TYPES,
  createSnapshot,
  packId,
} from "@aom/sim";
import { describe, expect, test } from "bun:test";
import {
  modelAnimationTime,
  resolveModelGhostPresentation,
  resolveModelPresentation,
  resolveStaticSpriteGhostPresentation,
  resolveStaticSpritePresentation,
  resolveStaticSpriteUnitPresentation,
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

  test("keeps the per-type static sprite fallback metadata", () => {
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

  test("uses both original Greek prayer variations for male and female villagers", () => {
    const snapshot = createSnapshot(4);
    snapshot.count = 4;
    snapshot.unitType.fill(TYPE_VILLAGER);
    snapshot.mode.fill(MODE_PRAYING);
    snapshot.ids[0] = packId(0, 1);
    snapshot.ids[1] = packId(1, 1);
    snapshot.ids[2] = packId(2, 1);
    snapshot.ids[3] = packId(3, 1);

    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("villagerMalePrayA");
    expect(resolveModelPresentation(snapshot, 1, false)?.model).toBe("villagerFemalePrayA");
    expect(resolveModelPresentation(snapshot, 2, false)?.model).toBe("villagerMalePrayB");
    expect(resolveModelPresentation(snapshot, 3, false)?.model).toBe("villagerFemalePrayB");
  });

  test("selects Egyptian villagers and architecture from the owner's major god", () => {
    const snapshot = createSnapshot(3);
    snapshot.count = 3;
    snapshot.playerMajorGods[0] = GOD_RA;
    snapshot.majorGod = GOD_RA;
    snapshot.owner.fill(0);
    snapshot.unitType[0] = TYPE_VILLAGER;
    snapshot.unitType[1] = TYPE_HOUSE;
    snapshot.unitType[2] = TYPE_TOWN_CENTER;

    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("egyptianVillagerMaleIdle");
    expect(resolveModelPresentation(snapshot, 1, false)?.model).toBe("egyptianHouse");
    expect(resolveModelPresentation(snapshot, 2, false)?.model).toBe("egyptianTownCenter");
    expect(resolveStaticSpriteUnitPresentation(snapshot, 1)).toBeNull();
    expect(resolveModelGhostPresentation(snapshot, TYPE_HOUSE)?.model).toBe("egyptianHouse");
    expect(resolveStaticSpriteGhostPresentation(snapshot, TYPE_HOUSE)).toBeNull();
  });

  test("selects original Greek building models and stable house variations", () => {
    const snapshot = createSnapshot(6);
    snapshot.count = 6;
    snapshot.playerMajorGods[0] = GOD_ZEUS;
    snapshot.majorGod = GOD_ZEUS;
    snapshot.owner.fill(0);
    snapshot.unitType[0] = TYPE_TOWN_CENTER;
    snapshot.unitType[1] = TYPE_HOUSE;
    snapshot.unitType[2] = TYPE_HOUSE;
    snapshot.unitType[3] = TYPE_HOUSE;
    snapshot.unitType[4] = TYPE_BARRACKS;
    snapshot.unitType[5] = TYPE_TEMPLE;
    snapshot.ids[1] = packId(0, 1);
    snapshot.ids[2] = packId(1, 1);
    snapshot.ids[3] = packId(2, 1);
    snapshot.buildProgress.fill(UNIT_TYPES[TYPE_HOUSE]!.buildTicks);

    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("greekTownCenter");
    expect(resolveModelPresentation(snapshot, 1, false)?.model).toBe("greekHouseA");
    expect(resolveModelPresentation(snapshot, 2, false)?.model).toBe("greekHouseB");
    expect(resolveModelPresentation(snapshot, 3, false)?.model).toBe("greekHouseC");
    expect(resolveModelPresentation(snapshot, 4, false)?.model).toBe("greekBarracks");
    expect(resolveModelPresentation(snapshot, 5, false)?.model).toBe("greekTemple");

    for (let index = 0; index < snapshot.count; index += 1) {
      expect(resolveStaticSpriteUnitPresentation(snapshot, index)).toBeNull();
    }

    expect(resolveModelGhostPresentation(snapshot, TYPE_TOWN_CENTER)?.model).toBe(
      "greekTownCenter",
    );
    expect(resolveModelGhostPresentation(snapshot, TYPE_HOUSE)?.model).toBe("greekHouseA");
    expect(resolveModelGhostPresentation(snapshot, TYPE_BARRACKS)?.model).toBe("greekBarracks");
    expect(resolveModelGhostPresentation(snapshot, TYPE_TEMPLE)?.model).toBe("greekTemple");
  });

  test("uses original-scale Greek construction models across house build progress", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.playerMajorGods[0] = GOD_ZEUS;
    snapshot.owner[0] = 0;
    snapshot.unitType[0] = TYPE_HOUSE;
    snapshot.ids[0] = packId(0, 1);
    const buildTicks = UNIT_TYPES[TYPE_HOUSE]!.buildTicks;

    snapshot.buildProgress[0] = 0;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("greekHouseConstructionA");
    snapshot.buildProgress[0] = Math.ceil(buildTicks * 0.33);
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("greekHouseConstructionB");
    snapshot.buildProgress[0] = Math.ceil(buildTicks * 0.66);
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("greekHouseConstructionC");
    snapshot.buildProgress[0] = buildTicks;
    expect(resolveModelPresentation(snapshot, 0, false)?.model).toBe("greekHouseA");
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
