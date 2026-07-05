// Wire contract consumed by both ends (@aom/engine's net layer and apps/server),
// so it lives in a package, not the server app. JSON-shaped plain data only;
// versioned from message one.
import type { Command } from "@aom/sim";

export const PROTOCOL_VERSION = 1;

// Omit does not distribute over unions by itself -- this is the standard idiom.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// Commands cross the wire WITHOUT ticks: execution time is the turn number the
// sequencer assigns; no client-chosen execution time is ever trusted.
export type WireCommand = DistributiveOmit<Command, "tick">;

export interface PlayerInfo {
  id: number;
  name: string;
}

export interface PlayerCommand {
  playerId: number;
  command: WireCommand;
}

export type ClientMessage =
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "join";
      room: string;
      name: string;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "start";
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "commands";
      commands: WireCommand[];
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "hash";
      tick: number;
      value: number;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "ping";
      // t is an opaque client timestamp echoed verbatim; the server never interprets it; RTT is computed entirely client-side.
      t: number;
    };

export type ServerMessage =
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "joined";
      playerId: number;
      players: PlayerInfo[];
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "playerJoined";
      player: PlayerInfo;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "playerLeft";
      playerId: number;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "begin";
      seed: number;
      players: PlayerInfo[];
      hashIntervalTicks: number;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "turn";
      turn: number;
      commands: PlayerCommand[];
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "desync";
      tick: number;
      reports: { playerId: number; value: number }[];
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "pong";
      // t is an opaque client timestamp echoed verbatim; the server never interprets it; RTT is computed entirely client-side.
      t: number;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "error";
      message: string;
    };
