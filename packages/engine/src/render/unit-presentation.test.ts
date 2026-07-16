import {
  GATHER_COOLDOWN_TICKS,
  GOD_RA,
  GOD_ZEUS,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_PRAYING,
  TYPE_BERRY,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_LABORER,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_GOLD_MINE,
  TYPE_GREEK_HOUSE as TYPE_HOUSE,
  TYPE_GREEK_MILITARY_ACADEMY as TYPE_BARRACKS,
  TYPE_GREEK_TEMPLE as TYPE_TEMPLE,
  TYPE_GREEK_TOWN_CENTER as TYPE_TOWN_CENTER,
  TYPE_GREEK_VILLAGER as TYPE_VILLAGER,
  TYPE_HOPLITE,
  TYPE_JASON,
  TYPE_MILITIA,
  TYPE_SPEARMAN,
  TYPE_TOXOTES,
  TYPE_TREE,
  UNIT_TYPES,
  createSnapshot,
  packId,
} from "@aom/sim";
import { describe, expect, test } from "bun:test";
import {
  modelAnimationTime,
  resolveModelGhostPresentation,
  resolveModelDeathPresentation,
  resolveModelPresentation,
  resolveStaticSpriteGhostPresentation,
  resolveStaticSpritePresentation,
  resolveStaticSpriteUnitPresentation,
  UNIT_PRESENTATIONS,
  type StaticSpritePresentation,
} from "./unit-presentation";
import { UNIT_MEDIA } from "../content/generated/unit-media";
import { MODEL_CONFIGS } from "./model-assets";

function modelKey(presentation: { modelIndex: number } | null | undefined): string | undefined {
  return presentation ? MODEL_CONFIGS[presentation.modelIndex]?.key : undefined;
}

describe("unit presentation", () => {
  test("resolves mobile model and action animation", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.unitType[0] = TYPE_VILLAGER;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerMaleIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("villagerMaleWalk");

    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_GOLD_MINE;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerMaleMine");

    snapshot.gatherTargetType[0] = TYPE_BERRY;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerMaleHarvest");

    snapshot.gatherTargetType[0] = TYPE_TREE;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerMaleChop");

    snapshot.mode[0] = MODE_BUILDING;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerMaleBuild");

    snapshot.unitType[0] = TYPE_MILITIA;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("militiaIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("militiaWalk");
  });

  test("keeps the per-type static sprite fallback metadata", () => {
    expect(UNIT_PRESENTATIONS[TYPE_VILLAGER]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_MILITIA]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_TREE]?.kind).toBe("sprite");
    expect(UNIT_PRESENTATIONS[TYPE_HOUSE]?.kind).toBe("model");
    expect(UNIT_PRESENTATIONS[TYPE_EGYPTIAN_BARRACKS]?.kind).toBe("sprite");
  });

  test("keeps the female villager variation through movement and work actions", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(1, 7);
    snapshot.unitType[0] = TYPE_VILLAGER;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerFemaleIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("villagerFemaleWalk");

    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_GOLD_MINE;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerFemaleMine");

    snapshot.gatherTargetType[0] = TYPE_BERRY;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerFemaleHarvest");

    snapshot.gatherTargetType[0] = TYPE_TREE;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerFemaleChop");

    snapshot.mode[0] = MODE_BUILDING;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerFemaleBuild");
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

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("villagerMalePrayA");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("villagerFemalePrayA");
    expect(modelKey(resolveModelPresentation(snapshot, 2, false))).toBe("villagerMalePrayB");
    expect(modelKey(resolveModelPresentation(snapshot, 3, false))).toBe("villagerFemalePrayB");
  });

  test("selects Egyptian Laborer and architecture from culture-specific type ids", () => {
    const snapshot = createSnapshot(3);
    snapshot.count = 3;
    snapshot.playerMajorGods[0] = GOD_RA;
    snapshot.majorGod = GOD_RA;
    snapshot.owner.fill(0);
    snapshot.unitType[0] = TYPE_EGYPTIAN_LABORER;
    snapshot.unitType[1] = TYPE_EGYPTIAN_HOUSE;
    snapshot.unitType[2] = TYPE_EGYPTIAN_TOWN_CENTER;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("egyptianVillagerMaleIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("egyptianHouse");
    expect(modelKey(resolveModelPresentation(snapshot, 2, false))).toBe("egyptianTownCenter");
    expect(resolveStaticSpriteUnitPresentation(snapshot, 1)).toBeNull();
    expect(modelKey(resolveModelGhostPresentation(snapshot, TYPE_EGYPTIAN_HOUSE))).toBe(
      "egyptianHouse",
    );
    expect(resolveStaticSpriteGhostPresentation(snapshot, TYPE_EGYPTIAN_HOUSE)).toBeNull();
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

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekTownCenter");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("greekHouseA");
    expect(modelKey(resolveModelPresentation(snapshot, 2, false))).toBe("greekHouseB");
    expect(modelKey(resolveModelPresentation(snapshot, 3, false))).toBe("greekHouseC");
    expect(modelKey(resolveModelPresentation(snapshot, 4, false))).toBe("greekMilitaryAcademy");
    expect(modelKey(resolveModelPresentation(snapshot, 5, false))).toBe("greekTemple");

    for (let index = 0; index < snapshot.count; index += 1) {
      expect(resolveStaticSpriteUnitPresentation(snapshot, index)).toBeNull();
    }

    expect(modelKey(resolveModelGhostPresentation(snapshot, TYPE_TOWN_CENTER))).toBe(
      "greekTownCenter",
    );
    expect(modelKey(resolveModelGhostPresentation(snapshot, TYPE_HOUSE))).toBe("greekHouseA");
    expect(modelKey(resolveModelGhostPresentation(snapshot, TYPE_BARRACKS))).toBe(
      "greekMilitaryAcademy",
    );
    expect(modelKey(resolveModelGhostPresentation(snapshot, TYPE_TEMPLE))).toBe("greekTemple");
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
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHouseConstructionA");
    snapshot.buildProgress[0] = Math.ceil(buildTicks * 0.33);
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHouseConstructionB");
    snapshot.buildProgress[0] = Math.ceil(buildTicks * 0.66);
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHouseConstructionC");
    snapshot.buildProgress[0] = buildTicks;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHouseA");
  });

  test("uses the Classic house construction stages before the completed variation", () => {
    const house = {
      kind: "sprite",
      url: "house.png",
      frames: {
        kind: "construction",
        completedFrames: 3,
        stages: [{ threshold: 0 }, { threshold: 0.33 }, { threshold: 0.66 }],
      },
      worldHeight: 2.6,
      bottomPadding: 0,
    } as const satisfies StaticSpritePresentation;

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

  test("resolves proof melee actions entirely from generated media", () => {
    const snapshot = createSnapshot(2);
    snapshot.count = 2;
    snapshot.unitType[0] = TYPE_HOPLITE;
    snapshot.unitType[1] = TYPE_SPEARMAN;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHopliteIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekHopliteWalk");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("egyptianSpearmanIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 1, true))).toBe("egyptianSpearmanWalk");

    snapshot.actionCooldown[0] = UNIT_TYPES[TYPE_HOPLITE]!.attack!.cooldownTicks;
    snapshot.actionCooldown[1] = UNIT_TYPES[TYPE_SPEARMAN]!.attack!.cooldownTicks;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHopliteAttackA");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("egyptianSpearmanAttack");
    expect(modelKey(resolveModelDeathPresentation(TYPE_HOPLITE, packId(0, 0)))).toBe(
      "greekHopliteDeath",
    );
    expect(modelKey(resolveModelDeathPresentation(TYPE_SPEARMAN, packId(1, 0)))).toBe(
      "egyptianSpearmanDeath",
    );
    expect(UNIT_MEDIA[TYPE_HOPLITE]!.presentation).toMatchObject({ kind: "model" });
    expect(UNIT_MEDIA[TYPE_SPEARMAN]!.presentation).toMatchObject({ kind: "model" });
  });

  test("uses Jason's original carry actions while a relic is contained", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.unitType[0] = TYPE_JASON;
    snapshot.carriedRelicCount[0] = 1;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekJasonCarryIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekJasonCarryWalk");

    snapshot.actionCooldown[0] = UNIT_TYPES[TYPE_JASON]!.attack!.cooldownTicks;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekJasonAttack");
    expect(modelKey(resolveModelDeathPresentation(TYPE_JASON, packId(0, 0)))).toBe(
      "greekJasonDeath",
    );
  });

  test("binds the Toxotes attack clip to the authored projectile release tag", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.unitType[0] = TYPE_TOXOTES;
    const attack = UNIT_TYPES[TYPE_TOXOTES]!.attack;
    if (attack?.kind !== "projectile") throw new Error("Toxotes requires a projectile attack");

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekToxotesIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekToxotesWalk");

    snapshot.actionCooldown[0] = attack.cooldownTicks - attack.launchDelayTicks;
    const presentation = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(presentation)).toBe("greekToxotesAttack");
    expect(modelAnimationTime(presentation, snapshot, 0, 0, 1)).toBeCloseTo(0.4, 8);
    expect(modelKey(resolveModelDeathPresentation(TYPE_TOXOTES, packId(0, 0)))).toBe(
      "greekToxotesDeath",
    );
  });
});
