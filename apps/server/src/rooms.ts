import {
  addPlayer,
  createRoom,
  isHost,
  PROTOCOL_VERSION,
  removePlayer,
  startRoom,
  type ClientMessage,
  type Room,
  type ServerMessage,
} from "@aom/relay";

export interface SocketData {
  room: string;
  playerId: number;
  name: string;
}

const rooms = new Map<string, Room>();
const turnTimers = new Map<string, ReturnType<typeof setInterval>>();

export function handleMessage(
  server: Bun.Server<SocketData>,
  ws: Bun.ServerWebSocket<SocketData>,
  raw: string | Buffer,
): void {
  let msg: ClientMessage;

  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as ClientMessage;
  } catch {
    const error: ServerMessage = {
      v: PROTOCOL_VERSION,
      kind: "error",
      message: "invalid JSON",
    };
    ws.send(JSON.stringify(error));
    return;
  }

  if (msg.v !== PROTOCOL_VERSION) {
    const error: ServerMessage = {
      v: PROTOCOL_VERSION,
      kind: "error",
      message: "protocol version mismatch",
    };
    ws.send(JSON.stringify(error));
    return;
  }

  switch (msg.kind) {
    case "ping": {
      ws.send(JSON.stringify({ v: PROTOCOL_VERSION, kind: "pong", t: msg.t }));
      return;
    }

    case "join": {
      let room = rooms.get(msg.room);
      if (!room) {
        room = createRoom(msg.room, (Math.random() * 0x7fffffff) | 0);
        // The server is not determinism-constrained here; the seed only needs to be shared across clients, not reproducible.
        rooms.set(msg.room, room);
      }

      const joined = addPlayer(room, msg.name);
      if (joined === null) {
        const error: ServerMessage = {
          v: PROTOCOL_VERSION,
          kind: "error",
          message: "room already started",
        };
        ws.send(JSON.stringify(error));
        return;
      }

      ws.data.room = msg.room;
      ws.data.playerId = joined.player.id;
      ws.data.name = joined.player.name;

      const roomTopic = topic(msg.room);
      ws.subscribe(roomTopic);
      ws.send(JSON.stringify(joined.joined));
      // ws.publish excludes the sender itself: exactly everyone else. server.publish would include the sender.
      ws.publish(roomTopic, JSON.stringify(joined.playerJoined));
      return;
    }

    case "start": {
      const room = rooms.get(ws.data.room);
      if (!room || !isHost(room, ws.data.playerId)) {
        const error: ServerMessage = {
          v: PROTOCOL_VERSION,
          kind: "error",
          message: "only the host may start the room",
        };
        ws.send(JSON.stringify(error));
        return;
      }

      const begin = startRoom(room, 20);
      if (begin === null) {
        const error: ServerMessage = {
          v: PROTOCOL_VERSION,
          kind: "error",
          message: "room cannot be started",
        };
        ws.send(JSON.stringify(error));
        return;
      }

      const roomTopic = topic(ws.data.room);
      // server.publish includes the host too: everyone gets begin.
      server.publish(roomTopic, JSON.stringify(begin));

      const timer = setInterval(() => {
        const turn = room.sequencer.closeTurn();
        const turnMessage: ServerMessage = {
          v: PROTOCOL_VERSION,
          kind: "turn",
          turn: turn.turn,
          commands: turn.commands,
        };
        // This timer is the lockstep heartbeat: turns flow even when empty; 50ms/20Hz matches TICK_HZ.
        server.publish(roomTopic, JSON.stringify(turnMessage));
      }, 50);
      turnTimers.set(ws.data.room, timer);
      return;
    }

    case "commands": {
      const room = rooms.get(ws.data.room);
      if (!room) {
        const error: ServerMessage = {
          v: PROTOCOL_VERSION,
          kind: "error",
          message: "room not found",
        };
        ws.send(JSON.stringify(error));
        return;
      }

      room.sequencer.submit(ws.data.playerId, msg.commands);
      return;
    }

    case "hash": {
      const room = rooms.get(ws.data.room);
      if (!room) {
        const error: ServerMessage = {
          v: PROTOCOL_VERSION,
          kind: "error",
          message: "room not found",
        };
        ws.send(JSON.stringify(error));
        return;
      }

      const desync = room.hashTracker.report(
        ws.data.playerId,
        msg.tick,
        msg.value,
        room.players.map((p) => p.id),
      );
      if (desync) {
        // Broadcast to everyone INCLUDING the reporter: all clients freeze together.
        server.publish(topic(ws.data.room), JSON.stringify(desync));
      }
      return;
    }
  }
}

export function handleClose(
  server: Bun.Server<SocketData>,
  ws: Bun.ServerWebSocket<SocketData>,
): void {
  if (!ws.data.room) {
    return;
  }

  const room = rooms.get(ws.data.room);
  if (!room) {
    return;
  }

  const left = removePlayer(room, ws.data.playerId);
  server.publish(topic(ws.data.room), JSON.stringify(left));

  if (room.players.length === 0) {
    const timer = turnTimers.get(ws.data.room);
    if (timer) {
      clearInterval(timer);
    }
    // Rooms are ephemeral; persistence is an apps/server-later concern, never a relay concern.
    rooms.delete(ws.data.room);
    turnTimers.delete(ws.data.room);
  }
}

function topic(room: string): string {
  return "room:" + room;
}
