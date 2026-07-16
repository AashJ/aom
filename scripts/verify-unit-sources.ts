import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TICK_HZ } from "../packages/sim/src/clock";
import {
  trialComparableExpected,
  structurallyEqual,
  type ReferenceCulture,
  type TrialComparableField,
  type TrialComparableValue,
  type UnitReferenceSpec,
} from "../packages/sim/src/content/unit-reference-schema";
import { UNIT_REFERENCE_SPECS } from "../packages/sim/src/content/unit-references";
import {
  CULTURE_EGYPTIAN,
  CULTURE_GREEK,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_CAVALRY,
  UNIT_CLASS_HERO,
  UNIT_CLASS_HUMAN,
  UNIT_CLASS_INFANTRY,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_NON_GREEK_UNIT,
  UNIT_CLASS_SIEGE,
  type DamageBonus,
} from "../packages/sim/src/content/unit-type-schema";
import { CULTURE_NORSE } from "../packages/sim/src/content/unit-type-schema";
import { readXmbFile, type XmbNode } from "./lib/xmb";
import {
  animationTagFraction,
  readTrialAction,
  type TrialAttackActionName,
} from "./lib/trial-unit";

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
  if (types.has("AbstractCavalry")) classes |= UNIT_CLASS_CAVALRY;
  if (types.has("Military")) classes |= UNIT_CLASS_MILITARY;
  if (types.has("Hero")) classes |= UNIT_CLASS_HERO;
  if (types.has("AbstractArcher")) classes |= UNIT_CLASS_ARCHER;
  if (childValues(unit, "action").some((action) => action.attributes.name === "HandAttack")) {
    classes |= UNIT_CLASS_MELEE;
  }
  if (types.has("LogicalTypeNonGreekUnit")) classes |= UNIT_CLASS_NON_GREEK_UNIT;
  return classes;
}

function damageBonus(type: string, multiplier: number): DamageBonus {
  switch (type) {
    case "AbstractInfantry":
      return { target: { kind: "classes", classes: UNIT_CLASS_INFANTRY }, multiplier };
    case "AbstractCavalry":
      return { target: { kind: "classes", classes: UNIT_CLASS_CAVALRY }, multiplier };
    case "AbstractArcher":
      return { target: { kind: "classes", classes: UNIT_CLASS_ARCHER }, multiplier };
    case "Building":
      return { target: { kind: "classes", classes: UNIT_CLASS_BUILDING }, multiplier };
    case "LogicalTypeNonGreekUnit":
      return { target: { kind: "classes", classes: UNIT_CLASS_NON_GREEK_UNIT }, multiplier };
    case "Raiding Cavalry":
      return { target: { kind: "unit", key: "norse-raiding-cavalry" }, multiplier };
    case "Throwing Axeman":
      return { target: { kind: "unit", key: "norse-throwing-axeman" }, multiplier };
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
      return { target: { kind: "classes", classes: UNIT_CLASS_SIEGE }, multiplier };
    case "MythUnit":
      return { target: { kind: "classes", classes: UNIT_CLASS_MYTH }, multiplier };
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
  readonly numericParameter: (name: string, type?: string) => number;
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
    numericParameter: (name, type) => action.numericParameter(name, type),
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
    armor: [armor("Hack"), armor("Pierce"), armor("Crush")],
    bodyRadius: numberValue(unit, "obstructionradiusx"),
    collidesWithProjectiles: hasFlag(unit, "CollidesWithProjectiles"),
    cost: [
      costByResource.get("Food") ?? 0,
      costByResource.get("Wood") ?? 0,
      costByResource.get("Gold") ?? 0,
      costByResource.get("Favor") ?? 0,
    ],
    buildTicks: numberValue(unit, "trainpoints") * TICK_HZ,
    populationCost: numberValue(unit, "populationcount"),
    requiredAge: numberValue(unit, "allowedage") - 1,
  };

  if (reference.expected.attack.kind === "melee") {
    const attack = trialAttack(unit, "HandAttack");
    return {
      ...common,
      "attack.damage": attack.damage,
      "attack.range": attack.range,
      "attack.bonuses": attack.bonuses,
    };
  }

  const attack = trialAttack(unit, "RangedAttack");
  const projectileName = childValues(unit, "projectileprotounit")[0]?.value;
  const projectile = proto.children.find(
    (candidate) => candidate.name === "unit" && candidate.attributes.name === projectileName,
  );
  if (projectile === undefined) {
    throw new Error(`${unit.attributes.name} has no Trial projectile proto ${projectileName}.`);
  }

  return {
    ...common,
    "attack.damage": attack.damage,
    "attack.range": attack.range,
    "attack.bonuses": attack.bonuses,
    "attack.accuracy": attack.numericParameter("Accuracy"),
    "attack.accuracyReductionFactor": attack.numericParameter("AccuracyReductionFactor"),
    "attack.aimBonus": attack.numericParameter("AimBonus"),
    "attack.spreadFactor": attack.numericParameter("SpreadFactor"),
    "attack.maxSpread": attack.numericParameter("MaxSpread"),
    "attack.trackRating": attack.numericParameter("TrackRating"),
    "attack.unintentionalDamageMultiplier": attack.numericParameter(
      "UnintentionalDamageMultiplier",
    ),
    "attack.projectile.speed": numberValue(projectile, "maxvelocity"),
    "attack.projectile.lifespanTicks": numberValue(projectile, "lifespan") * TICK_HZ,
    "attack.projectile.collisionRadius": numberValue(projectile, "obstructionradiusx"),
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
      throw new Error(`${reference.key} has an unreviewed or inaccurate Trial delta for ${field}.`);
    }
  }
}

for (const path of [protoPath, ...Object.values(inventoryPaths)]) {
  if (!existsSync(path)) {
    throw new Error(
      `Missing private fidelity source ${path}. Run the local asset extraction first.`,
    );
  }
}

const proto = readXmbFile(protoPath);
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
  if (reference.expected.attack.kind === "projectile") {
    const release = reference.source.assetInventory.attackRelease;
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
  }
}

console.log(
  `Verified Trial-derived gameplay fields, explicit final-ruleset deltas, and asset provenance for ${UNIT_REFERENCE_SPECS.length} unit references.`,
);
