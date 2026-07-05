import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  connectToRelay,
  createGame,
  isWebGPUSupported,
  WebGPUUnsupportedError,
  type GameHandle,
  type NetSession,
  type PlayerInfo,
} from "@aom/engine";
import { PerfHud } from "@/components/perf-hud";

const RELAY_URL = import.meta.env.VITE_RELAY_URL ?? "ws://localhost:3002/ws"; // Dev default; production config arrives with deployment.

interface NetState {
  players: PlayerInfo[];
  selfId: number;
  begun: boolean;
  stalled: boolean;
  desyncTick: number | null;
  closed: boolean;
}

interface GameSearch {
  room?: string;
  name?: string;
}

const initialNetState: NetState = {
  players: [],
  selfId: -1,
  begun: false,
  stalled: false,
  desyncTick: null,
  closed: false,
};

export const Route = createFileRoute("/game")({
  validateSearch: (search): GameSearch => ({
    room: typeof search.room === "string" ? search.room : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
  }),
  component: GameComponent,
});

function GameComponent() {
  const { room, name } = Route.useSearch();
  const playerName = normalizePlayerName(name);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<NetSession | null>(null);
  const begunSessionRef = useRef<NetSession | null>(null);
  const [error, setError] = useState<"unsupported" | "startup" | null>(null);
  const [game, setGame] = useState<GameHandle | null>(null);
  const [net, setNet] = useState<NetState>(initialNetState);

  useEffect(() => {
    if (room !== undefined) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (!isWebGPUSupported()) {
      setError("unsupported");
      return;
    }

    let handle: GameHandle | null = null;
    let cancelled = false;

    void createGame(canvas)
      .then((game) => {
        if (cancelled) {
          game.dispose();
          return;
        }

        handle = game;
        game.start();
        setGame(game);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof WebGPUUnsupportedError ? "unsupported" : "startup");
          console.error(err);
        }
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [room]);

  useEffect(() => {
    if (room === undefined || playerName === null) {
      sessionRef.current = null;
      begunSessionRef.current = null;
      setNet(initialNetState);
      return;
    }

    setNet(initialNetState);

    // StrictMode's double-mount means join-leave-rejoin against the server — playerIds are not reused, so dev may show a higher id; harmless, noted.
    const session = connectToRelay(RELAY_URL, room, playerName);
    sessionRef.current = session;
    begunSessionRef.current = null;

    const unsubscribe = session.onEvent((event) => {
      switch (event.kind) {
        case "roster":
          setNet((current) => ({
            ...current,
            players: event.players,
            selfId: event.selfId,
          }));
          return;

        case "begun":
          begunSessionRef.current = session;
          setNet((current) => ({ ...current, begun: true }));
          return;

        case "stalled":
          setNet((current) => ({ ...current, stalled: event.stalled }));
          return;

        case "desynced":
          setNet((current) => ({ ...current, desyncTick: event.tick }));
          return;

        case "closed":
          setNet((current) => ({ ...current, closed: true }));
          return;
      }
    });

    return () => {
      unsubscribe();
      session.close();

      if (sessionRef.current === session) {
        sessionRef.current = null;
      }

      if (begunSessionRef.current === session) {
        begunSessionRef.current = null;
      }
    };
  }, [room, playerName]);

  useEffect(() => {
    if (room === undefined || !net.begun || begunSessionRef.current !== sessionRef.current) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (!isWebGPUSupported()) {
      setError("unsupported");
      return;
    }

    let handle: GameHandle | null = null;
    let cancelled = false;

    void createGame(canvas, { session: sessionRef.current! })
      .then((game) => {
        if (cancelled) {
          game.dispose();
          return;
        }

        handle = game;
        game.start();
        setGame(game);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof WebGPUUnsupportedError ? "unsupported" : "startup");
          console.error(err);
        }
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, [room, net.begun]);

  if (error) {
    return <GameErrorScreen kind={error} />;
  }

  if (room !== undefined && playerName === null) {
    return <JoinRoomScreen room={room} />;
  }

  if (room !== undefined && net.closed && !net.begun) {
    return (
      <LobbyScreen
        room={room}
        players={net.players}
        selfId={net.selfId}
        isHost={sessionRef.current?.isHost() ?? false}
        onStart={() => sessionRef.current?.startMatch()}
        closed={net.closed}
      />
    );
  }

  if (room !== undefined && !net.begun) {
    return (
      <LobbyScreen
        room={room}
        players={net.players}
        selfId={net.selfId}
        isHost={sessionRef.current?.isHost() ?? false}
        onStart={() => sessionRef.current?.startMatch()}
        closed={net.closed}
      />
    );
  }

  return (
    <div className="relative h-dvh w-screen">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <PerfHud game={game} />
      {net.desyncTick !== null && (
        <StatusPill text={`Desync detected at tick ${net.desyncTick} — match halted`} />
      )}
      {room !== undefined && net.desyncTick === null && net.stalled && (
        <StatusPill text="Waiting for players…" />
      )}
      {/* The tick gate already froze the sim; the pill just says why. */}
      {room !== undefined && net.closed && <StatusPill text="Connection lost — match paused" />}
    </div>
  );
}

function JoinRoomScreen({ room }: { room: string }) {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");
  const canJoin = normalizePlayerName(playerName) !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = normalizePlayerName(playerName);

    if (nextName === null) {
      return;
    }

    void navigate({
      to: "/game",
      search: {
        room,
        name: nextName,
      },
    });
  }

  return (
    <main className="flex h-dvh items-center justify-center bg-[#0d121a] p-6 text-slate-100">
      <form className="w-full max-w-sm text-center" onSubmit={handleSubmit}>
        <h1 className="text-2xl font-semibold tracking-normal text-balance">Join {room}</h1>
        <label className="mt-6 block text-left text-sm font-medium text-slate-300">
          Name
          <input
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            className="mt-2 h-9 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-300/30"
            maxLength={24}
            autoComplete="nickname"
            autoFocus
          />
        </label>
        <button
          type="submit"
          disabled={!canJoin}
          className="mt-4 w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white outline-none hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:pointer-events-none disabled:opacity-50"
        >
          Join
        </button>
      </form>
    </main>
  );
}

function LobbyScreen({
  room,
  players,
  selfId,
  isHost,
  onStart,
  closed,
}: {
  room: string;
  players: PlayerInfo[];
  selfId: number;
  isHost: boolean;
  onStart: () => void;
  closed: boolean;
}) {
  const hostId = players.reduce(
    (lowest, player) => Math.min(lowest, player.id),
    Number.POSITIVE_INFINITY,
  );

  return (
    <main className="flex h-dvh items-center justify-center bg-[#0d121a] p-6 text-slate-100">
      <section className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-normal text-balance">Lobby — {room}</h1>

        <ul className="mt-6 divide-y divide-white/10 text-left" role="list">
          {players.map((player) => (
            <li key={player.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0 truncate text-base text-slate-100 sm:text-sm">
                {player.name}
              </div>
              <div className="shrink-0 text-base text-slate-400 sm:text-sm">
                {player.id === selfId ? " (you)" : ""}
                {player.id === hostId ? " (host)" : ""}
              </div>
            </li>
          ))}
        </ul>

        {closed ? (
          <p className="mt-6 text-base text-red-300 sm:text-sm">Connection lost.</p>
        ) : isHost ? (
          <button
            type="button"
            className="mt-6 rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white outline-none hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            onClick={onStart}
          >
            Start
          </button>
        ) : (
          <p className="mt-6 text-base text-slate-300 sm:text-sm">Waiting for the host to start…</p>
        )}
      </section>
    </main>
  );
}

function StatusPill({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-slate-100 -translate-x-1/2">
      {text}
    </div>
  );
}

function GameErrorScreen({ kind }: { kind: "unsupported" | "startup" }) {
  const heading = kind === "unsupported" ? "WebGPU not supported" : "Failed to start";
  const body =
    kind === "unsupported"
      ? "Use Chrome or Edge, Safari 26+, or a recent Firefox release."
      : "Refresh the page and check the browser console for details.";

  return (
    <main className="flex h-dvh items-center justify-center bg-[#0d121a] px-6 text-slate-100">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-normal">{heading}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
      </section>
    </main>
  );
}

function normalizePlayerName(name: string | undefined) {
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
