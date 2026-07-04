import { useEffect, useRef, useState } from "react";
import type { GameHandle } from "@aom/engine";

export function PerfHud({ game }: { game: GameHandle | null }) {
  const [open, setOpen] = useState(false);
  const readoutRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open || !game) {
      return;
    }

    const el = readoutRef.current;

    if (!el) {
      return;
    }

    return game.onStats((stats) => {
      el.textContent = [
        "fps  " + stats.fps.toFixed(0),
        "avg  " + stats.frameMsAvg.toFixed(2) + " ms",
        "p99  " + stats.frameMsP99.toFixed(2) + " ms",
        "gpu  " + (stats.gpuMs > 0 ? stats.gpuMs.toFixed(2) + " ms" : "n/a"),
        "draw " + stats.drawCalls,
        "inst " + stats.instances,
        "heap " + (stats.heapMB > 0 ? stats.heapMB.toFixed(1) + " MB" : "n/a"),
        "chnk " + stats.chunksVisible + "/" + stats.chunksTotal,
      ].join("\n");
    });
  }, [open, game]);

  return (
    <div className="absolute top-3 right-3 flex flex-col items-end gap-2 font-mono text-xs text-slate-200 select-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded bg-black/50 px-2 py-1 hover:bg-black/70"
      >
        perf
      </button>
      {open ? (
        <pre ref={readoutRef} className="min-w-36 rounded bg-black/50 p-2 leading-5" />
      ) : null}
    </div>
  );
}
