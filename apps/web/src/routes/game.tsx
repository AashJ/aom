import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  createGame,
  isWebGPUSupported,
  WebGPUUnsupportedError,
  type GameHandle,
} from "@aom/engine";

export const Route = createFileRoute("/game")({
  component: GameComponent,
});

function GameComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<"unsupported" | "startup" | null>(null);

  useEffect(() => {
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
  }, []);

  if (error) {
    return <GameErrorScreen kind={error} />;
  }

  return <canvas ref={canvasRef} className="block h-dvh w-screen" />;
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
