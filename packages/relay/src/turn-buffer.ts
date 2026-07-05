// Turn numbers ARE tick numbers: the sequencer starts at turn 0 and worlds start at tick 0.
// The gate below is what makes lockstep lockstep: a client may not simulate a tick it has not
// received the turn for.
import { enqueueCommand, type World } from "@aom/sim";
import type { PlayerCommand } from "./protocol";

export interface TurnBuffer {
  push(turn: number, commands: PlayerCommand[]): void;
  has(tick: number): boolean;
  applyTo(world: World, tick: number): void;
  latestReceived(): number;
}

export function createTurnBuffer(): TurnBuffer {
  const turns = new Map<number, PlayerCommand[]>();
  let latest = -1;

  return {
    push(turn: number, commands: PlayerCommand[]): void {
      // Duplicate pushes overwrite harmlessly: the server never re-broadcasts differing content for a turn.
      turns.set(turn, commands);
      latest = Math.max(latest, turn);
    },

    has(tick: number): boolean {
      return turns.has(tick);
    },

    applyTo(world: World, tick: number): void {
      const commands = turns.get(tick);
      if (commands === undefined) {
        // Callers must gate on has() first; applying an absent turn is a programming error, not a network condition.
        throw new Error(`Missing turn ${tick}.`);
      }

      for (const pc of commands) {
        // The execution tick is stamped HERE, from the turn number: wire commands are tickless by design.
        enqueueCommand(world, { ...pc.command, tick });
      }

      // Drained turns do not accumulate.
      turns.delete(tick);
    },

    latestReceived(): number {
      return latest;
    },
  };
}
