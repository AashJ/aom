// Authoritative command orderer: turn N's broadcast content IS the canonical
// order every client applies at tick N. Commands are assigned to the next
// unclosed turn on arrival; no client-side execution time is trusted. This stays
// transport-free so tests drive it in-process: the fake relay is this code.
import type { PlayerCommand, WireCommand } from "./protocol";

export interface Sequencer {
  submit(playerId: number, commands: WireCommand[]): void;
  closeTurn(): { turn: number; commands: PlayerCommand[] };
}

export function createSequencer(): Sequencer {
  let turn = 0;
  let pending: PlayerCommand[] = [];

  return {
    submit(playerId: number, commands: WireCommand[]): void {
      for (const command of commands) {
        pending.push({ playerId, command });
      }
    },

    closeTurn(): { turn: number; commands: PlayerCommand[] } {
      // Empty turns are normal and meaningful: an empty turn is the "you may
      // advance" token.
      // Array.prototype.sort is spec-guaranteed stable since ES2019, so arrival
      // order within a player survives: the (playerId, arrival) order from
      // ARCHITECTURE.md.
      const sorted = [...pending].sort((a, b) => a.playerId - b.playerId);
      const closedTurn = { turn, commands: sorted };

      turn += 1;
      // Fresh allocation at turn rate (20 Hz) is fine; this is not the sim hot path.
      pending = [];

      return closedTurn;
    },
  };
}
