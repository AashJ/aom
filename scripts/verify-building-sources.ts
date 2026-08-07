import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CLASSIC_BUILDING_ROSTER,
  CULTURE_EGYPTIAN,
  FAVOR,
  FOOD,
  GOLD,
  UNIT_TYPES,
  WOOD,
} from "../packages/sim/src";
import { descendants, readXmbFile, type XmbNode } from "./lib/xmb";

const root = resolve(import.meta.dir, "..");
const protoPath = resolve(root, "private-assets/work/extracted/data/proto.xmb");

if (!existsSync(protoPath)) {
  throw new Error(`Classic Trial proto source is missing: ${protoPath}`);
}

const proto = readXmbFile(protoPath);
const sourceUnits = descendants(proto, "unit");
const resourceIndexes = { Food: FOOD, Wood: WOOD, Gold: GOLD, Favor: FAVOR } as const;

function sourceUnit(name: string): XmbNode {
  const unit = sourceUnits.find((candidate) => candidate.attributes.name === name);
  if (!unit) throw new Error(`Classic proto unit is missing: ${name}`);
  return unit;
}

function optionalNumber(unit: XmbNode, childName: string): number | undefined {
  const child = unit.children.find((candidate) => candidate.name === childName);
  if (!child) return undefined;
  const value = Number(child.value);
  if (!Number.isFinite(value)) throw new Error(`${unit.attributes.name}.${childName} is not numeric.`);
  return value;
}

function requiredNumber(unit: XmbNode, childName: string): number {
  const value = optionalNumber(unit, childName);
  if (value === undefined) throw new Error(`${unit.attributes.name}.${childName} is missing.`);
  return value;
}

function sourceCosts(unit: XmbNode): [number, number, number, number] {
  const costs: [number, number, number, number] = [0, 0, 0, 0];
  for (const child of unit.children) {
    if (child.name !== "cost") continue;
    const resource = child.attributes.resourcetype as keyof typeof resourceIndexes;
    const index = resourceIndexes[resource];
    if (index === undefined) throw new Error(`${unit.attributes.name} has unknown cost ${resource}.`);
    costs[index] = Number(child.value);
  }
  return costs;
}

function expectedCultureCosts(
  protoName: string,
  culture: number,
  source: [number, number, number, number],
): [number, number, number, number] {
  const costs = source.slice() as [number, number, number, number];
  if (culture !== CULTURE_EGYPTIAN) return costs;

  // Egyptian culture effects in the Classic Trial tech database: ordinary
  // building wood costs are assigned to zero, with these authored gold deltas.
  costs[WOOD] = 0;
  if (protoName === "Settlement Level 1") costs[GOLD] += 100;
  if (protoName === "Tower") costs[GOLD] *= 2;
  if (protoName === "Farm") costs[GOLD] += 70;
  if (protoName === "Wonder") costs[GOLD] *= 1.5;
  if (protoName === "Dock") costs[GOLD] += 50;
  return costs;
}

function sourceArmor(unit: XmbNode): [number, number, number] {
  const armor: [number, number, number] = [0, 0, 0];
  const damageIndexes = { Hack: 0, Pierce: 1, Crush: 2 } as const;
  for (const child of unit.children) {
    if (child.name !== "armor") continue;
    const damageType = child.attributes.damagetype as keyof typeof damageIndexes;
    const index = damageIndexes[damageType];
    if (index === undefined) throw new Error(`${unit.attributes.name} has unknown armor ${damageType}.`);
    armor[index] = Number(child.value);
  }
  return armor;
}

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: implemented ${JSON.stringify(actual)}, source ${JSON.stringify(expected)}`);
  }
}

for (const entry of CLASSIC_BUILDING_ROSTER) {
  const definition = UNIT_TYPES[entry.id]!;
  const source = sourceUnit(entry.protoName);
  const sourceLimit = optionalNumber(source, "buildlimit");
  const sourceAge = optionalNumber(source, "allowedage");
  const sourcePopulation = optionalNumber(source, "populationcapaddition") ?? 0;

  assertEqual(`${definition.key}.maxHp`, definition.maxHp, requiredNumber(source, "maxhitpoints"));
  assertEqual(`${definition.key}.lineOfSight`, definition.lineOfSight, requiredNumber(source, "los"));
  assertEqual(`${definition.key}.armor`, definition.armor, sourceArmor(source));
  assertEqual(
    `${definition.key}.cost`,
    [definition.costFood, definition.costWood, definition.costGold, definition.costFavor],
    expectedCultureCosts(entry.protoName, entry.culture, sourceCosts(source)),
  );
  assertEqual(
    `${definition.key}.buildTicks`,
    definition.buildTicks,
    requiredNumber(source, "buildpoints") * 20,
  );
  assertEqual(`${definition.key}.popBonus`, definition.popBonus, sourcePopulation);
  if (sourceAge !== undefined) {
    assertEqual(`${definition.key}.requiredAge`, definition.requiredAge, sourceAge - 1);
  }
  if (sourceLimit !== undefined) {
    assertEqual(
      `${definition.key}.buildLimit`,
      definition.buildLimitByAge?.[0] ?? definition.buildLimit,
      sourceLimit,
    );
  }
}

console.log(`Verified ${CLASSIC_BUILDING_ROSTER.length} Greek/Egyptian buildings against proto.xmb.`);
