import { describe, expect, test } from "bun:test";
import { COMMAND_GARRISON, COMMAND_UNGARRISON, enqueueCommand } from "../../../commands";
import { countGarrisonedUnits } from "../../../ecs/garrison";
import { registerPlayer } from "../../../ecs/players";
import { NO_TARGET } from "../../../ecs/unit-tasks";
import { createWorld, killUnit, resolveId, spawnUnit, tickWorld } from "../../../ecs/world";
import { MAP_TILES } from "../../../terrain";
import { UNIT_CLASS_SHIP, UNIT_CLASS_TRANSPORT_SHIP } from "../../unit-type-schema";
import { unitReferenceEntry } from "../../unit-references";
import { validateDefinitionAgainstReference } from "../../unit-reference-schema";
import {
  TYPE_EGYPTIAN_TRANSPORT_SHIP,
  TYPE_GREEK_TRANSPORT_SHIP,
  TYPE_HOPLITE,
} from "../../unit-type-ids";
import { definition as egyptianDefinition } from "../egyptian/transport-ship";
import { definition } from "./transport-ship";

function shorelineWorld() {
  const world = createWorld(472);
  world.walkable.fill(0);
  world.waterNavigable.fill(1);
  world.waterWalkable.fill(1);
  for (let z = 0; z < MAP_TILES; z += 1) {
    for (let x = 0; x <= 10; x += 1) {
      world.walkable[z * MAP_TILES + x] = 1;
      world.waterNavigable[z * MAP_TILES + x] = 0;
      world.waterWalkable[z * MAP_TILES + x] = 0;
    }
  }
  registerPlayer(world, 0);
  return world;
}

describe("Classic transport-ship unit packs", () => {
  test("match both integration-owned naval references and shared launch row", () => {
    for (const candidate of [definition, egyptianDefinition]) {
      expect(() =>
        validateDefinitionAgainstReference(candidate, unitReferenceEntry(candidate.key)!),
      ).not.toThrow();
      expect(candidate).toMatchObject({
        classes: UNIT_CLASS_SHIP | UNIT_CLASS_TRANSPORT_SHIP,
        maxHp: 180,
        lineOfSight: 14,
        movementSpeed: 5.3,
        armor: [0.4, 0.8, 0.05],
        costWood: 120,
        buildTicks: 380,
        populationCost: 2,
        attack: null,
        garrison: { capacity: 10, enterRange: 4, ejectOnDeath: false },
      });
    }
  });

  test("boards land units across the shoreline and unloads only onto land", () => {
    const world = shorelineWorld();
    const transport = spawnUnit(world, 11.5, 40.5, 0, 0, 0, TYPE_GREEK_TRANSPORT_SHIP);
    const hoplite = spawnUnit(world, 10.5, 40.5, 0, 0, 0, TYPE_HOPLITE);
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: [hoplite],
      targetId: transport,
    });
    tickWorld(world);
    expect(world.containedBy[resolveId(world, hoplite)]).toBe(transport);

    const transportIndex = resolveId(world, transport);
    world.posX[transportIndex] = 40.5;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_UNGARRISON,
      containerId: transport,
    });
    tickWorld(world);
    expect(world.containedBy[resolveId(world, hoplite)]).toBe(transport);

    world.posX[transportIndex] = 11.5;
    enqueueCommand(world, {
      tick: world.tick,
      issuer: 0,
      type: COMMAND_UNGARRISON,
      containerId: transport,
    });
    tickWorld(world);
    const released = resolveId(world, hoplite);
    expect(world.containedBy[released]).toBe(NO_TARGET);
    expect(
      world.walkable[
        Math.floor(world.posZ[released]!) * MAP_TILES + Math.floor(world.posX[released]!)
      ],
    ).toBe(1);
  });

  test("enforces ten cargo slots and sinks embarked units with the ship", () => {
    const world = shorelineWorld();
    const transport = spawnUnit(world, 11.5, 80.5, 0, 0, 0, TYPE_EGYPTIAN_TRANSPORT_SHIP);
    const occupants = Array.from({ length: 11 }, (_, index) =>
      spawnUnit(world, 10.5, 80.1 + index * 0.05, 0, 0, 0, TYPE_HOPLITE),
    );
    enqueueCommand(world, {
      tick: 0,
      issuer: 0,
      type: COMMAND_GARRISON,
      unitIds: occupants,
      targetId: transport,
    });
    tickWorld(world);
    expect(countGarrisonedUnits(world, resolveId(world, transport))).toBe(10);

    const embarked = occupants.filter(
      (id) => world.containedBy[resolveId(world, id)] === transport,
    );
    const leftBehind = occupants.find(
      (id) => world.containedBy[resolveId(world, id)] !== transport,
    )!;
    killUnit(world, resolveId(world, transport), true);
    tickWorld(world);
    expect(resolveId(world, transport)).toBe(-1);
    for (const id of embarked) expect(resolveId(world, id)).toBe(-1);
    expect(resolveId(world, leftBehind)).toBeGreaterThanOrEqual(0);
  });
});
