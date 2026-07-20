import {
  addPlayer,
  createRoom,
  isHost,
  PROTOCOL_VERSION,
  removePlayer,
  startRoom,
  type ClientMessage,
  type PlayerInfo,
  type Room,
  type ServerMessage,
} from "@aom/relay";
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import { roomCodeFromRequest } from "./room-code";

const ROOM_STORAGE_KEY = "room";
const TURN_INTERVAL_MS = 50;
const HASH_INTERVAL_TICKS = 20;

interface SocketData {
  room: string;
  playerId: number;
  name: string;
}

interface StoredRoom {
  code: string;
  seed: number;
  players: PlayerInfo[];
  nextPlayerId: number;
  started: boolean;
}

export class GameRoom extends DurableObject<Env> {
  private readonly ready: Promise<void>;
  private room: Room | null = null;
  private turnTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<StoredRoom>(ROOM_STORAGE_KEY);
      if (stored === undefined) {
        return;
      }

      if (stored.started) {
        // The 20 Hz clock keeps an active room resident. Reaching this branch
        // means the runtime restarted, so turn state can no longer be resumed
        // safely. Reconnection/resync is intentionally parked: fail closed
        // instead of sending a second turn zero and desynchronizing the match.
        for (const socket of ctx.getWebSockets()) {
          socket.close(1012, "match relay restarted");
        }
        await ctx.storage.delete(ROOM_STORAGE_KEY);
        return;
      }

      this.room = restoreRoom(stored);
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }

    const roomCode = roomCodeFromRequest(request);
    if (roomCode === null) {
      return new Response("a valid room query parameter is required", { status: 400 });
    }

    if (this.room === null) {
      this.room = createRoom(roomCode, randomSeed());
      await this.persistRoom();
    } else if (this.room.code !== roomCode) {
      return new Response("room does not match this Durable Object", { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({ room: roomCode, playerId: -1, name: "" } satisfies SocketData);
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.ready;

    const socketData = readSocketData(socket);
    if (this.room === null) {
      this.room = createRoom(socketData.room, randomSeed());
      await this.persistRoom();
    }

    let message: ClientMessage;
    try {
      const decoded = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      message = JSON.parse(decoded) as ClientMessage;
    } catch {
      this.sendError(socket, "invalid JSON");
      return;
    }

    if (message === null || typeof message !== "object") {
      this.sendError(socket, "invalid message");
      return;
    }

    if (message.v !== PROTOCOL_VERSION) {
      this.sendError(socket, "protocol version mismatch");
      return;
    }

    switch (message.kind) {
      case "ping": {
        this.send(socket, { v: PROTOCOL_VERSION, kind: "pong", t: message.t });
        return;
      }

      case "join": {
        if (socketData.playerId !== -1) {
          this.sendError(socket, "connection already joined");
          return;
        }

        if (message.room !== socketData.room || message.room !== this.room.code) {
          this.sendError(socket, "room does not match the WebSocket URL");
          return;
        }

        const joined = addPlayer(this.room, message.name);
        if (joined === null) {
          this.sendError(socket, "room already started");
          return;
        }

        const joinedSocketData: SocketData = {
          room: socketData.room,
          playerId: joined.player.id,
          name: joined.player.name,
        };
        socket.serializeAttachment(joinedSocketData);
        await this.persistRoom();

        this.send(socket, joined.joined);
        this.broadcast(joined.playerJoined, socket);
        return;
      }

      case "start": {
        if (!isHost(this.room, socketData.playerId)) {
          this.sendError(socket, "only the host may start the room");
          return;
        }

        const begin = startRoom(this.room, HASH_INTERVAL_TICKS);
        if (begin === null) {
          this.sendError(socket, "room cannot be started");
          return;
        }

        await this.persistRoom();
        this.broadcast(begin);
        this.startTurnClock();
        return;
      }

      case "commands": {
        if (socketData.playerId === -1) {
          this.sendError(socket, "connection has not joined a room");
          return;
        }

        this.room.sequencer.submit(socketData.playerId, message.commands);
        return;
      }

      case "hash": {
        if (socketData.playerId === -1) {
          this.sendError(socket, "connection has not joined a room");
          return;
        }

        const desync = this.room.hashTracker.report(
          socketData.playerId,
          message.tick,
          message.value,
          this.room.players.map((player) => player.id),
        );
        if (desync !== null) {
          this.broadcast(desync);
        }
        return;
      }
    }
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    await this.disconnect(socket);
    // Compatibility dates on or after 2026-04-07 automatically complete the
    // close handshake after this handler returns.
    void code;
    void reason;
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    console.error("relay WebSocket error", error);
    await this.disconnect(socket);
    socket.close(1011, "relay WebSocket error");
  }

  private startTurnClock(): void {
    if (this.turnTimer !== null) {
      return;
    }

    this.turnTimer = setInterval(() => {
      if (this.room === null || !this.room.started) {
        this.stopTurnClock();
        return;
      }

      const turn = this.room.sequencer.closeTurn();
      this.broadcast({
        v: PROTOCOL_VERSION,
        kind: "turn",
        turn: turn.turn,
        commands: turn.commands,
      });
    }, TURN_INTERVAL_MS);
  }

  private stopTurnClock(): void {
    if (this.turnTimer === null) {
      return;
    }

    clearInterval(this.turnTimer);
    this.turnTimer = null;
  }

  private async disconnect(socket: WebSocket): Promise<void> {
    await this.ready;

    const socketData = readSocketData(socket);
    if (socketData.playerId === -1) {
      if (this.room?.players.length === 0) {
        await this.resetRoom();
      }
      return;
    }

    socket.serializeAttachment({ ...socketData, playerId: -1 });
    if (this.room === null) {
      return;
    }

    const playerWasPresent = this.room.players.some((player) => player.id === socketData.playerId);
    if (!playerWasPresent) {
      return;
    }

    const left = removePlayer(this.room, socketData.playerId);
    this.broadcast(left, socket);

    if (this.room.players.length === 0) {
      await this.resetRoom();
    } else {
      await this.persistRoom();
    }
  }

  private async resetRoom(): Promise<void> {
    this.stopTurnClock();
    this.room = null;
    await this.ctx.storage.delete(ROOM_STORAGE_KEY);
  }

  private async persistRoom(): Promise<void> {
    if (this.room === null) {
      return;
    }

    const stored: StoredRoom = {
      code: this.room.code,
      seed: this.room.seed,
      players: [...this.room.players],
      nextPlayerId: this.room.nextPlayerId,
      started: this.room.started,
    };
    await this.ctx.storage.put(ROOM_STORAGE_KEY, stored);
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    socket.send(JSON.stringify(message));
  }

  private sendError(socket: WebSocket, message: string): void {
    this.send(socket, { v: PROTOCOL_VERSION, kind: "error", message });
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except || socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (readSocketData(socket).playerId !== -1) {
        socket.send(encoded);
      }
    }
  }
}

function readSocketData(socket: WebSocket): SocketData {
  const attachment = socket.deserializeAttachment();
  if (
    attachment !== null &&
    typeof attachment === "object" &&
    "room" in attachment &&
    "playerId" in attachment &&
    "name" in attachment
  ) {
    return attachment as SocketData;
  }

  return { room: "", playerId: -1, name: "" };
}

function restoreRoom(stored: StoredRoom): Room {
  const room = createRoom(stored.code, stored.seed);
  room.players = [...stored.players];
  room.nextPlayerId = stored.nextPlayerId;
  room.started = stored.started;
  return room;
}

function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0]! & 0x7fffffff;
}
