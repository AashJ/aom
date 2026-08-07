import {
  GATHER_COOLDOWN_TICKS,
  GOD_RA,
  GOD_ZEUS,
  MODE_BUILDING,
  MODE_GATHERING,
  MODE_PRAYING,
  MODE_RETURNING,
  TYPE_BERRY,
  TYPE_ANUBITE,
  TYPE_AVENGER,
  TYPE_BELLEROPHON,
  TYPE_CATAPULT,
  TYPE_CENTAUR,
  TYPE_CHIMERA,
  TYPE_EGYPTIAN_BARRACKS,
  TYPE_EGYPTIAN_CARAVAN,
  TYPE_EGYPTIAN_HOUSE,
  TYPE_EGYPTIAN_LABORER,
  TYPE_EGYPTIAN_MARKET,
  TYPE_EGYPTIAN_SIEGE_WORKS,
  TYPE_EGYPTIAN_TOWN_CENTER,
  TYPE_FISH_PERCH,
  TYPE_GOLD_MINE,
  TYPE_GREEK_DOCK,
  TYPE_GREEK_FISHING_SHIP,
  TYPE_GREEK_HOUSE as TYPE_HOUSE,
  TYPE_GREEK_CARAVAN,
  TYPE_GREEK_MARKET,
  TYPE_GREEK_MILITARY_ACADEMY as TYPE_BARRACKS,
  TYPE_GREEK_TEMPLE as TYPE_TEMPLE,
  TYPE_GREEK_TOWN_CENTER as TYPE_TOWN_CENTER,
  TYPE_GREEK_VILLAGER as TYPE_VILLAGER,
  TYPE_HOPLITE,
  TYPE_HYDRA,
  TYPE_JASON,
  TYPE_MANTICORE,
  TYPE_MILITIA,
  TYPE_MEDUSA,
  TYPE_MINOTAUR,
  TYPE_NEMEAN_LION,
  TYPE_PETROBOLOS,
  TYPE_SPHINX,
  TYPE_SPEARMAN,
  TARGET_REACTION_THROWN,
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

  test("selects Caravan cargo and Market age models from authoritative snapshot state", () => {
    const snapshot = createSnapshot(4);
    snapshot.count = 4;
    snapshot.owner.fill(0);
    snapshot.unitType[0] = TYPE_GREEK_CARAVAN;
    snapshot.unitType[1] = TYPE_GREEK_MARKET;
    snapshot.unitType[2] = TYPE_EGYPTIAN_CARAVAN;
    snapshot.unitType[3] = TYPE_EGYPTIAN_MARKET;
    snapshot.playerAges[0] = 2;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekCaravanIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekCaravanWalk");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("greekMarketHeroic");
    expect(modelKey(resolveModelPresentation(snapshot, 2, false))).toBe("egyptianCaravanIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 2, true))).toBe("egyptianCaravanWalk");
    expect(modelKey(resolveModelPresentation(snapshot, 3, false))).toBe("egyptianMarketHeroic");

    snapshot.carried[0] = 19;
    snapshot.carried[2] = 17;
    snapshot.playerAges[0] = 3;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekCaravanLoadedIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekCaravanLoadedWalk");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("greekMarketMythic");
    expect(modelKey(resolveModelPresentation(snapshot, 2, false))).toBe(
      "egyptianCaravanLoadedIdle",
    );
    expect(modelKey(resolveModelPresentation(snapshot, 2, true))).toBe("egyptianCaravanLoadedWalk");
    expect(modelKey(resolveModelPresentation(snapshot, 3, false))).toBe("egyptianMarketMythic");
    expect(
      modelKey(resolveModelDeathPresentation(TYPE_GREEK_CARAVAN, packId(0, 0), 0, 2, 19)),
    ).toBe("greekCaravanLoadedDeath");
    expect(modelKey(resolveModelDeathPresentation(TYPE_GREEK_MARKET, packId(0, 0), 0, 3))).toBe(
      "greekMarketMythicDeath",
    );
    expect(
      modelKey(resolveModelDeathPresentation(TYPE_EGYPTIAN_CARAVAN, packId(2, 0), 0, 2, 17)),
    ).toBe("egyptianCaravanLoadedDeath");
    expect(modelKey(resolveModelDeathPresentation(TYPE_EGYPTIAN_MARKET, packId(3, 0), 0, 3))).toBe(
      "egyptianMarketMythicDeath",
    );
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

  test("selects the source Fishing Ship work cycle and all four Dock ages", () => {
    const snapshot = createSnapshot(2);
    snapshot.count = 2;
    snapshot.owner.fill(0);
    snapshot.unitType[0] = TYPE_GREEK_FISHING_SHIP;
    snapshot.unitType[1] = TYPE_GREEK_DOCK;
    snapshot.playerAges[0] = 0;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekFishingShipIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("greekDockArchaic");

    snapshot.mode[0] = MODE_GATHERING;
    snapshot.gatherTargetType[0] = TYPE_FISH_PERCH;
    snapshot.actionCooldown[0] = 5;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekFishingShipFish");

    snapshot.mode[0] = MODE_RETURNING;
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekFishingShipWalk");
    snapshot.playerAges[0] = 3;
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("greekDockMythic");
    expect(modelKey(resolveModelDeathPresentation(TYPE_GREEK_FISHING_SHIP, packId(0, 0)))).toBe(
      "greekFishingShipDeath",
    );
    expect(modelKey(resolveModelDeathPresentation(TYPE_GREEK_DOCK, packId(1, 0), 0, 3))).toBe(
      "greekDockMythicDeath",
    );
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

    snapshot.targetReactionKind[0] = TARGET_REACTION_THROWN;
    expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe("greekHopliteIdle");

    snapshot.targetReactionKind[0] = 255;
    expect(() => resolveModelPresentation(snapshot, 0, true)).toThrow(
      "Unsupported target-reaction presentation kind 255",
    );
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

  test("binds Medusa's arrow and petrify clips to their source tags", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_MEDUSA;
    const attack = UNIT_TYPES[TYPE_MEDUSA]!.attack;
    if (attack?.kind !== "projectile") throw new Error("Medusa requires a projectile attack");

    snapshot.actionCooldown[0] = attack.cooldownTicks - attack.launchDelayTicks;
    const ordinary = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(ordinary)).toBe("greekMedusaAttackA");
    expect(modelAnimationTime(ordinary, snapshot, 0, 0, 2)).toBeCloseTo(1.3, 8);

    snapshot.actionCooldown[0] = 0;
    snapshot.specialActionRemaining[0] = 16;
    const petrify = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(petrify)).toBe("greekMedusaPetrify");
    expect(modelAnimationTime(petrify, snapshot, 0, 0, 2)).toBeCloseTo(1.2, 8);
    expect(modelKey(resolveModelDeathPresentation(TYPE_MEDUSA, packId(0, 0)))).toBe(
      "greekMedusaDeath",
    );
  });

  test("binds Centaur's ordinary and tracking-shot clips to their source tags", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_CENTAUR;
    const attack = UNIT_TYPES[TYPE_CENTAUR]!.attack;
    if (attack?.kind !== "projectile") throw new Error("Centaur requires a projectile attack");

    snapshot.actionCooldown[0] = attack.cooldownTicks - attack.launchDelayTicks;
    const ordinary = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(ordinary)).toBe("greekCentaurAttackA");
    expect(modelAnimationTime(ordinary, snapshot, 0, 0, 1.5)).toBeCloseTo(0.9, 8);

    snapshot.actionCooldown[0] = 0;
    snapshot.specialActionRemaining[0] = 10;
    const special = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(special)).toBe("greekCentaurSpecial");
    expect(modelAnimationTime(special, snapshot, 0, 0, 2.5)).toBeCloseTo(2, 8);
    expect(modelKey(resolveModelDeathPresentation(TYPE_CENTAUR, packId(0, 0)))).toBe(
      "greekCentaurDeath",
    );
  });

  test("uses Manticore's shared tail-volley clip for ordinary and charged attacks", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_MANTICORE;
    const attack = UNIT_TYPES[TYPE_MANTICORE]!.attack;
    if (attack?.kind !== "projectile") throw new Error("Manticore requires a projectile attack");

    snapshot.actionCooldown[0] = attack.cooldownTicks - attack.launchDelayTicks;
    const ordinary = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(ordinary)).toBe("greekManticoreAttack");
    expect(modelAnimationTime(ordinary, snapshot, 0, 0, 0.95)).toBeCloseTo(0.5225, 8);

    snapshot.actionCooldown[0] = 0;
    snapshot.specialActionRemaining[0] = 8;
    const special = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(special)).toBe("greekManticoreAttack");
    expect(modelAnimationTime(special, snapshot, 0, 0, 0.95)).toBeCloseTo(0.55, 8);
  });

  test("binds Chimera's bite and three-flame breath to their source clips", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_CHIMERA;
    const attack = UNIT_TYPES[TYPE_CHIMERA]!.attack;
    if (attack?.kind !== "melee") throw new Error("Chimera requires a melee attack");

    const cycle = attack.cycleVariants?.[0];
    if (cycle === undefined) throw new Error("Chimera requires its source melee cycle");
    snapshot.meleeActionVariant[0] = 0;
    snapshot.actionCooldown[0] = cycle.actionTicks - cycle.impactDelayTicks;
    const ordinary = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(ordinary)).toBe("greekChimeraAttack");
    expect(modelAnimationTime(ordinary, snapshot, 0, 0, 1)).toBeCloseTo(0.45, 8);

    snapshot.actionCooldown[0] = 0;
    snapshot.specialActionRemaining[0] = 12;
    const special = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(special)).toBe("greekChimeraSpecial");
    expect(modelAnimationTime(special, snapshot, 0, 0, 2)).toBeCloseTo(1.4, 8);
    expect(modelKey(resolveModelDeathPresentation(TYPE_CHIMERA, packId(0, 0)))).toBe(
      "greekChimeraDeath",
    );
  });

  test("selects Anubite's source melee variants and all three jump phases", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_ANUBITE;

    snapshot.meleeActionVariant[0] = 1;
    snapshot.actionCooldown[0] = 10;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("egyptianAnubiteAttackB");

    snapshot.actionCooldown[0] = 0;
    snapshot.meleeActionVariant[0] = 0xff;
    snapshot.specialActionRemaining[0] = 73;
    const takeoff = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(takeoff)).toBe("egyptianAnubiteJumpTakeoff");
    expect(modelAnimationTime(takeoff, snapshot, 0, 0, 0.65)).toBe(0);

    snapshot.specialActionRemaining[0] = 40;
    const flight = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(flight)).toBe("egyptianAnubiteJumpFly");
    expect(modelAnimationTime(flight, snapshot, 0, 0, 2)).toBe(1);

    snapshot.specialActionRemaining[0] = 10;
    const landing = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(landing)).toBe("egyptianAnubiteJumpLand");
    expect(modelAnimationTime(landing, snapshot, 0, 0, 1)).toBe(0.5);
    expect(modelKey(resolveModelDeathPresentation(TYPE_ANUBITE, packId(0, 0)))).toBe(
      "egyptianAnubiteDeath",
    );
  });

  test("drives Bellerophon's original single-cycle leap from authoritative travel", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_BELLEROPHON;
    snapshot.specialActionRemaining[0] = 13;

    const leap = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(leap)).toBe("greekBellerophonJump");
    expect(modelAnimationTime(leap, snapshot, 0, 0, 1.3)).toBeCloseTo(0.65, 8);
    expect(modelKey(resolveModelDeathPresentation(TYPE_BELLEROPHON, packId(0, 0)))).toBe(
      "greekBellerophonDeath",
    );
  });

  test("binds both ranged siege units and the Siege Works to their original models", () => {
    const snapshot = createSnapshot(3);
    snapshot.count = 3;
    snapshot.ids[0] = packId(0, 0);
    snapshot.ids[1] = packId(1, 0);
    snapshot.ids[2] = packId(2, 0);
    snapshot.unitType[0] = TYPE_PETROBOLOS;
    snapshot.unitType[1] = TYPE_CATAPULT;
    snapshot.unitType[2] = TYPE_EGYPTIAN_SIEGE_WORKS;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekPetrobolosIdle");
    expect(modelKey(resolveModelPresentation(snapshot, 1, true))).toBe("egyptianCatapultWalk");
    expect(modelKey(resolveModelPresentation(snapshot, 2, false))).toBe("egyptianSiegeWorksIdle");

    snapshot.actionCooldown[0] = 80;
    snapshot.actionCooldown[1] = 80;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekPetrobolosAttack");
    expect(modelKey(resolveModelPresentation(snapshot, 1, false))).toBe("egyptianCatapultAttack");
    expect(modelKey(resolveModelDeathPresentation(TYPE_PETROBOLOS, packId(0, 0)))).toBe(
      "greekPetrobolosDeath",
    );
    expect(modelKey(resolveModelDeathPresentation(TYPE_CATAPULT, packId(1, 0)))).toBe(
      "egyptianCatapultDeath",
    );
  });

  test("drives the Minotaur gore clip from authoritative charged-action time", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_MINOTAUR;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekMinotaurIdle");
    snapshot.specialActionRemaining[0] = 40;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekMinotaurGore");

    snapshot.specialActionRemaining[0] = 21;
    const presentation = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelAnimationTime(presentation, snapshot, 0, 0, 2)).toBeCloseTo(0.95, 8);
  });

  test("uses the simulation-selected Nemean Lion attack cycle and roar clock", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_NEMEAN_LION;

    snapshot.actionCooldown[0] = 24;
    snapshot.meleeActionVariant[0] = 0;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekNemeanLionAttackA");

    snapshot.actionCooldown[0] = 9;
    snapshot.meleeActionVariant[0] = 1;
    const attack = resolveModelPresentation(snapshot, 0, false)!;
    expect(modelKey(attack)).toBe("greekNemeanLionAttackB");
    expect(modelAnimationTime(attack, snapshot, 0, 0, 0.9)).toBeCloseTo(0.45, 8);

    snapshot.meleeActionVariant[0] = 0xff;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekNemeanLionIdle");

    snapshot.actionCooldown[0] = 0;
    snapshot.specialActionRemaining[0] = 60;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekNemeanLionRoar");
  });

  test("selects every Hydra action and death model from credited-kill experience", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_HYDRA;

    for (const [kills, suffix] of [
      [0, "A"],
      [3, "B"],
      [6, "C"],
      [9, "D"],
      [12, "E"],
    ] as const) {
      snapshot.combatExperienceKills[0] = kills;
      expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe(
        `greekHydraIdle${suffix}`,
      );
      expect(modelKey(resolveModelPresentation(snapshot, 0, true))).toBe(`greekHydraWalk${suffix}`);

      snapshot.actionCooldown[0] = 30;
      snapshot.meleeActionVariant[0] = Math.floor(kills / 3);
      expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe(
        `greekHydraAttack${suffix}`,
      );
      snapshot.actionCooldown[0] = 0;

      expect(modelKey(resolveModelDeathPresentation(TYPE_HYDRA, packId(0, 0), kills))).toBe(
        `greekHydraDeath${suffix}`,
      );
    }

    snapshot.combatExperienceKills[0] = 3;
    snapshot.actionCooldown[0] = 10;
    snapshot.meleeActionVariant[0] = 0;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("greekHydraAttackA");
  });

  test("hides the Sphinx model while its source VisualNone whirlwind owns presentation", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_SPHINX;

    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("egyptianSphinxIdle");
    snapshot.specialActionRemaining[0] = 32;
    expect(resolveModelPresentation(snapshot, 0, false)).toBeNull();
  });

  test("binds the Avenger's two sword clips and Whirlwind to source models", () => {
    const snapshot = createSnapshot(1);
    snapshot.count = 1;
    snapshot.ids[0] = packId(0, 0);
    snapshot.unitType[0] = TYPE_AVENGER;

    snapshot.actionCooldown[0] = 20;
    snapshot.meleeActionVariant[0] = 0;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("egyptianAvengerAttackA");
    snapshot.meleeActionVariant[0] = 1;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("egyptianAvengerAttackB");

    snapshot.actionCooldown[0] = 0;
    snapshot.specialActionRemaining[0] = 30;
    expect(modelKey(resolveModelPresentation(snapshot, 0, false))).toBe("egyptianAvengerWhirlwind");
  });
});
