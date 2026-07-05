// Desync detection per ARCHITECTURE.md M4: clients report hashWorld every
// hashIntervalTicks; the tracker compares once every ACTIVE player has
// reported a tick. Detection only: recovery is parked; a desync in M4 is a bug
// to fix, not an event to survive.
import { PROTOCOL_VERSION, type ServerMessage } from "./protocol";

export interface HashTracker {
  report(
    playerId: number,
    tick: number,
    value: number,
    activePlayerIds: number[],
  ): ServerMessage | null;
}

export function createHashTracker(): HashTracker {
  const pending = new Map<number, Map<number, number>>();

  return {
    report(playerId, tick, value, activePlayerIds) {
      let inner = pending.get(tick);
      if (!inner) {
        inner = new Map<number, number>();
        pending.set(tick, inner);
      }
      inner.set(playerId, value);

      for (const pendingTick of pending.keys()) {
        // Bounds memory when a player stops reporting, e.g. a leaver whose ticks
        // can now never complete; 200 ticks = 10 s of grace.
        if (pendingTick < tick - 200) {
          pending.delete(pendingTick);
        }
      }

      // Resolve against the CURRENT roster, not the one from when this tick was
      // recorded; the roster shrinks when players leave.
      for (const activePlayerId of activePlayerIds) {
        if (!inner.has(activePlayerId)) {
          return null;
        }
      }

      const reports = activePlayerIds.map((id) => ({
        playerId: id,
        value: inner.get(id)!,
      }));
      pending.delete(tick);

      const first = reports[0]?.value;
      const matches = reports.every((report) => report.value === first);
      if (matches) {
        // Silence is the healthy steady state: matching hashes generate zero traffic.
        return null;
      }

      return {
        v: PROTOCOL_VERSION,
        kind: "desync",
        tick,
        reports,
      };
    },
  };
}
