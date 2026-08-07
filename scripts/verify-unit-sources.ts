import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TICK_HZ } from "../packages/sim/src/clock";
import {
  trialComparableExpected,
  structurallyEqual,
  type SpecialParticleEvidence,
  type ReferenceCulture,
  type TrialComparableField,
  type TrialComparableValue,
  type UnitReferenceSpec,
} from "../packages/sim/src/content/unit-reference-schema";
import { UNIT_REFERENCE_SPECS } from "../packages/sim/src/content/unit-references";
import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  CULTURE_NORSE,
  GOLD,
  UNIT_CLASS_AIR,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_CARAVAN,
  UNIT_CLASS_HERO,
  UNIT_CLASS_HUNTABLE,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_NON_GREEK_UNIT,
  UNIT_CLASS_SHIP,
  UNIT_CLASS_TRANSPORT_SHIP,
  UNIT_CLASS_SIEGE,
  UNIT_CLASS_SCOUT,
  UNIT_CLASS_WORKER,
  UNIT_CONDITION_FROZEN,
  UNIT_CONDITION_STONE,
  WOOD,
  type DamageBonus,
  type DamageBonusTarget,
} from "../packages/sim/src/content/unit-type-schema";
import { readXmbFile, type XmbNode } from "./lib/xmb";
import {
  animationTagFraction,
  animationTagFractions,
  readTrialAction,
  type TrialAttackActionName,
} from "./lib/trial-unit";
import {
  classicDdtDimensions,
  readClassicBarEntry,
  readClassicParticleSource,
} from "./lib/classic-particle";

const root = resolve(import.meta.dir, "..");
const protoPath = resolve(root, "private-assets/work/extracted/data/proto.xmb");
const inventoryPaths: Readonly<Record<ReferenceCulture, string>> = {
  greek: resolve(root, "private-assets/output/units/greek/manifest.json"),
  egyptian: resolve(root, "private-assets/output/units/egyptian/manifest.json"),
};
const animationRoots: Readonly<Record<ReferenceCulture, string>> = {
  greek: resolve(root, "private-assets/output/units/greek/raw/anim"),
  egyptian: resolve(root, "private-assets/output/units/egyptian/raw/anim"),
};
const modelArchivePath = resolve(root, "private-assets/work/trial/AOM/MODELS/MODELS.BAR");
const textureArchivePath = resolve(root, "private-assets/work/trial/AOM/TEXTURES/TEXTURES.BAR");
const animationArchivePath = resolve(root, "private-assets/work/trial/AOM/ANIM/ANIM.BAR");
const cultureIds: Readonly<Record<ReferenceCulture, number>> = {
  greek: CULTURE_GREEK,
  egyptian: CULTURE_EGYPTIAN,
};

interface UnitInventory {
  readonly units: readonly {
    readonly name: string;
    readonly rootAnimations: readonly string[];
  }[];
}

function isUnitInventory(value: unknown): value is UnitInventory {
  if (typeof value !== "object" || value === null || !("units" in value)) return false;
  const units = (value as { readonly units?: unknown }).units;
  return (
    Array.isArray(units) &&
    units.every(
      (unit) =>
        typeof unit === "object" &&
        unit !== null &&
        "name" in unit &&
        typeof unit.name === "string" &&
        "rootAnimations" in unit &&
        Array.isArray(unit.rootAnimations) &&
        unit.rootAnimations.every((animation) => typeof animation === "string"),
    )
  );
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function glbAnimationDurationTicks(path: string): number {
  const file = readFileSync(path);
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error(`${path} is not a GLB 2.0 file.`);
  }
  const jsonLength = view.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength))) as {
    readonly accessors: readonly { readonly max?: readonly number[] }[];
    readonly animations?: readonly {
      readonly samplers: readonly { readonly input: number }[];
    }[];
  };
  let duration = 0;
  for (const animation of gltf.animations ?? []) {
    for (const sampler of animation.samplers) {
      duration = Math.max(duration, gltf.accessors[sampler.input]?.max?.[0] ?? 0);
    }
  }
  return Math.round(duration * TICK_HZ);
}

function repeatingAnimationCycle(values: readonly number[]): readonly number[] {
  for (let period = 1; period <= values.length; period += 1) {
    if (values.every((value, index) => value === values[index % period])) {
      return values.slice(0, period);
    }
  }
  return values;
}

function childValues(node: XmbNode, name: string): readonly XmbNode[] {
  return node.children.filter((candidate) => candidate.name === name);
}

function numberValue(node: XmbNode, childName: string): number {
  const value = childValues(node, childName)[0]?.value;
  const parsed = Number(value);
  if (value === undefined || !Number.isFinite(parsed)) {
    throw new Error(`${node.attributes.name ?? node.name} has no numeric ${childName}.`);
  }
  return parsed;
}

function hasFlag(node: XmbNode, flag: string): boolean {
  return childValues(node, "flag").some((candidate) => candidate.value === flag);
}

function trialClasses(unit: XmbNode): number {
  const types = new Set(childValues(unit, "unittype").map((node) => node.value));
  let classes = 0;
  if (types.has("HumanSoldier")) classes |= UNIT_CLASS_HUMAN;
  if (types.has("AbstractInfantry")) classes |= UNIT_CLASS_INFANTRY;
  if (types.has("MythUnitInfantry")) classes |= UNIT_CLASS_INFANTRY;
  if (types.has("AbstractCavalry")) classes |= UNIT_CLASS_CAVALRY;
  if (types.has("MythUnitCavalry")) classes |= UNIT_CLASS_CAVALRY;
  if (types.has("MythUnitSiege")) classes |= UNIT_CLASS_SIEGE;
  if (types.has("AbstractSiegeWeapon")) classes |= UNIT_CLASS_SIEGE;
  if (types.has("SiegeShip")) classes |= UNIT_CLASS_SIEGE;
  if (types.has("Ship")) classes |= UNIT_CLASS_SHIP;
  if (types.has("TransportShip")) classes |= UNIT_CLASS_TRANSPORT_SHIP;
  // Trial's Transport type also labels the airborne Roc. Only its naval users
  // inherit the ship identities used by combat and containment predicates.
  if (types.has("Transport") && !types.has("FlyingUnit")) {
    classes |= UNIT_CLASS_SHIP | UNIT_CLASS_TRANSPORT_SHIP;
  }
  if (types.has("Military")) classes |= UNIT_CLASS_MILITARY;
  if (types.has("Hero")) classes |= UNIT_CLASS_HERO;
  if (types.has("MythUnit")) classes |= UNIT_CLASS_MYTH;
  if (types.has("FlyingUnit")) classes |= UNIT_CLASS_AIR;
  if (types.has("AbstractTradeUnit")) classes |= UNIT_CLASS_CARAVAN;
  if (types.has("AbstractArcher")) classes |= UNIT_CLASS_ARCHER;
  if (types.has("MythUnitArcher")) classes |= UNIT_CLASS_ARCHER;
  if (types.has("AbstractScout")) classes |= UNIT_CLASS_SCOUT;
  if (childValues(unit, "action").some((action) => action.attributes.name === "HandAttack")) {
    classes |= UNIT_CLASS_MELEE;
  }
  if (types.has("LogicalTypeNonGreekUnit")) classes |= UNIT_CLASS_NON_GREEK_UNIT;
  return classes;
}

function damageBonus(type: string, multiplier: number): DamageBonus {
  switch (type) {
    case "AbstractInfantry":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_INFANTRY },
        multiplier,
      };
    case "AbstractCavalry":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_CAVALRY },
        multiplier,
      };
    case "AbstractArcher":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_ARCHER },
        multiplier,
      };
    case "Building":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_BUILDING },
        multiplier,
      };
    case "LogicalTypeNonGreekUnit":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_NON_GREEK_UNIT },
        multiplier,
      };
    case "Raiding Cavalry":
      return {
        target: { kind: "unit", key: "norse-raiding-cavalry" },
        multiplier,
      };
    case "Throwing Axeman":
      return {
        target: { kind: "unit", key: "norse-throwing-axeman" },
        multiplier,
      };
    case "Hypaspist":
      return { target: { kind: "unit", key: "greek-hypaspist" }, multiplier };
    case "Axeman":
      return { target: { kind: "unit", key: "egyptian-axeman" }, multiplier };
    case "Hero Norse":
    case "Hero Ragnorok":
      return {
        target: {
          kind: "classes",
          classes: UNIT_CLASS_HERO,
          requiredCulture: CULTURE_NORSE,
        },
        multiplier,
      };
    case "Siege":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_SIEGE },
        multiplier,
      };
    case "Ship":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_SHIP },
        multiplier,
      };
    case "TransportShip":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_TRANSPORT_SHIP },
        multiplier,
      };
    case "MythUnit":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_MYTH },
        multiplier,
      };
    case "Hero":
      return {
        target: { kind: "classes", classes: UNIT_CLASS_HERO },
        multiplier,
      };
    default:
      throw new Error(`Unsupported Trial damage bonus type ${type}.`);
  }
}

function trialAttack(
  unit: XmbNode,
  actionName: TrialAttackActionName,
): {
  readonly damage: readonly [number, number, number];
  readonly range: number;
  readonly bonuses: readonly DamageBonus[];
  readonly parameters: readonly XmbNode[];
  readonly numericParameter: (name: string, type?: string) => number;
  readonly numericParameter2: (name: string, type?: string) => number;
  readonly rateTypes: readonly string[];
  readonly optionTypes: readonly string[];
} {
  const action = readTrialAction(unit, actionName);

  const bonuses: DamageBonus[] = [];
  for (const bonus of action.parameters.filter(
    (candidate) => candidate.attributes.name === "DamageBonus",
  )) {
    const type = bonus.attributes.type;
    const multiplier = Number(bonus.attributes.value1);
    if (type === undefined || !Number.isFinite(multiplier)) {
      throw new Error(`${unit.attributes.name} has an invalid Trial damage bonus.`);
    }
    const mapped = damageBonus(type, multiplier);
    if (!bonuses.some((candidate) => structurallyEqual(candidate, mapped))) bonuses.push(mapped);
  }

  const damage = (type: string): number => {
    const match = action.parameters.find(
      (candidate) => candidate.attributes.name === "Damage" && candidate.attributes.type === type,
    );
    return match === undefined ? 0 : Number(match.attributes.value1);
  };
  return {
    damage: [damage("Hack"), damage("Pierce"), damage("Crush")],
    range: action.numericParameter("MaximumRange"),
    bonuses,
    parameters: action.parameters,
    rateTypes: action.parameters
      .filter(
        (candidate) => candidate.attributes.name === "Rate" && candidate.attributes.type !== "All",
      )
      .flatMap((candidate) =>
        candidate.attributes.type === undefined ? [] : [candidate.attributes.type],
      ),
    optionTypes: action.parameters.flatMap((candidate) =>
      candidate.attributes.options === undefined ? [] : candidate.attributes.options.split("|"),
    ),
    numericParameter: (name, type) => action.numericParameter(name, type),
    numericParameter2: (name, type) => action.numericParameter2(name, type),
  };
}

function trialComparableValues(
  reference: UnitReferenceSpec,
  unit: XmbNode,
  proto: XmbNode,
): Readonly<Partial<Record<TrialComparableField, TrialComparableValue>>> {
  const armor = (type: string): number => {
    const node = childValues(unit, "armor").find(
      (candidate) => candidate.attributes.damagetype === type,
    );
    return node === undefined ? 0 : Number(node.value);
  };
  const costByResource = new Map(
    childValues(unit, "cost").map((node) => [node.attributes.resourcetype, Number(node.value)]),
  );
  const common = {
    label: unit.attributes.name ?? "",
    classes: trialClasses(unit),
    maxHp: numberValue(unit, "maxhitpoints"),
    lineOfSight: numberValue(unit, "los"),
    movementSpeed: numberValue(unit, "maxvelocity"),
    ...(reference.expected.movementDomain === undefined
      ? {}
      : {
          movementDomain:
            childValues(unit, "movementtype")[0]?.value === "water"
              ? 1
              : childValues(unit, "movementtype")[0]?.value === "air"
                ? 3
                : 0,
        }),
    armor: [armor("Hack"), armor("Pierce"), armor("Crush")],
    bodyRadius: numberValue(unit, "obstructionradiusx"),
    ...(reference.expected.collidesWithUnits === undefined
      ? {}
      : { collidesWithUnits: !hasFlag(unit, "NonCollideable") }),
    collidesWithProjectiles: hasFlag(unit, "CollidesWithProjectiles"),
    cost: [
      costByResource.get("Food") ?? 0,
      costByResource.get("Wood") ?? 0,
      costByResource.get("Gold") ?? 0,
      costByResource.get("Favor") ?? 0,
    ],
    buildTicks:
      (childValues(unit, "trainpoints")[0] === undefined ? 0 : numberValue(unit, "trainpoints")) *
      TICK_HZ,
    regenerationPerSecond: (() => {
      const action = unit.children.find(
        (candidate) => candidate.name === "action" && candidate.attributes.name === "Regenerate",
      );
      if (action === undefined) return null;
      const regenerate = readTrialAction(unit, "Regenerate");
      if (!regenerate.parameters.some((parameter) => parameter.attributes.name === "Persistent")) {
        throw new Error(`${unit.attributes.name} has a non-persistent Regenerate action.`);
      }
      return regenerate.numericParameter("Rate", "All");
    })(),
    lifespanTicks:
      childValues(unit, "lifespan")[0] === undefined
        ? null
        : numberValue(unit, "lifespan") * TICK_HZ,
    populationCost:
      childValues(unit, "populationcount")[0] === undefined
        ? 0
        : numberValue(unit, "populationcount"),
    requiredAge:
      childValues(unit, "allowedage")[0] === undefined ? 0 : numberValue(unit, "allowedage") - 1,
  };

  let primary: Readonly<Partial<Record<TrialComparableField, TrialComparableValue>>>;
  if (reference.expected.attack === null) {
    if (reference.family === "naval") {
      if (reference.expected.gather === null) {
        const movementType = childValues(unit, "movementtype")[0]?.value;
        if (movementType !== "water") {
          throw new Error(`${unit.attributes.name} is not a Trial water mover.`);
        }
        if (reference.expected.garrison === null) {
          throw new Error(`${reference.key} has neither a gather nor garrison contract.`);
        }
        primary = {
          ...common,
          movementDomain: 1,
          "garrison.capacity": numberValue(unit, "maxcontained"),
        };
      } else {
        const gather = readTrialAction(unit, "Gather");
        const capacity = childValues(unit, "carrycapacity").find(
          (candidate) => candidate.attributes.resourcetype === "Food",
        );
        const parsedCapacity = Number(capacity?.value);
        if (capacity === undefined || !Number.isFinite(parsedCapacity)) {
          throw new Error(`${unit.attributes.name} has no Food carry capacity.`);
        }
        const movementType = childValues(unit, "movementtype")[0]?.value;
        if (movementType !== "water") {
          throw new Error(`${unit.attributes.name} is not a Trial water mover.`);
        }
        primary = {
          ...common,
          movementDomain: 1,
          workRange: gather.numericParameter("MaximumRange", "Fish"),
          "gather.capacity": parsedCapacity,
          "gather.ratePerSecond": gather.numericParameter("Rate", "Fish"),
          ...(reference.expected.construction === null
            ? {}
            : (() => {
                const construction = readTrialAction(unit, "Build");
                return {
                  "construction.range": construction.numericParameter("MaximumRange"),
                  "construction.ratePerSecond": construction.numericParameter("Rate", "Building"),
                };
              })()),
        };
      }
    } else if (reference.family === "trade") {
      const trade = readTrialAction(unit, "Trade");
      const capacity = childValues(unit, "carrycapacity").find(
        (candidate) => candidate.attributes.resourcetype === "Gold",
      );
      const parsedCapacity = Number(capacity?.value);
      if (capacity === undefined || !Number.isFinite(parsedCapacity)) {
        throw new Error(`${unit.attributes.name} has no Gold carry capacity.`);
      }
      primary = {
        ...common,
        "trade.capacity": parsedCapacity,
        "trade.interactionRange": trade.numericParameter("MaximumRange"),
        "trade.townCenterWorkRate": trade.numericParameter("Rate", "Settlement Level 1"),
        "trade.townCenterMinimumRate": trade.numericParameter("MinRate", "Settlement Level 1"),
        // The proto action is the unmodified baseline; released culture bonuses
        // are reviewed as explicit deltas in each caravan reference.
        "trade.incomeMultiplier": 1,
      };
    } else {
      primary = common;
    }
  } else if (reference.expected.attack.kind === "melee") {
    const attack = trialAttack(unit, "HandAttack");
    primary = {
      ...common,
      ...(reference.expected.movementDomain === undefined
        ? {}
        : {
            movementDomain:
              childValues(unit, "movementtype")[0]?.value === "water"
                ? 1
                : childValues(unit, "movementtype")[0]?.value === "air"
                  ? 3
                  : 0,
          }),
      ...(reference.expected.garrison === null
        ? {}
        : { "garrison.capacity": numberValue(unit, "maxcontained") }),
      "attack.damage": attack.damage,
      "attack.range": attack.range,
      "attack.bonuses": attack.bonuses,
    };
  } else if (reference.expected.attack.kind === "projectile") {
    const attack = trialAttack(unit, "RangedAttack");
    const numericParameterOr = (name: string, fallback: number): number => {
      const parameter = attack.parameters.find((candidate) => candidate.attributes.name === name);
      if (parameter === undefined) return fallback;
      const value = Number(parameter.attributes.value1);
      if (!Number.isFinite(value)) {
        throw new Error(`${unit.attributes.name} has invalid numeric ${name}.`);
      }
      return value;
    };
    const projectileName = childValues(unit, "projectileprotounit")[0]?.value;
    const projectile = proto.children.find(
      (candidate) => candidate.name === "unit" && candidate.attributes.name === projectileName,
    );
    if (projectile === undefined) {
      throw new Error(`${unit.attributes.name} has no Trial projectile proto ${projectileName}.`);
    }

    primary = {
      ...common,
      "attack.damage": attack.damage,
      "attack.range": attack.range,
      "attack.minimumRange": numericParameterOr("MinimumRange", 0),
      "attack.autoAcquireBuildings": childValues(unit, "unittype").some(
        (candidate) => candidate.value === "LogicalTypeAutoattackTargetsBuildings",
      ),
      "attack.bonuses": attack.bonuses,
      "attack.accuracy": numericParameterOr("Accuracy", 1),
      "attack.accuracyReductionFactor": numericParameterOr("AccuracyReductionFactor", 0),
      "attack.aimBonus": numericParameterOr("AimBonus", 0),
      "attack.spreadFactor": numericParameterOr("SpreadFactor", 0),
      "attack.maxSpread": numericParameterOr("MaxSpread", 0),
      "attack.trackRating": numericParameterOr("TrackRating", 0),
      "attack.unintentionalDamageMultiplier": numericParameterOr(
        "UnintentionalDamageMultiplier",
        1,
      ),
      "attack.projectileCount": numericParameterOr("NumberProjectiles", 1),
      "attack.projectile.speed": numberValue(projectile, "maxvelocity"),
      "attack.projectile.lifespanTicks": numberValue(projectile, "lifespan") * TICK_HZ,
      "attack.projectile.collisionRadius": numberValue(projectile, "obstructionradiusx"),
    };
  } else {
    const controllerInjected = reference.source.trialDeltas.some(
      (delta) => delta.field === "attack.damage" && delta.trial === null,
    );
    if (controllerInjected) {
      primary = {
        ...common,
        "attack.damage": null,
        "attack.range": null,
        "attack.bonuses": null,
      };
    } else {
      const attack = trialAttack(unit, "LightningAttack");
      primary = {
        ...common,
        "attack.damage": attack.damage,
        "attack.range": attack.range,
        "attack.bonuses": attack.bonuses,
      };
    }
  }

  if (reference.expected.buildingAttack !== null) {
    const buildingAttack = trialAttack(unit, "HandAttack");
    primary = {
      ...primary,
      "buildingAttack.damage": buildingAttack.damage,
      "buildingAttack.range": buildingAttack.range,
      "buildingAttack.bonuses": buildingAttack.bonuses,
    };
  }
  if (reference.expected.resourceEat !== null) {
    const eat = readTrialAction(unit, "Eat");
    const resourceTypes = eat.parameters.flatMap((parameter) => {
      if (parameter.attributes.name !== "Rate") return [];
      if (parameter.attributes.type === "Wood") return [WOOD];
      if (parameter.attributes.type === "Gold") return [GOLD];
      throw new Error(
        `${unit.attributes.name} has unsupported Eat resource ${parameter.attributes.type}.`,
      );
    });
    const rates = eat.parameters
      .filter((parameter) => parameter.attributes.name === "Rate")
      .map((parameter) => Number(parameter.attributes.value1));
    if (rates.length === 0 || rates.some((rate) => !Number.isFinite(rate) || rate !== rates[0])) {
      throw new Error(`${unit.attributes.name} has inconsistent Eat rates.`);
    }
    primary = {
      ...primary,
      "resourceEat.resourceTypes": resourceTypes,
      "resourceEat.consumePerSecond": rates[0]!,
    };
  }

  const deathArea = reference.expected.deathAreaAttack;
  if (deathArea !== null) {
    const evidence = reference.source.deathAreaAttack;
    const replacementName = childValues(unit, "deadreplacement")[0]?.value;
    const replacement = proto.children.find(
      (candidate) =>
        candidate.name === "unit" &&
        candidate.attributes.id === String(evidence?.replacementUnitId) &&
        candidate.attributes.name === evidence?.replacementUnitName,
    );
    if (
      evidence === undefined ||
      replacementName !== evidence.replacementUnitName ||
      replacement === undefined ||
      !hasFlag(replacement, "AreaDamageConstant")
    ) {
      throw new Error(`${unit.attributes.name} has invalid Trial death-area replacement evidence.`);
    }
    const attack = trialAttack(replacement, "AreaAttack");
    primary = {
      ...primary,
      "deathAreaAttack.damage": attack.damage,
      "deathAreaAttack.radius": attack.range,
      "deathAreaAttack.bonuses": attack.bonuses,
      "deathAreaAttack.damageRelations": attack.optionTypes.reduce((relations, option) => {
        if (option === "AttackEnemy") return relations | AREA_DAMAGE_ENEMIES;
        if (option === "AttackGAIAUnits") return relations | AREA_DAMAGE_NEUTRAL_UNITS;
        throw new Error(
          `${replacement.attributes.name} has unsupported AreaAttack option ${option}.`,
        );
      }, 0),
    };
  }

  if (reference.expected.specialAttack === null) return primary;

  const specialAction =
    reference.expected.specialAttack.kind === "charged-cone-throw"
      ? "BuckAttack"
      : reference.expected.specialAttack.kind === "charged-pickup-throw"
        ? "Throw"
      : reference.expected.specialAttack.kind === "charged-melee"
        ? "Gore"
        : reference.expected.specialAttack.kind === "charged-area-pulse" ||
            reference.expected.specialAttack.kind === "charged-area-poison"
          ? "WhirlwindAttack"
          : reference.expected.specialAttack.kind === "charged-projectile"
            ? "ChargedRangedAttack"
            : reference.expected.specialAttack.kind === "charged-jump"
              ? "JumpAttack"
              : reference.expected.specialAttack.kind === "charged-convert"
                ? "ConvertAttack"
                : "FreezeAttack";
  const special = trialAttack(unit, specialAction);
  const validTargets: DamageBonusTarget[] = [];
  const coversAllHumans =
    special.rateTypes.includes("HumanSoldier") && special.rateTypes.includes("AbstractVillager");
  for (const type of special.rateTypes) {
    let target: DamageBonusTarget;
    if (type === "Unit") {
      for (const classes of [UNIT_CLASS_HUMAN, UNIT_CLASS_MYTH, UNIT_CLASS_HERO]) {
        const candidate = { kind: "classes", classes } as const;
        if (!validTargets.some((existing) => structurallyEqual(existing, candidate))) {
          validTargets.push(candidate);
        }
      }
      continue;
    } else if (type === "HumanSoldier") {
      target = coversAllHumans
        ? { kind: "classes", classes: UNIT_CLASS_HUMAN }
        : {
            kind: "classes",
            classes: UNIT_CLASS_HUMAN,
            excludedClasses: UNIT_CLASS_WORKER,
          };
    } else if (type === "AbstractVillager") {
      target = coversAllHumans
        ? { kind: "classes", classes: UNIT_CLASS_HUMAN }
        : {
            kind: "classes",
            classes: UNIT_CLASS_HUMAN | UNIT_CLASS_WORKER,
          };
    } else if (type === "MythUnitInfantry") {
      target = {
        kind: "classes",
        classes: UNIT_CLASS_MYTH | UNIT_CLASS_INFANTRY,
      };
    } else if (type === "MythUnit") {
      target = { kind: "classes", classes: UNIT_CLASS_MYTH };
    } else if (type === "AbstractSiegeWeapon") {
      target = { kind: "classes", classes: UNIT_CLASS_SIEGE };
    } else if (type === "Huntable") {
      target = { kind: "classes", classes: UNIT_CLASS_HUNTABLE };
    } else if (type === "Ship") {
      target = { kind: "classes", classes: UNIT_CLASS_SHIP };
    } else {
      throw new Error(`${unit.attributes.name} has unsupported ${specialAction} target ${type}.`);
    }
    if (!validTargets.some((candidate) => structurallyEqual(candidate, target))) {
      validTargets.push(target);
    }
  }

  const numericSpecialParameterOr = (name: string, fallback: number): number => {
    const parameter = special.parameters.find((candidate) => candidate.attributes.name === name);
    if (parameter === undefined) return fallback;
    const value = Number(parameter.attributes.value1);
    if (!Number.isFinite(value)) {
      throw new Error(`${unit.attributes.name} has invalid numeric ${name}.`);
    }
    return value;
  };
  const projectileName = childValues(unit, "projectileprotounit")[0]?.value;
  const specialProjectile =
    reference.expected.specialAttack.kind === "charged-projectile"
      ? proto.children.find(
          (candidate) => candidate.name === "unit" && candidate.attributes.name === projectileName,
        )
      : undefined;
  if (reference.expected.specialAttack.kind === "charged-projectile" && !specialProjectile) {
    throw new Error(`${unit.attributes.name} has no charged projectile proto ${projectileName}.`);
  }

  return {
    ...primary,
    "specialAttack.damage": special.damage,
    ...(reference.expected.specialAttack.kind === "charged-jump"
      ? {
          "specialAttack.minimumRange": special.numericParameter("MinimumRange"),
        }
      : {}),
    "specialAttack.range": special.range,
    "specialAttack.bonuses": special.bonuses,
    "specialAttack.rechargeTicks": numberValue(unit, "rechargetime") * TICK_HZ,
    "specialAttack.validTargets": validTargets,
    "specialAttack.invalidTargetConditions":
      (special.parameters.some((parameter) => parameter.attributes.name === "NoWorkOnFrozenUnits")
        ? UNIT_CONDITION_FROZEN
        : 0) |
      (special.parameters.some((parameter) => parameter.attributes.name === "NoWorkOnStoneUnits")
        ? UNIT_CONDITION_STONE
        : 0),
    ...(reference.expected.specialAttack.kind === "charged-terminal"
      ? { "specialAttack.effect": "petrify-kill" }
      : {}),
    ...(reference.expected.specialAttack.kind === "charged-projectile"
      ? {
          "specialAttack.accuracy": special.numericParameter("Accuracy"),
          "specialAttack.accuracyReductionFactor": numericSpecialParameterOr(
            "AccuracyReductionFactor",
            0,
          ),
          "specialAttack.aimBonus": numericSpecialParameterOr("AimBonus", 0),
          "specialAttack.spreadFactor": numericSpecialParameterOr("SpreadFactor", 0),
          "specialAttack.maxSpread": numericSpecialParameterOr("MaxSpread", 0),
          "specialAttack.trackRating": special.numericParameter("TrackRating"),
          "specialAttack.unintentionalDamageMultiplier": numericSpecialParameterOr(
            "UnintentionalDamageMultiplier",
            1,
          ),
          "specialAttack.poisonFraction": numericSpecialParameterOr("Poison", 0),
          "specialAttack.projectileCount": numericSpecialParameterOr("NumberProjectiles", 1),
          "specialAttack.projectile.speed": numberValue(specialProjectile!, "maxvelocity"),
          "specialAttack.projectile.lifespanTicks":
            numberValue(specialProjectile!, "lifespan") * TICK_HZ,
          "specialAttack.projectile.collisionRadius": numberValue(
            specialProjectile!,
            "obstructionradiusx",
          ),
          ...(reference.expected.specialAttack.impactArea === undefined
            ? {}
            : {
                "specialAttack.radius": special.numericParameter2("Damage"),
                "specialAttack.damageRelations": special.optionTypes.reduce((relations, option) => {
                  if (option === "AttackEnemy") return relations | AREA_DAMAGE_ENEMIES;
                  if (option === "AttackGAIAUnits") {
                    return relations | AREA_DAMAGE_NEUTRAL_UNITS;
                  }
                  throw new Error(
                    `${unit.attributes.name} has unsupported ${specialAction} option ${option}.`,
                  );
                }, 0),
              }),
        }
      : {}),
    ...(reference.expected.specialAttack.kind === "charged-area-pulse" ||
    reference.expected.specialAttack.kind === "charged-area-poison" ||
    reference.expected.specialAttack.kind === "charged-pickup-throw"
      ? {
          "specialAttack.radius": special.numericParameter2("Damage", "Hack"),
          "specialAttack.damageRelations": special.optionTypes.reduce((relations, option) => {
            if (option === "AttackEnemy") return relations | AREA_DAMAGE_ENEMIES;
            if (option === "AttackGAIAUnits") return relations | AREA_DAMAGE_NEUTRAL_UNITS;
            throw new Error(
              `${unit.attributes.name} has unsupported ${specialAction} option ${option}.`,
            );
          }, 0),
        }
      : {}),
    ...(reference.expected.specialAttack.kind === "charged-cone-throw"
      ? {
          "specialAttack.radius":
            special.range + reference.source.coneThrowSpecial!.queryRadiusPadding,
          // BuckAttack hard-codes the enemy-player relation filter in its
          // executable handler instead of exposing ordinary action options.
          "specialAttack.damageRelations": AREA_DAMAGE_ENEMIES,
        }
      : {}),
    ...(reference.expected.specialAttack.kind === "charged-jump"
      ? reference.expected.specialAttack.delivery === "area"
        ? {
            "specialAttack.radius": special.numericParameter2("Damage", "Hack"),
            "specialAttack.damageRelations": special.optionTypes.reduce((relations, option) => {
              if (option === "AttackEnemy") return relations | AREA_DAMAGE_ENEMIES;
              if (option === "AttackGAIAUnits") return relations | AREA_DAMAGE_NEUTRAL_UNITS;
              throw new Error(
                `${unit.attributes.name} has unsupported ${specialAction} option ${option}.`,
              );
            }, 0),
          }
        : {}
      : {}),
  };
}

function verifyTrialGameplay(reference: UnitReferenceSpec, unit: XmbNode, proto: XmbNode): void {
  const trial = trialComparableValues(reference, unit, proto);
  const final = trialComparableExpected(reference);
  const deltas = new Map(reference.source.trialDeltas.map((delta) => [delta.field, delta]));
  if (deltas.size !== reference.source.trialDeltas.length) {
    throw new Error(`${reference.key} declares duplicate Trial delta fields.`);
  }

  for (const field of Object.keys(trial) as TrialComparableField[]) {
    const delta = deltas.get(field);
    if (structurallyEqual(trial[field], final[field])) {
      if (delta !== undefined) {
        throw new Error(`${reference.key} declares an unnecessary Trial delta for ${field}.`);
      }
      continue;
    }
    if (
      delta === undefined ||
      delta.reason.trim().length === 0 ||
      !structurallyEqual(delta.trial, trial[field]) ||
      !structurallyEqual(delta.final, final[field])
    ) {
      throw new Error(
        `${reference.key} has an unreviewed or inaccurate Trial delta for ${field}: Trial ${JSON.stringify(trial[field])}, final ${JSON.stringify(final[field])}.`,
      );
    }
  }
}

function verifyParticleSources(
  referenceKey: string,
  animationPath: string,
  particleEvidences: readonly Omit<SpecialParticleEvidence, "presentation">[],
  modelArchive: Uint8Array,
  textureArchive: Uint8Array,
  animationArchive: Uint8Array,
): void {
  for (const particleEvidence of particleEvidences) {
    const particleBytes = readClassicBarEntry(modelArchive, particleEvidence.prtFile);
    const textureEvidence = [
      {
        file: particleEvidence.textureFile,
        sha256: particleEvidence.textureSha256,
        width: particleEvidence.textureWidth,
        height: particleEvidence.textureHeight,
      },
      ...(particleEvidence.additionalTextures ?? []),
    ];
    const textureBytes = textureEvidence.map((texture) =>
      readClassicBarEntry(textureArchive, texture.file),
    );
    if (
      sha256Bytes(particleBytes) !== particleEvidence.prtSha256 ||
      textureBytes.some((bytes, index) => sha256Bytes(bytes) !== textureEvidence[index]!.sha256)
    ) {
      throw new Error(`${referenceKey} particle asset hashes do not match their pinned source.`);
    }

    const particle = readClassicParticleSource(particleBytes);
    const expectedParticle = {
      loop: particleEvidence.loop,
      syncWithAttackAnimation: particleEvidence.syncWithAttackAnimation,
      maxParticles: particleEvidence.maxParticles,
      particleLifetimeSeconds: particleEvidence.particleLifetimeSeconds,
      emissionStartSeconds: particleEvidence.emissionStartSeconds,
      emissionDurationSeconds: particleEvidence.emissionDurationSeconds,
      emissionRatePerSecond: particleEvidence.emissionRatePerSecond,
      emissionRateVariance: particleEvidence.emissionRateVariance,
      initialVelocity: particleEvidence.initialVelocity,
      usesSpreader: true,
      shapeType:
        particleEvidence.spreader === "box"
          ? 4
          : particleEvidence.spreader === "rectangle"
            ? 11
            : 0,
      ...(particleEvidence.shapeOuterRadii === undefined
        ? {}
        : { outerRadii: particleEvidence.shapeOuterRadii }),
      ...(particleEvidence.shapeCenterHeight === undefined
        ? {}
        : { centerHeight: particleEvidence.shapeCenterHeight }),
      offAxisDegrees: particleEvidence.offAxisDegrees,
      offPlaneDegrees: particleEvidence.offPlaneDegrees,
      materialType: particleEvidence.blend === "additive" ? 1 : 0,
      baseScale: particleEvidence.baseScale,
      scaleCycleSeconds: particleEvidence.scaleCycleSeconds,
      opacityStages: particleEvidence.opacityStages,
      scaleStages: particleEvidence.scaleStages,
      appearanceWeights: particleEvidence.appearanceWeights ?? textureEvidence.map(() => 1),
    };
    const actualParticle = {
      loop: particle.loop,
      syncWithAttackAnimation: particle.syncWithAttackAnimation,
      maxParticles: particle.maxParticles,
      particleLifetimeSeconds: particle.particleLifetimeSeconds,
      emissionStartSeconds: particle.emissionStartSeconds,
      emissionDurationSeconds: particle.emissionDurationSeconds,
      emissionRatePerSecond: particle.emissionRatePerSecond,
      emissionRateVariance: particle.emissionRateVariance,
      initialVelocity: particle.initialVelocity,
      usesSpreader: particle.usesSpreader,
      shapeType: particle.shapeType,
      ...(particleEvidence.shapeOuterRadii === undefined
        ? {}
        : {
            outerRadii: [particle.outerXRadius, particle.outerYRadius, particle.outerZRadius],
          }),
      ...(particleEvidence.shapeCenterHeight === undefined
        ? {}
        : { centerHeight: particle.centerHeight }),
      offAxisDegrees: particle.offAxisDegrees,
      offPlaneDegrees: particle.offPlaneDegrees,
      materialType: particle.materialType,
      baseScale: particle.baseScale,
      scaleCycleSeconds: particle.scaleCycleSeconds,
      opacityStages: particle.opacityStages,
      scaleStages: particle.scaleStages,
      appearanceWeights: particle.appearanceWeights,
    };
    const sourceTextureNames = textureEvidence.map((texture) =>
      texture.file.replace(/\.ddt$/i, ".tga").toLowerCase(),
    );
    const animationBytes =
      particleEvidence.sourceAnimationFile === undefined
        ? null
        : readClassicBarEntry(animationArchive, particleEvidence.sourceAnimationFile);
    if (
      animationBytes !== null &&
      sha256Bytes(animationBytes) !== particleEvidence.sourceAnimationSha256
    ) {
      throw new Error(`${referenceKey} particle animation hash does not match its pinned source.`);
    }
    const animationSource =
      animationBytes === null
        ? readFileSync(animationPath, "utf8")
        : new TextDecoder().decode(animationBytes);
    const sourceBinding =
      (particleEvidence.sourceAnimationBinding ?? "connect") === "connect"
        ? `connect ${particleEvidence.attachmentNode} ${particleEvidence.animationSelector} hotspot`
        : `${particleEvidence.attachmentNode} ${particleEvidence.animationSelector}`;
    if (
      !structurallyEqual(actualParticle, expectedParticle) ||
      !structurallyEqual(
        particle.appearanceFiles.map((file) => file.toLowerCase()),
        sourceTextureNames,
      ) ||
      textureBytes.some(
        (bytes, index) =>
          !structurallyEqual(classicDdtDimensions(bytes), [
            textureEvidence[index]!.width,
            textureEvidence[index]!.height,
          ]),
      ) ||
      !animationSource.toLowerCase().includes(sourceBinding.toLowerCase())
    ) {
      throw new Error(
        `${referenceKey} particle ${particleEvidence.key} does not match its pinned source.`,
      );
    }
  }
}

for (const path of [
  protoPath,
  ...Object.values(inventoryPaths),
  modelArchivePath,
  textureArchivePath,
  animationArchivePath,
]) {
  if (!existsSync(path)) {
    throw new Error(
      `Missing private fidelity source ${path}. Run the local asset extraction first.`,
    );
  }
}

const proto = readXmbFile(protoPath);
const modelArchive = readFileSync(modelArchivePath);
const textureArchive = readFileSync(textureArchivePath);
const animationArchive = readFileSync(animationArchivePath);
const protoSha256 = sha256(protoPath);
const inventories = new Map<ReferenceCulture, UnitInventory>();
const inventoryHashes = new Map<ReferenceCulture, string>();
for (const culture of Object.keys(inventoryPaths) as ReferenceCulture[]) {
  const path = inventoryPaths[culture];
  const inventory: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isUnitInventory(inventory)) throw new Error(`Invalid unit inventory ${path}.`);
  inventories.set(culture, inventory);
  inventoryHashes.set(culture, sha256(path));
}

for (const reference of UNIT_REFERENCE_SPECS) {
  const protoSource = reference.source.trialProto;
  if (protoSha256 !== protoSource.sha256) {
    throw new Error(`${reference.key} Trial proto hash does not match its pinned source.`);
  }
  const protoUnit = proto.children.find(
    (node) =>
      node.name === "unit" &&
      node.attributes.id === String(protoSource.unitId) &&
      node.attributes.name === protoSource.unitName,
  );
  if (protoUnit === undefined) {
    throw new Error(
      `${reference.key} cannot find Trial proto unit ${protoSource.unitId} ${protoSource.unitName}.`,
    );
  }
  if (reference.expected.culture !== cultureIds[reference.source.culture]) {
    throw new Error(`${reference.key} source culture does not match its final reference.`);
  }
  const deathReplacement = reference.source.deathReplacement;
  if (deathReplacement !== undefined) {
    const replacementProto = proto.children.find(
      (node) =>
        node.name === "unit" &&
        node.attributes.id === String(deathReplacement.trialReplacementUnitId) &&
        node.attributes.name === deathReplacement.replacementUnitName,
    );
    const trainedUnit = replacementProto?.children.find(
      (node) =>
        node.name === "train" &&
        node.value === deathReplacement.trainsUnitName &&
        node.attributes.column === String(deathReplacement.commandSlot),
    );
    if (
      childValues(protoUnit, "deadreplacement")[0]?.value !==
        deathReplacement.replacementUnitName ||
      replacementProto === undefined ||
      numberValue(replacementProto, "maxhitpoints") !== deathReplacement.trialMaxHp ||
      trainedUnit === undefined ||
      !replacementProto.children.some((node) => node.name === "flag" && node.value === "TrainOnce")
    ) {
      throw new Error(`${reference.key} death replacement does not match its Trial source.`);
    }
  }
  const meleeImpactArea = reference.source.assetInventory.meleeImpactArea;
  if (meleeImpactArea !== undefined) {
    const action = readTrialAction(protoUnit, meleeImpactArea.action);
    for (const component of meleeImpactArea.components) {
      const parameter = action.parameters.find(
        (node) => node.attributes.name === "Damage" && node.attributes.type === component.type,
      );
      if (
        parameter === undefined ||
        Number(parameter.attributes.value1) !== component.damage ||
        (parameter.attributes.value2 === undefined ? null : Number(parameter.attributes.value2)) !==
          component.radius ||
        (parameter.attributes.options ?? null) !== component.options
      ) {
        throw new Error(`${reference.key} melee impact area does not match its Trial source.`);
      }
    }
  }
  verifyTrialGameplay(reference, protoUnit, proto);

  if (inventoryHashes.get(reference.source.culture) !== reference.source.assetInventory.sha256) {
    throw new Error(`${reference.key} asset inventory hash does not match its pinned source.`);
  }
  const inventoryUnit = inventories
    .get(reference.source.culture)
    ?.units.find((unit) => unit.name === reference.source.assetInventory.rosterName);
  if (
    inventoryUnit === undefined ||
    !inventoryUnit.rootAnimations.includes(reference.source.assetInventory.rootAnimation)
  ) {
    throw new Error(
      `${reference.key} cannot find root animation ${reference.source.assetInventory.rootAnimation} in its source inventory.`,
    );
  }
  if (reference.expected.attack?.kind === "projectile") {
    const inventory = reference.source.assetInventory;
    if (!("attackRelease" in inventory)) {
      throw new Error(`${reference.key} has no projectile-release source inventory.`);
    }
    const release = inventory.attackRelease;
    const animationPath = resolve(
      animationRoots[reference.source.culture],
      reference.source.assetInventory.rootAnimation,
    );
    if (!existsSync(animationPath) || sha256(animationPath) !== release.sha256) {
      throw new Error(`${reference.key} attack animation hash does not match its pinned source.`);
    }
    let fraction: number;
    try {
      fraction = animationTagFraction(
        readFileSync(animationPath, "utf8"),
        release.action,
        release.tag,
      );
    } catch (error) {
      throw new Error(`${reference.key} cannot read its attack release from ${animationPath}.`, {
        cause: error,
      });
    }
    if (fraction !== release.fraction) {
      throw new Error(`${reference.key} attack release tag does not match its pinned source.`);
    }
    if (release.durationTicks !== undefined) {
      const modelPath = resolve(
        animationRoots[reference.source.culture],
        "..",
        "..",
        "models",
        release.model!,
      );
      if (
        !existsSync(modelPath) ||
        sha256(modelPath) !== release.modelSha256 ||
        glbAnimationDurationTicks(modelPath) !==
          (release.modelDurationTicks ?? release.durationTicks)
      ) {
        throw new Error(
          `${reference.key} projectile attack model does not match its pinned source.`,
        );
      }
    }
  }
  const animationPath = resolve(
    animationRoots[reference.source.culture],
    reference.source.assetInventory.rootAnimation,
  );
  const cycleEvidence = reference.source.assetInventory.meleeAttackCycles;
  if (cycleEvidence !== undefined) {
    // Root animation files repeat the same attack selector once per armor
    // hotspot. Runtime variants are the smallest repeating source sequence.
    const fractions = repeatingAnimationCycle(
      animationTagFractions(readFileSync(animationPath, "utf8"), "attack", "Attack"),
    );
    const fractionsMatch =
      fractions.length === cycleEvidence.length
        ? cycleEvidence.every((cycle, index) => cycle.fraction === fractions[index])
        : fractions.length === 1 && cycleEvidence.every((cycle) => cycle.fraction === fractions[0]);
    if (!fractionsMatch) {
      throw new Error(`${reference.key} melee-cycle tags do not match their pinned source.`);
    }
    for (const cycle of cycleEvidence) {
      const modelPath = resolve(
        animationRoots[reference.source.culture],
        "..",
        "..",
        "models",
        cycle.model,
      );
      if (
        !existsSync(modelPath) ||
        sha256(modelPath) !== cycle.modelSha256 ||
        glbAnimationDurationTicks(modelPath) !== (cycle.modelDurationTicks ?? cycle.durationTicks)
      ) {
        throw new Error(`${reference.key} melee-cycle model does not match its pinned source.`);
      }
    }
  }
  const secondaryCycleEvidence =
    reference.source.assetInventory.secondaryMeleeAttackCycles;
  if (secondaryCycleEvidence !== undefined) {
    const fractions = repeatingAnimationCycle(
      animationTagFractions(readFileSync(animationPath, "utf8"), "attack", "Attack"),
    );
    const fractionsMatch =
      fractions.length === secondaryCycleEvidence.length
        ? secondaryCycleEvidence.every((cycle, index) => cycle.fraction === fractions[index])
        : fractions.length === 1 &&
          secondaryCycleEvidence.every((cycle) => cycle.fraction === fractions[0]);
    if (!fractionsMatch) {
      throw new Error(`${reference.key} secondary melee-cycle tags do not match their source.`);
    }
    for (const cycle of secondaryCycleEvidence) {
      const modelPath = resolve(
        animationRoots[reference.source.culture],
        "..",
        "..",
        "models",
        cycle.model,
      );
      if (
        !existsSync(modelPath) ||
        sha256(modelPath) !== cycle.modelSha256 ||
        glbAnimationDurationTicks(modelPath) !== (cycle.modelDurationTicks ?? cycle.durationTicks)
      ) {
        throw new Error(`${reference.key} secondary melee model does not match its source.`);
      }
    }
  }
  const beamEvidence = reference.source.assetInventory.beamAttackCycle;
  if (beamEvidence !== undefined) {
    const source = readFileSync(animationPath, "utf8");
    const fraction = animationTagFraction(source, beamEvidence.action, beamEvidence.tag);
    const modelPath = resolve(
      animationRoots[reference.source.culture],
      "..",
      "..",
      "models",
      beamEvidence.model,
    );
    if (
      fraction !== beamEvidence.fraction ||
      !existsSync(modelPath) ||
      sha256(modelPath) !== beamEvidence.modelSha256 ||
      glbAnimationDurationTicks(modelPath) !==
        (beamEvidence.modelDurationTicks ?? beamEvidence.durationTicks)
    ) {
      throw new Error(`${reference.key} beam-cycle source does not match its pinned evidence.`);
    }
  }
  const beamVisual = reference.source.assetInventory.beamVisual;
  if (reference.expected.attack?.kind === "beam") {
    if (beamVisual === undefined) {
      throw new Error(`${reference.key} has no beam-visual source evidence.`);
    }
    const beamAnimation = readClassicBarEntry(animationArchive, beamVisual.beamAnimationFile);
    const headAnimation = readClassicBarEntry(animationArchive, beamVisual.headAnimationFile);
    const beamTexture = readClassicBarEntry(textureArchive, beamVisual.beamTextureFile);
    const headTexture = readClassicBarEntry(textureArchive, beamVisual.headTextureFile);
    if (
      sha256Bytes(beamAnimation) !== beamVisual.beamAnimationSha256 ||
      sha256Bytes(headAnimation) !== beamVisual.headAnimationSha256 ||
      !new TextDecoder()
        .decode(beamAnimation)
        .toLowerCase()
        .includes(beamVisual.beamVisual.toLowerCase()) ||
      !new TextDecoder()
        .decode(headAnimation)
        .toLowerCase()
        .includes(beamVisual.headVisual.toLowerCase()) ||
      sha256Bytes(beamTexture) !== beamVisual.beamTextureSha256 ||
      sha256Bytes(headTexture) !== beamVisual.headTextureSha256 ||
      !structurallyEqual(classicDdtDimensions(beamTexture), [
        beamVisual.beamTextureWidth,
        beamVisual.beamTextureHeight,
      ]) ||
      !structurallyEqual(classicDdtDimensions(headTexture), [
        beamVisual.headTextureWidth,
        beamVisual.headTextureHeight,
      ])
    ) {
      throw new Error(`${reference.key} beam presentation does not match its pinned source.`);
    }
  } else if (beamVisual !== undefined) {
    throw new Error(`${reference.key} has unused beam-visual source evidence.`);
  }
  const cycleSelector = reference.source.assetInventory.meleeCycleSelector;
  if (cycleSelector !== undefined) {
    const source = readFileSync(animationPath, "utf8");
    const match = source.match(/\bExperienceLogic\s+([0-9. ]+)/i);
    const thresholds = match?.[1]?.trim().split(/\s+/).map(Number);
    if (thresholds === undefined || !structurallyEqual(thresholds, cycleSelector.thresholds)) {
      throw new Error(`${reference.key} experience selector does not match its pinned source.`);
    }
  }
  verifyParticleSources(
    reference.key,
    animationPath,
    reference.source.assetInventory.attackParticles ?? [],
    modelArchive,
    textureArchive,
    animationArchive,
  );
  verifyParticleSources(
    reference.key,
    animationPath,
    reference.source.assetInventory.beamParticles ?? [],
    modelArchive,
    textureArchive,
    animationArchive,
  );

  if (reference.expected.specialAttack !== null) {
    const inventory = reference.source.assetInventory;
    if (reference.expected.specialAttack.kind === "charged-jump") {
      const jump = inventory.jumpSpecial;
      if (
        jump === undefined ||
        !existsSync(animationPath) ||
        sha256(animationPath) !== jump.sha256
      ) {
        throw new Error(`${reference.key} jump animation hash does not match its pinned source.`);
      }
      const models =
        jump.kind === "phased"
          ? ([
              [jump.takeoffModel, jump.takeoffModelSha256, jump.takeoffTicks],
              [jump.flightModel, jump.flightModelSha256, jump.flightSourceTicks],
              [jump.landingModel, jump.landingModelSha256, jump.landingTicks],
            ] as const)
          : ([[jump.model, jump.modelSha256, jump.durationTicks]] as const);
      for (const [model, expectedHash, expectedTicks] of models) {
        const modelPath = resolve(
          animationRoots[reference.source.culture],
          "..",
          "..",
          "models",
          model,
        );
        if (
          !existsSync(modelPath) ||
          sha256(modelPath) !== expectedHash ||
          glbAnimationDurationTicks(modelPath) !== expectedTicks
        ) {
          throw new Error(`${reference.key} jump model does not match its pinned source.`);
        }
      }
    } else if (reference.expected.specialAttack.kind === "charged-pickup-throw") {
      const pickup = inventory.pickupThrowSpecial;
      if (
        pickup === undefined ||
        !existsSync(animationPath) ||
        sha256(animationPath) !== pickup.sha256
      ) {
        throw new Error(`${reference.key} pickup-throw animation hash does not match its source.`);
      }
      const animation = readFileSync(animationPath, "utf8");
      if (
        animationTagFraction(animation, pickup.action, pickup.pickupTag) !==
          pickup.pickupFraction ||
        animationTagFraction(animation, pickup.action, pickup.throwTag) !== pickup.throwFraction
      ) {
        throw new Error(`${reference.key} pickup-throw tags do not match its pinned source.`);
      }
      const modelPath = resolve(
        animationRoots[reference.source.culture],
        "..",
        "..",
        "models",
        pickup.model,
      );
      if (
        !existsSync(modelPath) ||
        sha256(modelPath) !== pickup.modelSha256 ||
        glbAnimationDurationTicks(modelPath) !== pickup.durationTicks
      ) {
        throw new Error(`${reference.key} pickup-throw model does not match its pinned source.`);
      }
    } else {
      const impact = inventory.specialImpact;
      if (impact === undefined) {
        throw new Error(`${reference.key} has no special-impact source inventory.`);
      }
      if (!existsSync(animationPath) || sha256(animationPath) !== impact.sha256) {
        throw new Error(
          `${reference.key} special animation hash does not match its pinned source.`,
        );
      }
      const fraction = animationTagFraction(
        readFileSync(animationPath, "utf8"),
        impact.action,
        impact.tag,
      );
      if (fraction !== impact.fraction) {
        throw new Error(`${reference.key} special impact tag does not match its pinned source.`);
      }
    }

    verifyParticleSources(
      reference.key,
      animationPath,
      inventory.specialParticles ?? [],
      modelArchive,
      textureArchive,
      animationArchive,
    );
  }
}

console.log(
  `Verified Trial-derived gameplay fields, explicit final-ruleset deltas, and asset provenance for ${UNIT_REFERENCE_SPECS.length} unit references.`,
);
