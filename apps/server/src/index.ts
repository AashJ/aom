import { PROTOCOL_VERSION } from "@aom/relay";
import { Hono } from "hono";
import { GameRoom } from "./game-room";
import { roomCodeFromRequest } from "./room-code";

export interface Env {
  GAMES: DurableObjectNamespace<GameRoom>;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => {
  return c.json({ ok: true, version: PROTOCOL_VERSION });
});

app.get("/ws", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.text("expected a WebSocket upgrade", 426);
  }

  const roomCode = roomCodeFromRequest(c.req.raw);
  if (roomCode === null) {
    return c.text("a valid room query parameter is required", 400);
  }

  const room = c.env.GAMES.get(c.env.GAMES.idFromName(roomCode));
  return room.fetch(c.req.raw);
});

export { GameRoom };
export default app;
