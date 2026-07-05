import { describe, expect, test } from "bun:test";
import {
  COMMAND_MOVE,
  COMMAND_STOP,
  createWorld,
  enqueueCommand,
  hashWorld,
  spawnUnit,
  tickWorld,
  type World,
} from "@aom/sim";
import { createSequencer } from "./sequencer";
import { addPlayer, createRoom, isHost, removePlayer, startRoom } from "./room";
import type { WireCommand } from "./protocol";

function move(unitIds: number[], targetX: number, targetZ: number): WireCommand {
  return { type: COMMAND_MOVE, unitIds, targetX, targetZ };
}

describe("sequencer", () => {
  test("orders a turn by playerId, preserving arrival order within a player", () => {
    const seq = createSequencer();

    // Arrival order deliberately scrambled across players.
    seq.submit(1, [move([1], 10, 10)]);
    seq.submit(0, [move([0], 20, 20)]);
    seq.submit(1, [move([2], 30, 30)]);

    const { turn, commands } = seq.closeTurn();

    expect(turn).toBe(0);
    expect(commands.map((c) => c.playerId)).toEqual([0, 1, 1]);
    // Player 1's two submissions must keep their arrival order (stable sort).
    expect(commands[1]!.command.unitIds).toEqual([1]);
    expect(commands[2]!.command.unitIds).toEqual([2]);
  });

  test("turn numbers are consecutive and pending drains each close", () => {
    const seq = createSequencer();

    seq.submit(0, [move([0], 5, 5)]);
    expect(seq.closeTurn().commands.length).toBe(1);

    // An empty turn is normal — it is the "you may advance" token.
    const empty = seq.closeTurn();
    expect(empty.turn).toBe(1);
    expect(empty.commands).toEqual([]);

    expect(seq.closeTurn().turn).toBe(2);
  });
});

describe("room", () => {
  test("join, host migration, start, and the closed-after-start rule", () => {
    const room = createRoom("abc", 1337);

    const first = addPlayer(room, "aash");
    const second = addPlayer(room, "rival");

    expect(first!.player.id).toBe(0);
    expect(second!.player.id).toBe(1);
    expect(second!.joined).toMatchObject({
      kind: "joined",
      playerId: 1,
      players: [
        { id: 0, name: "aash" },
        { id: 1, name: "rival" },
      ],
    });
    expect(second!.playerJoined).toMatchObject({ kind: "playerJoined", player: { id: 1 } });

    expect(isHost(room, 0)).toBe(true);
    expect(removePlayer(room, 0)).toMatchObject({ kind: "playerLeft", playerId: 0 });
    // Host migrates to the lowest remaining id.
    expect(isHost(room, 1)).toBe(true);

    const begin = startRoom(room, 20);
    expect(begin).toMatchObject({ kind: "begin", seed: 1337, hashIntervalTicks: 20 });

    // Started rooms reject both late joins and double starts.
    expect(addPlayer(room, "latecomer")).toBeNull();
    expect(startRoom(room, 20)).toBeNull();
  });
});

describe("fake-relay lockstep integration", () => {
  // The M4 spine test: two worlds ("two clients"), ONE real sequencer between
  // them. Commands flow client -> sequencer -> broadcast turn -> both worlds,
  // executing at tick = turn number. If the pipeline is sound, the worlds stay
  // bit-identical forever.
  test("two players' interleaved commands keep two worlds hash-identical", () => {
    const spawn = (world: World): { p0: number[]; p1: number[] } => {
      const p0: number[] = [];
      const p1: number[] = [];

      for (let i = 0; i < 30; i += 1) {
        p0.push(spawnUnit(world, 30 + (i % 6), 30 + Math.floor(i / 6), 0, 0));
      }

      for (let i = 0; i < 30; i += 1) {
        p1.push(spawnUnit(world, 200 + (i % 6), 200 + Math.floor(i / 6), 0, 0));
      }

      return { p0, p1 };
    };

    const worldA = createWorld(1337);
    const worldB = createWorld(1337);
    worldA.walkable.fill(1);
    worldB.walkable.fill(1);
    const ids = spawn(worldA);
    const idsB = spawn(worldB);

    expect(idsB).toEqual(ids);

    const seq = createSequencer();

    for (let t = 0; t < 250; t += 1) {
      // Scripted player behavior, keyed off the shared turn clock. On turn 5
      // BOTH players act, with player 1's submission arriving first — the
      // sequencer's playerId ordering is what keeps the worlds agreeing.
      if (t === 5) {
        seq.submit(1, [move(ids.p1, 60, 120)]);
        seq.submit(0, [move(ids.p0, 120, 60)]);
      }

      if (t === 50) {
        seq.submit(1, [{ type: COMMAND_STOP, unitIds: ids.p1.slice(0, 15) }]);
      }

      if (t === 80) {
        seq.submit(0, [move(ids.p0.slice(0, 10), 40, 200)]);
      }

      const { turn, commands } = seq.closeTurn();

      expect(turn).toBe(t);

      // The broadcast: every client stamps turn commands for tick = turn and
      // applies them through the same public seam the game uses.
      for (const world of [worldA, worldB]) {
        for (const pc of commands) {
          enqueueCommand(world, { ...pc.command, tick: turn });
        }
      }

      tickWorld(worldA);
      tickWorld(worldB);
      expect(hashWorld(worldA)).toBe(hashWorld(worldB));
    }

    // Sanity that the script actually did something: both player groups moved.
    expect(worldA.posX[ids.p0[29]!]).not.toBe(30 + (29 % 6));
    expect(worldA.posX[ids.p1[0]!]).not.toBe(200);
  });
});
