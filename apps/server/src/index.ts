import { PROTOCOL_VERSION } from "@aom/relay";
import { Hono } from "hono";
import { handleClose, handleMessage, type SocketData } from "./rooms";

const app = new Hono();

app.get("/health", (c) => {
  // Hono owns all HTTP; this surface grows later: saves, accounts, lobby lists, without touching the socket path.
  return c.json({ ok: true, version: PROTOCOL_VERSION });
});

const server: Bun.Server<SocketData> = Bun.serve<SocketData>({
  port: Number(process.env.PORT ?? 3002),
  fetch(req, server) {
    if (
      new URL(req.url).pathname === "/ws" &&
      server.upgrade(req, { data: { room: "", playerId: -1, name: "" } })
    ) {
      return;
    }

    return app.fetch(req);
  },
  websocket: {
    message: (ws, raw) => handleMessage(server, ws, raw),
    close: (ws) => handleClose(server, ws),
  },
});

console.log(`relay listening on :${server.port}`);
