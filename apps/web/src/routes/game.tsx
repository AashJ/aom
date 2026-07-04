import {
  WebGPUUnsupportedError,
  createGame,
  isWebGPUSupported,
  type GameHandle,
} from "@aom/engine";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/game")({
  component: GameComponent,
});

type GameError = "startup" | "unsupported";

function GameComponent() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [error, setError] = useState<GameError | null>(() =>
    isWebGPUSupported() ? null : "unsupported",
  );

  useEffect(() => {
    if (!isWebGPUSupported()) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let disposed = false;

    void createGame(canvas)
      .then((game) => {
        if (disposed) {
          game.dispose();
          return;
        }

        gameRef.current = game;
        game.start();
      })
      .catch((cause: unknown) => {
        if (disposed) {
          return;
        }

        if (cause instanceof WebGPUUnsupportedError) {
          setError("unsupported");
          return;
        }

        console.error("Unable to start the game renderer.", cause);
        setError("startup");
      });

    return () => {
      disposed = true;
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  if (error) {
    return <GameErrorScreen error={error} />;
  }

  return (
    <main className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="block h-dvh w-dvw" />
    </main>
  );
}

function GameErrorScreen({ error }: { error: GameError }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-white">
      <section className="max-w-lg">
        <h1 className="text-2xl font-semibold">
          {error === "unsupported" ? "WebGPU is required" : "Renderer startup failed"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/80">
          AoM Online requires WebGPU. Use Chrome or Edge, Safari 26+, or a recent Firefox release.
        </p>
      </section>
    </main>
  );
}
