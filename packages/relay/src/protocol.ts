// Wire contract consumed by both ends (@aom/engine's net layer and apps/server),
// so it lives in a package, not the server app. JSON-shaped plain data only;
// versioned from message one.
import type { Command, MapId } from "@aom/sim";

// v2 added COMMAND_CHEAT, v3 added COMMAND_ADVANCE_AGE, v4 added COMMAND_PRAY,
// v5 added COMMAND_CANCEL_TRAIN, v6 added relic pickup/drop-off, v7 added
// deterministic map selection to the match handshake, v8 added Egyptian heal
// and empower commands, v9 added the ready/go startup barrier, and v10 adds
// garrison/ungarrison orders, v11 adds caravan trade routes, and v12 adds
// Egyptian heal, empower, and animal-conversion orders. Older clients would
// otherwise construct a different world and immediately desync.
export const PROTOCOL_VERSION = 12;

// Omit does not distribute over unions by itself -- this is the standard idiom.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

// The wire carries NEITHER execution time NOR authority - the sequencer assigns the turn,
// the server assigns the playerId; clients assert nothing about either.
export type WireCommand = DistributiveOmit<Command, "tick" | "issuer">;

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
      map: MapId;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "ready";
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
      map: MapId;
      players: PlayerInfo[];
      hashIntervalTicks: number;
    }
  | {
      v: typeof PROTOCOL_VERSION;
      kind: "go";
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
