// The CommandSink seam from ARCHITECTURE.md M4 — callers say WHAT (move these units there),
// the sink owns WHEN (tick stamping) and later HOW (wire encoding). Single-player uses the
// loopback sink below; M4's relay sink implements the same interface and swaps in without
// touching callers. Per-verb methods instead of a generic submit(command): call sites stay
// fully typed and the sink builds the Command object, which is exactly the shape a wire
// encoder wants anyway.
import { COMMAND_MOVE, COMMAND_STOP, enqueueCommand, type World } from "@aom/sim";

// 200 ms at 20 Hz — the genre-native order-acknowledgement delay; in multiplayer this is
// the window a command needs to reach every player before its execution tick. Single-player
// adopts the same delay NOW so the game's feel doesn't change when networking arrives.
export const INPUT_DELAY_TICKS = 4;

export interface CommandSink {
  submitMove(unitIds: number[], targetX: number, targetZ: number): void;
  submitStop(unitIds: number[]): void;
}

export function createLoopbackSink(world: World): CommandSink {
  return {
    submitMove(unitIds: number[], targetX: number, targetZ: number): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        type: COMMAND_MOVE,
        unitIds,
        targetX,
        targetZ,
      });
    },
    submitStop(unitIds: number[]): void {
      enqueueCommand(world, {
        tick: world.tick + INPUT_DELAY_TICKS,
        type: COMMAND_STOP,
        unitIds,
      });
    },
  };
}
