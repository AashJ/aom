import { relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { unlinkSync } from "node:fs";
import {
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

  const requiredClass = kind === "trainedAt" ? UNIT_CLASS_BUILDING : UNIT_CLASS_WORKER;
  if ((source.classes & requiredClass) === 0) {
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
    (!Number.isInteger(definition.hero.trainLimit) ||
      definition.hero.trainLimit < 1 ||
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
      special.impactDelayTicks >= special.actionTicks ||
      special.validTargets.length === 0)
  ) {
    throw new Error(`${definition.key} has an invalid charged special-attack contract.`);
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
    !isResource &&
    !isBuilding &&
    definition.populationCost > 0 &&
    definition.buildTicks > 0 &&
    definition.trainedAt.length === 0
  ) {
    throw new Error(`${definition.key} is trainable but declares no trainedAt source.`);
  }
  if (isBuilding && definition.footprint > 0 && definition.builtBy.length === 0) {
    throw new Error(`${definition.key} is buildable but declares no builtBy source.`);
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
      ((definition.classes & UNIT_CLASS_MYTH) === 0 || definition.attack === null)
    ) {
      throw new Error(`${lane.key} must satisfy the serial myth-unit family contract.`);
    }
    if (
      lane.status !== "blocked" &&
      lane.foundationLanes.includes("serial-special-actions") &&
      definition.specialAttack === undefined
    ) {
      throw new Error(`${lane.key} must satisfy its charged special-action foundation.`);
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
  if ("attachments" in media.model) {
    throw new Error(`${media.key} projectile media cannot own model attachments.`);
  }
  if (modelsByKey.has(media.model.key)) {
    throw new Error(`Duplicate model key ${media.model.key}.`);
  }
  projectileMediaIds.add(media.type);
  projectileMediaKeys.add(media.key);
  modelsByKey.set(media.model.key, media.model);
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
    for (const action of ["idle", "walk", "attack", "death"] as const) {
      if (media.presentation.actions[action] === undefined) {
        throw new Error(`${media.key} is missing required ${action} action.`);
      }
    }
    if (
      media.icon === null ||
      media.audio.selection === undefined ||
      media.audio.acknowledge === undefined ||
      media.audio.attackAcknowledge === undefined
    ) {
      throw new Error(`${media.key} is missing required ordinary-unit icon or voice audio.`);
    }
    if (
      rosterLane?.family === "hero" &&
      (media.presentation.actions.carryIdle === undefined ||
        media.presentation.actions.carryWalk === undefined)
    ) {
      throw new Error(`${media.key} is missing required relic-carry presentation.`);
    }
    if (
      sim.specialAttack !== undefined &&
      (media.presentation.actions.specialAttack === undefined ||
        media.audio.specialAttack === undefined)
    ) {
      throw new Error(`${media.key} is missing required charged special-attack media.`);
    }
  }
}

const mediaImports = mediaEntries.map(({ binding, file }) => {
  const modulePath = `../unit-media/${file.replace(/\.ts$/, "")}`;
  return `import { definition as ${binding} } from ${JSON.stringify(modulePath)};`;
});
const unformattedMediaSource = `// Generated by scripts/generate-unit-catalogs.ts. Do not edit by hand.
${mediaImports.join("\n")}
import { PROJECTILE_MEDIA_DEFINITIONS } from "../projectile-media";
import type {
  IconConfig,
  ModelAssetDefinition,
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
  if (modelIndex[definition.model.key] !== undefined) {
    throw new Error(\`Duplicate model key \${definition.model.key}.\`);
  }
  modelIndex[definition.model.key] = authoredModelConfigs.length;
  authoredModelConfigs.push(definition.model);
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
    };
  }

  return {
    ...presentation,
    actions: actions as RuntimeModelUnitPresentation["actions"],
  };
}

const presentations: RuntimeUnitPresentation[] = [];
const icons: (IconConfig | undefined)[] = [];
for (const definition of UNIT_MEDIA_DEFINITIONS) {
  presentations[definition.type] = compilePresentation(definition.presentation);
  icons[definition.type] = definition.icon ?? undefined;
}

const projectilePresentations: RuntimeProjectilePresentation[] = [];
for (const definition of PROJECTILE_MEDIA_DEFINITIONS) {
  projectilePresentations[definition.type] = {
    modelIndex: modelIndex[definition.model.key]!,
    flightHeight: definition.flightHeight,
    arcHeight: definition.arcHeight,
    forwardAxis: definition.forwardAxis,
  };
}

export const UNIT_MEDIA: readonly UnitMediaDefinition[] = Object.freeze(unitMedia);
export const UNIT_PRESENTATIONS: readonly RuntimeUnitPresentation[] = Object.freeze(presentations);
export const PROJECTILE_PRESENTATIONS: readonly RuntimeProjectilePresentation[] = Object.freeze(projectilePresentations);
export const MODEL_CONFIGS: readonly RuntimeModelAssetDefinition[] = Object.freeze(modelConfigs);
export const TYPE_ICONS: readonly (IconConfig | undefined)[] = Object.freeze(icons);
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
