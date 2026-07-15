// The CommandSink seam from ARCHITECTURE.md M4 — callers say WHAT (move these units there),
// the sink owns WHEN (tick stamping) and later HOW (wire encoding). Single-player uses the
// loopback sink below; M4's relay sink implements the same interface and swaps in without
// touching callers. Per-verb methods instead of a generic submit(command): call sites stay
// fully typed and the sink builds the Command object, which is exactly the shape a wire
// encoder wants anyway.
import {
  COMMAND_ADVANCE_AGE,
  COMMAND_ATTACK,
  COMMAND_BUILD,
  COMMAND_CHEAT,
  COMMAND_GATHER,
  COMMAND_MOVE,
  COMMAND_PLACE,
  COMMAND_STOP,
  COMMAND_TRAIN,
  enqueueCommand,
  type CheatId,
  type World,
} from "@aom/sim";

// 200 ms at 20 Hz — the genre-native order-acknowledgement delay; in multiplayer this is
// the window a command needs to reach every player before its execution tick. Single-player
// adopts the same delay NOW so the game's feel doesn't change when networking arrives.
export const INPUT_DELAY_TICKS = 4;

export interface CommandSink {
  submitMove(unitIds: number[], targetX: number, targetZ: number): void;
  submitStop(unitIds: number[]): void;
  submitAttack(unitIds: number[], targetId: number): void;
  submitGather(unitIds: number[], targetId: number): void;
  submitBuild(unitIds: number[], targetId: number): void;
  submitTrain(buildingId: number, unitType: number): void;
  submitAdvanceAge(buildingId: number, minorGod: number): void;
  submitCheat(cheat: CheatId): void;
  submitPlace(buildingType: number, tileX: number, tileZ: number): void;
}

export function createLoopbackSink(world: World): CommandSink {
  return {
    submitMove(unitIds: number[], targetX: number, targetZ: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_MOVE,
        unitIds,
        targetX,
        targetZ,
      });
    },
    submitStop(unitIds: number[]): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_STOP,
        unitIds,
      });
    },
    submitAttack(unitIds: number[], targetId: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_ATTACK,
        unitIds,
        targetId,
      });
    },
    submitGather(unitIds: number[], targetId: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_GATHER,
        unitIds,
        targetId,
      });
    },
    submitBuild(unitIds: number[], targetId: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_BUILD,
        unitIds,
        targetId,
      });
    },
    submitTrain(buildingId: number, unitType: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_TRAIN,
        buildingId,
        unitType,
      });
    },
    submitAdvanceAge(buildingId: number, minorGod: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        issuer: 0,
        type: COMMAND_ADVANCE_AGE,
        buildingId,
        minorGod,
      });
    },
    submitCheat(cheat: CheatId): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        issuer: 0,
        type: COMMAND_CHEAT,
        cheat,
      });
    },
    submitPlace(buildingType: number, tileX: number, tileZ: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        // Single-player is player 0 and owns everything spawned by default.
        issuer: 0,
        type: COMMAND_PLACE,
        buildingType,
        tileX,
        tileZ,
      });
    },
  };
}
