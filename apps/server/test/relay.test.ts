import { COMMAND_STOP } from "@aom/sim";
import { PROTOCOL_VERSION, type ServerMessage } from "@aom/relay";
import { evictDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

interface TestSocket {
  socket: WebSocket;
  nextMessage(): Promise<ServerMessage>;
}

describe("Cloudflare relay Worker", () => {
  test("reports protocol health and rejects unrouteable sockets", async () => {
    const health = await exports.default.fetch(new Request("https://relay.example/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, version: PROTOCOL_VERSION });

    const missingRoom = await exports.default.fetch(
      new Request("https://relay.example/ws", { headers: { Upgrade: "websocket" } }),
    );
    expect(missingRoom.status).toBe(400);
  });

  test("keeps a lobby through hibernation and sequences a per-room match", async () => {
    const roomCode = "duel-worker-test";
    const room = env.GAMES.get(env.GAMES.idFromName(roomCode));
    const host = await connect(room, roomCode);

    host.socket.send(
      JSON.stringify({ v: PROTOCOL_VERSION, kind: "join", room: roomCode, name: "host" }),
    );
    expect(await host.nextMessage()).toMatchObject({
      kind: "joined",
      playerId: 0,
      players: [{ id: 0, name: "host" }],
    });

    await evictDurableObject(room);

    host.socket.send(JSON.stringify({ v: PROTOCOL_VERSION, kind: "ping", t: 42 }));
    expect(await host.nextMessage()).toEqual({ v: PROTOCOL_VERSION, kind: "pong", t: 42 });

    const guest = await connect(room, roomCode);
    guest.socket.send(
      JSON.stringify({ v: PROTOCOL_VERSION, kind: "join", room: roomCode, name: "guest" }),
    );

    expect(await host.nextMessage()).toMatchObject({
      kind: "playerJoined",
      player: { id: 1, name: "guest" },
    });
    expect(await guest.nextMessage()).toMatchObject({
      kind: "joined",
      playerId: 1,
      players: [
        { id: 0, name: "host" },
        { id: 1, name: "guest" },
      ],
    });

    host.socket.send(JSON.stringify({ v: PROTOCOL_VERSION, kind: "start" }));
    const [hostBegin, guestBegin] = await Promise.all([host.nextMessage(), guest.nextMessage()]);
    expect(hostBegin).toMatchObject({ kind: "begin", hashIntervalTicks: 20 });
    expect(guestBegin).toEqual(hostBegin);

    host.socket.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        kind: "commands",
        commands: [{ type: COMMAND_STOP, unitIds: [7] }],
      }),
    );

    const [hostTurn, guestTurn] = await Promise.all([host.nextMessage(), guest.nextMessage()]);
    expect(hostTurn).toEqual({
      v: PROTOCOL_VERSION,
      kind: "turn",
      turn: 0,
      commands: [{ playerId: 0, command: { type: COMMAND_STOP, unitIds: [7] } }],
    });
    expect(guestTurn).toEqual(hostTurn);

    host.socket.close(1000, "test complete");
    guest.socket.close(1000, "test complete");
  });

  test("requires the join message to match the routed room", async () => {
    const roomCode = "duel-route-test";
    const room = env.GAMES.get(env.GAMES.idFromName(roomCode));
    const client = await connect(room, roomCode);

    client.socket.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        kind: "join",
        room: "duel-other-room",
        name: "wanderer",
      }),
    );

    expect(await client.nextMessage()).toEqual({
      v: PROTOCOL_VERSION,
      kind: "error",
      message: "room does not match the WebSocket URL",
    });
    client.socket.close(1000, "test complete");
  });
});

async function connect(room: DurableObjectStub, roomCode: string): Promise<TestSocket> {
  const response = await room.fetch(
    `https://relay.example/ws?room=${encodeURIComponent(roomCode)}`,
    { headers: { Upgrade: "websocket" } },
  );
  const socket = response.webSocket;
  if (socket === null) {
    throw new Error("expected a WebSocket response");
  }
  socket.accept();

  const queued: ServerMessage[] = [];
  const waiting: Array<(message: ServerMessage) => void> = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as ServerMessage;
    const resolve = waiting.shift();
    if (resolve === undefined) {
      queued.push(message);
    } else {
      resolve(message);
    }
  });

  return {
    socket,
    nextMessage() {
      const message = queued.shift();
      if (message !== undefined) {
        return Promise.resolve(message);
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
  };
}
