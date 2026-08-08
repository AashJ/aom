import { relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { unlinkSync } from "node:fs";
import {
  AREA_DAMAGE_ENEMIES,
  AREA_DAMAGE_NEUTRAL_UNITS,
  CULTURE_SHARED,
  UNIT_CLASS_ARCHER,
  UNIT_CLASS_BUILDING,
  UNIT_CLASS_HERO,
  UNIT_CLASS_MELEE,
  UNIT_CLASS_MILITARY,
  UNIT_CLASS_MYTH,
  UNIT_CLASS_RESOURCE,
  UNIT_CLASS_WORKER,
  type UnitTypeStats,
  type TypeCommandRelationship,
} from "../packages/sim/src/content/unit-type-schema";
import { UNIT_ROSTER, unitRosterEntry } from "../packages/sim/src/content/unit-roster";
import { validateDefinitionAgainstReference } from "../packages/sim/src/content/unit-reference-schema";
import { unitReferenceEntry } from "../packages/sim/src/content/unit-references";
import { NO_GOD } from "../packages/sim/src/ecs/progression";
import { TICK_HZ } from "../packages/sim/src/clock";
import { PROJECTILE_TYPE_COUNT } from "../packages/sim/src/ecs/projectiles";
import type {
  ModelAssetDefinition,
  UnitMediaDefinition,
} from "../packages/engine/src/content/unit-media-schema";
import { PROJECTILE_MEDIA_DEFINITIONS } from "../packages/engine/src/content/projectile-media";
import { isValidTargetReactionContract } from "./lib/target-reaction-contract";
import {
  compileParticleEffectParameters,
  type ParticleEffectParameters,
} from "./lib/unit-particle-contract";

const root = resolve(import.meta.dir, "..");
const simSourceRoot = resolve(root, "packages/sim/src/content/unit-types");
const simOutputPath = resolve(root, "packages/sim/src/content/generated/unit-types.ts");
const mediaSourceRoot = resolve(root, "packages/engine/src/content/unit-media");
const mediaOutputPath = resolve(root, "packages/engine/src/content/generated/unit-media.ts");
const check = process.argv.includes("--check");
const validateOnly = process.argv.includes("--validate-only");

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

const requiredLaneName = option("--require-lane");
const glob = new Bun.Glob("**/*.ts");
const files = [...glob.scanSync({ cwd: simSourceRoot, onlyFiles: true })]
  .filter((file) => !file.endsWith(".test.ts"))
  .sort((left, right) => left.localeCompare(right));

function bindingName(file: string): string {
  return file
    .replace(/\.ts$/, "")
    .replaceAll(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replaceAll(/\s+(.)/g, (_, character: string) => character.toUpperCase());
}

interface DefinitionModule {
  readonly definition: UnitTypeStats;
}

const entries = await Promise.all(
  files.map(async (file) => {
    const moduleUrl = pathToFileURL(resolve(simSourceRoot, file)).href;
    const module = (await import(moduleUrl)) as DefinitionModule;
    return { binding: bindingName(file), definition: module.definition, file };
  }),
);
entries.sort(
  (left, right) => left.definition.id - right.definition.id || left.file.localeCompare(right.file),
);

const ids = new Set<number>();
const keys = new Set<string>();
const definitionsById = new Map<number, UnitTypeStats>();
for (const entry of entries) {
  if (
    !Number.isInteger(entry.definition.id) ||
    entry.definition.id < 0 ||
    entry.definition.id > 0xffff
  ) {
    throw new Error(`${entry.file} has invalid 16-bit id ${entry.definition.id}.`);
  }
  if (ids.has(entry.definition.id)) {
    throw new Error(`Duplicate unit type id ${entry.definition.id}.`);
  }
  if (keys.has(entry.definition.key)) {
    throw new Error(`Duplicate unit content key ${entry.definition.key}.`);
  }
  ids.add(entry.definition.id);
  keys.add(entry.definition.key);
  definitionsById.set(entry.definition.id, entry.definition);
}

function relationshipSource(
  target: UnitTypeStats,
  relationship: TypeCommandRelationship,
  kind: "trainedAt" | "builtBy",
): UnitTypeStats {
  if (!Number.isInteger(relationship.commandSlot) || relationship.commandSlot < 0) {
    throw new Error(`${target.key} has invalid ${kind} command slot ${relationship.commandSlot}.`);
  }

  const source = definitionsById.get(relationship.type);
  if (source === undefined) {
    throw new Error(`${target.key} references unimplemented ${kind} type ${relationship.type}.`);
  }

  if (
    source.culture !== CULTURE_SHARED &&
    target.culture !== CULTURE_SHARED &&
    source.culture !== target.culture
  ) {
    throw new Error(`${target.key} has a culture-incompatible ${kind} source ${source.key}.`);
  }

  const validSource =
    kind === "trainedAt"
      ? (source.classes & UNIT_CLASS_BUILDING) !== 0
      : (source.classes & UNIT_CLASS_WORKER) !== 0 || source.construction !== undefined;
  if (!validSource) {
    throw new Error(`${target.key} has invalid ${kind} source ${source.key}.`);
  }

  return source;
}

function relationshipsMatch(
  left: readonly TypeCommandRelationship[],
  right: readonly TypeCommandRelationship[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (relationship, index) =>
        relationship.type === right[index]?.type &&
        relationship.commandSlot === right[index]?.commandSlot,
    )
  );
}

const relationshipSlots = new Map<string, UnitTypeStats[]>();
for (const entry of entries) {
  const definition = entry.definition;
  const attack = definition.attack;
  const isHero = (definition.classes & UNIT_CLASS_HERO) !== 0;

  if (isHero !== (definition.hero !== undefined)) {
    throw new Error(`${definition.key} hero class and authored hero traits disagree.`);
  }
  if (
    definition.hero !== undefined &&
    ((definition.hero.trainLimit !== undefined &&
      (!Number.isInteger(definition.hero.trainLimit) || definition.hero.trainLimit < 1)) ||
      !Number.isInteger(definition.hero.relicCapacity) ||
      definition.hero.relicCapacity < 0 ||
      !Number.isFinite(definition.hero.relicPickupRange) ||
      definition.hero.relicPickupRange < 0 ||
      !Number.isFinite(definition.hero.relicDropOffRange) ||
      definition.hero.relicDropOffRange < 0)
  ) {
    throw new Error(`${definition.key} has invalid authored hero traits.`);
  }

  if (typeof definition.collidesWithProjectiles !== "boolean") {
    throw new Error(`${definition.key} has no authored projectile-collision policy.`);
  }

  if (attack !== null) {
    if (
      !Number.isFinite(attack.range) ||
      attack.range < 0 ||
      !Number.isFinite(attack.aggroRange) ||
      attack.aggroRange < attack.range ||
      !Number.isInteger(attack.cooldownTicks) ||
      attack.cooldownTicks < 1
    ) {
      throw new Error(`${definition.key} has an invalid ${attack.kind} attack envelope.`);
    }
    if (
      attack.damage.length !== 3 ||
      attack.damage.some((damage) => !Number.isFinite(damage) || damage < 0)
    ) {
      throw new Error(`${definition.key} has invalid attack damage.`);
    }

    if (attack.kind === "projectile") {
      const flight = attack.projectile;
      if (
        !Number.isInteger(attack.launchDelayTicks) ||
        attack.launchDelayTicks < 0 ||
        attack.launchDelayTicks >= attack.cooldownTicks ||
        !Number.isFinite(attack.accuracy) ||
        attack.accuracy < 0 ||
        attack.accuracy > 1 ||
        !Number.isFinite(attack.accuracyReductionFactor) ||
        attack.accuracyReductionFactor < 0 ||
        !Number.isFinite(attack.aimBonus) ||
        attack.aimBonus < 0 ||
        !Number.isFinite(attack.spreadFactor) ||
        attack.spreadFactor < 0 ||
        !Number.isFinite(attack.maxSpread) ||
        attack.maxSpread < 0 ||
        !Number.isFinite(attack.trackRating) ||
        attack.trackRating < 0 ||
        !Number.isFinite(attack.unintentionalDamageMultiplier) ||
        attack.unintentionalDamageMultiplier < 0 ||
        (attack.projectileCount !== undefined &&
          (!Number.isInteger(attack.projectileCount) ||
            attack.projectileCount < 1 ||
            attack.projectileCount > 255)) ||
        (attack.impactArea !== undefined &&
          (!Number.isFinite(attack.impactArea.radius) ||
            attack.impactArea.radius <= 0 ||
            attack.impactArea.falloff !== "linear" ||
            (attack.impactArea.damageRelations &
              ~(AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS)) !==
              0 ||
            (attack.impactArea.damageRelations & AREA_DAMAGE_ENEMIES) === 0)) ||
        !Number.isInteger(flight.type) ||
        flight.type < 0 ||
        flight.type >= PROJECTILE_TYPE_COUNT ||
        !Number.isFinite(flight.speed) ||
        flight.speed <= 0 ||
        !Number.isInteger(flight.lifespanTicks) ||
        flight.lifespanTicks < 1 ||
        !Number.isFinite(flight.collisionRadius) ||
        flight.collisionRadius < 0
      ) {
        throw new Error(`${definition.key} has an invalid projectile attack contract.`);
      }
      const maximumTravel = flight.speed * (flight.lifespanTicks / TICK_HZ);
      if (maximumTravel < attack.range) {
        throw new Error(`${definition.key} projectile lifespan cannot cover its attack range.`);
      }
    } else if (attack.kind === "beam") {
      if (
        !Number.isInteger(attack.impactDelayTicks) ||
        attack.impactDelayTicks < 1 ||
        attack.impactDelayTicks > attack.cooldownTicks
      ) {
        throw new Error(`${definition.key} has an invalid beam impact tag.`);
      }
    } else if (
      attack.cycleVariants !== undefined &&
      (attack.cycleVariants.length < 1 ||
        attack.cycleVariants.length > 0xfe ||
        attack.cycleVariants.some(
          (cycle) =>
            !Number.isInteger(cycle.actionTicks) ||
            cycle.actionTicks < 1 ||
            cycle.actionTicks > 0xffff ||
            !Number.isInteger(cycle.impactDelayTicks) ||
            cycle.impactDelayTicks < 1 ||
            cycle.impactDelayTicks >= cycle.actionTicks,
        ))
    ) {
      throw new Error(`${definition.key} has an invalid variable melee-cycle contract.`);
    }
  }

  const special = definition.specialAttack;
  if (
    special !== undefined &&
    (!Number.isFinite(special.range) ||
      special.range < 0 ||
      special.damage.length !== 3 ||
      special.damage.some((damage) => !Number.isFinite(damage) || damage < 0) ||
      !Number.isInteger(special.rechargeTicks) ||
      special.rechargeTicks < 1 ||
      special.rechargeTicks > 0xffff ||
      !Number.isInteger(special.actionTicks) ||
      special.actionTicks < 1 ||
      special.actionTicks > 0xffff ||
      !Number.isInteger(special.impactDelayTicks) ||
      special.impactDelayTicks < 1 ||
      special.impactDelayTicks > special.actionTicks ||
      special.validTargets.length === 0)
  ) {
    throw new Error(`${definition.key} has an invalid charged special-attack contract.`);
  }

  if (
    (special?.kind === "charged-area-pulse" || special?.kind === "charged-area-poison") &&
    (!Number.isFinite(special.radius) ||
      special.radius <= 0 ||
      special.falloff !== "linear" ||
      (special.damageRelations & ~(AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS)) !== 0 ||
      (special.damageRelations & AREA_DAMAGE_ENEMIES) === 0)
  ) {
    throw new Error(`${definition.key} has an invalid charged area-pulse contract.`);
  }
  if (
    special?.kind === "charged-area-poison" &&
    (!Number.isInteger(special.poisonDurationTicks) ||
      special.poisonDurationTicks < 1 ||
      special.poisonDurationTicks > 0xffff)
  ) {
    throw new Error(`${definition.key} has an invalid charged area-poison contract.`);
  }

  if (
    special?.kind === "charged-jump" &&
    (!Number.isFinite(special.minimumRange) ||
      special.minimumRange < 0 ||
      special.minimumRange > special.range ||
      !Number.isInteger(special.takeoffTicks) ||
      special.takeoffTicks < 0 ||
      !Number.isInteger(special.flightTicks) ||
      special.flightTicks < 1 ||
      !Number.isInteger(special.landingTicks) ||
      special.landingTicks < 0 ||
      special.takeoffTicks + special.flightTicks + special.landingTicks !== special.actionTicks ||
      special.takeoffTicks + special.flightTicks !== special.impactDelayTicks ||
      !Number.isFinite(special.jumpHeight) ||
      special.jumpHeight < 0 ||
      (special.delivery === "area" &&
        (!Number.isFinite(special.radius) ||
          special.radius <= 0 ||
          special.falloff !== "constant" ||
          (special.damageRelations & ~(AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS)) !== 0 ||
          (special.damageRelations & AREA_DAMAGE_ENEMIES) === 0)))
  ) {
    throw new Error(`${definition.key} has an invalid charged jump contract.`);
  }

  if (special?.kind === "charged-projectile") {
    const flight = special.projectile;
    if (
      !Number.isFinite(special.accuracy) ||
      special.accuracy < 0 ||
      special.accuracy > 1 ||
      !Number.isFinite(special.accuracyReductionFactor) ||
      special.accuracyReductionFactor < 0 ||
      !Number.isFinite(special.aimBonus) ||
      special.aimBonus < 0 ||
      !Number.isFinite(special.spreadFactor) ||
      special.spreadFactor < 0 ||
      !Number.isFinite(special.maxSpread) ||
      special.maxSpread < 0 ||
      !Number.isFinite(special.trackRating) ||
      special.trackRating < 0 ||
      !Number.isFinite(special.unintentionalDamageMultiplier) ||
      special.unintentionalDamageMultiplier < 0 ||
      (special.projectileCount !== undefined &&
        (!Number.isInteger(special.projectileCount) ||
          special.projectileCount < 1 ||
          special.projectileCount > 255)) ||
      (special.impactArea !== undefined &&
        (!Number.isFinite(special.impactArea.radius) ||
          special.impactArea.radius <= 0 ||
          special.impactArea.falloff !== "linear" ||
          (special.impactArea.damageRelations &
            ~(AREA_DAMAGE_ENEMIES | AREA_DAMAGE_NEUTRAL_UNITS)) !==
            0 ||
          (special.impactArea.damageRelations & AREA_DAMAGE_ENEMIES) === 0)) ||
      !Number.isInteger(flight.type) ||
      flight.type < 0 ||
      flight.type >= PROJECTILE_TYPE_COUNT ||
      !Number.isFinite(flight.speed) ||
      flight.speed <= 0 ||
      !Number.isInteger(flight.lifespanTicks) ||
      flight.lifespanTicks < 1 ||
      !Number.isFinite(flight.collisionRadius) ||
      flight.collisionRadius < 0 ||
      flight.speed * (flight.lifespanTicks / TICK_HZ) < special.range
    ) {
      throw new Error(`${definition.key} has an invalid charged projectile contract.`);
    }
  }

  const reaction = special?.kind === "charged-melee" ? special.targetReaction : undefined;
  if (reaction !== undefined && !isValidTargetReactionContract(reaction)) {
    throw new Error(`${definition.key} has an invalid thrown target-reaction contract.`);
  }

  if (
    definition.construction !== undefined &&
    (!Number.isFinite(definition.construction.range) ||
      definition.construction.range < 0 ||
      !Number.isFinite(definition.construction.ratePerSecond) ||
      definition.construction.ratePerSecond <= 0 ||
      !Number.isFinite(definition.construction.baselineRatePerSecond) ||
      definition.construction.baselineRatePerSecond <= 0)
  ) {
    throw new Error(`${definition.key} has an invalid construction contract.`);
  }

  for (const prerequisiteType of definition.prerequisiteBuildings) {
    const prerequisite = definitionsById.get(prerequisiteType);
    if (prerequisite === undefined) {
      throw new Error(
        `${definition.key} references unimplemented prerequisite ${prerequisiteType}.`,
      );
    }
    if ((prerequisite.classes & UNIT_CLASS_BUILDING) === 0) {
      throw new Error(`${definition.key} prerequisite ${prerequisite.key} is not a building.`);
    }
    if (
      prerequisite.culture !== CULTURE_SHARED &&
      definition.culture !== CULTURE_SHARED &&
      prerequisite.culture !== definition.culture
    ) {
      throw new Error(
        `${definition.key} has culture-incompatible prerequisite ${prerequisite.key}.`,
      );
    }
  }

  for (const kind of ["trainedAt", "builtBy"] as const) {
    for (const relationship of definition[kind]) {
      const source = relationshipSource(definition, relationship, kind);
      const slotKey = `${kind}:${source.id}:${relationship.commandSlot}`;
      const existing = relationshipSlots.get(slotKey) ?? [];
      const collision = existing.find(
        (candidate) =>
          candidate.requiredGod === NO_GOD ||
          definition.requiredGod === NO_GOD ||
          candidate.requiredGod === definition.requiredGod,
      );
      if (collision !== undefined) {
        throw new Error(
          `${source.key} command slot ${relationship.commandSlot} is shared by ${collision.key} and ${definition.key}.`,
        );
      }
      existing.push(definition);
      relationshipSlots.set(slotKey, existing);
    }
  }

  const isResource = (definition.classes & UNIT_CLASS_RESOURCE) !== 0;
  const isBuilding = (definition.classes & UNIT_CLASS_BUILDING) !== 0;
  if (
    definition.footprintDepth !== undefined &&
    (!isBuilding ||
      !Number.isInteger(definition.footprintDepth) ||
      definition.footprintDepth < 1)
  ) {
    throw new Error(`${definition.key} has an invalid rectangular-footprint contract.`);
  }
  if (
    definition.buildLimit !== undefined &&
    (!isBuilding || !Number.isInteger(definition.buildLimit) || definition.buildLimit < 1)
  ) {
    throw new Error(`${definition.key} has an invalid build limit.`);
  }
  if (
    definition.buildLimitByAge !== undefined &&
    (!isBuilding ||
      definition.buildLimitByAge.length !== 4 ||
      definition.buildLimitByAge.some((limit) => !Number.isInteger(limit) || limit < 1))
  ) {
    throw new Error(`${definition.key} has an invalid age-dependent build limit.`);
  }
  if (
    definition.lifespanTicks !== undefined &&
    (!Number.isInteger(definition.lifespanTicks) ||
      definition.lifespanTicks < 1 ||
      definition.lifespanTicks > 0xffff)
  ) {
    throw new Error(`${definition.key} has an invalid fixed-lifetime contract.`);
  }
  if (
    definition.regenerationPerSecond !== undefined &&
    (!Number.isFinite(definition.regenerationPerSecond) || definition.regenerationPerSecond <= 0)
  ) {
    throw new Error(`${definition.key} has an invalid persistent-regeneration contract.`);
  }
  if (definition.resourceGathererDomain !== undefined && !isResource) {
    throw new Error(`${definition.key} restricts gatherer movement domain but is not a resource.`);
  }
  if (
    !isResource &&
    !isBuilding &&
    definition.populationCost > 0 &&
    definition.buildTicks > 0 &&
    definition.trainedAt.length === 0
  ) {
    throw new Error(`${definition.key} is trainable but declares no trainedAt source.`);
  }
  if (
    isBuilding &&
    definition.footprint > 0 &&
    definition.isPlacementSocket !== true &&
    definition.builtBy.length === 0
  ) {
    throw new Error(`${definition.key} is buildable but declares no builtBy source.`);
  }

  if (definition.destructionReplacementType !== undefined) {
    const replacement = definitionsById.get(definition.destructionReplacementType);
    if (
      !isBuilding ||
      replacement?.isPlacementSocket !== true ||
      replacement.footprint !== definition.footprint ||
      replacement.footprintDepth !== definition.footprintDepth
    ) {
      throw new Error(`${definition.key} has an invalid destroyed-building replacement.`);
    }
  }
}

for (const entry of entries) {
  const definition = entry.definition;
  const meleeArea = definition.attack?.kind === "melee" ? definition.attack.impactArea : undefined;
  if (meleeArea !== undefined) {
    const componentDamage = [0, 0, 0];
    for (const component of meleeArea.components) {
      for (let damageType = 0; damageType < component.damage.length; damageType += 1) {
        const value = component.damage[damageType]!;
        if (!Number.isFinite(value) || value < 0) {
          throw new Error(`${definition.key} has invalid melee impact-area damage.`);
        }
        componentDamage[damageType] = componentDamage[damageType]! + value;
      }
      if (!Number.isInteger(component.damageRelations) || component.damageRelations <= 0) {
        throw new Error(`${definition.key} has invalid melee impact-area relations.`);
      }
    }
    if (
      !Number.isFinite(meleeArea.radius) ||
      meleeArea.radius <= 0 ||
      !componentDamage.every((value, index) => value === definition.attack!.damage[index])
    ) {
      throw new Error(`${definition.key} has an invalid melee impact-area contract.`);
    }
  }

  const trainingSite = definition.trainingSite;
  if (
    trainingSite !== undefined &&
    ((definition.classes & UNIT_CLASS_BUILDING) === 0 ||
      !entries.some((candidate) =>
        candidate.definition.trainedAt.some((relationship) => relationship.type === definition.id),
      ))
  ) {
    throw new Error(`${definition.key} has an invalid one-time training-site contract.`);
  }

  const replacement = definition.deathReplacement;
  if (replacement !== undefined) {
    const replacementDefinition = definitionsById.get(replacement.unitType);
    if (
      replacement.trigger !== "death" ||
      replacementDefinition === undefined ||
      replacementDefinition.culture !== definition.culture ||
      replacementDefinition.trainedAt.length !== 0
    ) {
      throw new Error(`${definition.key} has an invalid death-replacement contract.`);
    }
  }

  const deathSpawn = definition.deathSpawn;
  if (deathSpawn === undefined) continue;
  const spawnedDefinition = definitionsById.get(deathSpawn.unitType);
  if (
    (definition.classes & UNIT_CLASS_BUILDING) === 0 ||
    deathSpawn.trigger !== "destroyed-by-damage" ||
    !Number.isInteger(deathSpawn.count) ||
    deathSpawn.count < 1 ||
    !Number.isInteger(deathSpawn.liveLimit) ||
    deathSpawn.liveLimit < deathSpawn.count ||
    spawnedDefinition === undefined ||
    spawnedDefinition.culture !== definition.culture ||
    spawnedDefinition.trainedAt.length !== 0
  ) {
    throw new Error(`${definition.key} has an invalid damage-death spawn contract.`);
  }
}

for (const lane of UNIT_ROSTER) {
  const definition = definitionsById.get(lane.id);
  if (lane.status === "implemented" && definition === undefined) {
    throw new Error(`Implemented unit lane ${lane.lane} has no sim definition.`);
  }

  if (definition !== undefined) {
    if (
      definition.key !== lane.key ||
      definition.label !== lane.label ||
      definition.culture !== lane.culture ||
      definition.requiredGod !== lane.requiredGod ||
      (lane.trainedAt !== null && !relationshipsMatch(definition.trainedAt, lane.trainedAt))
    ) {
      throw new Error(`${lane.key} does not match its canonical roster assignment.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.family === "ordinary-melee" &&
      ((definition.classes & (UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE)) !==
        (UNIT_CLASS_MILITARY | UNIT_CLASS_MELEE) ||
        definition.attack?.kind !== "melee")
    ) {
      throw new Error(`${lane.key} must satisfy the ordinary-melee family contract.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.family === "ordinary-projectile" &&
      ((definition.classes & (UNIT_CLASS_MILITARY | UNIT_CLASS_ARCHER)) !==
        (UNIT_CLASS_MILITARY | UNIT_CLASS_ARCHER) ||
        definition.attack?.kind !== "projectile")
    ) {
      throw new Error(`${lane.key} must satisfy the ordinary-projectile family contract.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.family === "hero" &&
      ((definition.classes & UNIT_CLASS_HERO) === 0 ||
        definition.hero === undefined ||
        definition.attack === null)
    ) {
      throw new Error(`${lane.key} must satisfy the serial hero family contract.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.family === "myth" &&
      (definition.classes & UNIT_CLASS_MYTH) === 0
    ) {
      throw new Error(`${lane.key} must satisfy the serial myth-unit family contract.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.foundationLanes.some((foundation) =>
        [
          "serial-special-actions",
          "serial-charged-melee-special",
          "serial-area-whirlwind-special",
        ].includes(foundation),
      ) &&
      definition.specialAttack === undefined
    ) {
      throw new Error(`${lane.key} must satisfy its charged special-action foundation.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.foundationLanes.includes("serial-temporary-units") &&
      definition.lifespanTicks === undefined
    ) {
      throw new Error(`${lane.key} must satisfy its temporary-unit foundation.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.foundationLanes.includes("serial-unit-regeneration") &&
      definition.regenerationPerSecond === undefined
    ) {
      throw new Error(`${lane.key} must satisfy its persistent-regeneration foundation.`);
    }

    const reference = unitReferenceEntry(lane.key);
    if (reference !== undefined) validateDefinitionAgainstReference(definition, reference);
  }
}

const imports = entries.map(({ binding, file }) => {
  const modulePath = `../unit-types/${file.replace(/\.ts$/, "")}`;
  return `import { definition as ${binding} } from ${JSON.stringify(modulePath)};`;
});
const unformattedSimSource = `// Generated by scripts/generate-unit-catalogs.ts. Do not edit by hand.
${imports.join("\n")}
import type { TypeCommandRelationship, UnitTypeStats } from "../unit-type-schema";

export const UNIT_TYPE_DEFINITIONS = [
${entries.map(({ binding }) => `  ${binding},`).join("\n")}
] as const satisfies readonly UnitTypeStats[];

const unitTypes: UnitTypeStats[] = [];
const contentKeys = new Set<string>();

for (const definition of UNIT_TYPE_DEFINITIONS) {
  if (unitTypes[definition.id] !== undefined) {
    throw new Error(\`Duplicate unit type id \${definition.id}.\`);
  }
  if (contentKeys.has(definition.key)) {
    throw new Error(\`Duplicate unit content key \${definition.key}.\`);
  }

  unitTypes[definition.id] = definition;
  contentKeys.add(definition.key);
}

export const UNIT_TYPES: readonly UnitTypeStats[] = Object.freeze(unitTypes);

const trainedSlotsByProducer: TypeCommandRelationship[][] = [];
const builtSlotsByWorker: TypeCommandRelationship[][] = [];

function addReverseRelationship(
  catalog: TypeCommandRelationship[][],
  sourceType: number,
  targetType: number,
  commandSlot: number,
): void {
  if (unitTypes[sourceType] === undefined) {
    throw new Error(\`Type \${targetType} references unimplemented type \${sourceType}.\`);
  }
  const entries = (catalog[sourceType] ??= []);
  entries.push({ commandSlot, type: targetType });
}

for (const definition of UNIT_TYPE_DEFINITIONS) {
  for (const relationship of definition.trainedAt) {
    addReverseRelationship(
      trainedSlotsByProducer,
      relationship.type,
      definition.id,
      relationship.commandSlot,
    );
  }
  for (const relationship of definition.builtBy) {
    addReverseRelationship(
      builtSlotsByWorker,
      relationship.type,
      definition.id,
      relationship.commandSlot,
    );
  }
}

function freezeReverseCatalog(
  catalog: TypeCommandRelationship[][],
): readonly (readonly TypeCommandRelationship[] | undefined)[] {
  return Object.freeze(
    catalog.map((entries) =>
      entries === undefined
        ? undefined
        : Object.freeze(
            entries
              .sort((left, right) => left.commandSlot - right.commandSlot)
              .map((entry) => Object.freeze({ ...entry })),
          ),
    ),
  );
}

export const TRAIN_OPTIONS_BY_PRODUCER = freezeReverseCatalog(trainedSlotsByProducer);
export const BUILD_OPTIONS_BY_WORKER = freezeReverseCatalog(builtSlotsByWorker);
`;

interface MediaDefinitionModule {
  readonly definition: UnitMediaDefinition;
}

const mediaFiles = [...glob.scanSync({ cwd: mediaSourceRoot, onlyFiles: true })]
  .filter((file) => !file.endsWith(".test.ts"))
  .sort((left, right) => left.localeCompare(right));
const mediaEntries = await Promise.all(
  mediaFiles.map(async (file) => {
    const moduleUrl = pathToFileURL(resolve(mediaSourceRoot, file)).href;
    const module = (await import(moduleUrl)) as MediaDefinitionModule;
    return { binding: bindingName(file), definition: module.definition, file };
  }),
);
mediaEntries.sort(
  (left, right) =>
    left.definition.type - right.definition.type || left.file.localeCompare(right.file),
);

const mediaIds = new Set<number>();
const mediaKeys = new Set<string>();
const modelsByKey = new Map<string, ModelAssetDefinition>();
const effectKeys = new Set<string>();
const particleParametersByType = new Map<number, readonly ParticleEffectParameters[]>();
for (const entry of mediaEntries) {
  const media = entry.definition;
  if (mediaIds.has(media.type)) throw new Error(`Duplicate media type id ${media.type}.`);
  if (mediaKeys.has(media.key)) throw new Error(`Duplicate media content key ${media.key}.`);
  mediaIds.add(media.type);
  mediaKeys.add(media.key);

  const sim = definitionsById.get(media.type);
  if (sim === undefined)
    throw new Error(`${entry.file} references unimplemented type ${media.type}.`);
  if (sim.key !== media.key) {
    throw new Error(`${entry.file} key ${media.key} does not match sim key ${sim.key}.`);
  }

  for (const model of media.models) {
    if (modelsByKey.has(model.key)) throw new Error(`Duplicate model key ${model.key}.`);
    modelsByKey.set(model.key, model);
  }

  const reference = unitReferenceEntry(media.key);
  const particleEvidence =
    reference?.family === "myth"
      ? [
          ...(reference.source.assetInventory.specialParticles ?? []),
          ...(reference.source.assetInventory.beamParticles ?? []),
        ]
      : [];
  const particleEffects = media.effects ?? [];
  if (particleEffects.length !== particleEvidence.length) {
    throw new Error(`${media.key} particle media and source evidence must match one-for-one.`);
  }

  const compiledParticleParameters: ParticleEffectParameters[] = [];
  for (const effect of particleEffects) {
    if (effectKeys.has(effect.key)) throw new Error(`Duplicate particle effect key ${effect.key}.`);
    effectKeys.add(effect.key);
    const evidence = particleEvidence.find((candidate) => candidate.key === effect.key);
    if (evidence === undefined) {
      throw new Error(`${media.key} particle effect ${effect.key} has no keyed source evidence.`);
    }
    const evidenceTrigger = evidence.trigger ?? "special-attack";
    const effectWindowTicks =
      evidenceTrigger === "poisoned-status" && sim.specialAttack?.kind === "charged-area-poison"
        ? sim.specialAttack.poisonDurationTicks
        : evidenceTrigger === "beam-attack" && sim.attack?.kind === "beam"
          ? sim.attack.cooldownTicks
          : sim.specialAttack?.actionTicks;
    if (
      effect.trigger !== evidenceTrigger ||
      effectWindowTicks === undefined ||
      effect.textureUrl.trim().length === 0 ||
      (effect.additionalTextureUrls?.some((url) => url.trim().length === 0) ?? false) ||
      1 + (effect.additionalTextureUrls?.length ?? 0) !==
        1 + (evidence.additionalTextures?.length ?? 0)
    ) {
      throw new Error(`${media.key} has an invalid particle effect ${effect.key}.`);
    }
    compiledParticleParameters.push(compileParticleEffectParameters(evidence, effectWindowTicks));
  }
  if (compiledParticleParameters.length > 0) {
    particleParametersByType.set(media.type, compiledParticleParameters);
  }
  if (sim.attack?.kind === "beam") {
    const beam = media.beam;
    if (
      beam === undefined ||
      beam.beamTextureUrl.trim().length === 0 ||
      beam.headTextureUrl.trim().length === 0 ||
      beam.blend !== "additive" ||
      beam.startTicks !== sim.attack.impactDelayTicks ||
      beam.endTicks !== sim.attack.cooldownTicks ||
      !Number.isFinite(beam.width) ||
      beam.width <= 0 ||
      !Number.isFinite(beam.headLength) ||
      beam.headLength <= 0 ||
      !Number.isFinite(beam.sourceHeight) ||
      beam.sourceHeight < 0 ||
      !Number.isFinite(beam.targetHeightFactor) ||
      beam.targetHeightFactor < 0 ||
      beam.targetHeightFactor > 1
    ) {
      throw new Error(`${media.key} has an invalid beam presentation.`);
    }
  } else if (media.beam !== undefined) {
    throw new Error(`${media.key} has beam media without a beam attack.`);
  }
}

const projectileMediaIds = new Set<number>();
const projectileMediaKeys = new Set<string>();
for (const media of PROJECTILE_MEDIA_DEFINITIONS) {
  if (
    !Number.isInteger(media.type) ||
    media.type < 0 ||
    media.type >= PROJECTILE_TYPE_COUNT ||
    projectileMediaIds.has(media.type)
  ) {
    throw new Error(`Invalid or duplicate projectile media type ${media.type}.`);
  }
  if (projectileMediaKeys.has(media.key)) {
    throw new Error(`Duplicate projectile media key ${media.key}.`);
  }
  if (
    !Number.isFinite(media.flightHeight) ||
    media.flightHeight < 0 ||
    !Number.isFinite(media.arcHeight) ||
    media.arcHeight < 0
  ) {
    throw new Error(`${media.key} has invalid projectile presentation heights.`);
  }
  if (media.kind === "model") {
    if (media.models.length === 0) {
      throw new Error(`${media.key} projectile media requires at least one model.`);
    }
    for (const model of media.models) {
      if ("attachments" in model) {
        throw new Error(`${media.key} projectile media cannot own model attachments.`);
      }
      if (modelsByKey.has(model.key)) {
        throw new Error(`Duplicate model key ${model.key}.`);
      }
      modelsByKey.set(model.key, model);
    }
  } else if (
    media.kind === "particle" &&
    (media.textureUrl.trim().length === 0 ||
      !Number.isInteger(media.particleCount) ||
      media.particleCount < 1 ||
      !Number.isFinite(media.trailLength) ||
      media.trailLength < 0 ||
      !Number.isFinite(media.baseScale) ||
      media.baseScale <= 0 ||
      !Number.isFinite(media.scaleStart) ||
      !Number.isFinite(media.scaleEnd) ||
      !Number.isFinite(media.peakOpacity) ||
      media.peakOpacity < 0)
  ) {
    throw new Error(`${media.key} has invalid projectile particle media.`);
  } else if (media.kind === "particle") {
    const evidence = entries
      .filter(
        ({ definition }) =>
          definition.attack?.kind === "projectile" &&
          definition.attack.projectile.type === media.type,
      )
      .flatMap(
        ({ definition }) =>
          unitReferenceEntry(definition.key)?.source.assetInventory.attackParticles ?? [],
      )
      .find((particle) => particle.presentation.projectileType === media.type);
    const expected = evidence?.presentation;
    if (
      expected === undefined ||
      expected.kind !== "projectile-trail" ||
      media.flightHeight !== expected.flightHeight ||
      media.arcHeight !== expected.arcHeight ||
      media.particleCount !== expected.particleCount ||
      media.trailLength !== expected.trailLength ||
      media.baseScale !== expected.baseScale ||
      media.scaleStart !== expected.scaleStart ||
      media.scaleEnd !== expected.scaleEnd ||
      media.peakOpacity !== expected.peakOpacity ||
      media.blend !== evidence.blend
    ) {
      throw new Error(`${media.key} does not match its source-bound projectile particle evidence.`);
    }
  }
  projectileMediaIds.add(media.type);
  projectileMediaKeys.add(media.key);
}
if (projectileMediaIds.size !== PROJECTILE_TYPE_COUNT) {
  throw new Error(
    `Projectile media catalog has ${projectileMediaIds.size} entries; expected ${PROJECTILE_TYPE_COUNT}.`,
  );
}

if (requiredLaneName !== undefined) {
  const lane = unitRosterEntry(requiredLaneName);
  if (lane === undefined) throw new Error(`Unknown required unit lane ${requiredLaneName}.`);
  if (lane.status !== "ready") {
    throw new Error(`Required unit lane ${lane.lane} is ${lane.status}; expected ready.`);
  }
  if (definitionsById.get(lane.id) === undefined) {
    throw new Error(`Ready unit lane ${lane.lane} has no sim definition.`);
  }
  if (!mediaEntries.some((entry) => entry.definition.type === lane.id)) {
    throw new Error(`Ready unit lane ${lane.lane} has no media definition.`);
  }
}

for (const entry of entries) {
  const sim = entry.definition;
  const media = mediaEntries.find((candidate) => candidate.definition.type === sim.id)?.definition;
  if (media === undefined && (sim.classes & UNIT_CLASS_RESOURCE) === 0) {
    throw new Error(`${sim.key} has no media definition.`);
  }
}

for (const entry of mediaEntries) {
  const media = entry.definition;
  const sim = definitionsById.get(media.type)!;
  const localModelsByKey = new Set(media.models.map((model) => model.key));
  if (media.presentation.kind === "model") {
    for (const [actionName, action] of Object.entries(media.presentation.actions)) {
      if (
        action.variantValues !== undefined &&
        (action.variantValues.length !== action.models.length ||
          new Set(action.variantValues).size !== action.variantValues.length ||
          action.variantValues.some((value) => !Number.isInteger(value)))
      ) {
        throw new Error(
          `${media.key} action ${actionName} must map one unique integer variant value per model.`,
        );
      }
      if (action.variant === "major-god" && action.variantValues === undefined) {
        throw new Error(`${media.key} action ${actionName} must map its major-god model values.`);
      }
      for (const modelKey of action.models) {
        if (!localModelsByKey.has(modelKey)) {
          throw new Error(
            `${media.key} action ${actionName} must reference a model in the same unit pack: ${modelKey}.`,
          );
        }
      }
    }
  }
  for (const model of media.models) {
    for (const attachment of model.attachments ?? []) {
      if (!localModelsByKey.has(attachment.model)) {
        throw new Error(
          `${model.key} must reference an attachment model in the same unit pack: ${attachment.model}.`,
        );
      }
    }
  }

  const rosterLane = UNIT_ROSTER.find((lane) => lane.id === sim.id);
  const requiresCompleteUnitMedia =
    rosterLane?.status !== "blocked" &&
    (rosterLane?.family === "ordinary-melee" ||
      rosterLane?.family === "ordinary-projectile" ||
      rosterLane?.family === "hero" ||
      rosterLane?.family === "myth");
  if (requiresCompleteUnitMedia) {
    if (media.presentation.kind !== "model") {
      throw new Error(`${media.key} requires model presentation for its ordinary-unit gate.`);
    }
    const requiredActions =
      sim.attack === null
        ? (["idle", "walk", "death"] as const)
        : (["idle", "walk", "attack", "death"] as const);
    for (const action of requiredActions) {
      if (media.presentation.actions[action] === undefined) {
        throw new Error(`${media.key} is missing required ${action} action.`);
      }
    }
    if (
      media.icon === null ||
      media.audio.selection === undefined ||
      media.audio.acknowledge === undefined ||
      (sim.attack !== null && media.audio.attackAcknowledge === undefined)
    ) {
      throw new Error(`${media.key} is missing required ordinary-unit icon or voice audio.`);
    }
    if (
      rosterLane?.family === "hero" &&
      (sim.hero?.relicCapacity ?? 0) > 0 &&
      (media.presentation.actions.carryIdle === undefined ||
        media.presentation.actions.carryWalk === undefined)
    ) {
      throw new Error(`${media.key} is missing required relic-carry presentation.`);
    }
    if (sim.specialAttack !== undefined && media.presentation.actions.specialAttack === undefined) {
      throw new Error(`${media.key} is missing required charged special-attack presentation.`);
    }
  }
}

const mediaImports = mediaEntries.map(({ binding, file }) => {
  const modulePath = `../unit-media/${file.replace(/\.ts$/, "")}`;
  return `import { definition as ${binding} } from ${JSON.stringify(modulePath)};`;
});
const particleParameterSource = JSON.stringify(
  Object.fromEntries(
    [...particleParametersByType.entries()].sort(([left], [right]) => left - right),
  ),
  null,
  2,
);
const unformattedMediaSource = `// Generated by scripts/generate-unit-catalogs.ts. Do not edit by hand.
${mediaImports.join("\n")}
import { PROJECTILE_MEDIA_DEFINITIONS } from "../projectile-media";
import type {
  BeamEffectMediaDefinition,
  IconConfig,
  ModelAssetDefinition,
  ParticleEffectDefinition,
  RuntimeProjectilePresentation,
  RuntimeModelActionDefinition,
  RuntimeModelAssetDefinition,
  RuntimeModelUnitPresentation,
  RuntimeUnitPresentation,
  UnitMediaAction,
  UnitMediaDefinition,
  UnitPresentation,
} from "../unit-media-schema";

export const UNIT_MEDIA_DEFINITIONS = [
${mediaEntries.map(({ binding }) => `  ${binding},`).join("\n")}
] as const satisfies readonly UnitMediaDefinition[];

type ParticleEffectParameters = Omit<
  ParticleEffectDefinition,
  "key" | "trigger" | "textureUrl" | "appearanceWeightStart" | "appearanceWeightEnd"
> & { readonly appearanceWeights: readonly number[] };
const PARTICLE_EFFECT_PARAMETERS_BY_TYPE: Readonly<
  Record<number, readonly ParticleEffectParameters[]>
> = ${particleParameterSource};

const unitMedia: UnitMediaDefinition[] = [];
const authoredModelConfigs: ModelAssetDefinition[] = [];
const modelIndex: Record<string, number> = {};

for (const definition of UNIT_MEDIA_DEFINITIONS) {
  if (unitMedia[definition.type] !== undefined) {
    throw new Error(\`Duplicate media type id \${definition.type}.\`);
  }
  unitMedia[definition.type] = definition;

  for (const model of definition.models) {
    if (modelIndex[model.key] !== undefined) {
      throw new Error(\`Duplicate model key \${model.key}.\`);
    }
    modelIndex[model.key] = authoredModelConfigs.length;
    authoredModelConfigs.push(model);
  }
}

for (const definition of PROJECTILE_MEDIA_DEFINITIONS) {
  if (definition.kind !== "model") continue;
  for (const model of definition.models) {
    if (modelIndex[model.key] !== undefined) {
      throw new Error(\`Duplicate model key \${model.key}.\`);
    }
    modelIndex[model.key] = authoredModelConfigs.length;
    authoredModelConfigs.push(model);
  }
}

const modelConfigs: RuntimeModelAssetDefinition[] = authoredModelConfigs.map((model) => ({
  key: model.key,
  url: model.url,
  grounded: model.grounded,
  ...(model.attachments === undefined
    ? {}
    : {
        attachments: model.attachments.map((attachment) => ({
          modelIndex: modelIndex[attachment.model]!,
          targetNode: attachment.targetNode,
          hotspotNode: attachment.hotspotNode,
        })),
      }),
}));

function compilePresentation(presentation: UnitPresentation): RuntimeUnitPresentation {
  if (presentation.kind === "sprite") return presentation;

  const actions: Partial<Record<UnitMediaAction, RuntimeModelActionDefinition>> = {};
  for (const [name, action] of Object.entries(presentation.actions)) {
    actions[name as UnitMediaAction] = {
      modelIndices: action.models.map((model) => modelIndex[model]!) as [number, ...number[]],
      animationClock: action.animationClock,
      variant: action.variant,
      ...(action.variantValues === undefined ? {} : { variantValues: action.variantValues }),
    };
  }

  return {
    ...presentation,
    actions: actions as RuntimeModelUnitPresentation["actions"],
  };
}

const presentations: RuntimeUnitPresentation[] = [];
const icons: (IconConfig | undefined)[] = [];
const beamPresentations: (BeamEffectMediaDefinition | undefined)[] = [];
for (const definition of UNIT_MEDIA_DEFINITIONS) {
  presentations[definition.type] = compilePresentation(definition.presentation);
  icons[definition.type] = definition.icon ?? undefined;
  beamPresentations[definition.type] = (definition as UnitMediaDefinition).beam;
}

const projectilePresentations: RuntimeProjectilePresentation[] = [];
for (const definition of PROJECTILE_MEDIA_DEFINITIONS) {
  projectilePresentations[definition.type] =
    definition.kind === "model"
      ? {
          kind: "model",
          modelIndices: definition.models.map((model) => modelIndex[model.key]!) as [
            number,
            ...number[],
          ],
          flightHeight: definition.flightHeight,
          arcHeight: definition.arcHeight,
          forwardAxis: definition.forwardAxis,
        }
      : definition;
}

const particleEffectDefinitions: ParticleEffectDefinition[] = [];
const unitParticleEffectIndices: (readonly number[] | undefined)[] = [];
const poisonStatusParticleEffectIndices: number[] = [];
let maxSpecialParticlesPerUnit = 0;
let poisonStatusParticlesPerUnit = 0;
for (const definition of UNIT_MEDIA_DEFINITIONS) {
  const effects = (definition as UnitMediaDefinition).effects ?? [];
  const parameters = PARTICLE_EFFECT_PARAMETERS_BY_TYPE[definition.type] ?? [];
  if (effects.length !== parameters.length) {
    throw new Error(\`Generated particle parameters do not match \${definition.key}.\`);
  }
  const indices: number[] = [];
  let particlesForUnit = 0;
  for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
    const media = effects[effectIndex]!;
    const parametersForEffect = parameters[effectIndex]!;
    const urls = [media.textureUrl, ...(media.additionalTextureUrls ?? [])];
    const totalWeight = parametersForEffect.appearanceWeights.reduce(
      (total, weight) => total + weight,
      0,
    );
    let cumulativeWeight = 0;
    for (let appearanceIndex = 0; appearanceIndex < urls.length; appearanceIndex += 1) {
      const appearanceWeightStart = cumulativeWeight / totalWeight;
      cumulativeWeight += parametersForEffect.appearanceWeights[appearanceIndex]!;
      const { appearanceWeights: _, ...runtimeParameters } = parametersForEffect;
      indices.push(particleEffectDefinitions.length);
      if (media.trigger === "poisoned-status") {
        poisonStatusParticleEffectIndices.push(particleEffectDefinitions.length);
      }
      particleEffectDefinitions.push({
        key: appearanceIndex === 0 ? media.key : \`\${media.key}:\${appearanceIndex}\`,
        trigger: media.trigger,
        textureUrl: urls[appearanceIndex]!,
        appearanceWeightStart,
        appearanceWeightEnd: cumulativeWeight / totalWeight,
        ...runtimeParameters,
      });
    }
    if (media.trigger !== "poisoned-status") {
      particlesForUnit += parametersForEffect.maxParticles;
    } else {
      poisonStatusParticlesPerUnit += parametersForEffect.maxParticles;
    }
  }
  if (indices.length > 0) unitParticleEffectIndices[definition.type] = Object.freeze(indices);
  maxSpecialParticlesPerUnit = Math.max(maxSpecialParticlesPerUnit, particlesForUnit);
}

export const UNIT_MEDIA: readonly UnitMediaDefinition[] = Object.freeze(unitMedia);
export const UNIT_PRESENTATIONS: readonly RuntimeUnitPresentation[] = Object.freeze(presentations);
export const PROJECTILE_PRESENTATIONS: readonly RuntimeProjectilePresentation[] = Object.freeze(projectilePresentations);
export const MODEL_CONFIGS: readonly RuntimeModelAssetDefinition[] = Object.freeze(modelConfigs);
export const TYPE_ICONS: readonly (IconConfig | undefined)[] = Object.freeze(icons);
export const BEAM_PRESENTATIONS: readonly (BeamEffectMediaDefinition | undefined)[] = Object.freeze(beamPresentations);
export const PARTICLE_EFFECT_DEFINITIONS: readonly ParticleEffectDefinition[] = Object.freeze(particleEffectDefinitions);
export const UNIT_PARTICLE_EFFECT_INDICES: readonly (readonly number[] | undefined)[] = Object.freeze(unitParticleEffectIndices);
export const POISON_STATUS_PARTICLE_EFFECT_INDICES: readonly number[] = Object.freeze(poisonStatusParticleEffectIndices);
export const MAX_PARTICLES_PER_UNIT = maxSpecialParticlesPerUnit + poisonStatusParticlesPerUnit;
`;

async function formattedSource(name: string, unformatted: string): Promise<string> {
  const temporaryPath = resolve(tmpdir(), `aom-${name}-${process.pid}.ts`);
  await Bun.write(temporaryPath, unformatted);
  const formatter = Bun.spawnSync([resolve(root, "node_modules/.bin/oxfmt"), temporaryPath], {
    cwd: root,
  });
  if (formatter.exitCode !== 0) throw new Error(formatter.stderr.toString());
  const source = await Bun.file(temporaryPath).text();
  unlinkSync(temporaryPath);
  return source;
}

async function writeOrCheck(outputPath: string, source: string): Promise<boolean> {
  if (validateOnly) return true;
  const current = await Bun.file(outputPath)
    .text()
    .catch(() => "");
  if (check) {
    if (current === source) return true;
    console.error(`${relative(root, outputPath)} is stale. Run bun run generate:unit-catalogs.`);
    return false;
  }
  if (current !== source) await Bun.write(outputPath, source);
  return true;
}

const simSource = await formattedSource("unit-types", unformattedSimSource);
const mediaSource = await formattedSource("unit-media", unformattedMediaSource);
const results = await Promise.all([
  writeOrCheck(simOutputPath, simSource),
  writeOrCheck(mediaOutputPath, mediaSource),
]);
if (results.includes(false)) process.exit(1);
