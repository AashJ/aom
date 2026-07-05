import { describe, expect, test } from "bun:test";
import { createWorld, hashWorld, spawnUnit, tickWorld, type World } from "@aom/sim";
import { createLoopbackSink, INPUT_DELAY_TICKS } from "./sink";

// Walkability is flattened so these tests exercise sink scheduling, not the map.
function flatWorld(seed: number): World {
  const world = createWorld(seed);
  world.walkable.fill(1);
  return world;
}

describe("loopback command sink", () => {
  test("a move submitted now executes exactly INPUT_DELAY_TICKS later", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);
    const sink = createLoopbackSink(world);

    sink.submitMove([id], 40, 10);

    // Commands apply at the START of their stamped tick: a command stamped
    // tick 4 is untouched by the tickWorld calls that advance 0->1..3->4 and
    // first applies during the call that begins at tick 4 (the fifth call).
    for (let i = 0; i < INPUT_DELAY_TICKS; i += 1) {
      tickWorld(world);
      expect(world.posX[id]).toBe(10);
      expect(world.moving[id]).toBe(0);
    }

    tickWorld(world);
    expect(world.moving[id]).toBe(1);
    expect(world.posX[id]!).toBeGreaterThan(10);
  });

  test("a stop takes effect after the same delay, not immediately", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);
    const sink = createLoopbackSink(world);

    sink.submitMove([id], 100, 10);

    // Let the move engage and travel a bit.
    for (let i = 0; i < INPUT_DELAY_TICKS + 10; i += 1) {
      tickWorld(world);
    }

    expect(world.moving[id]).toBe(1);
    sink.submitStop([id]);

    // The unit must keep walking through the delay window...
    for (let i = 0; i < INPUT_DELAY_TICKS; i += 1) {
      const before = world.posX[id]!;
      tickWorld(world);
      expect(world.posX[id]!).toBeGreaterThan(before);
    }

    // ...and freeze once the stop lands.
    tickWorld(world);
    expect(world.moving[id]).toBe(0);

    const frozenX = world.posX[id]!;
    tickWorld(world);
    expect(world.posX[id]).toBe(frozenX);
  });

  test("the sink stamps against the world's CURRENT tick, not submission count", () => {
    const world = flatWorld(42);
    const id = spawnUnit(world, 10, 10, 0, 0);
    const sink = createLoopbackSink(world);

    // Advance far from tick 0 first; a sink that stamped from a stale or
    // internal counter would schedule into the past (applying instantly).
    for (let i = 0; i < 50; i += 1) {
      tickWorld(world);
    }

    sink.submitMove([id], 40, 10);
    tickWorld(world);
    expect(world.moving[id]).toBe(0);
  });

  test("two worlds fed identical submissions at identical ticks stay hash-identical", () => {
    const build = (): { world: World; ids: number[] } => {
      const world = flatWorld(7);
      const ids: number[] = [];

      for (let i = 0; i < 50; i += 1) {
        ids.push(spawnUnit(world, 30 + (i % 10), 30 + Math.floor(i / 10), 0, 0));
      }

      return { world, ids };
    };
    const a = build();
    const b = build();
    const sinkA = createLoopbackSink(a.world);
    const sinkB = createLoopbackSink(b.world);

    for (let t = 0; t < 150; t += 1) {
      // Scripted submissions keyed off the tick counter, mirrored to both.
      if (t === 5) {
        sinkA.submitMove(a.ids, 120, 60);
        sinkB.submitMove(b.ids, 120, 60);
      }

      if (t === 40) {
        sinkA.submitStop(a.ids.slice(0, 25));
        sinkB.submitStop(b.ids.slice(0, 25));
      }

      if (t === 60) {
        sinkA.submitMove(a.ids.slice(0, 25), 60, 120);
        sinkB.submitMove(b.ids.slice(0, 25), 60, 120);
      }

      tickWorld(a.world);
      tickWorld(b.world);
      expect(hashWorld(a.world)).toBe(hashWorld(b.world));
    }
  });
});
