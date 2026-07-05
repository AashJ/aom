import {
  createTurnBuffer,
  PROTOCOL_VERSION,
  type ClientMessage,
  type PlayerInfo,
  type ServerMessage,
  type TurnBuffer,
} from "@aom/relay";
import {
  COMMAND_ATTACK,
  COMMAND_BUILD,
  COMMAND_GATHER,
  COMMAND_MOVE,
  COMMAND_PLACE,
  COMMAND_STOP,
} from "@aom/sim";
import type { CommandSink } from "./sink";

export type NetEvent =
  | { kind: "roster"; players: PlayerInfo[]; selfId: number }
  | { kind: "begun" }
  | { kind: "stalled"; stalled: boolean }
  | { kind: "desynced"; tick: number; reports: { playerId: number; value: number }[] }
  | { kind: "closed" };

export interface BeginInfo {
  seed: number;
  players: PlayerInfo[];
  hashIntervalTicks: number;
  selfId: number;
}

export interface NetSession {
  readonly sink: CommandSink;
  readonly buffer: TurnBuffer;
  readonly begin: Promise<BeginInfo>;
  isHost(): boolean;
  startMatch(): void;
  reportHash(tick: number, value: number): void;
  isDesynced(): boolean;
  pingMs(): number;
  onEvent(cb: (e: NetEvent) => void): () => void;
  notifyStalled(stalled: boolean): void;
  close(): void;
}

export function createRelaySink(send: (message: ClientMessage) => void): CommandSink {
  return {
    submitMove(unitIds: number[], targetX: number, targetZ: number): void {
      // No tick stamping here: the sequencer's turn assignment IS the execution time, unlike the loopback sink.
      send({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_MOVE, unitIds, targetX, targetZ }],
      });
    },

    submitStop(unitIds: number[]): void {
      // No tick stamping here: the sequencer's turn assignment IS the execution time, unlike the loopback sink.
      send({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_STOP, unitIds }],
      });
    },

    submitAttack(unitIds: number[], targetId: number): void {
      // No tick stamping here: the sequencer's turn assignment IS the execution time, unlike the loopback sink.
      send({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_ATTACK, unitIds, targetId }],
      });
    },

    submitGather(unitIds: number[], targetId: number): void {
      // No tick stamping here: the sequencer's turn assignment IS the execution time, unlike the loopback sink.
      send({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_GATHER, unitIds, targetId }],
      });
    },

    submitBuild(unitIds: number[], targetId: number): void {
      // No tick stamping here: the sequencer's turn assignment IS the execution time, unlike the loopback sink.
      send({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_BUILD, unitIds, targetId }],
      });
    },

    submitPlace(buildingType: number, tileX: number, tileZ: number): void {
      // No tick stamping here: the sequencer's turn assignment IS the execution time, unlike the loopback sink.
      send({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_PLACE, buildingType, tileX, tileZ }],
      });
    },
  };
}

export function connectToRelay(url: string, room: string, name: string): NetSession {
  const ws = new WebSocket(url);
  const subscribers = new Set<(e: NetEvent) => void>();
  const buffer = createTurnBuffer();
  let roster: PlayerInfo[] = [];
  let selfId = -1;
  let begun = false;
  let closed = false;
  let pingMs = 0;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let closedIntentionally = false;
  let desynced = false;
  let lastStalled: boolean | null = null;
  let resolveBegin!: (info: BeginInfo) => void;

  const begin = new Promise<BeginInfo>((resolve) => {
    resolveBegin = resolve;
  });

  function send(message: ClientMessage): void {
    ws.send(JSON.stringify(message));
  }

  function emit(event: NetEvent): void {
    // Events fire synchronously; subscribers are chrome (React lobby), so no allocation discipline here.
    for (const cb of subscribers) {
      cb(event);
    }
  }

  function emitRoster(): void {
    emit({ kind: "roster", players: roster, selfId });
  }

  function emitClosed(): void {
    if (closed) {
      return;
    }

    closed = true;
    emit({ kind: "closed" });
  }

  ws.addEventListener("open", () => {
    send({ v: PROTOCOL_VERSION, kind: "join", room, name });
    pingInterval = setInterval(() => {
      send({ v: PROTOCOL_VERSION, kind: "ping", t: performance.now() });
    }, 2000);
  });

  ws.addEventListener("message", (event: MessageEvent) => {
    if (typeof event.data !== "string") {
      console.warn("Ignoring non-text relay message.");
      return;
    }

    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data) as ServerMessage;
    } catch (error) {
      console.warn("Ignoring invalid relay message.", error);
      return;
    }

    switch (msg.kind) {
      case "joined":
        selfId = msg.playerId;
        roster = [...msg.players];
        emitRoster();
        return;

      case "playerJoined":
        roster = [...roster.filter((player) => player.id !== msg.player.id), msg.player];
        emitRoster();
        return;

      case "playerLeft":
        roster = roster.filter((player) => player.id !== msg.playerId);
        emitRoster();
        return;

      case "begin":
        if (begun) {
          return;
        }

        begun = true;
        resolveBegin({
          seed: msg.seed,
          players: msg.players,
          hashIntervalTicks: msg.hashIntervalTicks,
          selfId,
        });
        emit({ kind: "begun" });
        return;

      case "turn":
        buffer.push(msg.turn, msg.commands);
        return;

      case "desync":
        // The game loop checks isDesynced and freezes — all clients receive the same broadcast and freeze at the same gate.
        desynced = true;
        emit({ kind: "desynced", tick: msg.tick, reports: msg.reports });
        return;

      case "pong":
        pingMs = Math.round(performance.now() - msg.t);
        return;

      case "error":
        console.warn("Relay error:", msg.message);
        return;

      default:
        return;
    }
  });

  ws.addEventListener("close", () => {
    if (pingInterval !== null) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    if (!closedIntentionally) {
      emitClosed();
    }
  });
  ws.addEventListener("error", emitClosed);

  return {
    sink: createRelaySink(send),
    buffer,
    begin,

    isHost(): boolean {
      // Mirrors the server's rule: the current lowest player id is host.
      let lowestPlayerId = Number.POSITIVE_INFINITY;
      for (const player of roster) {
        lowestPlayerId = Math.min(lowestPlayerId, player.id);
      }

      return selfId === lowestPlayerId;
    },

    startMatch(): void {
      send({ v: PROTOCOL_VERSION, kind: "start" });
    },

    reportHash(tick: number, value: number): void {
      send({ v: PROTOCOL_VERSION, kind: "hash", tick, value });
    },

    isDesynced(): boolean {
      return desynced;
    },

    pingMs(): number {
      return pingMs;
    },

    onEvent(cb: (e: NetEvent) => void): () => void {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },

    notifyStalled(stalled: boolean): void {
      if (lastStalled === stalled) {
        return;
      }

      lastStalled = stalled;
      emit({ kind: "stalled", stalled });
    },

    close(): void {
      // An unmount is not a failure; the closed event is for the OTHER kind of goodbye.
      closedIntentionally = true;
      if (pingInterval !== null) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      ws.close();
    },
  };
}
